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
import { THEME_CSS } from '../machvive-chat-syncopation-services/theme.js';
import { findServices, SERVICES_TAG } from '../machvive-chat-syncopation-services/machvive-chat-syncopation-services.js';

const CONFIG_ATTRS = ['transport', 'model', 'endpoint', 'persist', 'max-turns', 'streaming'];

export class MachviveChatSyncopation extends HTMLElement {
  #services = null;

  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
  }

  connectedCallback() {
    this.#services = findServices(this) ?? this.#createServices();
    this.shadowRoot.innerHTML = `
      <style>
${THEME_CSS}
        :host {
          display: flex;
          flex-direction: column;
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
      </style>
      <header><slot name="header"></slot></header>
      <div class="body"><slot></slot></div>
      <footer><slot name="footer"></slot></footer>
    `;
  }

  /** Mirrors the container's config attributes onto the services it created. */
  #createServices() {
    const services = document.createElement(SERVICES_TAG);
    for (const attr of CONFIG_ATTRS) {
      if (this.hasAttribute(attr)) services.setAttribute(attr, this.getAttribute(attr));
    }
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
