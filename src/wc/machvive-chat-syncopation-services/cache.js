/**
 * Durable storage for conversations.
 *
 * IndexedDB, not localStorage: a transcript grows without bound, and
 * localStorage is a synchronous ~5 MB cliff that fails at exactly the point the
 * conversation got interesting. Every method degrades to memory when IndexedDB
 * is unavailable (private mode, disabled storage, a plain Node test) rather than
 * throwing, because losing history must never break the surface.
 */
const DB_NAME = 'machvive-chat-syncopation';
const STORE = 'conversations';
const DB_VERSION = 1;

export class Cache {
  #dbPromise = null;
  #memory = new Map();

  get available() { return Boolean(globalThis.indexedDB); }

  #db() {
    if (!this.available) return Promise.resolve(null);
    this.#dbPromise ??= new Promise((resolve) => {
      let req;
      try { req = globalThis.indexedDB.open(DB_NAME, DB_VERSION); } catch { return resolve(null); }
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE, { keyPath: 'id' });
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = req.onblocked = () => resolve(null);
    });
    return this.#dbPromise;
  }

  async #tx(mode, run) {
    const db = await this.#db();
    if (!db) return null;
    return new Promise((resolve) => {
      let tx;
      try { tx = db.transaction(STORE, mode); } catch { return resolve(null); }
      const req = run(tx.objectStore(STORE));
      tx.oncomplete = () => resolve(req ? req.result : null);
      tx.onerror = tx.onabort = () => resolve(null);
    });
  }

  async put(conversation) {
    this.#memory.set(conversation.id, conversation);
    await this.#tx('readwrite', (s) => s.put(conversation));
    return conversation;
  }

  async get(id) {
    const stored = await this.#tx('readonly', (s) => s.get(id));
    return stored ?? this.#memory.get(id) ?? null;
  }

  async list() {
    const stored = await this.#tx('readonly', (s) => s.getAll());
    return stored?.length ? stored : [...this.#memory.values()];
  }

  async remove(id) {
    this.#memory.delete(id);
    await this.#tx('readwrite', (s) => s.delete(id));
  }

  /** The user's data is theirs: deleting it must actually delete it. */
  async clear() {
    this.#memory.clear();
    await this.#tx('readwrite', (s) => s.clear());
  }
}
