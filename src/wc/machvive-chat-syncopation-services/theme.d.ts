import type { MotifBundle } from './motifs.js';

export declare const THEME_CSS: string;
export declare const CONTROL_CSS: string;

/** Registers a motif's token bundle under a name `theme="<name>"` can select. */
export declare function registerMotif(name: string, bundle: MotifBundle): string;
/** Every registered motif name, built-ins included. */
export declare function motifNames(): string[];
/** The accumulated motif CSS, computed at call time so late registration is seen. */
export declare function motifCSSOutput(): string;
