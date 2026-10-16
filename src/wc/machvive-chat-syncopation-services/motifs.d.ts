/** Motifs — named light/dark token bundles applied over the base theme. */

export type MotifTokenKey =
  | 'fg' | 'muted' | 'bg' | 'surface' | 'user-bg' | 'assistant-bg'
  | 'border' | 'accent' | 'accent-fg' | 'danger' | 'radius' | 'font' | 'mono';

export type MotifTokens = Partial<Record<MotifTokenKey, string>>;

export interface MotifBundle {
  light: MotifTokens;
  dark: MotifTokens;
}

/** The token keys a motif is allowed to set — a motif may not invent tokens. */
export declare const MOTIF_TOKENS: readonly MotifTokenKey[];

/** The built-in motifs. */
export declare const MOTIFS: Record<string, MotifBundle>;

/** The built-in motif names. */
export declare const MOTIF_NAMES: string[];

/**
 * Builds the CSS that applies a motif over the base theme. Mirrors the base
 * cascade: motif light, then dark under the media query, then explicit dark wins.
 */
export declare function motifCSS(name: string, bundle: MotifBundle): string;
