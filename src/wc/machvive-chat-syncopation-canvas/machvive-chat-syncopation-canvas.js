/**
 * Renders the transcript.
 *
 * Append-only by design: a streaming turn updates one node's text rather than
 * re-rendering the list, because re-rendering steals focus, collapses a text
 * selection, and makes a screen reader re-announce turns the user already heard.
 *
 * Autoscroll follows the bottom only while the reader is already there. Yanking
 * someone back down while they are reading earlier context is the single most
 * common way a chat surface becomes unusable.
 */
import { THEME_CSS } from '../machvive-chat-syncopation-services/theme.js';
import { whenServices } from '../machvive-chat-syncopation-services/machvive-chat-syncopation-services.js';
import { resolveComponentConfig, keyToAttr } from '../machvive-chat-syncopation-services/component-config.js';
import { renderConfigForm, CONFIG_FORM_CSS } from '../machvive-chat-syncopation-services/config-form.js';

const NEAR_BOTTOM_PX = 48;

export class MachviveChatSyncopationCanvas extends HTMLElement {
  static configSchema = {
    emptyText: { type: 'string', default: 'No messages yet.', label: 'Empty text', description: 'Shown while the transcript is empty' }
  };

  static get observedAttributes() {
    return [...Object.keys(this.configSchema).map(keyToAttr), 'state'];
  }

  #off = [];
  #nodes = new Map();
  #list = null;
  #pinned = true;
  #services = null;
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
    if (name === 'state') {
      // Rebuilding the shell detaches every rendered node. Resync from the
      // conversation — the source of truth — rather than re-appending nodes
      // that may no longer match it (a clear() during design state leaves the
      // map holding records the conversation no longer has).
      this.#render();
      this.#resync();
    } else if (name === 'empty-text') {
      const empty = this.shadowRoot.querySelector('.empty');
      if (empty) empty.textContent = this.config.emptyText;
    }
  }

  async connectedCallback() {
    this.#render();

    const services = await whenServices(this);
    if (!services || !this.isConnected) return;
    this.#services = services;

    for (const record of services.conversation.records) this.#upsert(record);
    this.#off = [
      services.bus.on('record:added', (r) => this.#upsert(r)),
      services.bus.on('record:appended', ({ record }) => this.#upsert(record)),
      services.bus.on('record:updated', (r) => this.#upsert(r)),
      services.bus.on('conversation:cleared', () => this.#reset())
    ];
    this.#toggleEmpty();
  }

  #render() {
    const design = this.getAttribute('state') === 'design';
    this.shadowRoot.innerHTML = `
      <style>
${THEME_CSS}
        :host {
          display: block;
          flex: 1 1 auto;
          min-height: 0;
          overflow-y: auto;
          padding: 0.75rem;
          font-family: var(--mcs-font);
          color: var(--mcs-fg);
          background: var(--mcs-bg);
          /* Deliberately NOT scroll-behavior: smooth. Autoscroll here fires on
             every streamed chunk, and an animated scroll means the view
             perpetually lags the newest text — while scrollTop reads taken
             mid-animation are unreliable, which breaks the very pinned-to-bottom
             detection that keeps us from yanking a reader around. Measured in
             Chrome: setting scrollTop = 0 under smooth settled at 35, not 0. */
        }
        ol { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 0.5rem; }
        li { display: flex; }
        li[data-role="user"] { justify-content: flex-end; }
        .bubble {
          max-width: min(42rem, 85%);
          padding: 0.5rem 0.75rem;
          border-radius: var(--mcs-radius);
          background: var(--mcs-assistant-bg);
          /* Model output contains newlines and runs of spaces that carry
             meaning; collapsing them turns a list into a paragraph. */
          white-space: pre-wrap;
          overflow-wrap: anywhere;
          line-height: 1.45;
        }
        li[data-role="user"] .bubble { background: var(--mcs-user-bg); }
        li[data-role="system"] .bubble,
        li[data-role="tool"] .bubble {
          background: var(--mcs-surface);
          color: var(--mcs-muted);
          font-family: var(--mcs-mono);
          font-size: 0.875rem;
        }
        li[data-status="error"] .bubble { color: var(--mcs-danger); border: 1px solid var(--mcs-danger); }
        li[data-status="pending"] .bubble::after {
          content: '▋';
          color: var(--mcs-muted);
          animation: blink 1s steps(2, start) infinite;
        }
        @keyframes blink { to { visibility: hidden; } }
        @media (prefers-reduced-motion: reduce) {
          li[data-status="pending"] .bubble::after { animation: none; }
        }
        .empty { color: var(--mcs-muted); font-size: 0.9375rem; padding: 0.5rem; }
${design ? CONFIG_FORM_CSS : ''}
      </style>
      <ol role="log" aria-live="polite" aria-relevant="additions text"></ol>
      <p class="empty" hidden></p>
    `;
    this.#list = this.shadowRoot.querySelector('ol');
    const empty = this.shadowRoot.querySelector('.empty');
    empty.textContent = this.config.emptyText;
    this.addEventListener('scroll', this.#trackScroll, { passive: true });
    if (design) renderConfigForm(this.shadowRoot, this.constructor.configSchema, this.config, (k, v) => this.#applyConfig(k, v));
  }

  disconnectedCallback() {
    this.removeEventListener('scroll', this.#trackScroll);
    for (const off of this.#off) off();
    this.#off = [];
  }

  #trackScroll = () => {
    const distance = this.scrollHeight - this.scrollTop - this.clientHeight;
    this.#pinned = distance <= NEAR_BOTTOM_PX;
  };

  /** Rebuilds the node map from the live conversation after a shell rebuild. */
  #resync() {
    this.#nodes.clear();
    this.#list.replaceChildren();
    if (!this.#services) { this.#toggleEmpty(); return; }
    for (const record of this.#services.conversation.records) this.#upsert(record);
    this.#toggleEmpty();
  }

  #upsert(record) {
    let node = this.#nodes.get(record.id);
    if (!node) {
      node = document.createElement('li');
      node.innerHTML = '<div class="bubble"></div>';
      this.#nodes.set(record.id, node);
    }
    // A rebuild or a clear detaches nodes without dropping them from the map —
    // a replayed record then matches a node that is not in the document.
    if (!node.isConnected) this.#list.append(node);
    node.dataset.role = record.role;
    node.dataset.status = record.status;
    node.querySelector('.bubble').textContent = record.text;
    this.#toggleEmpty();
    if (this.#pinned) this.scrollTop = this.scrollHeight;
  }

  #reset() {
    this.#nodes.clear();
    this.#list.replaceChildren();
    this.#toggleEmpty();
  }

  #toggleEmpty() {
    this.shadowRoot.querySelector('.empty').hidden = this.#nodes.size > 0;
  }
}

if (!customElements.get('machvive-chat-syncopation-canvas')) {
  customElements.define('machvive-chat-syncopation-canvas', MachviveChatSyncopationCanvas);
}
