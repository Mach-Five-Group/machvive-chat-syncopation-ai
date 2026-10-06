/**
 * Stored conversations, and the controls to take them back.
 *
 * This is where "user data domain agency" stops being a slogan. The data lives
 * in the user's own browser, and this component gives them the three operations
 * that make that meaningful without asking anyone's server: see what is stored,
 * export it as JSON they keep, and delete it for real.
 *
 * Delete goes through Cache#remove / #clear, which drop both the IndexedDB row
 * and the memory copy — a "clear history" that only hides rows is a lie, and
 * the one place in this collection where that would actually matter.
 */
import { THEME_CSS, CONTROL_CSS } from '../machvive-chat-syncopation-services/theme.js';
import { whenServices } from '../machvive-chat-syncopation-services/machvive-chat-syncopation-services.js';
import { resolveComponentConfig, keyToAttr } from '../machvive-chat-syncopation-services/component-config.js';
import { renderConfigForm, CONFIG_FORM_CSS } from '../machvive-chat-syncopation-services/config-form.js';

export class MachviveChatSyncopationHistory extends HTMLElement {
  static configSchema = {
    heading: { type: 'string', default: 'History', label: 'Heading', description: 'Panel title' },
    maxHeight: { type: 'string', default: '', label: 'Max height', description: 'CSS length for the list; empty uses the 14rem default' }
  };

  static get observedAttributes() {
    return [...Object.keys(this.configSchema).map(keyToAttr), 'state'];
  }

  #services = null;
  #off = [];
  #list = null;
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
    this.#render();
  }

  async connectedCallback() {
    this.#render();

    this.#services = await whenServices(this);
    if (!this.#services || !this.isConnected) {
      this.#note('No <machvive-chat-syncopation-services> found.');
      return;
    }
    // Only resaved conversations change the stored set, so refreshing on the
    // persist writes is enough — no polling.
    this.#off = [
      this.#services.bus.on('record:added', () => this.refresh()),
      this.#services.bus.on('conversation:cleared', () => this.refresh())
    ];
    await this.refresh();
  }

  #render() {
    const design = this.getAttribute('state') === 'design';
    this.shadowRoot.innerHTML = `
      <style>
${THEME_CSS}
${CONTROL_CSS}
        :host {
          display: block;
          font-family: var(--mcs-font);
          font-size: 0.875rem;
          color: var(--mcs-fg);
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
        h2 { margin: 0; font-size: 0.875rem; font-weight: 600; flex: 1 1 auto; }
        header button { padding: 0.25rem 0.5rem; cursor: pointer; font-size: 0.75rem; }
        header button.danger { color: var(--mcs-danger); }
        ul { margin: 0; padding: 0; list-style: none; max-height: var(--mcs-history-height, 14rem); overflow-y: auto; }
        li { display: flex; align-items: center; gap: 0.5rem; padding: 0.375rem 0.5rem; border-bottom: 1px solid var(--mcs-border); }
        li:last-child { border-bottom: 0; }
        .label { flex: 1 1 auto; min-width: 0; }
        .title { display: block; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .count { color: var(--mcs-muted); font-size: 0.75rem; }
        .note { margin: 0; padding: 0.5rem; color: var(--mcs-muted); }
        :focus-visible { outline: 2px solid var(--mcs-accent); outline-offset: 2px; }
${design ? CONFIG_FORM_CSS : ''}
      </style>
      <header>
        <h2></h2>
        <button type="button" class="export">Export all</button>
        <button type="button" class="danger forget">Delete all</button>
      </header>
      <ul></ul>
      <p class="note"></p>
    `;
    this.shadowRoot.querySelector('h2').textContent = this.config.heading;
    if (this.config.maxHeight) this.style.setProperty('--mcs-history-height', this.config.maxHeight);
    this.#list = this.shadowRoot.querySelector('ul');
    this.shadowRoot.querySelector('.export').addEventListener('click', () => this.export());
    this.shadowRoot.querySelector('.forget').addEventListener('click', () => this.forgetAll());
    if (design) renderConfigForm(this.shadowRoot, this.constructor.configSchema, this.config, (k, v) => this.#applyConfig(k, v));
  }

  disconnectedCallback() {
    for (const off of this.#off) off();
    this.#off = [];
  }

  async refresh() {
    if (!this.#services) return;
    const stored = await this.#services.cache.list();
    this.#list.replaceChildren(...stored.map((conversation) => this.#row(conversation)));
    if (!stored.length) {
      this.#note(this.#services.config.persist
        ? 'Nothing stored yet.'
        : 'Persistence is off — set the persist attribute on the services element to keep conversations.');
    } else {
      this.#note('');
    }
  }

  /** Hands the user a file. No upload, no endpoint — their data, their disk. */
  async export(id) {
    if (!this.#services) return null;
    const payload = id
      ? await this.#services.cache.get(id)
      : { exportedAt: new Date().toISOString(), conversations: await this.#services.cache.list() };
    const json = JSON.stringify(payload, null, 2);
    this.dispatchEvent(new CustomEvent('history-export', { detail: { json }, bubbles: true, composed: true }));

    // jsdom has no download plumbing; the event above is what tests assert on.
    if (typeof URL?.createObjectURL !== 'function') return json;
    const url = URL.createObjectURL(new Blob([json], { type: 'application/json' }));
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `syncopation-${id ?? 'all'}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
    return json;
  }

  async forget(id) {
    await this.#services?.cache.remove(id);
    this.dispatchEvent(new CustomEvent('history-forget', { detail: { id }, bubbles: true, composed: true }));
    await this.refresh();
  }

  async forgetAll() {
    await this.#services?.cache.clear();
    this.dispatchEvent(new CustomEvent('history-forget', { detail: { id: null }, bubbles: true, composed: true }));
    await this.refresh();
  }

  #row(conversation) {
    const first = conversation.records?.find((r) => r.role === 'user');
    const row = document.createElement('li');

    const label = document.createElement('div');
    label.className = 'label';
    const title = document.createElement('span');
    title.className = 'title';
    title.textContent = first?.text?.trim() || conversation.id;
    const count = document.createElement('span');
    count.className = 'count';
    count.textContent = `${conversation.records?.length ?? 0} turns`;
    label.append(title, count);

    const resume = document.createElement('button');
    resume.type = 'button';
    resume.textContent = 'Open';
    resume.addEventListener('click', () => this.#resume(conversation));

    const save = document.createElement('button');
    save.type = 'button';
    save.textContent = 'Export';
    save.addEventListener('click', () => this.export(conversation.id));

    const drop = document.createElement('button');
    drop.type = 'button';
    drop.className = 'danger';
    drop.textContent = 'Delete';
    drop.addEventListener('click', () => this.forget(conversation.id));

    row.append(label, resume, save, drop);
    return row;
  }

  /** Replays a stored conversation into the live one so the canvas shows it. */
  #resume(conversation) {
    const live = this.#services?.conversation;
    if (!live) return;
    live.clear();
    for (const record of conversation.records ?? []) live.add(record);
    this.dispatchEvent(new CustomEvent('history-open', { detail: { id: conversation.id }, bubbles: true, composed: true }));
  }

  #note(text) {
    const note = this.shadowRoot.querySelector('.note');
    note.textContent = text;
    note.hidden = !text;
  }
}

if (!customElements.get('machvive-chat-syncopation-history')) {
  customElements.define('machvive-chat-syncopation-history', MachviveChatSyncopationHistory);
}
