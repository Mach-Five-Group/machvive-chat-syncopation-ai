import type { MotifBundle } from './motifs.js';

/** Base scope rules (light/dark + data-mcs-theme scopes), hoisted to document head. */
export declare const THEME_CSS: string;
export declare const CONTROL_CSS: string;
/** Scrollbar styling that follows the active theme/motif tokens. */
export declare const SCROLL_CSS: string;

/** The id of the hoisted theme <style>, so a page can detect or remove it. */
export declare const THEME_STYLE_ID: string;
/** Hoists the theme scope rules + registered motifs into document head, once. */
export declare function hoistTheme(): void;

/** Registers a motif's token bundle under a name `data-mcs-motif="<name>"` selects. */
export declare function registerMotif(name: string, bundle: MotifBundle): string;
/** Every registered motif name, built-ins included. */
export declare function motifNames(): string[];
/** The accumulated motif scope CSS, computed at call time so late registration is seen. */
export declare function motifCSSOutput(): string;
