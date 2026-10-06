import type { ConfigSchema } from './component-config.js';

/**
 * Renders a labelled control row per schema key into `container`. Values are
 * written with textContent / value — never innerHTML.
 *
 * @returns the appended <form> element.
 */
export declare function renderConfigForm(
  container: ShadowRoot | Element,
  schema: ConfigSchema,
  config: Record<string, unknown>,
  apply: (key: string, value: unknown) => void
): HTMLFormElement;

/** Scoped styles for the design-state form; components interpolate it in design mode. */
export declare const CONFIG_FORM_CSS: string;
