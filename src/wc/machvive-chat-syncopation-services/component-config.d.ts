/** Declarative component configuration — one schema drives attributes, the
 *  `config` object, and the design-state form. */

export interface ConfigField {
  type: 'string' | 'number' | 'boolean';
  default: unknown;
  label?: string;
  description?: string;
  /** When present, renders a <select> in design state. */
  options?: string[];
}

export type ConfigSchema = Record<string, ConfigField>;

/** `max-turns` → `maxTurns`. */
export declare function attrToKey(attr: string): string;
/** `maxTurns` → `max-turns`. */
export declare function keyToAttr(key: string): string;

/** Coerces a raw attribute string to the field's schema type. */
export declare function coerceValue(schema: ConfigField, raw: string | null): unknown;

/**
 * Resolves an element's configuration from its constructor's `configSchema`:
 * schema defaults < attributes < object overrides.
 */
export declare function resolveComponentConfig(
  element: HTMLElement,
  overrides?: Record<string, unknown>
): Record<string, unknown>;
