import type { ConversationJSON } from './conversation.js';

export declare class Cache {
  /** False when IndexedDB is unavailable; the cache then holds memory only. */
  readonly available: boolean;
  put(conversation: ConversationJSON): Promise<ConversationJSON>;
  get(id: string): Promise<ConversationJSON | null>;
  list(): Promise<ConversationJSON[]>;
  remove(id: string): Promise<void>;
  clear(): Promise<void>;
}
