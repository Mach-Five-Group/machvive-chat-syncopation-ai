import { createRecord } from './record.js';

/**
 * An ordered list of records, and the only thing allowed to mutate it.
 *
 * Every change is announced on the bus, so components never poll and never hold
 * a private copy that can drift from what was actually said.
 */
export class Conversation {
  #records = [];
  #bus;
  #max;

  constructor({ bus, maxTurns = 200, id } = {}) {
    this.#bus = bus;
    this.#max = maxTurns;
    this.id = id ?? `c-${Date.now().toString(36)}`;
  }

  get records() { return [...this.#records]; }
  get length() { return this.#records.length; }
  get last() { return this.#records.at(-1) ?? null; }

  add(input) {
    const record = input?.id ? input : createRecord(input);
    this.#records.push(record);
    // Oldest-first trim: the recent turns are the ones a reader needs.
    if (this.#records.length > this.#max) this.#records.splice(0, this.#records.length - this.#max);
    this.#bus?.emit('record:added', record);
    return record;
  }

  /** Streaming appends to the open turn rather than adding a new one. */
  append(id, chunk) {
    const record = this.#records.find((r) => r.id === id);
    if (!record) return null;
    record.text += chunk;
    this.#bus?.emit('record:appended', { id, chunk, record });
    return record;
  }

  update(id, patch) {
    const record = this.#records.find((r) => r.id === id);
    if (!record) return null;
    Object.assign(record, patch);
    this.#bus?.emit('record:updated', record);
    return record;
  }

  clear() {
    this.#records = [];
    this.#bus?.emit('conversation:cleared', { id: this.id });
  }

  toJSON() { return { id: this.id, records: this.#records }; }
}
