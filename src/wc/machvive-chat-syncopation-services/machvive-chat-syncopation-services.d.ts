import type { PubSub } from './pubsub.js';
import type { Conversation } from './conversation.js';
import type { Daemon } from './daemon.js';
import type { Cache } from './cache.js';
import type { ChatRecord } from './record.js';
import type { SyncopationConfig } from './config.js';

export * from './pubsub.js';
export * from './conversation.js';
export * from './daemon.js';
export * from './cache.js';
export * from './config.js';
export * from './record.js';
export * from './metadata.js';
export * from './theme.js';

export declare const SERVICES_TAG: 'machvive-chat-syncopation-services';

/** Nearest services element, searching ancestors and their children. */
export declare function findServices(node: Node | null): MachviveChatSyncopationServices | null;
/** Resolves once services exist and have booted; null on timeout. */
export declare function whenServices(
  node: Node | null,
  options?: { timeoutMs?: number }
): Promise<MachviveChatSyncopationServices | null>;

export declare class MachviveChatSyncopationServices extends HTMLElement {
  readonly bus: PubSub;
  readonly conversation: Conversation | null;
  readonly daemon: Daemon | null;
  readonly cache: Cache;
  readonly config: SyncopationConfig | null;
  send(text: string): Promise<ChatRecord | null> | undefined;
  /** Registers a transport and, unless told otherwise, selects it. */
  registerTransport(
    name: string,
    transport: import('./daemon.js').Transport,
    options?: { select?: boolean }
  ): this;
}

declare global {
  interface HTMLElementTagNameMap {
    'machvive-chat-syncopation-services': MachviveChatSyncopationServices;
  }
}
