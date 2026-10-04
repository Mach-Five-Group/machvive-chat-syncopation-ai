/**
 * Resolved configuration, in precedence order: explicit > element attributes >
 * defaults. Reading attributes keeps a page author in HTML rather than forcing a
 * script tag for every knob.
 */
export const DEFAULTS = Object.freeze({
  /** Where turns are produced. 'local' keeps everything in the user agent. */
  transport: 'echo',          // 'echo' | 'local' | 'remote'
  model: '',
  endpoint: '',
  /** Persist conversations to IndexedDB. Off by default: storing someone's
   *  conversation is a decision a page should have to make deliberately. */
  persist: false,
  maxTurns: 200,
  streaming: true,
  locale: undefined
});

const COERCE = { persist: (v) => v !== 'false', streaming: (v) => v !== 'false', maxTurns: (v) => Number(v) };

export function resolveConfig(element, overrides = {}) {
  const fromAttrs = {};
  for (const key of Object.keys(DEFAULTS)) {
    const attr = key.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`);
    if (element?.hasAttribute?.(attr)) {
      const raw = element.getAttribute(attr);
      fromAttrs[key] = COERCE[key] ? COERCE[key](raw) : raw;
    }
  }
  return { ...DEFAULTS, ...fromAttrs, ...overrides };
}
