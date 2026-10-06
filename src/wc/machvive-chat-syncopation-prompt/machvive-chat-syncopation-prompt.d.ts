import type { MachviveChatSyncopationServices } from '../machvive-chat-syncopation-services/machvive-chat-syncopation-services.js';
import type { ConfigSchema } from '../machvive-chat-syncopation-services/component-config.js';

export declare class MachviveChatSyncopationPrompt extends HTMLElement {
  static configSchema: ConfigSchema;
  get config(): Record<string, unknown>;
  set config(overrides: Record<string, unknown>);
  /** Puts text in the field; only submits when `send` is true. */
  fill(text: string, options?: { send?: boolean }): void;
}

declare global {
  interface HTMLElementTagNameMap {
    'machvive-chat-syncopation-prompt': MachviveChatSyncopationPrompt;
  }
}
