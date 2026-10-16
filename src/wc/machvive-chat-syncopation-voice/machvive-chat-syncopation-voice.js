/**
 * Speech in, speech out — where the user agent can do it.
 *
 * Both halves are capability-gated and the component says so in the UI rather
 * than rendering a button that silently does nothing. SpeechRecognition remains
 * unimplemented or vendor-prefixed across whole browser families, so "it works
 * on my machine" is the default failure here.
 *
 * Dictation is push-to-talk and fills the composer rather than sending. A
 * microphone that transmits the moment it recognises a phrase will eventually
 * send a half-sentence, or a conversation happening in the room.
 */
import { CONTROL_CSS, SCROLL_CSS } from '../machvive-chat-syncopation-services/theme.js';
import { whenServices } from '../machvive-chat-syncopation-services/machvive-chat-syncopation-services.js';
import { resolveComponentConfig, keyToAttr } from '../machvive-chat-syncopation-services/component-config.js';
import { renderConfigForm, CONFIG_FORM_CSS } from '../machvive-chat-syncopation-services/config-form.js';

const Recognition = typeof window !== 'undefined'
  ? (window.SpeechRecognition ?? window.webkitSpeechRecognition ?? null)
  : null;
const canSpeak = () => typeof window !== 'undefined' && 'speechSynthesis' in window;

export class MachviveChatSyncopationVoice extends HTMLElement {
  static configSchema = {
    lang: { type: 'string', default: '', label: 'Language', description: 'BCP-47 tag for dictation; empty follows the services locale' }
  };

  static get observedAttributes() {
    return Object.keys(this.configSchema).map(keyToAttr);
  }

  #services = null;
  #off = [];
  #speechOff = [];
  #recognition = null;
  #listening = false;
  #speaking = false;
  #composer = null;
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
    if (!this.#services || !this.isConnected) return;
    this.#off.push(this.#services.bus.on('state:changed', () => this.#render()));
    // The composer may not have upgraded yet; wait for it before registering.
    await customElements.whenDefined('machvive-chat-syncopation-prompt');
    if (!this.isConnected) return;
    this.#registerWithComposer();
    this.#render();
  }

  /**
   * One mic per surface. When a composer shares this surface, voice registers
   * its actions into the composer's action row and hides its own — the prompt
   * owns the row layout. Standalone (no composer), voice keeps its own buttons.
   */
  #registerWithComposer() {
    const prompt = this.#findComposer();
    if (!prompt || typeof prompt.registerAction !== 'function') return false;
    this.#composer = prompt;
    // Mic is press-and-hold; speak toggles on click.
    prompt.registerAction('voice-mic', {
      icon: 'mic', label: 'Hold to talk', order: 10,
      onPress: () => this.start(),
      onRelease: () => this.stop()
    });
    prompt.registerAction('voice-speak', {
      icon: 'no-sound', label: 'Read replies', order: 20,
      run: () => this.#toggleSpeech()
    });
    return true;
  }

  #findComposer() {
    // The composer is a sibling within the same surface. Voice and the composer
    // share a container or services element in the light DOM; search from the
    // nearest shared ancestor's subtree.
    let scope = this.parentElement;
    while (scope && !scope.querySelector?.('machvive-chat-syncopation-prompt')) {
      scope = scope.parentElement ?? scope.getRootNode?.()?.host ?? null;
    }
    return scope?.querySelector?.('machvive-chat-syncopation-prompt') ?? null;
  }

  #render() {
    const design = this.#services?.state === 'design';
    const integrated = Boolean(this.#composer);
    this.shadowRoot.innerHTML = `
      <style>
${CONTROL_CSS}
${SCROLL_CSS}
        :host {
          display: block;
          flex: 0 0 auto;
          padding: 0.5rem;
          font-family: var(--mcs-font, system-ui, sans-serif);
          color: var(--mcs-fg, #1a1a1a);
          background: var(--mcs-bg, #ffffff);
        }
        .row { display: flex; align-items: center; gap: 0.5rem; }
        .row button { padding: 0.375rem 0.75rem; cursor: pointer; background: var(--mcs-surface, #f6f7f9); }
        .row button[aria-pressed="true"] { background: var(--mcs-accent, #1565c0); color: var(--mcs-accent-fg, #ffffff); border-color: transparent; }
        .row button[disabled] { cursor: not-allowed; color: var(--mcs-muted, #646464); }
        .note { margin: 0; font-size: 0.8125rem; color: var(--mcs-muted, #646464); }
        :focus-visible { outline: 2px solid var(--mcs-accent, #1565c0); outline-offset: 2px; }
${design ? CONFIG_FORM_CSS : ''}
      </style>
      <div class="row" ${integrated ? 'hidden' : ''}>
        <button type="button" class="mic" aria-pressed="false">🎤 Hold to talk</button>
        <button type="button" class="speak" aria-pressed="false">🔊 Read replies</button>
      </div>
      <p class="note"></p>
    `;
    const mic = this.shadowRoot.querySelector('.mic');
    const speak = this.shadowRoot.querySelector('.speak');
    const note = this.shadowRoot.querySelector('.note');

    const unsupported = [];
    if (!Recognition) { mic.disabled = true; unsupported.push('dictation'); }
    if (!canSpeak()) { speak.disabled = true; unsupported.push('read-aloud'); }
    note.textContent = unsupported.length
      ? `${unsupported.join(' and ')} unavailable in this browser`
      : '';

    if (Recognition) {
      mic.addEventListener('pointerdown', () => this.start());
      mic.addEventListener('pointerup', () => this.stop());
      mic.addEventListener('pointerleave', () => this.stop());
    }
    speak.addEventListener('click', () => this.#toggleSpeech(speak));
    if (design) renderConfigForm(this.shadowRoot, this.constructor.configSchema, this.config, (k, v) => this.#applyConfig(k, v));
  }

  disconnectedCallback() {
    this.stop();
    if (canSpeak()) window.speechSynthesis.cancel();
    for (const off of this.#off) off();
    this.#off = [];
  }

  start() {
    if (!Recognition || this.#listening) return;
    this.#recognition = new Recognition();
    this.#recognition.lang = this.getAttribute('lang') || this.#services?.config.locale || navigator.language;
    this.#recognition.interimResults = true;
    this.#recognition.onresult = (event) => {
      const text = [...event.results].map((r) => r[0].transcript).join('');
      this.#services?.bus.emit('prompt:fill', { text, send: false });
      this.dispatchEvent(new CustomEvent('voice-transcript', { detail: { text }, bubbles: true, composed: true }));
    };
    // A denied microphone surfaces here, not as a rejected promise. Showing it
    // is the difference between "broken" and "you declined the permission".
    this.#recognition.onerror = (event) => {
      this.shadowRoot.querySelector('.note').textContent = `microphone: ${event.error}`;
      this.#setListening(false);
    };
    this.#recognition.onend = () => this.#setListening(false);
    try {
      this.#recognition.start();
      this.#setListening(true);
    } catch {
      this.#setListening(false);
    }
  }

  stop() {
    if (!this.#listening) return;
    try { this.#recognition?.stop(); } catch { /* already stopped */ }
    this.#setListening(false);
  }

  #setListening(on) {
    this.#listening = on;
    this.shadowRoot?.querySelector('.mic')?.setAttribute('aria-pressed', String(on));
  }

  /** Reads completed assistant turns. Only completed ones — speaking a stream
   *  chunk by chunk produces stuttered nonsense. */
  #toggleSpeech(button) {
    // Speech state is internal so the composer action (no button) and the
    // standalone button both work. Reflect to whichever control exists.
    this.#speaking = !this.#speaking;
    const pressed = String(this.#speaking);
    button?.setAttribute('aria-pressed', pressed);
    this.#composer?.shadowRoot?.querySelector('[data-action="voice-speak"]')?.setAttribute('aria-pressed', pressed);
    if (!this.#speaking) {
      window.speechSynthesis.cancel();
      for (const off of this.#speechOff) off();
      this.#speechOff = [];
      return;
    }
    if (!this.#services) return;
    this.#speechOff.push(this.#services.bus.on('record:updated', (record) => {
      if (record.role !== 'assistant' || record.status !== 'complete' || !record.text) return;
      const utterance = new SpeechSynthesisUtterance(record.text);
      utterance.lang = this.#recognition?.lang ?? navigator.language;
      window.speechSynthesis.speak(utterance);
    }));
  }
}

if (!customElements.get('machvive-chat-syncopation-voice')) {
  customElements.define('machvive-chat-syncopation-voice', MachviveChatSyncopationVoice);
}
