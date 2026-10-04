/**
 * Reserved keys on `record.meta`, and helpers for reading them.
 *
 * Namespaced because `meta` is deliberately open — an integrator puts whatever
 * they need there, and a reserved key collides with their field otherwise. Keys
 * outside this set are carried verbatim and never stripped.
 */
export const META = Object.freeze({
  TOKENS: 'mcs:tokens',
  LATENCY: 'mcs:latencyMs',
  MODEL: 'mcs:model',
  /** 'local' when produced in the user agent — no token cost, no data egress. */
  SOURCE: 'mcs:source',
  ERROR: 'mcs:error',
  CITATIONS: 'mcs:citations',
  TOOL_CALLS: 'mcs:toolCalls'
});

export const annotate = (record, patch) => ({ ...record, meta: { ...record.meta, ...patch } });
export const readMeta = (record, key, fallback) => record?.meta?.[key] ?? fallback;

/** Everything the integrator put there, without our namespace. */
export function userMeta(record) {
  return Object.fromEntries(
    Object.entries(record?.meta ?? {}).filter(([k]) => !k.startsWith('mcs:'))
  );
}
