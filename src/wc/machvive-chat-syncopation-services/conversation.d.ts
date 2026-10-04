import type { ChatRecord } from './record.js';
import type { PubSub } from './pubsub.js';

export interface ConversationJSON {
  id: string;
  records: ChatRecord[];
}

export declare class Conversation {
  constructor(options?: { bus?: PubSub; maxTurns?: number; id?: string });
  id: string;
  readonly records: ChatRecord[];
  readonly length: number;
  readonly last: ChatRecord | null;
  add(input: Partial<ChatRecord>): ChatRecord;
  append(id: string, chunk: string): ChatRecord | null;
  update(id: string, patch: Partial<ChatRecord>): ChatRecord | null;
  clear(): void;
  toJSON(): ConversationJSON;
}
