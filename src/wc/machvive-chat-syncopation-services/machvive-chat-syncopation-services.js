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

export { PubSub } from './pubsub.js';
export { Conversation } from './conversation.js';
export { Daemon, transports } from './daemon.js';
export { Cache } from './cache.js';
export { resolveConfig, DEFAULTS } from './config.js';
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
  #bus = new PubSub();
  #cache = new Cache();
  #config = null;
  #conversation = null;
  #daemon = null;

  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
  }

  connectedCallback() {
    this.shadowRoot.innerHTML = '<style>:host { display: none; }</style>';
    this.#config = resolveConfig(this);
    this.#conversation = new Conversation({ bus: this.#bus, maxTurns: this.#config.maxTurns });
    this.#daemon = new Daemon({ bus: this.#bus, conversation: this.#conversation, config: this.#config });

    // Persisting someone's conversation is opt-in. Defaulting it on would store
    // what people said without anyone deciding to.
    if (this.#config.persist) {
      this.#bus.on('record:added', () => this.#cache.put(this.#conversation.toJSON()));
      this.#bus.on('record:updated', () => this.#cache.put(this.#conversation.toJSON()));
    }
    this.#bus.emit('services:ready', { config: this.#config });
    this.dispatchEvent(new CustomEvent('services-ready', { bubbles: true, composed: true }));
  }

  get bus() { return this.#bus; }
  get conversation() { return this.#conversation; }
  get daemon() { return this.#daemon; }
  get cache() { return this.#cache; }
  get config() { return this.#config; }

  /** Convenience for page code; components use the daemon directly. */
  send(text) { return this.#daemon?.send(text); }
}

if (!customElements.get('machvive-chat-syncopation-services')) {
  customElements.define('machvive-chat-syncopation-services', MachviveChatSyncopationServices);
}
