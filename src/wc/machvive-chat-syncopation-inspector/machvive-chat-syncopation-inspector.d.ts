import type { MachviveChatSyncopationServices } from '../machvive-chat-syncopation-services/machvive-chat-syncopation-services.js';

export declare class MachviveChatSyncopationInspector extends HTMLElement {
  readonly limit: number;
  readonly events: Array<{ at: Date; topic: string; detail: string }>;
}

declare global {
  interface HTMLElementTagNameMap {
    'machvive-chat-syncopation-inspector': MachviveChatSyncopationInspector;
  }
}
