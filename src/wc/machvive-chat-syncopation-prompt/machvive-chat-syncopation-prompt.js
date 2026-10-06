/**
 * The composer.
 *
 * Enter sends, Shift+Enter inserts a newline — the convention every chat surface
 * now shares, and violating it costs a user a mis-sent message before they learn
 * otherwise. The textarea grows to a ceiling so a long paragraph is visible
 * while composing without the transcript disappearing.
 *
 * While a turn is generating the button becomes Stop rather than disabling. A
 * disabled control leaves the user watching output they cannot interrupt, which
 * is the one thing a streaming interface must never do.
 */
import { THEME_CSS, CONTROL_CSS } from '../machvive-chat-syncopation-services/theme.js';
import { whenServices } from '../machvive-chat-syncopation-services/machvive-chat-syncopation-services.js';
import { resolveComponentConfig, keyToAttr } from '../machvive-chat-syncopation-services/component-config.js';
import { renderConfigForm, CONFIG_FORM_CSS } from '../machvive-chat-syncopation-services/config-form.js';

export class MachviveChatSyncopationPrompt extends HTMLElement {
  static configSchema = {
    placeholder: { type: 'string', default: 'Message…', label: 'Placeholder', description: 'Empty-field hint text' },
    label: { type: 'string', default: 'Message', label: 'Accessible label', description: 'Screen-reader label for the field' }
  };

  static get observedAttributes() {
    return [...Object.keys(this.configSchema).map(keyToAttr), 'state'];
  }

  #services = null;
  #off = [];
  #field = null;
  #button = null;
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

  attributeChangedCallback(name, oldValue, newValue) {
    if (oldValue === newValue || !this.shadowRoot?.childElementCount) return;
    if (name === 'state' || name === 'placeholder' || name === 'label') this.#render();
  }

  async connectedCallback() {
    this.#render();

    this.#services = await whenServices(this);
    if (!this.#services || !this.isConnected) return;
    this.#off = [
      this.#services.bus.on('daemon:idle', () => this.#setMode('send')),
      // A nudge or a CLI can hand text to the composer; routing it through the
      // same field means the user still sees and can edit it before sending.
      this.#services.bus.on('prompt:fill', ({ text, send }) => this.fill(text, { send }))
    ];
  }

  #render() {
    const { placeholder, label } = this.config;
    const design = this.getAttribute('state') === 'design';
    this.shadowRoot.innerHTML = `
      <style>
${THEME_CSS}
${CONTROL_CSS}
        :host {
          display: block;
          flex: 0 0 auto;
          padding: 0.5rem;
          font-family: var(--mcs-font);
          color: var(--mcs-fg);
          background: var(--mcs-bg);
          border-top: 1px solid var(--mcs-border);
        }
        form.composer { display: flex; gap: 0.5rem; align-items: flex-end; }
        textarea {
          flex: 1 1 auto;
          min-height: 2.5rem;
          max-height: 8rem;
          padding: 0.5rem;
          resize: none;
          background: var(--mcs-surface);
        }
        button {
          flex: 0 0 auto;
          padding: 0.5rem 1rem;
          min-height: 2.5rem;
          cursor: pointer;
          background: var(--mcs-accent);
          color: var(--mcs-accent-fg);
          border-color: transparent;
        }
        button[data-mode="stop"] { background: var(--mcs-surface); color: var(--mcs-fg); border-color: var(--mcs-border); }
        /* Focus has to be visible against both themes; the UA default ring
           disappears on a dark surface. */
        :focus-visible { outline: 2px solid var(--mcs-accent); outline-offset: 2px; }
        .sr { position: absolute; width: 1px; height: 1px; overflow: hidden; clip-path: inset(50%); }
${design ? CONFIG_FORM_CSS : ''}
      </style>
      <form class="composer">
        <label class="sr" for="field"></label>
        <textarea id="field" rows="1"></textarea>
        <button type="submit" data-mode="send">Send</button>
      </form>
    `;
    const srLabel = this.shadowRoot.querySelector('label.sr');
    const field = this.shadowRoot.querySelector('textarea');
    // textContent / property assignment: config values are page data, not markup.
    srLabel.textContent = label;
    field.placeholder = placeholder;
    this.#field = field;
    this.#button = this.shadowRoot.querySelector('button');
    this.shadowRoot.querySelector('form.composer').addEventListener('submit', this.#submit);
    this.#field.addEventListener('keydown', this.#keydown);
    this.#field.addEventListener('input', this.#autosize);
    if (design) renderConfigForm(this.shadowRoot, this.constructor.configSchema, this.config, (k, v) => this.#applyConfig(k, v));
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
    this.#button.textContent = mode === 'stop' ? 'Stop' : 'Send';
  }
}

if (!customElements.get('machvive-chat-syncopation-prompt')) {
  customElements.define('machvive-chat-syncopation-prompt', MachviveChatSyncopationPrompt);
}
