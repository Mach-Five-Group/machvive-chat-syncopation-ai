import type { MachviveChatSyncopationServices } from '../machvive-chat-syncopation-services/machvive-chat-syncopation-services.js';
import type { ConfigSchema } from '../machvive-chat-syncopation-services/component-config.js';

export declare class MachviveChatSyncopationInspector extends HTMLElement {
  static configSchema: ConfigSchema;
  get config(): Record<string, unknown>;
  set config(overrides: Record<string, unknown>);
  readonly limit: number;
  readonly events: Array<{ at: Date; topic: string; detail: string }>;
}

declare global {
  interface HTMLElementTagNameMap {
    'machvive-chat-syncopation-inspector': MachviveChatSyncopationInspector;
  }
}
