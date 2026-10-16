/**
 * The chat container.
 *
 * It owns layout and nothing else. Every surface inside it — canvas, prompt,
 * nudge, voice — is slotted, so a page composes the experience it wants instead
 * of accepting one opinion about what a chat looks like. That is the whole point
 * of the collection: a prompt row above the transcript, a CLI instead of a
 * textarea, or no visible transcript at all are all valid arrangements.
 *
 * If no services element governs it, it creates one. A single tag on the page
 * should produce a working chat; explicit services are for pages that need to
 * reach the bus or share one conversation across two surfaces.
 */
import { THEME_CSS, motifCSSOutput } from '../machvive-chat-syncopation-services/theme.js';
import { findServices, SERVICES_TAG } from '../machvive-chat-syncopation-services/machvive-chat-syncopation-services.js';
import { resolveComponentConfig, keyToAttr } from '../machvive-chat-syncopation-services/component-config.js';
import { renderConfigForm, CONFIG_FORM_CSS } from '../machvive-chat-syncopation-services/config-form.js';
import { ICON_ROOT_CSS, ICON_CSS, ICON_STYLE_ID } from '../machvive-chat-syncopation-services/icons.js';
import { CHAT_STATE_ATTR } from '../machvive-chat-syncopation-services/state.js';

const CONFIG_ATTRS = ['transport', 'model', 'endpoint', 'persist', 'max-turns', 'streaming'];

/**
 * Hoists the icon set to `:root` in the light DOM.
 *
 * A component cannot export custom properties outward — `:host` vars flow in,
 * never out — so the icons have to be set on `:root` from light DOM, and the
 * container is the carrier. Appended once, keyed by id, so any number of
 * instances share it. Icons recolour with the theme via `currentColor`, so the
 * same definition serves light and dark surfaces with no duplicate.
 */
function hoistIcons() {
  if (typeof document === 'undefined' || document.getElementById(ICON_STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = ICON_STYLE_ID;
  style.textContent = ICON_ROOT_CSS + ICON_CSS;
  document.head.append(style);
}

export class MachviveChatSyncopation extends HTMLElement {
  static configSchema = {
    height: { type: 'string', default: '', label: 'Height', description: 'Surface height (CSS length); empty uses the 32rem default' }
  };

  // The container observes its config keys plus data-chat-state, which it
  // mirrors onto the services element it creates — so a page can author the
  // surface state on the container it actually writes markup for.
  static get observedAttributes() {
    return [...Object.keys(this.configSchema).map(keyToAttr), CHAT_STATE_ATTR];
  }

  #services = null;
  #overrides = {};
  #createdServices = false;
  #off = [];
  #waiting = false;

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
    if (oldValue === newValue) return;
    if (name === CHAT_STATE_ATTR) {
      // Mirror onto the services element — the runtime authority — so the whole
      // governed surface transitions together.
      if (newValue == null) this.#services?.removeAttribute(CHAT_STATE_ATTR);
      else this.#services?.setAttribute(CHAT_STATE_ATTR, newValue);
      return;
    }
    if (!this.shadowRoot?.childElementCount) return;
    this.#render();
  }

  connectedCallback() {
    hoistIcons();
    this.#services = findServices(this) ?? this.#createServices();
    if (this.#services?.bus) {
      this.#off = [
        this.#services.bus.on('state:changed', () => this.#render()),
        // The wait state is the daemon's busy signal made visible: a turn
        // starting animates the border, ending (or stopping) stills it.
        this.#services.bus.on('daemon:busy', () => this.#setWaiting(true)),
        this.#services.bus.on('daemon:idle', () => this.#setWaiting(false))
      ];
    }
    this.#render();
  }

  #setWaiting(on) {
    this.#waiting = on;
    this.toggleAttribute('waiting', on);
  }

  disconnectedCallback() {
    for (const off of this.#off) off();
    this.#off = [];
  }

  #render() {
    const { height } = this.config;
    const design = this.#services?.state === 'design';
    this.shadowRoot.innerHTML = `
      <style>
${THEME_CSS}
${motifCSSOutput()}
        :host {
          display: flex;
          flex-direction: column;
          /* Anchors the wait-state ::after ring to the host's own box. */
          position: relative;
          /* A chat surface needs a bounded height or the transcript grows the
             page and the prompt walks off the bottom of the viewport. */
          height: var(--mcs-height, 32rem);
          max-height: 100%;
          font-family: var(--mcs-font);
          color: var(--mcs-fg);
          background: var(--mcs-bg);
          border: 1px solid var(--mcs-border);
          border-radius: var(--mcs-radius);
          overflow: hidden;
        }
        header, footer { flex: 0 0 auto; }
        .body { flex: 1 1 auto; min-height: 0; display: flex; flex-direction: column; }
        header::slotted(*) { display: block; }
        /* Wait state: an animated gradient ring on the outermost border while a
           turn generates. The gradient is theme-derived — accent through muted
           and back — so it follows light, dark and any page token overrides
           rather than a fixed rainbow. The ring sits flush against the host edge
           (the host clips its content with overflow:hidden, so the ring cannot
           overhang); z-index:-1 keeps it behind the host's own background. */
        :host::after {
          content: '';
          position: absolute;
          inset: 0;
          border-radius: var(--mcs-radius);
          padding: 2px;
          background: linear-gradient(60deg,
            var(--mcs-accent),
            var(--mcs-muted),
            var(--mcs-danger),
            var(--mcs-accent));
          background-size: 300% 300%;
          /* Mask to a ring: the padding box shows the gradient, the content
             box is cut out, so only the 2px border band is visible. The mask
             colour never paints — it only marks opacity — so it uses a system
             colour, not a token or a hex. */
          -webkit-mask: linear-gradient(Canvas 0 0) content-box, linear-gradient(Canvas 0 0);
          -webkit-mask-composite: xor;
          mask: linear-gradient(Canvas 0 0) content-box, linear-gradient(Canvas 0 0);
          mask-composite: exclude;
          pointer-events: none;
          opacity: 0;
          transition: opacity 240ms ease;
        }
        :host([waiting])::after {
          opacity: 1;
          animation: mcs-wait-gradient 3s ease alternate infinite;
        }
        @keyframes mcs-wait-gradient {
          0% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
          100% { background-position: 0% 50%; }
        }
        @media (prefers-reduced-motion: reduce) {
          :host([waiting])::after { animation: none; opacity: 1; }
        }
${design ? CONFIG_FORM_CSS : ''}
      </style>
      <header><slot name="header"></slot></header>
      <div class="body"><slot></slot></div>
      <footer><slot name="footer"></slot></footer>
    `;
    if (height) this.style.setProperty('--mcs-height', height);
    if (design) renderConfigForm(this.shadowRoot, this.constructor.configSchema, this.config, (k, v) => this.#applyConfig(k, v));
  }

  /** Mirrors the container's config attributes onto the services it created. */
  #createServices() {
    const services = document.createElement(SERVICES_TAG);
    for (const attr of CONFIG_ATTRS) {
      if (this.hasAttribute(attr)) services.setAttribute(attr, this.getAttribute(attr));
    }
    // The surface state mirrors too, so a page authors it on the container.
    if (this.hasAttribute(CHAT_STATE_ATTR)) services.setAttribute(CHAT_STATE_ATTR, this.getAttribute(CHAT_STATE_ATTR));
    // Light DOM, not shadow: slotted children walk up through the light tree,
    // and a services element inside the shadow root would be invisible to them.
    this.prepend(services);
    return services;
  }

  get services() { return this.#services; }
  get conversation() { return this.#services?.conversation ?? null; }
  send(text) { return this.#services?.send(text); }
}

if (!customElements.get('machvive-chat-syncopation')) {
  customElements.define('machvive-chat-syncopation', MachviveChatSyncopation);
}
