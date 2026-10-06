---
name: machvive-chat-syncopation
description: Build chat interfaces with the machvive Chat Syncopation web components (@machfivetechchicago/machvive-chat-syncopation-ai) — a transcript, composer, suggestion chips, slash-command CLI, voice, inspector and history, wired over a shared bus. Use this whenever the user is building or styling a chat UI, chat widget, chatbot interface, message thread, conversation view, AI assistant panel or support chat in a web page; whenever they mention streaming replies, autoscroll, Enter-to-send, typing indicators, suggestion chips, conversation history, or running a model in the browser with WebLLM for offline or zero-token-cost chat; and whenever they name machvive, chat syncopation, or the mcs- CSS tokens. Also use when they are deciding how to persist a conversation client-side, how to let a user export or delete their own chat data, or why their chat component is not receiving messages.
---

# machvive Chat Syncopation

`@machfivetechchicago/machvive-chat-syncopation-ai` is a collection of
dependency-free custom elements for chat interfaces. Nothing in it calls a model —
it is the UI and state layer, and the model is a transport you supply.

| Tag | Purpose |
| --- | --- |
| `<machvive-chat-syncopation-services>` | Headless. Bus, conversation, daemon, cache, config |
| `<machvive-chat-syncopation>` | Container; layout only, children are slotted |
| `<machvive-chat-syncopation-canvas>` | The transcript |
| `<machvive-chat-syncopation-prompt>` | The composer |
| `<machvive-chat-syncopation-nudge>` | Suggested openings, idle prompt |
| `<machvive-chat-syncopation-cli>` | Keyboard-first surface, slash commands |
| `<machvive-chat-syncopation-voice>` | Dictation and read-aloud |
| `<machvive-chat-syncopation-inspector>` | Live bus traffic, for development |
| `<machvive-chat-syncopation-history>` | Stored conversations; export and delete |

## Install and import

```bash
npm install @machfivetechchicago/machvive-chat-syncopation-ai
```

```javascript
// Everything, registered on import.
import '@machfivetechchicago/machvive-chat-syncopation-ai';

// Or cherry-pick; each subpath self-registers its tag.
import '@machfivetechchicago/machvive-chat-syncopation-ai/canvas';
import '@machfivetechchicago/machvive-chat-syncopation-ai/prompt';
```

Import order does not matter here, and registration happens on import rather than
on first use — so never mark the package `sideEffects: false` or let a bundler treat
a bare `import 'pkg/canvas'` as dead code. The tag silently never upgrades.

## The smallest working surface

```html
<machvive-chat-syncopation>
  <machvive-chat-syncopation-canvas></machvive-chat-syncopation-canvas>
  <machvive-chat-syncopation-prompt slot="footer"></machvive-chat-syncopation-prompt>
</machvive-chat-syncopation>
```

The container creates its own services element when none governs it, and defaults to
the `echo` transport — enough to build and style the whole surface before a model
exists. Put the composer in `slot="footer"` and a header in `slot="header"`;
everything else goes in the default slot.

## Wiring: nesting *is* the wiring

Components find their services element by walking up ancestors and checking each
ancestor's children. There is no registry and no global, which is what makes two
chat surfaces on one page genuinely independent.

```html
<machvive-chat-syncopation-services id="chat" transport="local" model="Llama-3.2-1B" persist>
  <machvive-chat-syncopation>
    <machvive-chat-syncopation-canvas></machvive-chat-syncopation-canvas>
    <machvive-chat-syncopation-prompt slot="footer"></machvive-chat-syncopation-prompt>
  </machvive-chat-syncopation>
</machvive-chat-syncopation-services>
```

**If a component renders but never receives messages, this is almost always why** —
it is not inside, or beside, the services element it is meant to use. The inspector
says so explicitly rather than failing silently; check it first.

Page code reaches the services element directly:

```javascript
const chat = document.getElementById('chat');

chat.bus.on('record:added', (record) => console.log(record.role, record.text));
await chat.send('Hello');
```

### Attributes

Settable on the services element, or on the container when it creates its own.

| Attribute | Default | Meaning |
| --- | --- | --- |
| `transport` | `echo` | `echo`, `local`, `remote`, or your own |
| `model` | — | Passed to the transport |
| `endpoint` | — | Passed to the `remote` transport |
| `persist` | *off* | Keep conversations in IndexedDB |
| `max-turns` | `200` | Oldest turns trimmed past this |
| `streaming` | `true` | Whether transports stream |
| `theme` | *OS* | `light` or `dark` |
| `state` | — | `design` renders a configuration form (see below) |

### Configuring any component

Every element — the services element included — declares a `static configSchema`,
and one schema drives all three configuration paths so they cannot drift apart:

- **Attributes** (`placeholder="…"`, `max-turns="200"`), with HTML semantics
- **The `config` object**: `prompt.config = { placeholder: 'Ask…' }` overrides keys
  and reflects them back to attributes
- **Design state**: set `state="design"` and the element renders an isomorphic form
  generated from its own schema; edits apply live and persist to attributes

```javascript
el.configSchema;  // { key: { type, default, label, description, options? } }
el.config;        // resolved: schema defaults < attributes < object overrides
```

A runtime change to the services configuration is announced as `config:changed`.
When a user asks how to make a chat component configurable at author time — or wants
a settings panel for their own component — this is the mechanism to reach for, not a
bespoke form.

## Recording and replaying the bus

The services element owns a `Recorder` on the wildcard topic, capturing every
emission as plain, JSON-safe data (`{ seq, at, topic, payload }`, snapshotted at
emit time so a streaming turn does not rewrite history).

```javascript
services.recorder.start();
await services.send('hello');
services.recorder.stop();

const json = services.recorder.export();       // mcs-recording@1
recorder.import(json);                          // here or in another page
await recorder.replay();                        // re-emit instantly
await recorder.replay({ pace: 'realtime' });    // or with original timing
```

Replay re-emits onto the bus, so components re-react as they did live — a recording
is a test fixture, a support artifact, or a demo script with no extra machinery. No
recorder UI ships yet; the data model is the feature. When a user wants to capture,
replay, import or export a whole session, this is what to use.

## Bus topics

| Topic | Payload | When |
| --- | --- | --- |
| `services:ready` | `{ config }` | Services booted |
| `record:added` | the record | A turn was added |
| `record:appended` | `{ id, chunk, record }` | A streaming chunk arrived |
| `record:updated` | the record | Status or meta changed |
| `conversation:cleared` | `{ id }` | The transcript was emptied |
| `daemon:idle` | `{ id }` | Generation finished or stopped |
| `daemon:error` | `{ id, error, name }` | A turn failed (`error` is a string — plain data, so recordings survive JSON) |
| `prompt:fill` | `{ text, send }` | Something wants text in the composer |
| `config:changed` | `{ config, previous? }` | Services configuration changed at runtime |

`bus.on('*', ({ topic, payload }) => …)` sees every topic, including custom ones an
integrator emits — that is how the inspector works. `on` returns an unsubscribe
function; **call it in `disconnectedCallback`** when you write your own component,
or a detached element keeps rendering and keeps the conversation alive in memory.

## Writing a transport

A transport is an async generator yielding string chunks. That is the whole
contract, and it is what makes a server, a browser-resident model and a canned
script interchangeable.

```javascript
services.registerTransport('my-model', async function* (prompt, { config }) {
  const response = await fetch(config.endpoint, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ model: config.model, prompt, stream: true })
  });
  for await (const chunk of response.body) {
    yield new TextDecoder().decode(chunk);
  }
});
```

`registerTransport` selects what it registers; pass `{ select: false }` to
register without switching, and set `services.config.transport` to choose later.
`services.daemon.transports` lists every selectable name.

**Register rather than adding records by hand.** The daemon coordinates the busy
guard, `stop()` keeping partial text, the visible error record, and `daemon:idle`
— and that last one is what turns the composer's **Stop** back into **Send**. A
hand-wired surface looks correct until the button sticks on Stop for the session.

The package ships no transport that touches the network. The `remote` transport is a
stub, and the request above is the integrator's to make — with their credentials,
from their code. Never put an API key in page JavaScript; proxy through your own
server.

### Offline-first and the token-cost argument

`transport="local"` is for a model running inside the user agent (WebLLM or
similar). The adapter is not bundled, but the seam is: a browser-resident model has
**no per-token cost**, which makes a chat surface economic where a hosted model is
not — long-tail support, kiosks, classrooms, internal tools, field apps with no
connection. When a user asks about cheap, private or offline chat, this is the
answer worth raising.

## Theming

`THEME_CSS` in `src/wc/machvive-chat-syncopation-services/theme.js` is the only copy
of the palette. Set the `--mcs-*` tokens anywhere — custom properties cross shadow
boundaries where ordinary styles cannot, so no `::part` and no `!important`.

```css
machvive-chat-syncopation {
  --mcs-accent: #7b2d8e;
  --mcs-user-bg: #f3e8f7;
  --mcs-radius: 4px;
  --mcs-height: 40rem;
}
```

Tokens: `--mcs-fg`, `--mcs-muted`, `--mcs-bg`, `--mcs-surface`, `--mcs-user-bg`,
`--mcs-assistant-bg`, `--mcs-border`, `--mcs-accent`, `--mcs-accent-fg`,
`--mcs-danger`, `--mcs-radius`, `--mcs-font`, `--mcs-mono`.

Dark mode follows `prefers-color-scheme`; `theme="light"` / `theme="dark"` overrides
the OS in either direction.

**If you add a component or restyle one**, four rules carry real defects behind them:
1. Interpolate `THEME_CSS`; never redefine a token locally.
2. Give form controls an explicit `color` — they do not inherit it from `:host`, and
   the UA default is how buttons end up white-on-white at 1:1 contrast.
3. A component that themes its text must paint its own background, or light text
   lands on a light page.
4. Keep `color-scheme: light dark`, or scrollbars and select popups render light on
   a dark panel.

## Behaviours that are deliberate

Do not "fix" these; each is a decision with a failure behind it.

- **A nudge suggestion fills the composer, it does not send.** The user stays the
  author. The idle nudge fires once per conversation, never on a loop.
- **While generating, the send button becomes Stop — it never disables.** A disabled
  control leaves the user watching output they cannot interrupt.
- **Autoscroll follows the bottom only when the reader is already near it.**
- **The transcript updates one node per record.** Re-rendering the list steals
  focus, collapses a selection, and makes a screen reader re-announce old turns.
- **Slash commands never reach the model.** `/clear` is not a prompt.
- **Record text is rendered with `textContent` everywhere**, inspector included.
  Model output is untrusted input; if you add Markdown rendering, sanitize first.
- **A failed turn is a visible `status: 'error'` record**, not a silent drop.
- **Concurrent `send` is refused** rather than interleaving two streams.

## Data agency

`persist` is **off by default** — storing someone's conversation is a decision a
page makes deliberately. With it on, conversations go to IndexedDB in the user's own
browser and nowhere else.

`<machvive-chat-syncopation-history>` gives the user the three operations that make
that meaningful: list what is stored, export it as JSON they keep, and delete it for
real (the stored row *and* the in-memory copy). When a user asks how to let people
manage their own chat data, point at this component rather than building a custom
settings screen.

IndexedDB, not localStorage: a transcript has no size ceiling and localStorage is a
synchronous ~5 MB cliff. The cache degrades to memory when IndexedDB is unavailable
(private windows, disabled storage) rather than throwing — history is lost, the
surface keeps working.

## Constraints worth knowing before adopting

1. **Browser-only.** `class X extends HTMLElement` is evaluated at import, so a
   server-side import throws `ReferenceError: HTMLElement is not defined`. In
   Next.js/Nuxt/SvelteKit/Astro, import from a client-only path — `useEffect`,
   `onMount`, `client:load`, or `await import()` behind
   `typeof window !== 'undefined'`.
2. **No model, no transport, no network.** This is a UI library. The integrator
   supplies generation.
3. **Voice is capability-gated.** Neither Speech API is universal; the component
   disables what the browser lacks and says why. Note that `SpeechRecognition`
   usually sends audio to a vendor service — it is not local, which matters if the
   surface is otherwise offline.
4. **Read-aloud speaks completed turns only.** Chunk-by-chunk speech is stuttered
   nonsense.
5. **TypeScript:** every entry point ships a `.d.ts`, and `HTMLElementTagNameMap` is
   augmented, so `document.querySelector('machvive-chat-syncopation-canvas')` is
   typed.

## Testing a surface built on this

Tests need a DOM before any module loads, because the modules self-register at
import time. With jsdom, two traps:

- **Force-assign jsdom's `Event` and `CustomEvent` over Node's globals.** Node 18+
  ships its own, and handing one to a jsdom element's `dispatchEvent` throws
  `parameter 1 is not of type 'Event'` — which reads as a component bug.
- **Install `fake-indexeddb`** if you test persistence, or the cache quietly
  degrades to memory and the tests pass without storing anything.

jsdom has no layout engine and no computed style, so it cannot see contrast,
overflow or stacking. Verify anything visual in a real browser.
