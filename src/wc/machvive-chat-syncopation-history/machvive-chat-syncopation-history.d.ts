import type { MachviveChatSyncopationServices } from '../machvive-chat-syncopation-services/machvive-chat-syncopation-services.js';
import type { ConfigSchema } from '../machvive-chat-syncopation-services/component-config.js';

export declare class MachviveChatSyncopationHistory extends HTMLElement {
  static configSchema: ConfigSchema;
  get config(): Record<string, unknown>;
  set config(overrides: Record<string, unknown>);
  refresh(): Promise<void>;
  /** Serialises to JSON and offers it as a download; returns the JSON. */
  export(id?: string): Promise<string | null>;
  forget(id: string): Promise<void>;
  forgetAll(): Promise<void>;
}

declare global {
  interface HTMLElementTagNameMap {
    'machvive-chat-syncopation-history': MachviveChatSyncopationHistory;
  }
}
