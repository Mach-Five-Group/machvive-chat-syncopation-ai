# Agent Instructions

Published npm library of vanilla Web Components for chat interfaces. No framework, no bundler, no build step, no linter — files are published as-authored ESM, so what is on disk is what consumers load. **AI-stack agnostic**: nothing here calls a model; never add a hosted-model assumption or a runtime dependency.

Deep rationale lives in [CLAUDE.md](CLAUDE.md) — read it before non-trivial work. Integration-facing docs are in [README.md](README.md) and [design/wiki/](design/wiki/).

## Commands

```bash
npm test                 # full suite (node --test + jsdom + fake-indexeddb, dev-only deps)
npm run test:watch

# one file / one test — the --import flag is REQUIRED (components self-register at import; DOM must exist first)
node --test --import ./test/setup.js test/components.test.js
node --test --import ./test/setup.js "test/*.test.js" --test-name-pattern "persist"
```

Validate new tests by mutation: break the thing the test covers, watch it fail, revert.

## Adding a component — touch all four or it breaks silently

1. `src/wc/<tag-name>/<tag-name>.js` — `export class` PascalCase, `attachShadow({mode:'open'})` in constructor, markup + scoped `<style>` in `connectedCallback`, `THEME_CSS` at top of stylesheet, guarded self-registration `if (!customElements.get('<tag-name>'))`, every bus subscription unsubscribed in `disconnectedCallback`
2. Sibling `<tag-name>.d.ts`
3. Import/export pair in [index.js](index.js)
4. New subpath in `package.json` `exports` with `types` condition **first**

[test/package.test.js](test/package.test.js) asserts all four. All tags are prefixed `machvive-chat-syncopation`.

## Invariants that fail silently — keep them true

- **Never add runtime dependencies** (especially `@machfivetechchicago/machvive-webmcp-ai` — an external install script keeps re-adding it; remove it from `package.json` *and* `package-lock.json`, don't relax the test).
- `sideEffects` never `false`; `types` first in every exports subpath; every `.js` entry has a sibling `.d.ts` that does not outrun runtime exports.
- Browser-only by construction (`extends HTMLElement` at module load) — do not lazy-declare classes; self-registration on import is the feature.
- `PubSub` must not extend `EventTarget` (realm-free); wildcard `'*'` topic must keep delivering.
- Only `Conversation` mutates records; `records` returns a copy.
- `Cache` is IndexedDB with memory fallback, never throws; persistence is opt-in (`persist` defaults false).
- Transports are registered (`Daemon#register` / `registerTransport`), unknown transport falls back to `echo`; a failed turn surfaces as a visible `status: 'error'` record; concurrent `send` is refused.
- Record text renders with `textContent` everywhere, inspector included (model output is untrusted).
- Canvas updates one node per record — never re-render the list; autoscroll only when reader is already at bottom.
- Nudge fills the composer, never sends; CLI slash commands never reach the model; voice is capability-gated; read-aloud speaks completed turns only.
- Theming: no hardcoded hex/named colours outside token blocks; keep `color-scheme: light dark`; cascade order (light → dark media query → explicit `theme="dark"`) is load-bearing; a component that themes text paints its own background. Verify contrast in a real browser — jsdom is structurally blind to it.

## Packaging

`prepublishOnly` runs the suite. Tarball contents: `files` allowlist is authoritative, [.npmignore](.npmignore) is backup. `npm pack --dry-run --json` shape changed in npm 12 (array → object) — accept both.

## Releasing — trusted publishing over OIDC, never a token

Releases publish from GitHub Actions via npm trusted publishing (OIDC) with a provenance attestation. **No npm token exists and none should be created — never ask for one, never accept one pasted into chat.**

```bash
npm version <patch|minor|major>
git commit -am "…" && git tag -a v<x.y.z> -m "…"
git push origin main --follow-tags
```

- [.github/workflows/publish.yml](.github/workflows/publish.yml) authenticates over OIDC, guards that the tag matches `package.json` `version`, runs the suite, then `npm publish --access public --provenance`.
- **The trusted-publisher config on npmjs.com is bound to the workflow filename `publish.yml`** — renaming the file breaks publishing until the npm config is updated.
- If a tag push does not trigger the workflow, dispatch it: `gh workflow run publish.yml --ref v<tag>`.
- Registry propagation lags a minute or more after publish; poll rather than assuming failure. A red "verify attestation" step right after a good publish means "not visible yet", not "bad release".
- **Read the staged diff before committing** — an unread `git add -A` once shipped a self-dependency to npm.
- Before believing a release, install the tarball into an empty project and import it; exercise any new API in a real page. A passing suite says nothing about whether the published shape resolves.

## Documentation is part of a release

README, [design/wiki/](design/wiki/), [plugins/machvive-chat-syncopation/skills/](plugins/machvive-chat-syncopation/skills/), and the Hugo homepage drift with no symptom. Any claim of absence ("no network requests", "no dependencies") needs a test asserting it.
