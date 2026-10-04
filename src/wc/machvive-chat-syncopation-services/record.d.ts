export type Role = 'user' | 'assistant' | 'system' | 'tool';
export type RecordStatus = 'complete' | 'pending' | 'error';

export interface ChatRecord {
  id: string;
  role: Role;
  text: string;
  /** ISO 8601. */
  at: string;
  status: RecordStatus;
  /** Open map; reserved keys are namespaced `mcs:` — see metadata.d.ts. */
  meta: Record<string, unknown>;
  [key: string]: unknown;
}

export declare const ROLES: readonly Role[];
export declare function createRecord(input?: Partial<ChatRecord>): ChatRecord;
export declare function isPending(record?: ChatRecord | null): boolean;
