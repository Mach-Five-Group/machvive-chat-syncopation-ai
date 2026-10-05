import type { ChatRecord } from './record.js';
import type { Conversation } from './conversation.js';
import type { PubSub } from './pubsub.js';
import type { SyncopationConfig } from './config.js';

/** Yields string chunks. The entire transport contract. */
export type Transport = (
  prompt: string,
  context: { config: SyncopationConfig }
) => AsyncGenerator<string, void, unknown>;

export declare class Daemon {
  constructor(options: {
    bus?: PubSub;
    conversation: Conversation;
    config: SyncopationConfig;
    /** Merged over the built-ins; a name collision replaces the built-in. */
    transports?: Record<string, Transport>;
  });
  /** Adds a transport under a name `config.transport` can select. */
  register(name: string, transport: Transport): this;
  /** Every selectable name, built-ins and registered alike. */
  readonly transports: string[];
  readonly busy: boolean;
  /** Stops generating; the partial turn is kept. */
  stop(): void;
  send(text: string): Promise<ChatRecord | null>;
}

export declare const transports: string[];
