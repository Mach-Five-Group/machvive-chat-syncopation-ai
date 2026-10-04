# Security

## Reporting

Email **security@machfivetech.com** or open a
[private advisory](https://github.com/Mach-Five-Group/machvive-chat-syncopation-ai/security/advisories/new).
Please do not open a public issue for a vulnerability.

## What this package does and does not do

These are UI components. Being precise about the boundary is most of the security
story, and each claim below has a test asserting it — a claim of absence with no
test goes false one feature later with nothing failing.

**No network requests.** No module calls `fetch`, `XMLHttpRequest`, `WebSocket` or
`importScripts`, and the source references no external origin. The `remote`
transport is a stub; the actual call is yours to write, from your own code. Nothing
here holds a credential.
*Asserted by `the source makes no network requests` in* `test/package.test.js`.

**No dependencies.** Nothing is installed at runtime, so there is no transitive
supply chain to audit. `jsdom` and `fake-indexeddb` are dev-only.
*Asserted by* `the package declares no runtime, peer, or optional dependencies` *and
the lock-file guard beside it.*

**No telemetry.** Importing any module emits nothing, anywhere. The inspector is a
development tool that reads the in-page bus and keeps a capped buffer in memory.

**Nothing is stored until a page asks.** `persist` defaults to off. With it on,
conversations go to IndexedDB in the user's own browser and nowhere else. Deleting
through the history component removes the stored row and the in-memory copy.
*Asserted from both directions by* `persist writes the conversation through to the
cache` *and* `nothing is stored when persistence is off`.

## Handling model output

**Model output is untrusted input.** Every component renders record text with
`textContent`, never `innerHTML` — including the inspector, which is not exempt
because it is a dev tool. A reply containing `<img src=x onerror=…>` renders as
those characters.
*Asserted by* `the canvas renders record text as text, never as markup` *and*
`the inspector caps its buffer and renders payloads as text`.

If you extend these components to render Markdown or HTML, that decision is yours
and it reopens the hole: sanitize before you insert, and treat anything a model
produces — including text it copied from a document, a web page or a tool result —
as hostile.

**Prompt injection is not solved by a UI library.** If your transport gives a model
access to tools or private data, text arriving in the conversation can try to steer
it. Keep authorization on your server, where the user's identity is known, rather
than in anything the page can rewrite.

## Privacy

The conversation belongs to the person having it. With `transport="local"` it never
leaves their device at all. With a remote transport, what you send and what you log
is governed by your own privacy policy — this package neither helps nor hinders
that, and it never adds a recipient of its own.

Note that dictation in most browsers is **not** local: `SpeechRecognition` typically
sends audio to a vendor service. If that matters for your users, say so where you
put the microphone button.

## Supported versions

The latest minor release receives security fixes. Releases are published from CI
with a provenance attestation — verify any version with:

```bash
npm audit signatures
```
