<h1 align="center">machvive-chat-syncopation-ai</h1>

<p align="center">
  <strong>A chat interface is a UI problem before it is a model problem.</strong><br>
  Dependency-free Web Components for prototyping complex chat interactions — by
  <a href="https://github.com/Mach-Five-Group">MachFiveTech Chicago</a>.
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/@machfivetechchicago/machvive-chat-syncopation-ai"><img alt="npm" src="https://img.shields.io/npm/v/@machfivetechchicago/machvive-chat-syncopation-ai.svg"></a>
  <a href="LICENSE"><img alt="license" src="https://img.shields.io/npm/l/@machfivetechchicago/machvive-chat-syncopation-ai.svg"></a>
  <img alt="types" src="https://img.shields.io/badge/types-included-blue.svg">
  <img alt="dependencies" src="https://img.shields.io/badge/dependencies-0-brightgreen.svg">
  <a href="https://github.com/Mach-Five-Group/machvive-chat-syncopation-ai/wiki"><img alt="docs" src="https://img.shields.io/badge/docs-wiki-blue.svg"></a>
  <a href="https://mach-five-group.github.io/chat-syncopation-playground/"><img alt="live demo" src="https://img.shields.io/badge/demo-live-success.svg"></a>
</p>

Chat is now the default interface for anything an AI touches, and most of it is
assembled from scratch each time — the same bubble list, the same Enter-to-send
textarea, the same autoscroll bug where the transcript yanks you to the bottom
while you are reading something further up.

Machvive Chat Syncopation is that layer, built once: a collection of standards-based
custom elements you compose into the surface your product actually needs. Four
commitments shape every one of them.

**User engagement.** An empty prompt box is the highest-friction moment in any chat
interface — the user has to invent both the task and the phrasing. The nudge
component offers concrete openings, and fills the composer rather than sending, so
the user stays the author.

**Prompt cognitive load.** A conversation is a reading surface. Turns stream into one
node instead of re-rendering the list, autoscroll follows the bottom only when the
reader is already there, and the send button becomes Stop rather than going
disabled — you are never watching output you cannot interrupt.

**Modern web experiences.** Shadow DOM, custom properties that inherit through the
shadow boundary, `prefers-color-scheme`, `prefers-reduced-motion`, the Speech APIs
where they exist and an honest explanation where they do not. No framework, no build
step, no runtime dependencies — just custom elements that work anywhere
`customElements` does.

**User data domain agency.** The conversation lives in the user's own browser.
Persistence is off until a page turns it on, and the history component gives the
person whose words these are the three operations that make that meaningful: see
what is stored, export it as JSON they keep, and delete it for real.

## Where a chat system can run

We are deliberately challenging where a chat surface is possible. Nothing in this
package calls a model: the daemon exposes transports as a uniform interface, and the
one that matters is `local` — a model running inside the user agent, via WebLLM or
similar.

A model in the browser has **no per-token cost**. That changes the arithmetic
entirely for the cases usually ruled out as uneconomic: a long-tail support surface,
a kiosk, a classroom, an internal tool nobody will fund an API bill for, a field
application that has to work with no connection at all. Offline-first becomes a
configuration rather than a rewrite, because no component knows where its text
came from.

| Component | Tag | What it does |
| --- | --- | --- |
| Services | `<machvive-chat-syncopation-services>` | Headless. The bus, conversation, daemon, cache and config every surface shares |
| Container | `<machvive-chat-syncopation>` | Layout, and nothing else. Everything inside it is slotted |
| Canvas | `<machvive-chat-syncopation-canvas>` | The transcript — append-only, streaming, reader-respecting autoscroll |
| Prompt | `<machvive-chat-syncopation-prompt>` | The composer. Enter sends, Shift+Enter newlines, Stop interrupts |
| Nudge | `<machvive-chat-syncopation-nudge>` | Suggested openings and a once-only idle prompt |
| CLI | `<machvive-chat-syncopation-cli>` | Keyboard-first surface with extensible slash commands |
| Voice | `<machvive-chat-syncopation-voice>` | Push-to-talk dictation and read-aloud, capability-gated |
| Inspector | `<machvive-chat-syncopation-inspector>` | Live bus traffic, for whoever is building the surface |
| History | `<machvive-chat-syncopation-history>` | Stored conversations, with export and real deletion |

📖 **[Read the full guide on the Wiki](https://github.com/Mach-Five-Group/machvive-chat-syncopation-ai/wiki)** — how the
components compose, how to write a transport, and the constraints worth knowing
before you adopt.

🎮 **[Try the live playground](https://mach-five-group.github.io/chat-syncopation-playground/)** — every component,
every theme, running in the browser.

🤖 **[machvive-webmcp-ai](https://www.npmjs.com/package/@machfivetechchicago/machvive-webmcp-ai)** — the sibling package.
Chat Syncopation is the interface a person talks through; WebMCP is how an agent
reaches your product without one. They compose well and neither depends on the other.

📝 **MachFiveTech article** — *coming soon*.

## Install

```bash
npm i @machfivetechchicago/machvive-chat-syncopation-ai
```

```js
// Everything, registered on import.
import '@machfivetechchicago/machvive-chat-syncopation-ai';

// Or cherry-pick.
import '@machfivetechchicago/machvive-chat-syncopation-ai/canvas';
import '@machfivetechchicago/machvive-chat-syncopation-ai/prompt';
```

## The shortest thing that works

One tag. It creates its own services and runs the `echo` transport, which is enough
to build and style a surface before any model exists.

```html
<machvive-chat-syncopation>
  <machvive-chat-syncopation-nudge
    suggestions="Where's my order?|I'd like to return something|Talk to a human">
  </machvive-chat-syncopation-nudge>
  <machvive-chat-syncopation-canvas></machvive-chat-syncopation-canvas>
  <machvive-chat-syncopation-prompt slot="footer"></machvive-chat-syncopation-prompt>
</machvive-chat-syncopation>
```

## Owning the services explicitly

Wrap the surface when the page needs the bus, wants persistence, or runs two
independent conversations that must not share state.

```html
<machvive-chat-syncopation-services id="chat" transport="local" model="Llama-3.2-1B" persist>
  <machvive-chat-syncopation>
    <machvive-chat-syncopation-canvas></machvive-chat-syncopation-canvas>
    <machvive-chat-syncopation-prompt slot="footer"></machvive-chat-syncopation-prompt>
  </machvive-chat-syncopation>
  <machvive-chat-syncopation-history></machvive-chat-syncopation-history>
</machvive-chat-syncopation-services>
```

```js
const chat = document.getElementById('chat');

chat.bus.on('record:added', (record) => {
  console.log(record.role, record.text);
});

await chat.send('Hello');
```

Components discover the services element by walking up the DOM, so **nesting is the
wiring** — no registry and no globals, which is what makes two surfaces on one page
genuinely independent.

### Attributes

Set them on `<machvive-chat-syncopation-services>`, or on `<machvive-chat-syncopation>`
when you let the container create its own.

| Attribute | Default | Meaning |
| --- | --- | --- |
| `transport` | `echo` | `echo`, `local`, `remote`, or your own registered name |
| `model` | — | Passed to the transport |
| `endpoint` | — | Passed to the `remote` transport |
| `persist` | *off* | Keep conversations in IndexedDB. Opt-in, deliberately |
| `max-turns` | `200` | Oldest turns are trimmed past this |
| `streaming` | `true` | Whether transports stream |
| `theme` | *OS* | `light` or `dark`, overriding `prefers-color-scheme` |

## Writing a transport

A transport is an async generator that yields string chunks. That is the whole
contract — a server, a model in the user agent, and a canned script all look the
same to every component.

```js
import { Daemon } from '@machfivetechchicago/machvive-chat-syncopation-ai/services';

async function* anthropic(prompt, { config }) {
  const response = await fetch(config.endpoint, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ model: config.model, prompt, stream: true })
  });
  for await (const chunk of response.body) {
    yield new TextDecoder().decode(chunk);
  }
}
```

The library ships no transport that touches the network — the call above is yours to
make, from your own code, with your own credentials. Nothing here holds an API key
and nothing here phones home.

## Theming

Set the `--mcs-*` tokens once, anywhere. Custom properties cross shadow boundaries
where ordinary styles cannot, so there is no `::part` surgery and no `!important`.

```css
machvive-chat-syncopation {
  --mcs-accent: #7b2d8e;
  --mcs-user-bg: #f3e8f7;
  --mcs-radius: 4px;
  --mcs-height: 40rem;
}
```

Dark mode follows `prefers-color-scheme` by default; `theme="light"` or
`theme="dark"` overrides the OS, and an explicit choice wins in either direction.

## Browser support

Anywhere `customElements`, Shadow DOM and ES modules work — every current browser.
Persistence needs IndexedDB and degrades to in-memory without it, so a private
window loses history rather than breaking. Dictation and read-aloud are gated on the
Speech APIs and say so in the UI when they are absent.

**These modules are browser-only.** `class X extends HTMLElement` is evaluated at
import, so a server-side import throws. In an SSR framework, import them from a
client-only path (`useEffect`, `onMount`, `client:load`, or a dynamic `import()`
behind a `typeof window !== 'undefined'` check).

## Contributing

```bash
npm test          # the whole suite; there is no build step
npm run test:watch
```

There is no bundler and no linter: files are published as authored, so what is on
disk is what consumers load. Before trusting a new test, break the thing it covers
and watch it fail — a green suite proves nothing until you have seen it go red.

## License

[Apache-2.0](LICENSE) © MachFiveTech Chicago
