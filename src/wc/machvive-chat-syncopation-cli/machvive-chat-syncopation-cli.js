/**
 * A keyboard-first surface for people who would rather type a command.
 *
 * This is the low-cognitive-load path: no mouse, no reading a menu, and the
 * commands are discoverable from inside the surface via /help. Slash commands
 * are handled locally and never reach the model — clearing a conversation or
 * switching transport is not a prompt, and sending it as one wastes a turn and
 * produces a confident wrong answer.
 *
 * Anything that is not a command is sent as an ordinary message, so this can
 * replace the composer outright rather than sitting beside it.
 */
import { THEME_CSS, CONTROL_CSS } from '../machvive-chat-syncopation-services/theme.js';
import { whenServices } from '../machvive-chat-syncopation-services/machvive-chat-syncopation-services.js';
import { transports } from '../machvive-chat-syncopation-services/daemon.js';

export class MachviveChatSyncopationCli extends HTMLElement {
  #services = null;
  #field = null;
  #out = null;
  /** Session-only; a command history that outlived the tab would be a record
   *  of what someone typed that they never asked anyone to keep. */
  #history = [];
  #cursor = 0;
  #commands = new Map();

  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
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
          font-family: var(--mcs-mono);
          font-size: 0.875rem;
          color: var(--mcs-fg);
          background: var(--mcs-surface);
          border-top: 1px solid var(--mcs-border);
        }
        .out { margin: 0 0 0.375rem; white-space: pre-wrap; color: var(--mcs-muted); }
        .out:empty { display: none; }
        .row { display: flex; align-items: center; gap: 0.5rem; }
        .sigil { color: var(--mcs-accent); user-select: none; }
        input {
          flex: 1 1 auto;
          padding: 0.375rem 0.5rem;
          font-family: inherit;
          background: var(--mcs-bg);
        }
        :focus-visible { outline: 2px solid var(--mcs-accent); outline-offset: 2px; }
        .sr { position: absolute; width: 1px; height: 1px; overflow: hidden; clip-path: inset(50%); }
      </style>
      <p class="out" role="status" aria-live="polite"></p>
      <div class="row">
        <span class="sigil" aria-hidden="true">&gt;</span>
        <label class="sr" for="cli">Command or message</label>
        <input id="cli" type="text" autocomplete="off" spellcheck="false"
               placeholder="message, or /help" />
      </div>
    `;
    this.#field = this.shadowRoot.querySelector('input');
    this.#out = this.shadowRoot.querySelector('.out');
    this.#field.addEventListener('keydown', this.#keydown);

    this.#registerBuiltins();
    this.#services = await whenServices(this);
  }

  /**
   * Adds a command. Exposed so an integrator can wire /order, /ticket, or
   * whatever their domain calls for without forking the component.
   */
  register(name, { describe = '', run }) {
    this.#commands.set(name.replace(/^\//, ''), { describe, run });
  }

  #registerBuiltins() {
    this.register('help', {
      describe: 'list commands',
      run: () => [...this.#commands.entries()].map(([n, c]) => `/${n} — ${c.describe}`).join('\n')
    });
    this.register('clear', {
      describe: 'clear the conversation',
      run: () => { this.#services?.conversation.clear(); return 'cleared'; }
    });
    this.register('transport', {
      describe: `show or set transport (${transports.join(', ')})`,
      run: (arg) => {
        if (!arg) return `transport: ${this.#services?.config.transport}`;
        if (!transports.includes(arg)) return `unknown transport "${arg}"`;
        this.#services.config.transport = arg;
        return `transport: ${arg}`;
      }
    });
    this.register('stop', {
      describe: 'interrupt the current turn',
      run: () => { this.#services?.daemon.stop(); return 'stopped'; }
    });
  }

  #keydown = (event) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      this.#run(this.#field.value.trim());
      this.#field.value = '';
      return;
    }
    // Up/Down walks the session history, as a shell does. Anyone reaching for a
    // CLI expects this, and its absence reads as a broken control.
    if (event.key === 'ArrowUp' || event.key === 'ArrowDown') {
      if (!this.#history.length) return;
      event.preventDefault();
      this.#cursor = Math.max(0, Math.min(this.#history.length, this.#cursor + (event.key === 'ArrowUp' ? -1 : 1)));
      this.#field.value = this.#history[this.#cursor] ?? '';
    }
  };

  #run(line) {
    if (!line) return;
    this.#history.push(line);
    this.#cursor = this.#history.length;

    if (!line.startsWith('/')) {
      this.#print('');
      this.#services?.send(line);
      return;
    }
    const [name, ...rest] = line.slice(1).split(/\s+/);
    const command = this.#commands.get(name);
    if (!command) return this.#print(`unknown command "/${name}" — try /help`);
    try {
      this.#print(String(command.run(rest.join(' ')) ?? ''));
    } catch (err) {
      // A thrown command must not take the surface down with it.
      this.#print(`/${name} failed: ${err?.message ?? err}`);
    }
    this.dispatchEvent(new CustomEvent('cli-command', { detail: { name, args: rest }, bubbles: true, composed: true }));
  }

  #print(text) { if (this.#out) this.#out.textContent = text; }
}

if (!customElements.get('machvive-chat-syncopation-cli')) {
  customElements.define('machvive-chat-syncopation-cli', MachviveChatSyncopationCli);
}
