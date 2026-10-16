/**
 * The composer.
 *
 * A three-row grid: a status line that surfaces what the surface wants to say
 * (offline, a failed turn, a state change), the growing textarea, and an action
 * row that other components register into — voice adds its mic here rather than
 * shipping a second button. Enter sends, Shift+Enter inserts a newline; while a
 * turn generates the button becomes Stop rather than disabling, because a
 * disabled control leaves the user watching output they cannot interrupt.
 *
 * The animated wait-state border lives on the *container*, not here — this row's
 * job is the message channel, not the activity channel.
 */
import { CONTROL_CSS, SCROLL_CSS } from '../machvive-chat-syncopation-services/theme.js';
import { whenServices } from '../machvive-chat-syncopation-services/machvive-chat-syncopation-services.js';
import { resolveComponentConfig, keyToAttr } from '../machvive-chat-syncopation-services/component-config.js';
import { renderConfigForm, CONFIG_FORM_CSS } from '../machvive-chat-syncopation-services/config-form.js';
import { ICON_CSS } from '../machvive-chat-syncopation-services/icons.js';

export class MachviveChatSyncopationPrompt extends HTMLElement {
  static configSchema = {
    placeholder: { type: 'string', default: 'Message…', label: 'Placeholder', description: 'Empty-field hint text' },
    label: { type: 'string', default: 'Message', label: 'Accessible label', description: 'Screen-reader label for the field' },
    status: { type: 'string', default: '', label: 'Status override', description: 'Pin a status message; empty lets the surface derive one' }
  };

  // Components observe their own config keys; the surface state is owned by the
  // services element and inherited, so `state` is deliberately NOT observed here.
  static get observedAttributes() {
    return Object.keys(this.configSchema).map(keyToAttr);
  }

  #services = null;
  #off = [];
  #field = null;
  #button = null;
  #statusEl = null;
  #overrides = {};
  #actions = new Map();
  /** The message the bus derived — shown only when no explicit status is set. */
  #derivedStatus = '';
  #derivedSeverity = 'info';

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

  /**
   * Registers an action into the action row. This is how voice, an overflow
   * menu or an integrator's own button joins the composer without a second
   * component re-implementing the row. `run` receives the prompt element.
   */
  registerAction(name, { icon = 'settings', label = name, run, order = 100 } = {}) {
    this.#actions.set(name, { icon, label, run, order });
    this.#renderActions();
    return this;
  }

  attributeChangedCallback(name, oldValue, newValue) {
    if (oldValue === newValue || !this.shadowRoot?.childElementCount) return;
    this.#render();
  }

  async connectedCallback() {
    this.#render();

    this.#services = await whenServices(this);
    if (!this.#services || !this.isConnected) return;
    this.#off = [
      this.#services.bus.on('daemon:idle', () => this.#setMode('send')),
      // A nudge or a CLI can hand text to the composer; routing it through the
      // same field means the user still sees and can edit it before sending.
      this.#services.bus.on('prompt:fill', ({ text, send }) => this.fill(text, { send })),
      // The surface state is inherited from services; re-render when it changes.
      this.#services.bus.on('state:changed', () => this.#render()),
      // The status channel: a failed turn or a state transition is the kind of
      // thing the surface should say, not the kind of thing it should hide.
      this.#services.bus.on('daemon:error', (e) => this.#derive(`Something went wrong — ${e.error}`, 'error')),
      this.#services.bus.on('daemon:busy', () => this.#derive('')),
      this.#services.bus.on('daemon:idle', () => this.#derive('')),
      this.#services.bus.on('state:changed', ({ to }) => {
        if (to === 'disabled') this.#derive('This surface is read-only', 'info');
        else if (to === 'loading') this.#derive('Loading…', 'info');
        else this.#derive(''); // enabled / design: nothing to announce
      })
    ];
    this.#render();
  }

  #render() {
    const { placeholder, label, status } = this.config;
    const state = this.#services?.state ?? 'enabled';
    const design = state === 'design';
    const disabled = state === 'disabled';
    const loading = state === 'loading';
    // Page-set status wins; the bus-derived message is the fallback.
    const statusText = status || this.#derivedStatus;
    this.shadowRoot.innerHTML = `
      <style>
${CONTROL_CSS}
${SCROLL_CSS}
${ICON_CSS}
        :host {
          display: block;
          flex: 0 0 auto;
          font-family: var(--mcs-font, system-ui, sans-serif);
          color: var(--mcs-fg, #1a1a1a);
          background: var(--mcs-bg, #ffffff);
          border-top: 1px solid var(--mcs-border, #e2e4e8);
        }
        form.composer {
          display: grid;
          grid-template-areas: "status" "input" "actions";
          grid-template-rows: auto auto auto;
        }
        .row + .row { border-top: 1px solid var(--mcs-border, #e2e4e8); }

        /* Row 1 — the status line. A single left-justified line with an icon and
           real presence (it occupies height only when it has something to say);
           its colour reflects severity from the theme tokens. */
        .status {
          grid-area: status;
          display: flex;
          align-items: center;
          gap: 0.5rem;
          padding: 0.375rem 0.75rem;
          min-height: 1.75rem;
          font-size: 0.8125rem;
          color: var(--mcs-muted, #646464);
          white-space: nowrap;
          overflow: hidden;
          text-align: left;
        }
        .status[hidden] { display: none; }
        .status .status-text { overflow: hidden; text-overflow: ellipsis; }
        .status .mcs-icon { width: 1rem; height: 1rem; flex: 0 0 auto; }
        .status[data-severity="error"] { color: var(--mcs-danger, #a4161a); }
        .status[data-severity="info"] { color: var(--mcs-muted, #646464); }

        /* Row 2 — the input. The textarea grows with content. */
        .input { grid-area: input; display: flex; padding: 0.5rem 0.75rem; }
        textarea {
          flex: 1 1 auto;
          min-height: 2.5rem;
          max-height: 8rem;
          padding: 0.5rem;
          resize: none;
          background: var(--mcs-surface, #f6f7f9);
        }

        /* Row 3 — the action row. Registered actions on the left, send on the right. */
        .actions {
          grid-area: actions;
          display: flex;
          align-items: center;
          gap: 0.375rem;
          padding: 0.375rem 0.75rem;
        }
        .actions .spacer { flex: 1 1 auto; }
        .actions button.action {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          padding: 0.375rem;
          min-width: 2rem;
          min-height: 2rem;
          cursor: pointer;
          background: transparent;
          border-color: transparent;
          color: var(--mcs-muted, #646464);
        }
        .actions button.action:hover { color: var(--mcs-fg, #1a1a1a); }
        .actions button.action .mcs-icon { width: 1.25rem; height: 1.25rem; }
        /* Send is icon-only — the glyph carries it, and the accessible name stays. */
        button.send {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          padding: 0.5rem;
          min-width: 2.25rem;
          min-height: 2.25rem;
          cursor: pointer;
          background: var(--mcs-accent, #1565c0);
          color: var(--mcs-accent-fg, #ffffff);
          border-color: transparent;
          border-radius: var(--mcs-radius, 12px);
        }
        button.send .mcs-icon { width: 1.125rem; height: 1.125rem; }
        button.send[data-mode="stop"] { background: var(--mcs-surface, #f6f7f9); color: var(--mcs-fg, #1a1a1a); border-color: var(--mcs-border, #e2e4e8); }
        button.send[data-mode="stop"] .mcs-icon-send { display: none; }
        button.send[data-mode="stop"] .mcs-icon-stop-circle { display: inline-block; }
        button.send[data-mode="send"] .mcs-icon-stop-circle { display: none; }

        :focus-visible { outline: 2px solid var(--mcs-accent, #1565c0); outline-offset: 2px; }
        .sr { position: absolute; width: 1px; height: 1px; overflow: hidden; clip-path: inset(50%); }
        form.composer[data-state="disabled"] .input,
        form.composer[data-state="disabled"] .actions { pointer-events: none; opacity: 0.6; }
        .loading-bar { height: 2px; background: var(--mcs-surface, #f6f7f9); overflow: hidden; }
        .loading-bar::after { content: ''; display: block; height: 100%; width: 40%; background: var(--mcs-accent, #1565c0);
          animation: mcs-loading 1.1s ease-in-out infinite; }
        @keyframes mcs-loading { 0% { transform: translateX(-100%); } 100% { transform: translateX(250%); } }
        @media (prefers-reduced-motion: reduce) { .loading-bar::after { animation: none; width: 100%; } }
${design ? CONFIG_FORM_CSS : ''}
      </style>
      <form class="composer" data-state="${state}">
        ${loading ? '<div class="loading-bar" role="progressbar" aria-label="Loading"></div>' : ''}
        <p class="status row" role="status" aria-live="polite" data-severity="info" ${statusText ? '' : 'hidden'}><span class="mcs-icon mcs-icon-notifications" aria-hidden="true"></span><span class="status-text"></span></p>
        <div class="input row">
          <label class="sr" for="field"></label>
          <textarea id="field" rows="1" ${disabled ? 'disabled' : ''}></textarea>
        </div>
        <div class="actions row" role="toolbar" aria-label="Composer actions">
          <span class="action-cluster"></span>
          <span class="spacer"></span>
          <button type="submit" class="send" data-mode="send" aria-label="Send" ${disabled ? 'disabled' : ''}><span class="mcs-icon mcs-icon-send" aria-hidden="true"></span><span class="mcs-icon mcs-icon-stop-circle" aria-hidden="true"></span><span class="btn-label sr">Send</span></button>
        </div>
      </form>
    `;
    const srLabel = this.shadowRoot.querySelector('label.sr');
    const field = this.shadowRoot.querySelector('textarea');
    // textContent / property assignment: config values are page data, not markup.
    srLabel.textContent = label;
    field.placeholder = placeholder;
    this.#field = field;
    this.#button = this.shadowRoot.querySelector('button.send');
    this.#statusEl = this.shadowRoot.querySelector('.status');
    if (statusText) this.#applyStatus();
    this.shadowRoot.querySelector('form.composer').addEventListener('submit', this.#submit);
    this.#field.addEventListener('keydown', this.#keydown);
    this.#field.addEventListener('input', this.#autosize);
    this.#renderActions();
    if (design) renderConfigForm(this.shadowRoot, this.constructor.configSchema, this.config, (k, v) => this.#applyConfig(k, v));
  }

  /** The bus-derived status. An explicit `status` config always wins. */
  #derive(text, severity = 'info') {
    this.#derivedStatus = text;
    this.#derivedSeverity = severity;
    this.#applyStatus();
  }

  #applyStatus() {
    if (!this.#statusEl) return;
    const text = this.config.status || this.#derivedStatus;
    this.#statusEl.querySelector('.status-text').textContent = text;
    this.#statusEl.dataset.severity = this.#derivedSeverity;
    this.#statusEl.hidden = !text;
  }

  #renderActions() {
    const cluster = this.shadowRoot.querySelector('.action-cluster');
    if (!cluster) return;
    const ordered = [...this.#actions.entries()].sort((a, b) => a[1].order - b[1].order);
    cluster.replaceChildren(...ordered.map(([name, action]) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'action';
      button.title = action.label;
      button.setAttribute('aria-label', action.label);
      button.dataset.action = name;
      const icon = document.createElement('span');
      icon.className = `mcs-icon mcs-icon-${action.icon}`;
      icon.setAttribute('aria-hidden', 'true');
      button.append(icon);
      // Hold-to-talk actions (voice) need press/release, not click.
      if (action.onPress || action.onRelease) {
        button.addEventListener('pointerdown', () => action.onPress?.(this));
        button.addEventListener('pointerup', () => action.onRelease?.(this));
        button.addEventListener('pointerleave', () => action.onRelease?.(this));
      } else {
        button.addEventListener('click', () => action.run?.(this));
      }
      return button;
    }));
  }

  disconnectedCallback() {
    for (const off of this.#off) off();
    this.#off = [];
  }

  /** Puts text in the field. `send` only submits when explicitly asked. */
  fill(text, { send = false } = {}) {
    if (!this.#field) return;
    this.#field.value = text;
    this.#autosize();
    this.#field.focus();
    if (send) this.#send();
  }

  #autosize = () => {
    if (!this.#field) return;
    this.#field.style.height = 'auto';
    this.#field.style.height = `${this.#field.scrollHeight}px`;
  };

  #keydown = (event) => {
    if (event.key === 'Enter' && !event.shiftKey && !event.isComposing) {
      event.preventDefault();
      this.#send();
    }
  };

  #submit = (event) => {
    event.preventDefault();
    this.#send();
  };

  #send() {
    if (this.#services?.daemon?.busy) {
      this.#services.daemon.stop();
      this.#setMode('send');
      return;
    }
    const text = this.#field.value.trim();
    if (!text) return;
    this.#field.value = '';
    this.#autosize();
    this.#setMode('stop');
    this.dispatchEvent(new CustomEvent('prompt-submit', { detail: { text }, bubbles: true, composed: true }));
    this.#services?.send(text);
  }

  #setMode(mode) {
    if (!this.#button) return;
    this.#button.dataset.mode = mode;
    // The button is icon-only; keep the accessible name accurate.
    this.#button.setAttribute('aria-label', mode === 'stop' ? 'Stop' : 'Send');
    const label = this.#button.querySelector('.btn-label');
    if (label) label.textContent = mode === 'stop' ? 'Stop' : 'Send';
  }
}

if (!customElements.get('machvive-chat-syncopation-prompt')) {
  customElements.define('machvive-chat-syncopation-prompt', MachviveChatSyncopationPrompt);
}
