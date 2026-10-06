import type { MachviveChatSyncopationServices } from '../machvive-chat-syncopation-services/machvive-chat-syncopation-services.js';
import type { ConfigSchema } from '../machvive-chat-syncopation-services/component-config.js';

export declare class MachviveChatSyncopationVoice extends HTMLElement {
  static configSchema: ConfigSchema;
  get config(): Record<string, unknown>;
  set config(overrides: Record<string, unknown>);
  start(): void;
  stop(): void;
}

declare global {
  interface HTMLElementTagNameMap {
    'machvive-chat-syncopation-voice': MachviveChatSyncopationVoice;
  }
}
