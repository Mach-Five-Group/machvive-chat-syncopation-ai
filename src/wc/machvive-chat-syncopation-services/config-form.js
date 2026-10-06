/**
 * Design-state configuration form.
 *
 * One renderer, driven entirely by a component's `configSchema`, so every
 * element presents its knobs the same way. The form is isomorphic by
 * construction: changing a field calls the provided `apply` callback, and the
 * component reflects that back into its runtime appearance and its attributes.
 *
 * Values are written with textContent / value — schema labels and current
 * values are page data, not markup.
 */

/**
 * Renders a labelled control row per schema key into `container`.
 *
 * @param {ShadowRoot|Element} container where the form goes
 * @param {object} schema the component's static configSchema
 * @param {object} config the component's resolved config
 * @param {(key: string, value: any) => void} apply persist + apply one change
 */
export function renderConfigForm(container, schema, config, apply) {
  const form = document.createElement('form');
  form.className = 'design-form';
  form.addEventListener('submit', (e) => e.preventDefault());

  for (const [key, def] of Object.entries(schema)) {
    const row = document.createElement('label');
    row.className = 'design-row';

    const caption = document.createElement('span');
    caption.className = 'design-label';
    caption.textContent = def.label ?? key;
    if (def.description) caption.title = def.description;
    row.append(caption);

    let control;
    if (def.type === 'boolean') {
      control = document.createElement('input');
      control.type = 'checkbox';
      control.checked = Boolean(config[key]);
      control.addEventListener('change', () => apply(key, control.checked));
    } else if (def.type === 'number') {
      control = document.createElement('input');
      control.type = 'number';
      control.value = String(config[key] ?? '');
      control.addEventListener('change', () => apply(key, Number(control.value)));
    } else if (Array.isArray(def.options)) {
      control = document.createElement('select');
      for (const option of def.options) {
        const el = document.createElement('option');
        el.value = option;
        el.textContent = option;
        control.append(el);
      }
      control.value = String(config[key] ?? '');
      control.addEventListener('change', () => apply(key, control.value));
    } else {
      control = document.createElement('input');
      control.type = 'text';
      control.value = config[key] == null ? '' : String(config[key]);
      control.addEventListener('change', () => apply(key, control.value));
    }
    control.dataset.configKey = key;
    row.append(control);
    form.append(row);
  }

  container.append(form);
  return form;
}

/** Scoped styles for the form; components interpolate this in design mode. */
export const CONFIG_FORM_CSS = `
.design-form { display: flex; flex-direction: column; gap: 0.375rem; padding: 0.5rem; font-family: var(--mcs-font); }
.design-row { display: flex; align-items: center; gap: 0.5rem; font-size: 0.8125rem; }
.design-label { flex: 0 0 8rem; color: var(--mcs-muted); }
.design-row input[type="text"], .design-row input[type="number"], .design-row select {
  flex: 1 1 auto; min-width: 0; padding: 0.25rem 0.375rem;
  background: var(--mcs-surface); color: var(--mcs-fg);
  border: 1px solid var(--mcs-border); border-radius: var(--mcs-radius);
  font: inherit;
}
.design-row input[type="checkbox"] { accent-color: var(--mcs-accent); }
`;
