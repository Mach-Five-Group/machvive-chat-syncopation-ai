/** Surface state — `data-chat-state`, owned by the services element. */

export type ChatState = 'enabled' | 'disabled' | 'loading' | 'design';

export declare const CHAT_STATES: readonly ChatState[];
export declare const CHAT_STATE_ATTR: 'data-chat-state';

/**
 * Reads and validates a state attribute value; case-insensitive, falls back to
 * `enabled` with a warning on a missing or unrecognized value.
 */
export declare function readChatState(
  element: { getAttribute?: (name: string) => string | null } | null,
  options?: { warn?: boolean }
): ChatState;

/** The shared CSS for the disabled state: unclickable and dimmed. */
export declare const DISABLED_STATE_CSS: string;
