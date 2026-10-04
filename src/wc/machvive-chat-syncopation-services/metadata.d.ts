import type { ChatRecord } from './record.js';

export declare const META: Readonly<{
  TOKENS: 'mcs:tokens';
  LATENCY: 'mcs:latencyMs';
  MODEL: 'mcs:model';
  SOURCE: 'mcs:source';
  ERROR: 'mcs:error';
  CITATIONS: 'mcs:citations';
  TOOL_CALLS: 'mcs:toolCalls';
}>;

export declare function annotate(record: ChatRecord, patch: Record<string, unknown>): ChatRecord;
export declare function readMeta<T = unknown>(record: ChatRecord | null | undefined, key: string, fallback?: T): T;
/** Everything the integrator put on `meta`, without the `mcs:` namespace. */
export declare function userMeta(record?: ChatRecord | null): Record<string, unknown>;
