import type { MachviveChatSyncopationServices } from '../machvive-chat-syncopation-services/machvive-chat-syncopation-services.js';

export declare class MachviveChatSyncopationPrompt extends HTMLElement {
  /** Puts text in the field; only submits when `send` is true. */
  fill(text: string, options?: { send?: boolean }): void;
}

declare global {
  interface HTMLElementTagNameMap {
    'machvive-chat-syncopation-prompt': MachviveChatSyncopationPrompt;
  }
}
