import test from 'node:test';
import assert from 'node:assert/strict';
import '../index.js';
import { findServices, whenServices } from '../src/wc/machvive-chat-syncopation-services/machvive-chat-syncopation-services.js';
import { mount, until, tick } from './helpers.js';

const TAGS = [
  'machvive-chat-syncopation-services',
  'machvive-chat-syncopation',
  'machvive-chat-syncopation-canvas',
  'machvive-chat-syncopation-prompt',
  'machvive-chat-syncopation-nudge',
  'machvive-chat-syncopation-cli',
  'machvive-chat-syncopation-voice',
  'machvive-chat-syncopation-inspector',
  'machvive-chat-syncopation-history'
];

// Each test starts from an empty body. Without this, a test that throws before
// its cleanup line leaves a services element in the document, and the next test
// that expects to find none discovers it via the document-wide fallback — a
// failure that points at the wrong component.
test.beforeEach(() => document.body.replaceChildren());

test('importing the bulk entry point registers every tag', () => {
  for (const tag of TAGS) {
    assert.ok(customElements.get(tag), `${tag} should be defined`);
  }
});

test('every component attaches a shadow root', () => {
  for (const tag of TAGS) {
    const element = document.createElement(tag);
    assert.ok(element.shadowRoot, `${tag} should attach a shadow root in its constructor`);
  }
});

test('the services element projects its children instead of hiding them', () => {
  // It is documented as a wrapper, so it must render a slot and must not be
  // display:none — with neither, wrapping a surface hides the whole surface.
  // jsdom has no layout engine, so this asserts the structure that produces
  // correct layout rather than the layout itself; the real check is the
  // browser audit in design/chat-syncopation-playground/verify.mjs.
  const services = document.createElement('machvive-chat-syncopation-services');
  document.body.append(services);

  const style = services.shadowRoot.querySelector('style').textContent;
  assert.ok(services.shadowRoot.querySelector('slot'), 'needs a <slot> to project children');
  assert.ok(!/:host\s*\{[^}]*display:\s*none/.test(style), ':host must not be display:none');
  assert.match(style, /display:\s*contents/, ':host should take no layout space of its own');
  services.remove();
});

test('a component inside a services wrapper is reachable and wired', async () => {
  const page = mount(`
    <machvive-chat-syncopation-services transport="echo">
      <machvive-chat-syncopation-canvas></machvive-chat-syncopation-canvas>
    </machvive-chat-syncopation-services>
  `);
  const services = page.query('machvive-chat-syncopation-services');
  const canvas = page.query('machvive-chat-syncopation-canvas');

  // The child is assigned to the services element's slot rather than being
  // dropped on the floor.
  assert.equal(canvas.assignedSlot?.tagName, 'SLOT');
  await services.send('wrapped');
  await until(() => canvas.shadowRoot.querySelectorAll('li').length === 2);
  page.remove();
});

test('the container creates services when none governs it', async () => {
  const page = mount('<machvive-chat-syncopation transport="echo"></machvive-chat-syncopation>');
  const container = page.query('machvive-chat-syncopation');
  const services = container.services;

  assert.ok(services, 'container should have created a services element');
  // Light DOM, not shadow: slotted children walk up the light tree and would
  // never see a services element hidden inside the container's shadow root.
  assert.equal(services.parentElement, container);
  assert.equal(services.getAttribute('transport'), 'echo', 'config attributes should carry over');
  page.remove();
});

test('the container reuses services it is nested inside', async () => {
  const page = mount(`
    <machvive-chat-syncopation-services>
      <machvive-chat-syncopation></machvive-chat-syncopation>
    </machvive-chat-syncopation-services>
  `);
  const outer = page.query('machvive-chat-syncopation-services');
  const container = page.query('machvive-chat-syncopation');
  assert.equal(container.services, outer);
  assert.equal(page.host.querySelectorAll('machvive-chat-syncopation-services').length, 1);
  page.remove();
});

test('findServices locates a sibling services element', () => {
  const page = mount(`
    <div>
      <machvive-chat-syncopation-services></machvive-chat-syncopation-services>
      <machvive-chat-syncopation-canvas></machvive-chat-syncopation-canvas>
    </div>
  `);
  const canvas = page.query('machvive-chat-syncopation-canvas');
  assert.equal(findServices(canvas), page.query('machvive-chat-syncopation-services'));
  page.remove();
});

test('whenServices resolves null rather than hanging when there are none', async () => {
  const orphan = document.createElement('machvive-chat-syncopation-canvas');
  const resolved = await whenServices(orphan, { timeoutMs: 30 });
  assert.equal(resolved, null);
});

test('the canvas renders existing records on connect and streams new ones', async () => {
  const page = mount(`
    <machvive-chat-syncopation-services transport="echo">
      <machvive-chat-syncopation-canvas></machvive-chat-syncopation-canvas>
    </machvive-chat-syncopation-services>
  `);
  const services = page.query('machvive-chat-syncopation-services');
  const canvas = page.query('machvive-chat-syncopation-canvas');

  services.conversation.add({ role: 'user', text: 'before connect' });
  await until(() => canvas.shadowRoot.querySelectorAll('li').length === 1);

  const first = canvas.shadowRoot.querySelector('li');
  assert.equal(first.dataset.role, 'user');
  assert.equal(first.querySelector('.bubble').textContent, 'before connect');

  await services.send('hello');
  await until(() => canvas.shadowRoot.querySelectorAll('li').length === 3);
  const rows = [...canvas.shadowRoot.querySelectorAll('li')];
  assert.deepEqual(rows.map((r) => r.dataset.role), ['user', 'user', 'assistant']);
  assert.equal(rows[2].dataset.status, 'complete');
  assert.match(rows[2].querySelector('.bubble').textContent, /^You said: hello/);
  page.remove();
});

test('the canvas updates one node per record instead of re-rendering', async () => {
  const page = mount(`
    <machvive-chat-syncopation-services transport="echo">
      <machvive-chat-syncopation-canvas></machvive-chat-syncopation-canvas>
    </machvive-chat-syncopation-services>
  `);
  const services = page.query('machvive-chat-syncopation-services');
  const canvas = page.query('machvive-chat-syncopation-canvas');

  const record = services.conversation.add({ role: 'assistant', text: 'a', status: 'pending' });
  await until(() => canvas.shadowRoot.querySelector('li'));
  const node = canvas.shadowRoot.querySelector('li');

  services.conversation.append(record.id, 'b');
  await until(() => node.querySelector('.bubble').textContent === 'ab');
  // Identity matters: replacing the node would steal focus and make a screen
  // reader re-announce a turn the user already heard.
  assert.equal(canvas.shadowRoot.querySelector('li'), node);
  page.remove();
});

test('the canvas renders record text as text, never as markup', async () => {
  const page = mount(`
    <machvive-chat-syncopation-services>
      <machvive-chat-syncopation-canvas></machvive-chat-syncopation-canvas>
    </machvive-chat-syncopation-services>
  `);
  const services = page.query('machvive-chat-syncopation-services');
  const canvas = page.query('machvive-chat-syncopation-canvas');

  services.conversation.add({ role: 'assistant', text: '<img src=x onerror=alert(1)>' });
  await until(() => canvas.shadowRoot.querySelector('.bubble'));
  const bubble = canvas.shadowRoot.querySelector('.bubble');
  assert.equal(bubble.querySelector('img'), null, 'model output must not become live markup');
  assert.equal(bubble.textContent, '<img src=x onerror=alert(1)>');
  page.remove();
});

test('clearing the conversation empties the canvas', async () => {
  const page = mount(`
    <machvive-chat-syncopation-services>
      <machvive-chat-syncopation-canvas></machvive-chat-syncopation-canvas>
    </machvive-chat-syncopation-services>
  `);
  const services = page.query('machvive-chat-syncopation-services');
  const canvas = page.query('machvive-chat-syncopation-canvas');
  services.conversation.add({ text: 'x' });
  await until(() => canvas.shadowRoot.querySelector('li'));

  services.conversation.clear();
  await until(() => canvas.shadowRoot.querySelectorAll('li').length === 0);
  assert.equal(canvas.shadowRoot.querySelector('.empty').hidden, false);
  page.remove();
});

test('Enter sends, Shift+Enter does not', async () => {
  const page = mount(`
    <machvive-chat-syncopation-services transport="echo">
      <machvive-chat-syncopation-prompt></machvive-chat-syncopation-prompt>
    </machvive-chat-syncopation-services>
  `);
  const services = page.query('machvive-chat-syncopation-services');
  const prompt = page.query('machvive-chat-syncopation-prompt');
  await whenServices(prompt);
  const field = prompt.shadowRoot.querySelector('textarea');

  field.value = 'line one';
  field.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Enter', shiftKey: true, bubbles: true }));
  assert.equal(services.conversation.length, 0, 'Shift+Enter must insert a newline, not send');
  assert.equal(field.value, 'line one');

  field.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
  await until(() => services.conversation.length > 0);
  assert.equal(services.conversation.records[0].text, 'line one');
  assert.equal(field.value, '', 'the field clears on send');
  page.remove();
});

test('the prompt ignores whitespace-only input', async () => {
  const page = mount(`
    <machvive-chat-syncopation-services transport="echo">
      <machvive-chat-syncopation-prompt></machvive-chat-syncopation-prompt>
    </machvive-chat-syncopation-services>
  `);
  const services = page.query('machvive-chat-syncopation-services');
  const prompt = page.query('machvive-chat-syncopation-prompt');
  await whenServices(prompt);
  const field = prompt.shadowRoot.querySelector('textarea');
  field.value = '   \n  ';
  field.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
  await tick(20);
  assert.equal(services.conversation.length, 0);
  page.remove();
});

test('the send button becomes Stop while generating, not disabled', async () => {
  const page = mount(`
    <machvive-chat-syncopation-services transport="echo">
      <machvive-chat-syncopation-prompt></machvive-chat-syncopation-prompt>
    </machvive-chat-syncopation-services>
  `);
  const services = page.query('machvive-chat-syncopation-services');
  const prompt = page.query('machvive-chat-syncopation-prompt');
  await whenServices(prompt);
  const button = prompt.shadowRoot.querySelector('button');
  const field = prompt.shadowRoot.querySelector('textarea');

  field.value = 'a few words to stream';
  field.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
  await until(() => button.dataset.mode === 'stop');
  // Disabling it would leave the user watching output they cannot interrupt.
  assert.equal(button.disabled, false);
  assert.equal(button.textContent, 'Stop');

  button.click();
  assert.equal(services.daemon.busy, false, 'the button in stop mode must interrupt');
  await until(() => button.dataset.mode === 'send');
  page.remove();
});

test('prompt:fill puts text in the field without sending', async () => {
  const page = mount(`
    <machvive-chat-syncopation-services transport="echo">
      <machvive-chat-syncopation-prompt></machvive-chat-syncopation-prompt>
    </machvive-chat-syncopation-services>
  `);
  const services = page.query('machvive-chat-syncopation-services');
  const prompt = page.query('machvive-chat-syncopation-prompt');
  await whenServices(prompt);

  services.bus.emit('prompt:fill', { text: 'drafted for you', send: false });
  assert.equal(prompt.shadowRoot.querySelector('textarea').value, 'drafted for you');
  assert.equal(services.conversation.length, 0, 'the user stays the author');
  page.remove();
});

test('a nudge suggestion fills the composer and never sends', async () => {
  const page = mount(`
    <machvive-chat-syncopation-services transport="echo">
      <machvive-chat-syncopation-nudge suggestions="Track my order|Return something|Talk to a human"></machvive-chat-syncopation-nudge>
      <machvive-chat-syncopation-prompt></machvive-chat-syncopation-prompt>
    </machvive-chat-syncopation-services>
  `);
  const services = page.query('machvive-chat-syncopation-services');
  const nudge = page.query('machvive-chat-syncopation-nudge');
  const prompt = page.query('machvive-chat-syncopation-prompt');
  await whenServices(prompt);

  const chips = nudge.shadowRoot.querySelectorAll('button');
  assert.equal(chips.length, 3);
  assert.deepEqual(nudge.suggestions, ['Track my order', 'Return something', 'Talk to a human']);

  let announced = null;
  nudge.addEventListener('nudge-select', (e) => { announced = e.detail.text; });
  chips[0].click();

  assert.equal(announced, 'Track my order');
  assert.equal(prompt.shadowRoot.querySelector('textarea').value, 'Track my order');
  assert.equal(services.conversation.length, 0, 'a suggestion is a draft, not a message');
  page.remove();
});

test('suggestions clear once the user says something', async () => {
  const page = mount(`
    <machvive-chat-syncopation-services>
      <machvive-chat-syncopation-nudge suggestions="One|Two"></machvive-chat-syncopation-nudge>
    </machvive-chat-syncopation-services>
  `);
  const services = page.query('machvive-chat-syncopation-services');
  const nudge = page.query('machvive-chat-syncopation-nudge');
  await whenServices(nudge);

  services.conversation.add({ role: 'user', text: 'something else entirely' });
  await until(() => nudge.shadowRoot.querySelectorAll('button').length === 0);
  page.remove();
});

test('the idle nudge fires once, never on a loop', async () => {
  const page = mount(`
    <machvive-chat-syncopation-services>
      <machvive-chat-syncopation-nudge idle-ms="20" idle-text="Still there?"></machvive-chat-syncopation-nudge>
    </machvive-chat-syncopation-services>
  `);
  const services = page.query('machvive-chat-syncopation-services');
  const nudge = page.query('machvive-chat-syncopation-nudge');
  await whenServices(nudge);

  let fired = 0;
  nudge.addEventListener('nudge-idle', () => fired++);
  await until(() => nudge.shadowRoot.querySelector('.idle').hidden === false);
  assert.equal(nudge.shadowRoot.querySelector('.idle').textContent, 'Still there?');

  // Activity, then idle again: a surface that keeps asking is one people close.
  services.conversation.add({ role: 'user', text: 'yes' });
  await tick(80);
  assert.equal(fired, 1);
  page.remove();
});

test('CLI slash commands run locally and never reach the model', async () => {
  const page = mount(`
    <machvive-chat-syncopation-services transport="echo">
      <machvive-chat-syncopation-cli></machvive-chat-syncopation-cli>
    </machvive-chat-syncopation-services>
  `);
  const services = page.query('machvive-chat-syncopation-services');
  const cli = page.query('machvive-chat-syncopation-cli');
  await whenServices(cli);
  const field = cli.shadowRoot.querySelector('input');
  const enter = () => field.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));

  field.value = '/help';
  enter();
  assert.match(cli.shadowRoot.querySelector('.out').textContent, /\/clear/);
  assert.equal(services.conversation.length, 0, 'a command is not a prompt');

  field.value = '/transport local';
  enter();
  assert.equal(services.config.transport, 'local');

  field.value = '/transport nonsense';
  enter();
  assert.match(cli.shadowRoot.querySelector('.out').textContent, /unknown transport/);
  assert.equal(services.config.transport, 'local', 'a rejected value must not be applied');
  page.remove();
});

test('CLI plain text is sent as a message', async () => {
  const page = mount(`
    <machvive-chat-syncopation-services transport="echo">
      <machvive-chat-syncopation-cli></machvive-chat-syncopation-cli>
    </machvive-chat-syncopation-services>
  `);
  const services = page.query('machvive-chat-syncopation-services');
  const cli = page.query('machvive-chat-syncopation-cli');
  await whenServices(cli);
  const field = cli.shadowRoot.querySelector('input');
  field.value = 'just a message';
  field.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));

  await until(() => services.conversation.length > 0);
  assert.equal(services.conversation.records[0].text, 'just a message');
  page.remove();
});

test('a throwing CLI command reports instead of taking the surface down', async () => {
  const page = mount(`
    <machvive-chat-syncopation-services>
      <machvive-chat-syncopation-cli></machvive-chat-syncopation-cli>
    </machvive-chat-syncopation-services>
  `);
  const cli = page.query('machvive-chat-syncopation-cli');
  await whenServices(cli);
  cli.register('boom', { describe: 'throws', run: () => { throw new Error('nope'); } });

  const field = cli.shadowRoot.querySelector('input');
  field.value = '/boom';
  field.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
  assert.match(cli.shadowRoot.querySelector('.out').textContent, /\/boom failed: nope/);
  page.remove();
});

test('CLI arrow keys walk the session history', async () => {
  const page = mount(`
    <machvive-chat-syncopation-services>
      <machvive-chat-syncopation-cli></machvive-chat-syncopation-cli>
    </machvive-chat-syncopation-services>
  `);
  const cli = page.query('machvive-chat-syncopation-cli');
  await whenServices(cli);
  const field = cli.shadowRoot.querySelector('input');
  const key = (k) => field.dispatchEvent(new window.KeyboardEvent('keydown', { key: k, bubbles: true }));

  for (const line of ['/help', '/clear']) { field.value = line; key('Enter'); }
  key('ArrowUp');
  assert.equal(field.value, '/clear');
  key('ArrowUp');
  assert.equal(field.value, '/help');
  key('ArrowDown');
  assert.equal(field.value, '/clear');
  page.remove();
});

test('the inspector captures topics it was never taught, including custom ones', async () => {
  const page = mount(`
    <machvive-chat-syncopation-services transport="echo">
      <machvive-chat-syncopation-inspector></machvive-chat-syncopation-inspector>
    </machvive-chat-syncopation-services>
  `);
  const services = page.query('machvive-chat-syncopation-services');
  const inspector = page.query('machvive-chat-syncopation-inspector');
  await whenServices(inspector);

  services.bus.emit('integrator:custom', { anything: true });
  services.conversation.add({ role: 'user', text: 'hi' });
  await until(() => inspector.events.length >= 2);

  const topics = inspector.events.map((e) => e.topic);
  assert.ok(topics.includes('integrator:custom'), 'wildcard subscription should see unknown topics');
  assert.ok(topics.includes('record:added'));
  page.remove();
});

test('the inspector caps its buffer and renders payloads as text', async () => {
  const page = mount(`
    <machvive-chat-syncopation-services>
      <machvive-chat-syncopation-inspector limit="5"></machvive-chat-syncopation-inspector>
    </machvive-chat-syncopation-services>
  `);
  const services = page.query('machvive-chat-syncopation-services');
  const inspector = page.query('machvive-chat-syncopation-inspector');
  await whenServices(inspector);

  for (let i = 0; i < 12; i++) services.bus.emit('tick', `n=${i}`);
  await until(() => inspector.events.length === 5);
  assert.equal(inspector.shadowRoot.querySelectorAll('.log li').length, 5);

  services.bus.emit('danger', '<script>alert(1)</script>');
  await until(() => inspector.events.at(-1).topic === 'danger');
  const detail = inspector.shadowRoot.querySelector('.log li:last-child .detail');
  assert.equal(detail.querySelector('script'), null, 'a dev tool must not execute what it inspects');
  page.remove();
});

test('the inspector explains itself when there are no services', async () => {
  const page = mount('<machvive-chat-syncopation-inspector></machvive-chat-syncopation-inspector>');
  const inspector = page.query('machvive-chat-syncopation-inspector');
  await until(() => /No <machvive-chat-syncopation-services>/.test(inspector.shadowRoot.querySelector('.empty').textContent), { timeoutMs: 3000 });
  page.remove();
});

test('history lists, exports, and genuinely deletes stored conversations', async () => {
  const page = mount(`
    <machvive-chat-syncopation-services persist>
      <machvive-chat-syncopation-history></machvive-chat-syncopation-history>
    </machvive-chat-syncopation-services>
  `);
  const services = page.query('machvive-chat-syncopation-services');
  const history = page.query('machvive-chat-syncopation-history');
  await whenServices(history);

  await services.cache.put({ id: 'kept', records: [{ id: 'm', role: 'user', text: 'first question' }] });
  await history.refresh();
  assert.equal(history.shadowRoot.querySelectorAll('li').length, 1);
  assert.match(history.shadowRoot.querySelector('.title').textContent, /first question/);

  let exported = null;
  history.addEventListener('history-export', (e) => { exported = e.detail.json; });
  await history.export('kept');
  assert.match(exported, /first question/, 'the user gets their own data, verbatim');

  await history.forgetAll();
  assert.deepEqual(await services.cache.list(), [], 'delete must reach storage, not just the list');
  assert.equal(history.shadowRoot.querySelectorAll('li').length, 0);
  page.remove();
});

test('history says persistence is off rather than looking broken', async () => {
  const page = mount(`
    <machvive-chat-syncopation-services>
      <machvive-chat-syncopation-history></machvive-chat-syncopation-history>
    </machvive-chat-syncopation-services>
  `);
  const services = page.query('machvive-chat-syncopation-services');
  const history = page.query('machvive-chat-syncopation-history');
  await whenServices(history);
  await services.cache.clear();
  await history.refresh();
  assert.match(history.shadowRoot.querySelector('.note').textContent, /Persistence is off/);
  page.remove();
});

test('persist writes the conversation through to the cache', async () => {
  const page = mount('<machvive-chat-syncopation-services persist transport="echo"></machvive-chat-syncopation-services>');
  const services = page.query('machvive-chat-syncopation-services');
  await services.cache.clear();

  services.conversation.add({ role: 'user', text: 'remember me' });
  const stored = await until(async () => (await services.cache.get(services.conversation.id)) ?? false);
  assert.match(JSON.stringify(stored), /remember me/);
  page.remove();
});

test('nothing is stored when persistence is off', async () => {
  const page = mount('<machvive-chat-syncopation-services transport="echo"></machvive-chat-syncopation-services>');
  const services = page.query('machvive-chat-syncopation-services');
  await services.cache.clear();

  services.conversation.add({ role: 'user', text: 'do not keep this' });
  await tick(50);
  // The inverse of the test above. A default-on cache would quietly retain
  // everything anyone typed, which is the opposite of the stated promise.
  assert.deepEqual(await services.cache.list(), []);
  page.remove();
});

test('voice disables what the user agent cannot do and says why', async () => {
  const page = mount(`
    <machvive-chat-syncopation-services>
      <machvive-chat-syncopation-voice></machvive-chat-syncopation-voice>
    </machvive-chat-syncopation-services>
  `);
  const voice = page.query('machvive-chat-syncopation-voice');
  await whenServices(voice);

  // jsdom implements neither Speech API, which is the same position a real
  // browser without them is in.
  assert.equal(voice.shadowRoot.querySelector('.mic').disabled, true);
  assert.equal(voice.shadowRoot.querySelector('.speak').disabled, true);
  assert.match(voice.shadowRoot.querySelector('.note').textContent, /unavailable in this browser/);
  page.remove();
});

test('components unsubscribe on disconnect', async () => {
  const page = mount(`
    <machvive-chat-syncopation-services>
      <machvive-chat-syncopation-canvas></machvive-chat-syncopation-canvas>
      <machvive-chat-syncopation-inspector></machvive-chat-syncopation-inspector>
    </machvive-chat-syncopation-services>
  `);
  const services = page.query('machvive-chat-syncopation-services');
  const canvas = page.query('machvive-chat-syncopation-canvas');
  await whenServices(canvas);
  services.conversation.add({ text: 'x' });
  await until(() => canvas.shadowRoot.querySelector('li'));

  canvas.remove();
  page.query('machvive-chat-syncopation-inspector').remove();
  const before = canvas.shadowRoot.querySelectorAll('li').length;
  services.conversation.add({ text: 'after removal' });
  await tick(20);
  // A detached component that keeps rendering is a leak that also keeps the
  // whole conversation alive in memory.
  assert.equal(canvas.shadowRoot.querySelectorAll('li').length, before);
  page.remove();
});
