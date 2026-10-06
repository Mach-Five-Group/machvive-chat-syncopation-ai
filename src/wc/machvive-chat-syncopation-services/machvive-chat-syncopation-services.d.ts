import type { PubSub } from './pubsub.js';
import type { Conversation } from './conversation.js';
import type { Daemon } from './daemon.js';
import type { Cache } from './cache.js';
import type { Recorder } from './recorder.js';
import type { ChatRecord } from './record.js';
import type { SyncopationConfig } from './config.js';
import type { ConfigSchema } from './component-config.js';

export * from './pubsub.js';
export * from './conversation.js';
export * from './daemon.js';
export * from './cache.js';
export * from './record.js';
export * from './metadata.js';
export * from './theme.js';
export * from './recorder.js';
export * from './component-config.js';
export * from './config-form.js';
// config.js and daemon.js both declare a `Transport` type (a name union vs. the
// transport function). Re-export explicitly so the wildcard ambiguity resolves:
// the daemon's function type keeps the short name, the config's becomes explicit.
export { DEFAULTS, resolveConfig } from './config.js';
export type { SyncopationConfig } from './config.js';
export type { Transport as TransportName } from './config.js';

export declare const SERVICES_TAG: 'machvive-chat-syncopation-services';

/** Nearest services element, searching ancestors and their children. */
export declare function findServices(node: Node | null): MachviveChatSyncopationServices | null;
/** Resolves once services exist and have booted; null on timeout. */
export declare function whenServices(
  node: Node | null,
  options?: { timeoutMs?: number }
): Promise<MachviveChatSyncopationServices | null>;

export declare class MachviveChatSyncopationServices extends HTMLElement {
  static configSchema: ConfigSchema;
  readonly bus: PubSub;
  readonly conversation: Conversation | null;
  readonly daemon: Daemon | null;
  readonly cache: Cache;
  readonly recorder: Recorder | null;
  /** Resolved configuration. Assign a partial object to override keys —
   *  overrides are reflected to attributes and announced as `config:changed`. */
  get config(): SyncopationConfig | Record<string, unknown>;
  set config(overrides: Partial<SyncopationConfig>);
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
