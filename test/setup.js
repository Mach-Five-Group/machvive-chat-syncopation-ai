/**
 * Installs the DOM before any component module loads.
 *
 * This is required, not convenient: `class X extends HTMLElement` is evaluated
 * at module load and each module self-registers at the bottom, so importing a
 * component with no DOM present throws ReferenceError before a single test runs.
 *
 * fake-indexeddb is here for the same reason — the cache probes
 * `globalThis.indexedDB` and silently degrades to memory, which would make the
 * persistence tests pass without exercising any persistence.
 */
import { JSDOM, VirtualConsole } from 'jsdom';
import 'fake-indexeddb/auto';

/**
 * Forwards jsdom's console to ours, minus one known limitation.
 *
 * Exporting history hands the user a file by clicking an <a download>. jsdom has
 * no download plumbing, so it reports "navigation to another Document" every
 * time — and a suite that prints a harmless warning on every run is a suite
 * where the next real warning goes unread. Everything else passes through.
 */
const virtualConsole = new VirtualConsole();
// jsdom 29 renamed sendTo -> forwardTo.
virtualConsole.forwardTo(console, { jsdomErrors: 'none' });
virtualConsole.on('jsdomError', (error) => {
  if (/navigation to another Document/.test(error.message)) return;
  console.error(error);
});

const dom = new JSDOM('<!doctype html><html><body></body></html>', {
  url: 'https://example.test/',
  pretendToBeVisual: true,
  virtualConsole
});

const { window } = dom;

/**
 * These must come from jsdom even though Node defines its own.
 *
 * Node 18+ ships a global `Event` and `CustomEvent`. Constructing one of those
 * and handing it to a jsdom element's `dispatchEvent` throws
 * "parameter 1 is not of type 'Event'" — the realms do not recognise each
 * other's objects. Assigning only the *missing* globals leaves Node's versions
 * in place and every component that dispatches an event fails at runtime, which
 * reads as a component bug rather than a harness one.
 */
const FORCE = [
  'Event', 'CustomEvent', 'EventTarget',
  'KeyboardEvent', 'MouseEvent', 'PointerEvent', 'InputEvent', 'FocusEvent'
];

/** Harmless to take from Node when jsdom has no better version. */
const IF_MISSING = [
  'window', 'document', 'navigator', 'HTMLElement', 'customElements',
  'Node', 'NodeFilter', 'DocumentFragment', 'ShadowRoot', 'Element',
  'getComputedStyle', 'requestAnimationFrame', 'cancelAnimationFrame',
  'Blob', 'URL', 'FormData', 'DOMParser', 'MutationObserver'
];

for (const key of FORCE) {
  if (window[key] !== undefined) globalThis[key] = window[key];
}
for (const key of IF_MISSING) {
  if (globalThis[key] === undefined && window[key] !== undefined) {
    globalThis[key] = window[key];
  }
}

// jsdom reports isSecureContext false by default; nothing here is gated on it,
// but a component that later adds a secure-context check should see the truth
// of the URL above rather than an accident of the harness.
Object.defineProperty(window, 'isSecureContext', { value: true, configurable: true });

globalThis.__jsdom__ = dom;
