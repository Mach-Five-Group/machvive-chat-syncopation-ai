/**
 * Declarative component configuration.
 *
 * Every element in the collection declares `static configSchema` — one object
 * whose keys are camelCase, each mapping to `{ type, default, label,
 * description, options? }`. The same declaration drives everything: attribute
 * parsing, `element.config` object overrides, and the design-state form, so
 * the three can never drift apart. That consistency is the point of the
 * schema — a knob you can set in markup but not see in the design UI is a
 * knob an integrator will lose.
 *
 * Resolution order is defaults < attributes < object overrides.
 */

/**
 * Parses a hyphenated attribute name into a camelCase schema key.
 * `max-turns` → `maxTurns`.
 */
export const attrToKey = (attr) => attr.replace(/-([a-z])/g, (_, c) => c.toUpperCase());

/** camelCase schema key to hyphenated attribute name. `maxTurns` → `max-turns`. */
export const keyToAttr = (key) => key.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`);

/**
 * Coerces a raw attribute string to the schema type. Booleans follow HTML
 * presence semantics ("persist" and persist="true" are on; persist="false"
 * is off), except when a default of true flips the meaning — then only an
 * explicit "false" turns it off, matching the existing streaming/persist
 * coercion.
 */
export function coerceValue(schema, raw) {
  if (raw == null) return raw;
  switch (schema.type) {
    case 'boolean':
      if (raw === '' || raw === 'true') return true;
      if (raw === 'false') return false;
      return schema.default !== true;
    case 'number': {
      const n = Number(raw);
      return Number.isNaN(n) ? schema.default : n;
    }
    default:
      return raw;
  }
}

/**
 * Resolves an element's configuration from its constructor's `configSchema`.
 * Object overrides passed to `element.config` win over attributes, which win
 * over schema defaults.
 */
export function resolveComponentConfig(element, overrides = {}) {
  const schema = element.constructor.configSchema ?? {};
  const config = {};
  for (const [key, def] of Object.entries(schema)) config[key] = def.default;
  for (const [key, def] of Object.entries(schema)) {
    const attr = keyToAttr(key);
    if (element.hasAttribute?.(attr)) config[key] = coerceValue(def, element.getAttribute(attr));
  }
  for (const [key, value] of Object.entries(overrides)) {
    if (key in schema && value !== undefined) config[key] = value;
  }
  return config;
}
