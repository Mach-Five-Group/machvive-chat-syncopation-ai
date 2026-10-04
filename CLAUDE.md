# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

`@machfivetechchicago/machvive-chat-syncopation-ai` — a published npm library of vanilla Web Components for building chat interfaces. Consumers install it and `import` the modules; there is no app shell, no bundler, and no framework in this repo.

It is **AI-stack agnostic by construction**. Nothing here calls a model. The daemon's transports are a uniform interface an integrator fills in, and the one that matters strategically is `local` — a model running inside the user agent has no per-token cost, which makes a chat surface economic in places where a hosted model is not. Keep that possibility open in every design decision: anything that assumes a server exists closes it.

The sibling package `@machfivetechchicago/machvive-webmcp-ai` is referenced in the docs and is **not a dependency**. Do not add it as one — see *The dependency that keeps coming back* below.

## Commands

```bash
npm test                 # whole suite
npm run test:watch       # re-runs on change

# one file
node --test --import ./test/setup.js test/components.test.js
# one test by name
node --test --import ./test/setup.js "test/*.test.js" --test-name-pattern "persist"
```

Tests use the built-in Node test runner plus `jsdom` and `fake-indexeddb` (the only dependencies, dev-only). There is no build step and no linter — files are published as-authored ESM, so whatever is on disk is what consumers load.

`--import ./test/setup.js` is required, not optional: the component modules self-register at import time, so the DOM has to exist before any of them load. The runner gives each test file its own process, so each starts from a clean document and registry.

### setup.js force-assigns some globals on purpose

Node 18+ ships its own global `Event` and `CustomEvent`. Handing one of those to a jsdom element's `dispatchEvent` throws `parameter 1 is not of type 'Event'` — the realms do not recognise each other's objects, and it surfaces as a component failure rather than a harness one. [test/setup.js](test/setup.js) therefore *overwrites* those globals with jsdom's rather than filling in only the missing ones. If a component starts failing on event dispatch, check that list before suspecting the component.

The same file filters one jsdom "not implemented" warning (navigation, from the history export's `<a download>` click). A suite that prints a harmless warning every run is a suite where the next real warning goes unread.

### Validate new tests by mutation

26 deliberate mutations are currently all caught. Before trusting a new test, break the thing it covers and watch it fail — in the sibling package three of the first five mutations survived. The mutation list is not checked in; write it ad hoc in the scratchpad, cover the invariant you just added, and revert.

## Architecture

**Entry points.** Eleven subpaths, all declared in `package.json` `exports`:
- `.` → [index.js](index.js) — bulk import; imports every component (triggering self-registration) and re-exports the classes plus the whole service layer.
- `./services`, `./container`, `./canvas`, `./prompt`, `./nudge`, `./cli`, `./voice`, `./inspector`, `./history` — cherry-picking.

Adding a component means touching four places: the module under `src/wc/<tag-name>/`, its `.d.ts` sibling, the import/export pair in [index.js](index.js), and a new subpath in `package.json` `exports`. Missing any one breaks either the bulk import or the cherry-pick path, and nothing says so at runtime — so [test/package.test.js](test/package.test.js) asserts all four.

**Component convention** (see [machvive-chat-syncopation-canvas.js](src/wc/machvive-chat-syncopation-canvas/machvive-chat-syncopation-canvas.js) as the reference):
- One directory per component at `src/wc/<tag-name>/<tag-name>.js`, matching the custom element tag.
- Named `export class` in PascalCase; the module is imported for side effects *and* the class re-exported from `index.js`.
- Constructor calls `attachShadow({ mode: 'open' })`; markup and scoped `<style>` are written in `connectedCallback`.
- `THEME_CSS` is interpolated at the top of every stylesheet.
- Each module self-registers at the bottom, guarded by `if (!customElements.get('<tag-name>'))` so bulk and cherry-pick imports can both run without a double-define error.
- Every bus subscription returns an unsubscribe, collected in a private array and released in `disconnectedCallback`. A detached component that keeps rendering also keeps the whole conversation alive in memory.

All tags are prefixed `machvive-chat-syncopation`.

**These modules are browser-only by construction.** `class X extends HTMLElement` is evaluated at module load, so importing any entry point where no DOM exists throws `ReferenceError: HTMLElement is not defined`. Don't "fix" this by lazily declaring the classes — self-registration on import is the feature; the constraint is inherent to custom elements. SSR frameworks need a client-only import path.

## The service layer

[machvive-chat-syncopation-services](src/wc/machvive-chat-syncopation-services/) is a headless element (`display: none`) plus eight modules. Components find it with `findServices`/`whenServices`, which walk ancestors *and* each ancestor's children — both nesting directions are legitimate, since a page may wrap a surface in `<…-services>` or a container may create one for itself.

Why discovery by DOM position rather than a module-level singleton: two independent chat surfaces on one page must not share a conversation, and a global registry makes that impossible to express.

Things to preserve:

- **`PubSub` does not extend `EventTarget`.** EventTarget binds the bus to whichever realm supplied the global, and dispatching an event built elsewhere throws. The hand-rolled listener set is realm-free and works in a worker or plain Node. A subscriber that throws is caught so one bad render cannot silence its siblings.
- **The wildcard `'*'` topic is how the inspector sees topics it was never taught**, including an integrator's own. Keep `emit` delivering to it.
- **`Conversation` is the only thing allowed to mutate records**, and announces every change. `records` returns a copy; handing out the live array lets a component corrupt the transcript.
- **`Cache` is IndexedDB, not localStorage.** A transcript grows without bound and localStorage is a synchronous ~5 MB cliff that fails exactly when the conversation got interesting. Every method degrades to memory rather than throwing — losing history must never break the surface. `remove`/`clear` drop the memory copy *and* the row; a delete that only hides rows is a lie, and this is the one place that matters most.
- **Persistence is opt-in** (`persist` defaults false). Storing someone's conversation is a decision a page has to make deliberately. Two tests pin this from both directions: that `persist` writes through, and that nothing is stored without it.
- **The daemon surfaces a failed turn** as a visible `status: 'error'` record. Silently dropping it leaves the user staring at a prompt that appears to have done nothing. `stop()` keeps the partial text — the user saw it.
- **Concurrent `send` is refused.** Interleaving two streams into one transcript produces output no reader can attribute.
- **Reserved `meta` keys are namespaced `mcs:`** because `meta` is deliberately open; integrator keys are carried verbatim and never stripped (they carry CRM and ticket identifiers).

## Component rules worth not relearning

- **The canvas updates one node per record**, never re-rendering the list. Re-rendering steals focus, collapses a text selection, and makes a screen reader re-announce turns the user already heard.
- **Autoscroll follows the bottom only when the reader is already there.** Yanking someone back down mid-read is the fastest way to make a chat surface unusable.
- **Record text is rendered with `textContent` everywhere**, including inside the inspector. Model output is untrusted input; `innerHTML` would make every reply a script-injection vector, and the dev tool is not exempt.
- **While generating, the send button becomes Stop — it does not disable.** A disabled control leaves the user watching output they cannot interrupt.
- **A nudge suggestion fills the composer; it never sends.** The user stays the author. The idle nudge fires once per conversation, never on a loop.
- **CLI slash commands never reach the model.** Clearing a conversation is not a prompt, and sending it as one wastes a turn and produces a confident wrong answer. A throwing command reports instead of taking the surface down.
- **Voice is capability-gated with the reason shown.** Neither Speech API is universal, so "it works on my machine" is the default failure. Dictation is push-to-talk and fills rather than sends — a microphone that transmits on recognition will eventually send half a sentence, or a conversation happening in the room.
- **Read-aloud speaks completed turns only.** Speaking a stream chunk by chunk produces stuttered nonsense.

## Theming

[services/theme.js](src/wc/machvive-chat-syncopation-services/theme.js) holds the only copy of the palette; every component interpolates `THEME_CSS` at the top of its stylesheet. Custom properties inherit *through* shadow boundaries where ordinary styles do not, so a page restyles everything by setting the `--mcs-*` tokens once.

- **Cascade order is load-bearing.** Light tokens on bare `:host`, then the `prefers-color-scheme: dark` block guarded by `:host(:not([theme="light"]))`, then `:host([theme="dark"])` *after* the media query so an explicit choice wins in a light OS. A test asserts the ordering.
- **Controls set their own colour.** Form controls do not inherit `color` from `:host`, so the UA supplies a per-theme default — which is how every button in the sibling package became white-on-white at 1:1 contrast.
- **A component that themes its own text must paint its own background**, or inside a light page its light text renders on light. A test enforces it.
- **No hardcoded hex or named colours outside the token blocks.** A test strips `THEME_CSS` and fails on any remaining literal.
- **`color-scheme: light dark`** must stay declared, or the browser paints light scrollbars, select popups and checkboxes onto a dark panel.
- **Every colour token needs a dark value.** A token defined only in light inherits the light value under dark.

Contrast is not something to eyeball. jsdom has no layout engine and no computed style, so the suite is structurally blind to it — measure WCAG ratios in a real browser across all six OS-preference × `theme` combinations before any release that touches component CSS.

## The dependency that keeps coming back

`~/Documents/2026/m5t_cli/index.js -npmi` walks every `package.json` under its search root and installs `@machfivetechchicago/machvive-webmcp-ai` into each one. It reaches this repo and adds a **runtime** dependency to `package.json` and `package-lock.json`.

That breaks two things this package claims: it is dependency-free, and it is stack-agnostic. A consumer would be forced to install a WebMCP polyfill to use a chat bubble.

[test/package.test.js](test/package.test.js) fails while the entry is present, in both the manifest and the lock file, so it cannot be published that way. If the test fails on a clean checkout, remove the entry from both files rather than relaxing the test, and check whether that process is running.

## Publishing

Trusted publishing from GitHub Actions over OIDC — no tokens. `prepublishOnly` runs the suite, so a failing test blocks the release.

Two overlapping mechanisms control tarball contents: the `files` allowlist in `package.json` (authoritative) and [.npmignore](.npmignore) (belt-and-braces). Editing only `.npmignore` appears to do nothing when the path isn't in `files`. The `published tarball` test asserts the real `npm pack` output, so drift surfaces there rather than after a release.

Things that will break a publish or a consumer, all currently satisfied — keep them that way:
- **`sideEffects` must never be `false`.** Components register via `customElements.define()` on import; `false` lets bundlers drop `import "pkg/canvas"` and silently skip the tag.
- **`types` must be the first condition in each `exports` subpath.** TypeScript resolves conditions in order and will miss declarations placed after `default`.
- **Every `.js` entry point needs a sibling `.d.ts`**, and `index.d.ts` must not declare value exports [index.js](index.js) lacks — declarations that outrun runtime fail only in the consumer.
- **The declared `Apache-2.0` license requires [LICENSE](LICENSE) to ship.**
- **`npm pack --dry-run --json` changed shape in npm 12** from an array to an object keyed by package name. Anything reading it must accept both, or it passes locally and fails in CI.

Install the tarball into an empty project and import it before believing a release. A passing suite says nothing about whether the published shape resolves.

## Documentation drifts with no symptom

The README, the wiki, the Claude skill and the Hugo homepage all describe this package and none of them fail when they go stale — the sibling package's skill sat four releases behind, missing a whole component. Treat them as part of the release, and any claim of absence ("no network requests", "no dependencies") needs a test asserting that absence, or it goes false one feature later with nothing failing.

## Excluded from the repo

`.gitignore` excludes `design/` (local design assets, including the visual-verification harness) and `.env`. The published tarball additionally omits `test/`, `.github/`, `plugins/` and this file.
