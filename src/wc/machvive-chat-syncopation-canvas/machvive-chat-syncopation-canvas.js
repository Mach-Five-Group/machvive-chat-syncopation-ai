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

const NEAR_BOTTOM_PX = 48;

export class MachviveChatSyncopationCanvas extends HTMLElement {
  #off = [];
  #nodes = new Map();
  #list = null;
  #pinned = true;

  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
  }

  async connectedCallback() {
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
          /* Pages that scroll the transcript with a keyboard get a focus ring
             they can see, rather than a silently focused scroll container. */
          scroll-behavior: smooth;
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
          :host { scroll-behavior: auto; }
          li[data-status="pending"] .bubble::after { animation: none; }
        }
        .empty { color: var(--mcs-muted); font-size: 0.9375rem; padding: 0.5rem; }
      </style>
      <ol role="log" aria-live="polite" aria-relevant="additions text"></ol>
      <p class="empty" hidden>No messages yet.</p>
    `;
    this.#list = this.shadowRoot.querySelector('ol');
    this.addEventListener('scroll', this.#trackScroll, { passive: true });

    const services = await whenServices(this);
    if (!services || !this.isConnected) return;

    for (const record of services.conversation.records) this.#upsert(record);
    this.#off = [
      services.bus.on('record:added', (r) => this.#upsert(r)),
      services.bus.on('record:appended', ({ record }) => this.#upsert(record)),
      services.bus.on('record:updated', (r) => this.#upsert(r)),
      services.bus.on('conversation:cleared', () => this.#reset())
    ];
    this.#toggleEmpty();
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

  #upsert(record) {
    let node = this.#nodes.get(record.id);
    if (!node) {
      node = document.createElement('li');
      node.innerHTML = '<div class="bubble"></div>';
      this.#nodes.set(record.id, node);
      this.#list.append(node);
    }
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
