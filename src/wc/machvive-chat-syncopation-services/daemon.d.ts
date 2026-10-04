import type { ChatRecord } from './record.js';
import type { Conversation } from './conversation.js';
import type { PubSub } from './pubsub.js';
import type { SyncopationConfig } from './config.js';

export declare class Daemon {
  constructor(options: { bus?: PubSub; conversation: Conversation; config: SyncopationConfig });
  readonly busy: boolean;
  /** Stops generating; the partial turn is kept. */
  stop(): void;
  send(text: string): Promise<ChatRecord | null>;
}

export declare const transports: string[];
