/**
 * The services every other component shares.
 *
 * Headless: it renders nothing and exists so a page can own the bus, the
 * conversation and the cache explicitly rather than having each component
 * invent its own. Components discover it by walking up the DOM, so nesting is
 * the wiring — no registry, no globals, and two independent chat surfaces on
 * one page cannot bleed into each other.
 */
import { PubSub } from './pubsub.js';
import { Conversation } from './conversation.js';
import { Daemon } from './daemon.js';
import { Cache } from './cache.js';
import { resolveConfig } from './config.js';
import { Recorder } from './recorder.js';
import { resolveComponentConfig, keyToAttr } from './component-config.js';
import { renderConfigForm, CONFIG_FORM_CSS } from './config-form.js';
import { THEME_CSS } from './theme.js';

export { PubSub } from './pubsub.js';
export { Conversation } from './conversation.js';
export { Daemon, transports } from './daemon.js';
export { Cache } from './cache.js';
export { resolveConfig, DEFAULTS } from './config.js';
export { Recorder } from './recorder.js';
export { resolveComponentConfig, attrToKey, keyToAttr } from './component-config.js';
export { renderConfigForm, CONFIG_FORM_CSS } from './config-form.js';
export { createRecord, ROLES, isPending } from './record.js';
export { META, annotate, readMeta, userMeta } from './metadata.js';
export { THEME_CSS, CONTROL_CSS } from './theme.js';

export const SERVICES_TAG = 'machvive-chat-syncopation-services';

/**
 * Finds the services element governing `node`.
 *
 * Checks each ancestor *and* that ancestor's own children, because both nesting
 * directions are legitimate: a page may wrap a surface in <…-services>, or a
 * container may create one for itself. Crossing shadow boundaries via the host
 * keeps a component that lives inside someone else's shadow root working.
 */
export function findServices(node) {
  let current = node;
  while (current) {
    if (current.localName === SERVICES_TAG) return current;
    for (const child of current.children ?? []) {
      if (child.localName === SERVICES_TAG) return child;
    }
    current = current.parentElement ?? current.getRootNode?.()?.host ?? null;
  }
  return document.querySelector(SERVICES_TAG);
}

/**
 * Resolves once services exist and have booted.
 *
 * Upgrade order is not something a component can rely on — it may connect
 * before the services element in its own subtree does, and `document.write`,
 * innerHTML and a framework's hydration each order it differently. Waiting is
 * cheaper than making every component defensive about a half-built bus.
 */
export function whenServices(node, { timeoutMs = 2000 } = {}) {
  const found = findServices(node);
  if (found?.bus) return Promise.resolve(found);
  return new Promise((resolve) => {
    const deadline = Date.now() + timeoutMs;
    const poll = () => {
      const services = findServices(node);
      if (services?.bus) return resolve(services);
      if (Date.now() > deadline) return resolve(null);
      setTimeout(poll, 16);
    };
    poll();
  });
}

export class MachviveChatSyncopationServices extends HTMLElement {
  /**
   * Same contract every component follows: one schema object drives attribute
   * parsing, the `config` object property, and the design-state form.
   */
  static configSchema = {
    transport: { type: 'string', default: 'echo', label: 'Transport', description: 'Where turns are produced: echo, local, remote, or a registered name' },
    model: { type: 'string', default: '', label: 'Model', description: 'Passed through to the transport' },
    endpoint: { type: 'string', default: '', label: 'Endpoint', description: 'URL for the remote transport' },
    persist: { type: 'boolean', default: false, label: 'Persist', description: 'Keep conversations in IndexedDB (opt-in, deliberately)' },
    maxTurns: { type: 'number', default: 200, label: 'Max turns', description: 'Oldest turns are trimmed past this' },
    streaming: { type: 'boolean', default: true, label: 'Streaming', description: 'Whether transports stream chunks' },
    locale: { type: 'string', default: '', label: 'Locale', description: 'BCP-47 tag used by voice dictation' }
  };

  static get observedAttributes() {
    return [...Object.keys(this.configSchema).map(keyToAttr), 'state'];
  }

  #bus = new PubSub();
  #cache = new Cache();
  #config = null;
  #conversation = null;
  #daemon = null;
  #recorder = null;
  #persistOff = [];
  #booted = false;

  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
  }

  connectedCallback() {
    // `display: contents`, with a slot — not `display: none`.
    //
    // This element is documented as something you wrap around a surface, so it
    // has to project its children. With `display: none` and no <slot> the host
    // renders nothing and takes its whole subtree with it: every component
    // inside it is invisible. jsdom has no layout engine, so the unit suite
    // cannot see this at all — it was caught in a real browser.
    //
    // `display: contents` removes the host's own box, so wrapping costs nothing
    // in layout while the children render exactly where they would have.
    this.#render();
    if (this.#booted) return;
    this.#booted = true;
    this.#config = resolveComponentConfig(this, this.#overrides);
    this.#conversation = new Conversation({ bus: this.#bus, maxTurns: this.#config.maxTurns });
    this.#daemon = new Daemon({ bus: this.#bus, conversation: this.#conversation, config: this.#config });
    this.#recorder = new Recorder(this.#bus);

    this.#wirePersist();
    this.#bus.emit('services:ready', { config: this.#config });
    this.dispatchEvent(new CustomEvent('services-ready', { bubbles: true, composed: true }));
  }

  attributeChangedCallback(name, oldValue, newValue) {
    if (oldValue === newValue) return;
    if (name === 'state') {
      if (this.shadowRoot) this.#render();
      return;
    }
    if (!this.#booted || !this.#config) return;
    const resolved = resolveComponentConfig(this, this.#overrides);
    const previous = this.#config;
    this.#config = resolved;
    // Live attribute edits reach the daemon through the shared config object
    // identity; announce so components can react.
    if (JSON.stringify(previous) !== JSON.stringify(resolved)) {
      if (previous.persist !== resolved.persist) this.#wirePersist();
      this.#bus.emit('config:changed', { config: resolved, previous });
    }
  }

  #overrides = {};

  /**
   * Resolved configuration. Assign a partial object to override individual
   * keys — overrides are reflected to attributes so they survive re-renders
   * and are visible in markup.
   */
  get config() { return this.#config ?? resolveComponentConfig(this); }
  set config(overrides) {
    if (overrides == null || typeof overrides !== 'object') return;
    for (const [key, value] of Object.entries(overrides)) this.#applyConfig(key, value);
  }

  /** Persists one key to its attribute (single source of truth), then reapplies. */
  #applyConfig(key, value) {
    if (!(key in this.constructor.configSchema)) return;
    this.#overrides[key] = value;
    const attr = keyToAttr(key);
    if (this.constructor.configSchema[key].type === 'boolean') {
      this.toggleAttribute(attr, Boolean(value));
    } else {
      this.setAttribute(attr, String(value));
    }
    if (this.#booted) {
      this.#config = resolveComponentConfig(this, this.#overrides);
      this.#wirePersist();
      this.#bus.emit('config:changed', { config: this.#config });
    }
  }

  #wirePersist() {
    for (const off of this.#persistOff) off();
    this.#persistOff = [];
    // Persisting someone's conversation is opt-in. Defaulting it on would store
    // what people said without anyone deciding to.
    if (this.#config?.persist) {
      this.#persistOff = [
        this.#bus.on('record:added', () => this.#cache.put(this.#conversation.toJSON())),
        this.#bus.on('record:updated', () => this.#cache.put(this.#conversation.toJSON()))
      ];
    }
  }

  #render() {
    const design = this.getAttribute('state') === 'design';
    this.shadowRoot.innerHTML = `
      <style>
        ${design ? THEME_CSS : ''}
        :host { display: ${design ? 'block' : 'contents'}; }
        ${design ? CONFIG_FORM_CSS : ''}
        ${design ? ':host { border: 1px dashed var(--mcs-border); border-radius: var(--mcs-radius); margin: 0.25rem 0; }' : ''}
      </style>
      <slot></slot>
    `;
    if (design) renderConfigForm(this.shadowRoot, this.constructor.configSchema, this.config, (k, v) => this.#applyConfig(k, v));
  }

  get bus() { return this.#bus; }
  get conversation() { return this.#conversation; }
  get daemon() { return this.#daemon; }
  get cache() { return this.#cache; }
  get recorder() { return this.#recorder; }

  /** Convenience for page code; components use the daemon directly. */
  send(text) { return this.#daemon?.send(text); }

  /**
   * Registers a transport and, unless told otherwise, selects it.
   *
   * Registering without selecting is the common mistake — the transport exists,
   * nothing uses it, and the surface silently keeps echoing.
   */
  registerTransport(name, transport, { select = true } = {}) {
    this.#daemon?.register(name, transport);
    if (select && this.#config) this.#config.transport = name;
    return this;
  }
}

if (!customElements.get('machvive-chat-syncopation-services')) {
  customElements.define('machvive-chat-syncopation-services', MachviveChatSyncopationServices);
}
