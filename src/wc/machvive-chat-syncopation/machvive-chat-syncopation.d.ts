import type { MachviveChatSyncopationServices } from '../machvive-chat-syncopation-services/machvive-chat-syncopation-services.js';
import type { ConfigSchema } from '../machvive-chat-syncopation-services/component-config.js';

export declare class MachviveChatSyncopation extends HTMLElement {
  static configSchema: ConfigSchema;
  get config(): Record<string, unknown>;
  set config(overrides: Record<string, unknown>);
  readonly services: MachviveChatSyncopationServices | null;
  readonly conversation: import('../machvive-chat-syncopation-services/conversation.js').Conversation | null;
  send(text: string): Promise<import('../machvive-chat-syncopation-services/record.js').ChatRecord | null> | undefined;
}

declare global {
  interface HTMLElementTagNameMap {
    'machvive-chat-syncopation': MachviveChatSyncopation;
  }
}
