import type { MachviveChatSyncopationServices } from '../machvive-chat-syncopation-services/machvive-chat-syncopation-services.js';
import type { ConfigSchema } from '../machvive-chat-syncopation-services/component-config.js';

export declare class MachviveChatSyncopationNudge extends HTMLElement {
  static configSchema: ConfigSchema;
  get config(): Record<string, unknown>;
  set config(overrides: Record<string, unknown>);
  /** Parsed from the pipe-delimited `suggestions` attribute. */
  readonly suggestions: string[];
}

declare global {
  interface HTMLElementTagNameMap {
    'machvive-chat-syncopation-nudge': MachviveChatSyncopationNudge;
  }
}
