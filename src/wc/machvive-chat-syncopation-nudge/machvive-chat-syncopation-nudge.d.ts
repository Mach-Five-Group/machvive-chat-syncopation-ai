import type { MachviveChatSyncopationServices } from '../machvive-chat-syncopation-services/machvive-chat-syncopation-services.js';

export declare class MachviveChatSyncopationNudge extends HTMLElement {
  /** Parsed from the pipe-delimited `suggestions` attribute. */
  readonly suggestions: string[];
}

declare global {
  interface HTMLElementTagNameMap {
    'machvive-chat-syncopation-nudge': MachviveChatSyncopationNudge;
  }
}
