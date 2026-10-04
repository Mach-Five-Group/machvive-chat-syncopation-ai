/**
 * Suggested openings, and a quiet re-engagement prompt.
 *
 * An empty prompt box is the highest-friction moment in any chat interface: the
 * user has to invent both the task and the phrasing. Offering three concrete
 * starts removes that, which is the engagement half of this collection's remit.
 *
 * Two rules keep it from becoming the pop-up it could easily be:
 *  - Suggestions fill the composer, they do not send. The user stays the author.
 *  - The idle nudge fires once per conversation, never on a loop. A surface that
 *    keeps asking whether you are still there is a surface people close.
 */
import { THEME_CSS, CONTROL_CSS } from '../machvive-chat-syncopation-services/theme.js';
import { whenServices } from '../machvive-chat-syncopation-services/machvive-chat-syncopation-services.js';

export class MachviveChatSyncopationNudge extends HTMLElement {
  #services = null;
  #off = [];
  #timer = null;
  #nudged = false;

  static get observedAttributes() { return ['suggestions', 'idle-ms', 'idle-text']; }

  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
  }

  get suggestions() {
    const raw = this.getAttribute('suggestions');
    if (!raw) return [];
    return raw.split('|').map((s) => s.trim()).filter(Boolean);
  }

  async connectedCallback() {
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
        }
        :host([hidden]) { display: none; }
        .chips { display: flex; flex-wrap: wrap; gap: 0.375rem; }
        button {
          padding: 0.375rem 0.75rem;
          font-size: 0.875rem;
          cursor: pointer;
          background: var(--mcs-surface);
          border-radius: 999px;
          text-align: left;
        }
        button:hover { border-color: var(--mcs-accent); }
        :focus-visible { outline: 2px solid var(--mcs-accent); outline-offset: 2px; }
        .idle {
          margin: 0.5rem 0 0;
          font-size: 0.875rem;
          color: var(--mcs-muted);
        }
        .idle[hidden] { display: none; }
      </style>
      <div class="chips" role="group" aria-label="Suggested messages"></div>
      <p class="idle" hidden></p>
    `;
    this.#render();

    this.#services = await whenServices(this);
    if (!this.#services || !this.isConnected) return;
    this.#off = [
      this.#services.bus.on('record:added', (record) => {
        // Suggestions are for the empty state. Once there is a conversation,
        // the conversation is the context — stale chips just take up space.
        if (record.role === 'user') this.#clearChips();
        this.#resetIdle();
      })
    ];
    this.#resetIdle();
  }

  disconnectedCallback() {
    clearTimeout(this.#timer);
    for (const off of this.#off) off();
    this.#off = [];
  }

  attributeChangedCallback() {
    if (this.shadowRoot?.childElementCount) this.#render();
  }

  #render() {
    const chips = this.shadowRoot.querySelector('.chips');
    if (!chips) return;
    chips.replaceChildren(...this.suggestions.map((text) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.textContent = text;
      button.addEventListener('click', () => this.#choose(text));
      return button;
    }));
  }

  #choose(text) {
    this.dispatchEvent(new CustomEvent('nudge-select', { detail: { text }, bubbles: true, composed: true }));
    this.#services?.bus.emit('prompt:fill', { text, send: false });
    this.#clearChips();
  }

  #clearChips() {
    this.shadowRoot?.querySelector('.chips')?.replaceChildren();
  }

  #resetIdle() {
    clearTimeout(this.#timer);
    const after = Number(this.getAttribute('idle-ms'));
    if (!after || this.#nudged) return;
    this.#timer = setTimeout(() => {
      this.#nudged = true;
      const note = this.shadowRoot.querySelector('.idle');
      note.textContent = this.getAttribute('idle-text') ?? 'Still here if you need anything.';
      note.hidden = false;
      this.dispatchEvent(new CustomEvent('nudge-idle', { bubbles: true, composed: true }));
    }, after);
  }
}

if (!customElements.get('machvive-chat-syncopation-nudge')) {
  customElements.define('machvive-chat-syncopation-nudge', MachviveChatSyncopationNudge);
}
