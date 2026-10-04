import { JSDOM } from 'jsdom';

/** Lets a queued microtask / 0ms timer run. Streaming is async throughout. */
export const tick = (ms = 0) => new Promise((r) => setTimeout(r, ms));

/**
 * Waits for a condition instead of sleeping a guessed interval.
 *
 * Fixed sleeps are how a suite becomes flaky on a loaded machine: the test that
 * passes at 50ms fails at 51. Polling a predicate states the actual
 * requirement — "by now this should be true".
 */
export async function until(predicate, { timeoutMs = 2000, everyMs = 5 } = {}) {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    const value = await predicate();
    if (value) return value;
    if (Date.now() > deadline) throw new Error(`until(): condition not met in ${timeoutMs}ms`);
    await tick(everyMs);
  }
}

/** Mounts markup in the live document and removes it afterwards. */
export function mount(html) {
  const host = document.createElement('div');
  host.innerHTML = html;
  document.body.append(host);
  return {
    host,
    query: (selector) => host.querySelector(selector),
    remove: () => host.remove()
  };
}

export { JSDOM };
