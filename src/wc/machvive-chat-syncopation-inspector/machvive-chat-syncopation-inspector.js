/**
 * A window onto the bus, for the person building the surface.
 *
 * It subscribes to the wildcard topic, so it shows traffic from components that
 * did not exist when it was written — including an integrator's own. That is the
 * point: a chat bug is almost always a sequencing bug, and a list of topics in
 * the order they fired answers it faster than a breakpoint.
 *
 * Capped and opt-in. It holds the last N events in memory and is a development
 * tool, not telemetry: nothing leaves the page, and importing it emits nothing.
 */
import { THEME_CSS, CONTROL_CSS } from '../machvive-chat-syncopation-services/theme.js';
import { whenServices } from '../machvive-chat-syncopation-services/machvive-chat-syncopation-services.js';
import { resolveComponentConfig, keyToAttr } from '../machvive-chat-syncopation-services/component-config.js';
import { renderConfigForm, CONFIG_FORM_CSS } from '../machvive-chat-syncopation-services/config-form.js';

export class MachviveChatSyncopationInspector extends HTMLElement {
  static configSchema = {
    limit: { type: 'number', default: 200, label: 'Event limit', description: 'How many bus events to keep in view' }
  };

  static get observedAttributes() {
    return [...Object.keys(this.configSchema).map(keyToAttr), 'state'];
  }

  #services = null;
  #off = [];
  #events = [];
  #body = null;
  #paused = false;
  #overrides = {};

  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
  }

  get config() { return resolveComponentConfig(this, this.#overrides); }
  set config(overrides) {
    if (overrides == null || typeof overrides !== 'object') return;
    for (const [key, value] of Object.entries(overrides)) this.#applyConfig(key, value);
  }

  #applyConfig(key, value) {
    if (!(key in this.constructor.configSchema)) return;
    this.#overrides[key] = value;
    this.setAttribute(keyToAttr(key), String(value));
  }

  get limit() { return this.config.limit; }
  get events() { return [...this.#events]; }

  attributeChangedCallback(name, oldValue, newValue) {
    if (oldValue === newValue || !this.shadowRoot?.childElementCount) return;
    if (name === 'state') this.#render();
  }

  async connectedCallback() {
    this.#render();

    this.#services = await whenServices(this);
    if (!this.#services || !this.isConnected) {
      this.shadowRoot.querySelector('.empty').textContent =
        'No <machvive-chat-syncopation-services> found — the inspector reads that element’s bus.';
      return;
    }
    this.#off = [this.#services.bus.on('*', (event) => this.#record(event))];
  }

  #render() {
    const design = this.getAttribute('state') === 'design';
    this.shadowRoot.innerHTML = `
      <style>
${THEME_CSS}
${CONTROL_CSS}
        :host {
          display: block;
          font-family: var(--mcs-mono);
          font-size: 0.8125rem;
          color: var(--mcs-fg);
          /* Paints its own surface: a component that themes its text and
             inherits the page's background renders light-on-light. */
          background: var(--mcs-bg);
          border: 1px solid var(--mcs-border);
          border-radius: var(--mcs-radius);
          overflow: hidden;
        }
        header {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          padding: 0.375rem 0.5rem;
          background: var(--mcs-surface);
          border-bottom: 1px solid var(--mcs-border);
        }
        h2 { margin: 0; font-size: 0.8125rem; font-weight: 600; flex: 1 1 auto; }
        header button { padding: 0.25rem 0.5rem; cursor: pointer; font-size: 0.75rem; }
        header button[aria-pressed="true"] { background: var(--mcs-accent); color: var(--mcs-accent-fg); border-color: transparent; }
        .log { margin: 0; padding: 0; list-style: none; max-height: var(--mcs-inspector-height, 14rem); overflow-y: auto; }
        .log li { display: flex; gap: 0.5rem; padding: 0.1875rem 0.5rem; border-bottom: 1px solid var(--mcs-border); }
        .log li:last-child { border-bottom: 0; }
        time { color: var(--mcs-muted); flex: 0 0 5.5rem; }
        .topic { flex: 0 0 11rem; color: var(--mcs-accent); overflow-wrap: anywhere; }
        .detail { flex: 1 1 auto; color: var(--mcs-muted); overflow-wrap: anywhere; }
        .empty { padding: 0.5rem; margin: 0; color: var(--mcs-muted); }
        :focus-visible { outline: 2px solid var(--mcs-accent); outline-offset: 2px; }
${design ? CONFIG_FORM_CSS : ''}
      </style>
      <header>
        <h2>Bus</h2>
        <button type="button" class="pause" aria-pressed="false">Pause</button>
        <button type="button" class="clear">Clear</button>
      </header>
      <ul class="log"></ul>
      <p class="empty">Waiting for events…</p>
    `;
    this.#body = this.shadowRoot.querySelector('.log');
    this.shadowRoot.querySelector('.pause').addEventListener('click', (e) => {
      this.#paused = !this.#paused;
      e.currentTarget.setAttribute('aria-pressed', String(this.#paused));
      e.currentTarget.textContent = this.#paused ? 'Resume' : 'Pause';
    });
    this.shadowRoot.querySelector('.clear').addEventListener('click', () => {
      this.#events = [];
      this.#body.replaceChildren();
      this.shadowRoot.querySelector('.empty').hidden = false;
    });
    if (design) renderConfigForm(this.shadowRoot, this.constructor.configSchema, this.config, (k, v) => this.#applyConfig(k, v));
  }

  disconnectedCallback() {
    for (const off of this.#off) off();
    this.#off = [];
  }

  #record({ topic, payload }) {
    if (this.#paused) return;
    const entry = { at: new Date(), topic, detail: summarize(payload) };
    this.#events.push(entry);
    if (this.#events.length > this.limit) this.#events.splice(0, this.#events.length - this.limit);

    const row = document.createElement('li');
    const time = document.createElement('time');
    time.textContent = entry.at.toISOString().slice(11, 23);
    const name = document.createElement('span');
    name.className = 'topic';
    name.textContent = topic;
    const detail = document.createElement('span');
    detail.className = 'detail';
    // textContent throughout: payloads carry model output, and innerHTML here
    // would make every reply a script-injection vector into the dev tool.
    detail.textContent = entry.detail;
    row.append(time, name, detail);

    this.#body.append(row);
    while (this.#body.childElementCount > this.limit) this.#body.firstElementChild.remove();
    this.shadowRoot.querySelector('.empty').hidden = true;
    this.#body.scrollTop = this.#body.scrollHeight;
  }
}

/** One readable line per payload; a full JSON dump is unreadable at this width. */
function summarize(payload) {
  if (payload == null) return '';
  if (typeof payload === 'string') return clip(payload);
  if (payload.chunk !== undefined) return clip(payload.chunk);
  if (payload.role) return `${payload.role}/${payload.status} ${clip(payload.text ?? '')}`;
  try { return clip(JSON.stringify(payload)); } catch { return String(payload); }
}
const clip = (text, max = 120) => (text.length > max ? `${text.slice(0, max)}…` : text);

if (!customElements.get('machvive-chat-syncopation-inspector')) {
  customElements.define('machvive-chat-syncopation-inspector', MachviveChatSyncopationInspector);
}
