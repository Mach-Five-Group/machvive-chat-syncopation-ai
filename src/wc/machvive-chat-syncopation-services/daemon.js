/**
 * Turns a prompt into records, whichever way this page produces them.
 *
 * The transports are deliberately uniform: a component should not know whether a
 * reply came from a server, from a model running in the user agent, or from the
 * echo stub. That is what makes offline-first a configuration rather than a
 * rewrite — and a model in the user agent has no token cost, which changes where
 * a chat surface is economic at all.
 */
import { createRecord } from './record.js';
import { META } from './metadata.js';

/** A transport yields string chunks. Streaming is the normal case. */
const TRANSPORTS = {
  /** No backend. Useful for building UI before a model exists. */
  async *echo(prompt) {
    for (const word of `You said: ${prompt}`.split(' ')) {
      await new Promise((r) => setTimeout(r, 40));
      yield word + ' ';
    }
  },

  /** In-user-agent model (WebLLM or similar). Stubbed; see adapters/. */
  async *local(prompt, { config }) {
    yield `[local model "${config.model || 'unset'}" not yet wired] ${prompt}`;
  },

  /** Remote endpoint. Stubbed; the real one streams and is adapter-specific. */
  async *remote(prompt, { config }) {
    yield `[remote endpoint "${config.endpoint || 'unset'}" not yet wired] ${prompt}`;
  }
};

export class Daemon {
  #bus; #conversation; #config; #abort = null;

  constructor({ bus, conversation, config }) {
    this.#bus = bus; this.#conversation = conversation; this.#config = config;
  }

  get busy() { return this.#abort !== null; }

  /** Stop generating. The partial turn is kept — the user saw it. */
  stop() { this.#abort?.abort(); this.#abort = null; }

  async send(text) {
    if (this.busy) return null;
    this.#conversation.add({ role: 'user', text });

    const reply = this.#conversation.add({
      role: 'assistant', text: '', status: 'pending',
      meta: { [META.SOURCE]: this.#config.transport, [META.MODEL]: this.#config.model }
    });

    const transport = TRANSPORTS[this.#config.transport] ?? TRANSPORTS.echo;
    this.#abort = new AbortController();
    const startedAt = Date.now();

    try {
      for await (const chunk of transport(text, { config: this.#config })) {
        if (this.#abort.signal.aborted) break;
        this.#conversation.append(reply.id, chunk);
      }
      this.#conversation.update(reply.id, {
        status: 'complete',
        meta: { ...reply.meta, [META.LATENCY]: Date.now() - startedAt }
      });
    } catch (err) {
      // A failed turn is a visible turn. Silently dropping it leaves the user
      // staring at a prompt that appears to have done nothing.
      this.#conversation.update(reply.id, {
        status: 'error',
        meta: { ...reply.meta, [META.ERROR]: String(err?.message ?? err) }
      });
      this.#bus?.emit('daemon:error', { id: reply.id, error: err });
    } finally {
      this.#abort = null;
      this.#bus?.emit('daemon:idle', { id: reply.id });
    }
    return reply;
  }
}

export const transports = Object.keys(TRANSPORTS);
