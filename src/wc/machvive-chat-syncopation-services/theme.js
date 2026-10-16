/**
 * Design tokens — scoped and inheritable.
 *
 * Theming is *scope*, not a component-local setting. Two attributes carry it, and
 * both inherit down the tree (nearest scope wins — a component's own beats its
 * section beats the body):
 *
 *   data-mcs-theme="light|dark"    — the scheme (bright or dark)
 *   data-mcs-motif="corp|artdeco"  — the motif (personality), orthogonal to scheme
 *
 * Each scope rule sets the actual `--mcs-*` token values on the scoped element.
 * Custom properties inherit down *and through* shadow boundaries, so a component
 * reads `var(--mcs-bg)` and gets whatever the nearest scope decided — no internal
 * media query, no attribute logic. The same surface can be dark in one section and
 * light in another, which the old `:host` cascade could not express.
 *
 * The load-bearing rule: a component NEVER sets a public `--mcs-*` token on its own
 * `:host`. `:host` outranks the page's `:root` on specificity, so a literal default
 * there silently overrides the configuration drag-and-drop depends on. Defaults live
 * behind a private fallback in each usage (`var(--mcs-accent, #default)`), and the
 * public token is left for the scope to own.
 */

const LIGHT = `
    --mcs-fg: #1a1a1a;
    --mcs-muted: #646464;
    --mcs-bg: #ffffff;
    --mcs-surface: #f6f7f9;
    --mcs-user-bg: #e8f0fe;
    --mcs-assistant-bg: #f3f4f6;
    --mcs-border: #e2e4e8;
    --mcs-accent: #1565c0;
    --mcs-accent-fg: #ffffff;
    --mcs-danger: #a4161a;
    --mcs-radius: 12px;
    --mcs-font: system-ui, -apple-system, sans-serif;
    --mcs-mono: ui-monospace, SFMono-Regular, Menlo, monospace;
    --mcs-scroll-track: #f6f7f9;
    --mcs-scroll-thumb: #c3cbd4;
    --mcs-scroll-thumb-hover: #9aa2ad;
`;

const DARK = `
    --mcs-fg: #e8eaed;
    --mcs-muted: #a6acb3;
    --mcs-bg: #1f2125;
    --mcs-surface: #282b30;
    --mcs-user-bg: #1e3a5f;
    --mcs-assistant-bg: #2b2f36;
    --mcs-border: #3c4046;
    --mcs-accent: #5b9bf8;
    --mcs-accent-fg: #0b1220;
    --mcs-danger: #ff9d97;
    --mcs-scroll-track: #282b30;
    --mcs-scroll-thumb: #4a5058;
    --mcs-scroll-thumb-hover: #646c76;
`;

/**
 * The base scope rules. Order is load-bearing: the OS-following `:root` default,
 * then the explicit `data-mcs-theme` scopes *after* it so a scoped choice wins in
 * either OS. Hoisted to document head by hoistTheme().
 */
export const THEME_CSS = `
  :root {
    color-scheme: light dark;
${LIGHT}  }
  @media (prefers-color-scheme: dark) {
    :root:not([data-mcs-theme]) {
${DARK}    }
  }
  [data-mcs-theme="light"] {
    color-scheme: light;
${LIGHT}  }
  [data-mcs-theme="dark"] {
    color-scheme: dark;
${DARK}  }
`;

/**
 * Controls do not inherit colour, so every one needs it set explicitly or the
 * UA supplies a per-theme default — which is how you end up with white text on
 * a white button. Each reads the inherited token with a fallback so a component
 * with no scope still renders legibly.
 */
export const CONTROL_CSS = `
  button, input, textarea, select {
    font: inherit;
    color: var(--mcs-fg, #1a1a1a);
    background: var(--mcs-bg, #ffffff);
    border: 1px solid var(--mcs-border, #e2e4e8);
    border-radius: var(--mcs-radius, 8px);
  }
`;

/** Scrollbars follow the motif — track, thumb, and hover from the active tokens. */
export const SCROLL_CSS = `
  * {
    scrollbar-width: thin;
    scrollbar-color: var(--mcs-scroll-thumb, #c3cbd4) var(--mcs-scroll-track, #f6f7f9);
  }
  ::-webkit-scrollbar { width: 8px; height: 8px; }
  ::-webkit-scrollbar-track { background: var(--mcs-scroll-track, #f6f7f9); }
  ::-webkit-scrollbar-thumb {
    background: var(--mcs-scroll-thumb, #c3cbd4);
    border-radius: 4px;
  }
  ::-webkit-scrollbar-thumb:hover { background: var(--mcs-scroll-thumb-hover, #9aa2ad); }
`;

/**
 * Hoists the theme scope rules and the motif registry into document head, once.
 * The container calls this on connect, as it does for the icons. Everything the
 * cascade needs lives in the light DOM so it inherits into every shadow root.
 */
export const THEME_STYLE_ID = 'mcs-theme';

export function hoistTheme() {
  if (typeof document === 'undefined' || document.getElementById(THEME_STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = THEME_STYLE_ID;
  style.textContent = THEME_CSS + motifCSSOutput();
  document.head.append(style);
}

/**
 * The motif registry — named token bundles applied as `data-mcs-motif` scope
 * rules. Registered like transports; see motifs.js.
 */
import { buildMotifScopeCSS } from './motifs.js';

const registeredMotifs = new Map();

/** Registers a motif's token bundle under a name `data-mcs-motif="<name>"` selects. */
export function registerMotif(name, bundle) {
  registeredMotifs.set(name, bundle);
  // A theme hoisted before this registration is stale; refresh it in place.
  const style = typeof document !== 'undefined' && document.getElementById(THEME_STYLE_ID);
  if (style) style.textContent = THEME_CSS + motifCSSOutput();
  return name;
}

/** Every registered motif name, built-ins included. */
export function motifNames() { return [...registeredMotifs.keys()]; }

/** The accumulated motif scope CSS, computed at call time so late registration is seen. */
export function motifCSSOutput() {
  return [...registeredMotifs.entries()].map(([name, bundle]) => buildMotifScopeCSS(name, bundle)).join('\n');
}

// The built-in motifs register at import, alongside the built-in transports.
import { MOTIFS } from './motifs.js';
for (const [name, bundle] of Object.entries(MOTIFS)) registerMotif(name, bundle);

