import type { MachviveChatSyncopationServices } from '../machvive-chat-syncopation-services/machvive-chat-syncopation-services.js';

export declare class MachviveChatSyncopationCli extends HTMLElement {
  /** Adds a slash command, for domain verbs this collection cannot know about. */
  register(name: string, command: { describe?: string; run: (args: string) => string | void }): void;
}

declare global {
  interface HTMLElementTagNameMap {
    'machvive-chat-syncopation-cli': MachviveChatSyncopationCli;
  }
}
