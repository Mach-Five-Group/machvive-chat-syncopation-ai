import type { MachviveChatSyncopationServices } from '../machvive-chat-syncopation-services/machvive-chat-syncopation-services.js';
import type { ConfigSchema } from '../machvive-chat-syncopation-services/component-config.js';

export interface PromptAction {
  /** Icon name from the shared set (e.g. 'mic', 'more-vert'). */
  icon?: string;
  label?: string;
  /** Called with the prompt element when the action is activated. */
  run?: (prompt: MachviveChatSyncopationPrompt) => void;
  /** Lower orders render further left. */
  order?: number;
}

export declare class MachviveChatSyncopationPrompt extends HTMLElement {
  static configSchema: ConfigSchema;
  get config(): Record<string, unknown>;
  set config(overrides: Record<string, unknown>);
  /** Puts text in the field; only submits when `send` is true. */
  fill(text: string, options?: { send?: boolean }): void;
  /**
   * Registers an action into the action row — how voice, an overflow menu, or an
   * integrator's own button joins the composer without a second component
   * re-implementing the row.
   */
  registerAction(name: string, action: PromptAction): this;
}

declare global {
  interface HTMLElementTagNameMap {
    'machvive-chat-syncopation-prompt': MachviveChatSyncopationPrompt;
  }
}
