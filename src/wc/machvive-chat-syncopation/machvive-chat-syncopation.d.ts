import type { MachviveChatSyncopationServices } from '../machvive-chat-syncopation-services/machvive-chat-syncopation-services.js';

export declare class MachviveChatSyncopation extends HTMLElement {
  readonly services: MachviveChatSyncopationServices | null;
  readonly conversation: import('../machvive-chat-syncopation-services/conversation.js').Conversation | null;
  send(text: string): Promise<import('../machvive-chat-syncopation-services/record.js').ChatRecord | null> | undefined;
}

declare global {
  interface HTMLElementTagNameMap {
    'machvive-chat-syncopation': MachviveChatSyncopation;
  }
}
