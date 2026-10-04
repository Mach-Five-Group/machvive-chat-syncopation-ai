export type Transport = 'echo' | 'local' | 'remote';

export interface SyncopationConfig {
  transport: Transport | string;
  model: string;
  endpoint: string;
  persist: boolean;
  maxTurns: number;
  streaming: boolean;
  locale?: string;
}

export declare const DEFAULTS: Readonly<SyncopationConfig>;
export declare function resolveConfig(
  element?: Element | null,
  overrides?: Partial<SyncopationConfig>
): SyncopationConfig;
