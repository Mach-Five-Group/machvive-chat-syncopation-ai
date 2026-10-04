import type { MachviveChatSyncopationServices } from '../machvive-chat-syncopation-services/machvive-chat-syncopation-services.js';

export declare class MachviveChatSyncopationHistory extends HTMLElement {
  refresh(): Promise<void>;
  /** Serialises to JSON and offers it as a download; returns the JSON. */
  export(id?: string): Promise<string | null>;
  forget(id: string): Promise<void>;
  forgetAll(): Promise<void>;
}

declare global {
  interface HTMLElementTagNameMap {
    'machvive-chat-syncopation-history': MachviveChatSyncopationHistory;
  }
}
