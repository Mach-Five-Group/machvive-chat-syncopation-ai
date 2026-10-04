/**
 * One turn in a conversation.
 *
 * A record is data, never a DOM node: the same turn is rendered by the canvas,
 * replayed by history, and read by the inspector. Keeping it inert means a
 * renderer can be swapped without touching what was said.
 */
let seq = 0;
const nextId = () => `m-${Date.now().toString(36)}-${(seq++).toString(36)}`;

export const ROLES = Object.freeze(['user', 'assistant', 'system', 'tool']);

export function createRecord({ role = 'user', text = '', ...rest } = {}) {
  if (!ROLES.includes(role)) throw new TypeError(`record.role must be one of ${ROLES.join(', ')}`);
  return {
    id: nextId(),
    role,
    text,
    at: new Date().toISOString(),
    /** Streaming turns stay `pending` until the producer marks them done. */
    status: 'complete',
    /** Free-form, carried verbatim; see metadata.js for the reserved keys. */
    meta: {},
    ...rest
  };
}

export const isPending = (record) => record?.status === 'pending';
