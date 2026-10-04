import type { MachviveChatSyncopationServices } from '../machvive-chat-syncopation-services/machvive-chat-syncopation-services.js';

export declare class MachviveChatSyncopationVoice extends HTMLElement {
  start(): void;
  stop(): void;
}

declare global {
  interface HTMLElementTagNameMap {
    'machvive-chat-syncopation-voice': MachviveChatSyncopationVoice;
  }
}
