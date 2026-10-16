/**
 * Surface state — `data-chat-state`, owned by the services element and inherited
 * by every component it governs.
 *
 * Four states, all explicit:
 *   enabled   — normal operation.
 *   disabled  — static; unclickable and dimmed (pointer-events, opacity). Read-only.
 *   loading   — behavioral; a progress indication, and the surface stays largely
 *               enabled (the prompt stays editable, a cancel stays reachable).
 *               This is the daemon's startup/turn flow made visible, not a dim.
 *   design    — each component renders the isomorphic form for its own schema.
 *
 * The state lives on the services element because a surface has one conversation,
 * one bus and one daemon — a half-designed surface (canvas in design, prompt not)
 * makes no sense. Components read `services.state` and react to `state:changed`;
 * they never own the attribute themselves.
 */

export const CHAT_STATES = Object.freeze(['enabled', 'disabled', 'loading', 'design']);
export const CHAT_STATE_ATTR = 'data-chat-state';
const DEFAULT_STATE = 'enabled';

/**
 * Reads and validates a state attribute value. `data-*` values are lowercased by
 * the HTML parser, so comparison is case-insensitive. An absent or unrecognized
 * value falls back to `enabled` and says so — an empty state should be a
 * discoverable mistake, not a silent default.
 */
export function readChatState(element, { warn = true } = {}) {
  const raw = element?.getAttribute?.(CHAT_STATE_ATTR);
  if (raw == null || raw === '') {
    if (warn) console.warn(`[syncopation] ${CHAT_STATE_ATTR} is not set — defaulting to "enabled". Valid: ${CHAT_STATES.join(', ')}`);
    return DEFAULT_STATE;
  }
  const value = raw.toLowerCase();
  if (!CHAT_STATES.includes(value)) {
    if (warn) console.warn(`[syncopation] unrecognized ${CHAT_STATE_ATTR}="${raw}" — defaulting to "enabled". Valid: ${CHAT_STATES.join(', ')}`);
    return DEFAULT_STATE;
  }
  return value;
}

/** The shared CSS for the disabled state: unclickable and dimmed. */
export const DISABLED_STATE_CSS = `
:host([data-chat-state="disabled"]) .chat-state-disabled,
:host(.chat-state-disabled) .chat-state-disabled,
.chat-state-host-disabled {
  pointer-events: none;
  opacity: 0.6;
}
`;
