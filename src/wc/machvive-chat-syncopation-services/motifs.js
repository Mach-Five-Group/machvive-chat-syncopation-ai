/**
 * Motifs — named token bundles, applied as scope.
 *
 * A theme (`data-mcs-theme`) answers "bright or dark". A motif
 * (`data-mcs-motif`) answers "what personality". They are orthogonal attributes
 * that compose: a motif declares both its light and its dark token set, and the
 * active *scheme* scope picks which one is in force.
 *
 * Motifs are registered like transports — `services.registerTheme(name, bundle)` —
 * so an integrator ships their own without forking, and the built-ins are data,
 * not privileged code. Every token a motif sets is one of the `--mcs-*` tokens the
 * theme defines; a motif that invents a token is a bug the test catches.
 *
 * Selection: `data-mcs-motif="artdeco"` on any element scopes that subtree. The
 * light or dark set is chosen by the nearest `data-mcs-theme` scope, falling back
 * to the OS. Set both on the same element to force a combination.
 */

/**
 * The token keys a motif is allowed to set. Mirrors the theme's token list —
 * a motif may restyle any of them and none outside them.
 */
export const MOTIF_TOKENS = Object.freeze([
  'fg', 'muted', 'bg', 'surface', 'user-bg', 'assistant-bg',
  'border', 'accent', 'accent-fg', 'danger', 'radius', 'font', 'mono',
  'scroll-track', 'scroll-thumb', 'scroll-thumb-hover'
]);

/**
 * The built-in motifs. Reference pair first — corp and artdeco — to prove the
 * pattern; the rest of the set lands once the registry and the per-motif
 * contrast verification are established.
 */
export const MOTIFS = {
  corp: {
    light: {
      fg: '#1c2430', muted: '#5a6472', bg: '#f4f6f8', surface: '#e7ebef',
      'user-bg': '#dbe6f2', 'assistant-bg': '#eceff3', border: '#c3cbd4',
      accent: '#1f4e79', 'accent-fg': '#ffffff', danger: '#a3233a',
      radius: '4px', font: 'system-ui, -apple-system, sans-serif',
      mono: 'ui-monospace, SFMono-Regular, Menlo, monospace',
      'scroll-track': '#e7ebef', 'scroll-thumb': '#b6bfc9', 'scroll-thumb-hover': '#8d97a3'
    },
    dark: {
      fg: '#dde3ea', muted: '#98a2ae', bg: '#171c23', surface: '#20272f',
      'user-bg': '#1d3a55', 'assistant-bg': '#242c36', border: '#39424e',
      accent: '#6aa3d8', 'accent-fg': '#10151b', danger: '#e98a97',
      radius: '4px', font: 'system-ui, -apple-system, sans-serif',
      mono: 'ui-monospace, SFMono-Regular, Menlo, monospace',
      'scroll-track': '#20272f', 'scroll-thumb': '#3d4753', 'scroll-thumb-hover': '#566270'
    }
  },

  artdeco: {
    light: {
      fg: '#241d13', muted: '#6f6350', bg: '#f7f2e7', surface: '#efe6d2',
      'user-bg': '#e9dcc0', 'assistant-bg': '#f0e8d6', border: '#cbb98a',
      accent: '#9c7c1e', 'accent-fg': '#241d13', danger: '#8f2f1f',
      radius: '2px', font: 'Georgia, "Times New Roman", serif',
      mono: 'ui-monospace, SFMono-Regular, Menlo, monospace',
      'scroll-track': '#efe6d2', 'scroll-thumb': '#c9b683', 'scroll-thumb-hover': '#a8925a'
    },
    dark: {
      fg: '#eadfc6', muted: '#b3a482', bg: '#17130c', surface: '#221c12',
      'user-bg': '#3a2f18', 'assistant-bg': '#262014', border: '#5a4a26',
      accent: '#d4af37', 'accent-fg': '#17130c', danger: '#e0705a',
      radius: '2px', font: 'Georgia, "Times New Roman", serif',
      mono: 'ui-monospace, SFMono-Regular, Menlo, monospace',
      'scroll-track': '#221c12', 'scroll-thumb': '#5a4a26', 'scroll-thumb-hover': '#7a653a'
    }
  }
};

/** The built-in motif names. */
export const MOTIF_NAMES = Object.keys(MOTIFS);

/**
 * Builds the scope CSS for a motif. A motif scope sets both token sets behind the
 * scheme: the light set applies under `data-mcs-theme="light"` (or OS light with no
 * scheme scope), the dark set under `data-mcs-theme="dark"` or OS dark. Because the
 * scheme is itself an inheriting scope, the composition is just cascade order.
 */
export function buildMotifScopeCSS(name, bundle) {
  const light = toVars(bundle.light);
  const dark = toVars(bundle.dark);
  return `
  /* ${name}: light set under an explicit or OS-light scheme */
  [data-mcs-motif="${name}"] {
${light}  }
  [data-mcs-motif="${name}"][data-mcs-theme="dark"],
  [data-mcs-theme="dark"] [data-mcs-motif="${name}"] {
${dark}  }
  @media (prefers-color-scheme: dark) {
    [data-mcs-motif="${name}"]:not([data-mcs-theme="light"]):not([data-mcs-theme="dark"]) {
${dark}    }
  }
`;
}

/** @deprecated — the scope-model name is buildMotifScopeCSS. */
export const motifCSS = buildMotifScopeCSS;

function toVars(tokens) {
  return Object.entries(tokens)
    .map(([key, value]) => `    --mcs-${key}: ${value};\n`)
    .join('');
}
