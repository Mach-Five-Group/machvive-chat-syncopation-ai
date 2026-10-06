import type { PubSub } from './pubsub.js';

/** One captured bus emission — plain, JSON-serializable data. */
export interface RecordedEvent {
  seq: number;
  at: string;
  topic: string;
  payload: unknown;
}

export interface RecordingJSON {
  format: 'mcs-recording@1';
  exportedAt: string;
  entries: RecordedEvent[];
}

/**
 * Records every bus emission off the wildcard topic and replays them. Payloads
 * are snapshotted at capture time, so later mutation does not rewrite history.
 */
export declare class Recorder {
  constructor(bus: PubSub);
  readonly recording: boolean;
  readonly entries: RecordedEvent[];
  readonly length: number;
  /** Start (or resume) capturing. Idempotent. */
  start(): this;
  /** Stop capturing; entries are kept. */
  stop(): this;
  /** Drop captured entries (and stop). */
  clear(): this;
  toJSON(): RecordingJSON;
  /** JSON string form of toJSON(). */
  export(): string;
  /** Loads a previously exported recording; throws on anything else. */
  import(data: string | RecordingJSON): this;
  /**
   * Re-emits captured events onto the bus in order. Capture is paused during
   * replay so a recording does not double itself.
   */
  replay(options?: { pace?: 'instant' | 'realtime' }): Promise<this>;
}
