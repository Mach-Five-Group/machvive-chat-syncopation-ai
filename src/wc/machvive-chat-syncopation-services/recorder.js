/**
 * Bus recording and replay.
 *
 * Subscribes to the wildcard topic and captures every emission as plain,
 * JSON-serializable entries — `{ seq, at, topic, payload }`. The data model is
 * the feature: a recording can be exported, stored, imported, and replayed
 * without any UI existing yet. The inspector stays a live dev view; this is
 * the durable artifact.
 *
 * Two invariants keep recordings honest:
 *  - Payloads are snapshotted at capture time (structuredClone with a JSON
 *    fallback), so a record object that mutates later — a streaming turn
 *    appending chunks — does not rewrite history retroactively.
 *  - The daemon's error topic carries `{ error: String, name }`, never the
 *    live Error, so the whole stream survives JSON round-tripping.
 */
export class Recorder {
  #bus;
  #off = null;
  #entries = [];
  #seq = 0;
  #recording = false;

  constructor(bus) {
    this.#bus = bus;
  }

  get recording() { return this.#recording; }
  get entries() { return this.#entries.map((e) => ({ ...e })); }
  get length() { return this.#entries.length; }

  /** Start (or resume) capturing. Idempotent. */
  start() {
    if (this.#recording) return this;
    this.#recording = true;
    this.#off = this.#bus.on('*', ({ topic, payload }) => {
      this.#entries.push({ seq: this.#seq++, at: new Date().toISOString(), topic, payload: snapshot(payload) });
    });
    return this;
  }

  /** Stop capturing; entries are kept. */
  stop() {
    this.#off?.();
    this.#off = null;
    this.#recording = false;
    return this;
  }

  /** Drop captured entries (and stop). */
  clear() {
    this.stop();
    this.#entries = [];
    this.#seq = 0;
    return this;
  }

  /** Serializes the recording. Pure data — no functions, no live refs. */
  toJSON() {
    return { format: 'mcs-recording@1', exportedAt: new Date().toISOString(), entries: this.entries };
  }

  /** JSON string form of toJSON(). */
  export() { return JSON.stringify(this.toJSON(), null, 2); }

  /**
   * Loads a previously exported recording. Accepts the object form or its JSON
   * string. Throws on anything that does not look like a recording — replaying
   * arbitrary data onto a live bus would be worse than failing loudly.
   */
  import(data) {
    const parsed = typeof data === 'string' ? JSON.parse(data) : data;
    if (parsed?.format !== 'mcs-recording@1' || !Array.isArray(parsed.entries)) {
      throw new TypeError('not a syncopation recording (expected format "mcs-recording@1")');
    }
    this.stop();
    this.#entries = parsed.entries.map((e, i) => ({ seq: i, at: e.at, topic: e.topic, payload: e.payload }));
    this.#seq = this.#entries.length;
    return this;
  }

  /**
   * Re-emits the captured events onto the bus in order. Components re-react
   * exactly as they did live — replay is a bus phenomenon, not a state hack.
   *
   * @param {{ pace?: 'instant' | 'realtime' }} opts realtime preserves the
   *   original inter-event delays; instant (default) fires them back-to-back.
   */
  async replay({ pace = 'instant' } = {}) {
    const wasRecording = this.#recording;
    if (wasRecording) this.stop(); // replaying into your own recording doubles every entry
    const entries = this.#entries;
    for (let i = 0; i < entries.length; i++) {
      if (pace === 'realtime' && i > 0) {
        const gap = Date.parse(entries[i].at) - Date.parse(entries[i - 1].at);
        if (gap > 0) await new Promise((r) => setTimeout(r, Math.min(gap, 5000)));
      }
      this.#bus.emit(entries[i].topic, entries[i].payload);
    }
    if (wasRecording) this.start();
    return this;
  }
}

/** Deep plain-data copy; falls back to JSON for realms without structuredClone. */
function snapshot(payload) {
  if (payload == null || typeof payload !== 'object') return payload;
  try {
    return structuredClone(payload);
  } catch {
    try { return JSON.parse(JSON.stringify(payload)); } catch { return String(payload); }
  }
}
