/**
 * The bus every component talks over.
 *
 * Deliberately not an EventTarget subclass. EventTarget binds you to whichever
 * realm supplied the global, and dispatching an event built in another realm
 * throws — which surfaces as a component failure rather than a plumbing one.
 * A plain listener set is realm-free and works in a worker or in plain Node.
 */
export class PubSub {
  #topics = new Map();

  /** @returns {() => void} unsubscribe */
  on(topic, handler) {
    if (typeof handler !== 'function') return () => {};
    const set = this.#topics.get(topic) ?? new Set();
    set.add(handler);
    this.#topics.set(topic, set);
    return () => set.delete(handler);
  }

  once(topic, handler) {
    const off = this.on(topic, (payload) => { off(); handler(payload); });
    return off;
  }

  /**
   * A subscriber that throws must not take down the publisher or its siblings —
   * a chat surface has many independent listeners and one bad render should not
   * silence the rest.
   */
  emit(topic, payload) {
    for (const handler of this.#topics.get(topic) ?? []) {
      try { handler(payload); } catch (err) { console.warn(`[syncopation] "${topic}" subscriber failed:`, err); }
    }
    for (const handler of this.#topics.get('*') ?? []) {
      try { handler({ topic, payload }); } catch { /* as above */ }
    }
  }

  get topics() { return [...this.#topics.keys()]; }
}
