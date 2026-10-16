/**
 * Motifs — named token bundles, applied over the light/dark themes.
 *
 * A theme (light | dark) answers "is this surface bright or dark". A motif
 * (corp, artdeco, cyberpunk…) answers "what is its personality". They compose:
 * a motif declares both its light and its dark token set, and the active theme
 * picks which one is in force.
 *
 * Motifs are registered like transports — `services.registerTheme(name, bundle)` —
 * so an integrator ships their own without forking, and the built-ins are data,
 * not privileged code. Every token a motif sets is one of the `--mcs-*` tokens the
 * theme already defines; a motif that invents a token is a bug the test catches.
 *
 * Selection rides the `theme` attribute: `theme="dark"` forces dark,
 * `theme="artdeco"` selects the artdeco motif (its light or dark set follows the
 * same prefers-color-scheme / explicit-choice cascade as the base themes).
 * `theme="artdeco-dark"` forces the motif's dark set.
 */

/**
 * The token keys a motif is allowed to set. Mirrors the theme's token list —
 * a motif may restyle any of them and none outside them.
 */
export const MOTIF_TOKENS = Object.freeze([
  'fg', 'muted', 'bg', 'surface', 'user-bg', 'assistant-bg',
  'border', 'accent', 'accent-fg', 'danger', 'radius', 'font', 'mono'
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
      mono: 'ui-monospace, SFMono-Regular, Menlo, monospace'
    },
    dark: {
      fg: '#dde3ea', muted: '#98a2ae', bg: '#171c23', surface: '#20272f',
      'user-bg': '#1d3a55', 'assistant-bg': '#242c36', border: '#39424e',
      accent: '#6aa3d8', 'accent-fg': '#10151b', danger: '#e98a97',
      radius: '4px', font: 'system-ui, -apple-system, sans-serif',
      mono: 'ui-monospace, SFMono-Regular, Menlo, monospace'
    }
  },

  artdeco: {
    light: {
      fg: '#241d13', muted: '#6f6350', bg: '#f7f2e7', surface: '#efe6d2',
      'user-bg': '#e9dcc0', 'assistant-bg': '#f0e8d6', border: '#cbb98a',
      accent: '#9c7c1e', 'accent-fg': '#241d13', danger: '#8f2f1f',
      radius: '2px', font: 'Georgia, "Times New Roman", serif',
      mono: 'ui-monospace, SFMono-Regular, Menlo, monospace'
    },
    dark: {
      fg: '#eadfc6', muted: '#b3a482', bg: '#17130c', surface: '#221c12',
      'user-bg': '#3a2f18', 'assistant-bg': '#262014', border: '#5a4a26',
      accent: '#d4af37', 'accent-fg': '#17130c', danger: '#e0705a',
      radius: '2px', font: 'Georgia, "Times New Roman", serif',
      mono: 'ui-monospace, SFMono-Regular, Menlo, monospace'
    }
  }
};

/** The built-in motif names. */
export const MOTIF_NAMES = Object.keys(MOTIFS);

/**
 * Builds the CSS that applies a motif over the base theme. Mirrors the base
 * cascade: the motif's light set guards against an explicit dark choice, the
 * dark set sits in the media query guarded against explicit light, and explicit
 * `theme="<motif>-dark"` wins in a light OS.
 */
export function motifCSS(name, bundle) {
  const light = toVars(bundle.light);
  const dark = toVars(bundle.dark);
  return `
  :host([theme="${name}"]) {
${light}  }
  @media (prefers-color-scheme: dark) {
    :host([theme="${name}"]:not([data-scheme="light"])) {
${dark}    }
  }
  :host([theme="${name}"][data-scheme="dark"]),
  :host([theme="${name}-dark"]) {
${dark}  }
  :host([theme="${name}-light"]) {
    color-scheme: light;
${light}  }
`;
}

function toVars(tokens) {
  return Object.entries(tokens)
    .map(([key, value]) => `    --mcs-${key}: ${value};\n`)
    .join('');
}
