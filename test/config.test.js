/**
 * The configuration contract every component shares, design state, and bus
 * recording. These pin the agreement that one schema drives attributes, the
 * `config` object, and the design UI — and that recordings survive JSON.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { mount, tick, until } from './helpers.js';
import {
  resolveComponentConfig,
  attrToKey,
  keyToAttr,
  renderConfigForm,
  Recorder,
  PubSub,
  Conversation,
  Daemon,
  resolveConfig
} from '../src/wc/machvive-chat-syncopation-services/machvive-chat-syncopation-services.js';
import '../src/wc/machvive-chat-syncopation-prompt/machvive-chat-syncopation-prompt.js';
import '../src/wc/machvive-chat-syncopation-nudge/machvive-chat-syncopation-nudge.js';
import '../src/wc/machvive-chat-syncopation-inspector/machvive-chat-syncopation-inspector.js';
import '../src/wc/machvive-chat-syncopation-cli/machvive-chat-syncopation-cli.js';
import '../src/wc/machvive-chat-syncopation-history/machvive-chat-syncopation-history.js';
import '../src/wc/machvive-chat-syncopation-voice/machvive-chat-syncopation-voice.js';
import '../src/wc/machvive-chat-syncopation-services/machvive-chat-syncopation-services.js';
import '../src/wc/machvive-chat-syncopation/machvive-chat-syncopation.js';
import '../src/wc/machvive-chat-syncopation-canvas/machvive-chat-syncopation-canvas.js';

test('key/attr name mapping round-trips', () => {
  assert.equal(attrToKey('max-turns'), 'maxTurns');
  assert.equal(keyToAttr('maxTurns'), 'max-turns');
  assert.equal(keyToAttr('placeholder'), 'placeholder');
});

test('every element in the collection declares a config schema', () => {
  const tags = [
    'machvive-chat-syncopation',
    'machvive-chat-syncopation-canvas',
    'machvive-chat-syncopation-cli',
    'machvive-chat-syncopation-history',
    'machvive-chat-syncopation-inspector',
    'machvive-chat-syncopation-nudge',
    'machvive-chat-syncopation-prompt',
    'machvive-chat-syncopation-services',
    'machvive-chat-syncopation-voice'
  ];
  for (const tag of tags) {
    const ctor = customElements.get(tag);
    assert.ok(ctor, `${tag} should be registered`);
    assert.equal(typeof ctor.configSchema, 'object', `${tag} should declare a static configSchema`);
    assert.ok(ctor.observedAttributes.includes('state'), `${tag} should observe state`);
    for (const key of Object.keys(ctor.configSchema)) {
      assert.ok(ctor.observedAttributes.includes(keyToAttr(key)), `${tag} should observe ${keyToAttr(key)}`);
    }
  }
});

test('config resolution: defaults < attributes < object overrides', async () => {
  const { host, query, remove } = mount('<machvive-chat-syncopation-prompt placeholder="Ask me"></machvive-chat-syncopation-prompt>');
  const prompt = query('machvive-chat-syncopation-prompt');
  assert.equal(prompt.config.placeholder, 'Ask me', 'attribute beats default');
  assert.equal(prompt.config.label, 'Message', 'schema default applies');

  prompt.config = { placeholder: 'Type here' };
  assert.equal(prompt.config.placeholder, 'Type here', 'object override wins');
  assert.equal(prompt.getAttribute('placeholder'), 'Type here', 'override is reflected to the attribute');
  remove();
});

test('boolean and number coercion match HTML semantics', async () => {
  const { query, remove } = mount('<machvive-chat-syncopation-services persist max-turns="50"></machvive-chat-syncopation-services>');
  await tick(20);
  const services = query('machvive-chat-syncopation-services');
  assert.equal(services.config.persist, true, 'bare boolean attribute is true');
  assert.equal(services.config.maxTurns, 50, 'number attribute coerces');

  services.config = { persist: false, maxTurns: 10 };
  assert.equal(services.config.persist, false);
  assert.equal(services.hasAttribute('persist'), false, 'false boolean removes the attribute');
  assert.equal(services.config.maxTurns, 10);
  remove();
});

test('object overrides reach resolution even with no attribute set', () => {
  // resolveComponentConfig is the seam a mutation could gut without any
  // attribute-driven test noticing — pin it directly.
  const el = document.createElement('machvive-chat-syncopation-prompt');
  const resolved = resolveComponentConfig(el, { placeholder: 'from-object' });
  assert.equal(resolved.placeholder, 'from-object', 'object override applies without any attribute');
  assert.equal(resolved.label, 'Message', 'other keys still default');
  const ignored = resolveComponentConfig(el, { notAKey: 'x' });
  assert.equal('notAKey' in ignored, false, 'unknown keys are dropped, not carried');
});

test('services config object updates the live daemon transport', async () => {
  const { query, remove } = mount('<machvive-chat-syncopation-services></machvive-chat-syncopation-services>');
  await tick(20);
  const services = query('machvive-chat-syncopation-services');
  assert.equal(services.config.transport, 'echo');
  services.config = { transport: 'remote', endpoint: 'https://example.invalid' };
  assert.equal(services.daemon ? services.config.transport : null, 'remote');
  assert.equal(services.config.endpoint, 'https://example.invalid');
  remove();
});

test('design state renders a form driven by the schema, and edits apply live', async () => {
  const { query, remove } = mount('<machvive-chat-syncopation-prompt state="design"></machvive-chat-syncopation-prompt>');
  await tick(20);
  const prompt = query('machvive-chat-syncopation-prompt');
  const form = prompt.shadowRoot.querySelector('.design-form');
  assert.ok(form, 'design state should render the config form');
  const field = form.querySelector('[data-config-key="placeholder"]');
  assert.ok(field, 'schema keys become form fields');
  assert.equal(field.value, 'Message…');

  field.value = 'Design-time placeholder';
  field.dispatchEvent(new Event('change'));
  assert.equal(prompt.config.placeholder, 'Design-time placeholder');
  assert.equal(prompt.getAttribute('placeholder'), 'Design-time placeholder');
  await tick(20);
  assert.equal(prompt.shadowRoot.querySelector('textarea').placeholder, 'Design-time placeholder',
    'the runtime UI follows the design edit');
  remove();
});

test('leaving design state removes the form', async () => {
  const { query, remove } = mount('<machvive-chat-syncopation-prompt state="design"></machvive-chat-syncopation-prompt>');
  await tick(20);
  const prompt = query('machvive-chat-syncopation-prompt');
  assert.ok(prompt.shadowRoot.querySelector('.design-form'));
  prompt.removeAttribute('state');
  await tick(20);
  assert.equal(prompt.shadowRoot.querySelector('.design-form'), null);
  assert.ok(prompt.shadowRoot.querySelector('textarea'), 'runtime UI is intact');
  remove();
});

test('services design state exposes its own schema form', async () => {
  const { query, remove } = mount('<machvive-chat-syncopation-services state="design"></machvive-chat-syncopation-services>');
  await tick(20);
  const services = query('machvive-chat-syncopation-services');
  const transport = services.shadowRoot.querySelector('[data-config-key="transport"]');
  assert.ok(transport, 'services exposes transport in design state');
  transport.value = 'remote';
  transport.dispatchEvent(new Event('change'));
  assert.equal(services.config.transport, 'remote');
  remove();
});

test('daemon:error payload is JSON-serializable plain data', async () => {
  const bus = new PubSub();
  const conversation = new Conversation({ bus });
  const config = resolveConfig(null, { transport: 'echo' });
  const daemon = new Daemon({ bus, conversation, config });
  let errored = null;
  bus.on('daemon:error', (e) => { errored = e; });

  config.transport = 'nonexistent-but-falls-back';
  conversation.append = () => { throw new TypeError('render blew up'); };
  await daemon.send('x');

  assert.ok(errored);
  assert.equal(typeof errored.error, 'string', 'error is a string, not the live Error');
  assert.equal(errored.name, 'TypeError');
  assert.doesNotThrow(() => JSON.stringify(errored), 'payload survives JSON');
  assert.match(errored.error, /render blew up/);
});

test('recorder captures every topic with serializable payloads', async () => {
  const bus = new PubSub();
  const conversation = new Conversation({ bus });
  const config = resolveConfig(null, { transport: 'echo' });
  const daemon = new Daemon({ bus, conversation, config });
  const recorder = new Recorder(bus).start();

  await daemon.send('hello recorder');
  recorder.stop();

  assert.ok(recorder.length > 0, 'events were captured');
  const topics = recorder.entries.map((e) => e.topic);
  assert.ok(topics.includes('record:added'));
  assert.ok(topics.includes('daemon:idle'));
  assert.equal(typeof recorder.entries[0].at, 'string');
  assert.equal(typeof recorder.entries[0].seq, 'number');
  assert.doesNotThrow(() => JSON.stringify(recorder.toJSON()), 'the whole recording serializes');
});

test('recording snapshots payloads — later mutation does not rewrite history', async () => {
  const bus = new PubSub();
  const conversation = new Conversation({ bus });
  const recorder = new Recorder(bus).start();
  const record = conversation.add({ role: 'user', text: 'before' });
  conversation.update(record.id, { text: 'after' });
  recorder.stop();

  const added = recorder.entries.find((e) => e.topic === 'record:added');
  assert.equal(added.payload.text, 'before', 'captured the value at emit time, not the mutated record');
});

test('recording round-trips through export and import', async () => {
  const bus = new PubSub();
  const conversation = new Conversation({ bus });
  const recorder = new Recorder(bus).start();
  conversation.add({ role: 'user', text: 'round trip' });
  recorder.stop();

  const json = recorder.export();
  const loaded = new Recorder(bus).import(json);
  assert.equal(loaded.length, recorder.length);
  assert.deepEqual(loaded.entries.map((e) => e.topic), recorder.entries.map((e) => e.topic));
});

test('import rejects anything that is not a recording', () => {
  const recorder = new Recorder(new PubSub());
  assert.throws(() => recorder.import('{"nope": true}'), TypeError);
  assert.throws(() => recorder.import('{"format":"mcs-recording@1"}'), TypeError);
});

test('replay re-emits onto the bus so components re-react', async () => {
  const source = new PubSub();
  const sourceConversation = new Conversation({ bus: source });
  const recorder = new Recorder(source).start();
  sourceConversation.add({ role: 'user', text: 'replayed message' });
  recorder.stop();

  const { query, remove } = mount(`
    <machvive-chat-syncopation-services>
      <machvive-chat-syncopation-canvas></machvive-chat-syncopation-canvas>
    </machvive-chat-syncopation-services>
  `);
  const services = query('machvive-chat-syncopation-services');
  await until(() => services.conversation && query('machvive-chat-syncopation-canvas').shadowRoot.querySelector('ol'));

  const target = new Recorder(services.bus); // swap the recording onto the live bus
  target.import(recorder.export());
  await target.replay();

  const canvas = query('machvive-chat-syncopation-canvas');
  await until(() => canvas.shadowRoot.querySelector('li .bubble')?.textContent.includes('replayed message'));
  remove();
});

test('replay into a recording recorder does not double-capture', async () => {
  const bus = new PubSub();
  const conversation = new Conversation({ bus });
  const recorder = new Recorder(bus).start();
  conversation.add({ role: 'user', text: 'x' });
  const before = recorder.length;
  await recorder.replay(); // replay() pauses capture while re-emitting
  assert.equal(recorder.length, before, 'replayed events were not re-captured');
  recorder.stop();
});

test('a cleared canvas re-renders a replayed record with the same id', async () => {
  // Replay re-emits records with their original ids; a clear detaches the node
  // but the id stays in the canvas map, so upsert must re-mount detached nodes.
  const { query, remove } = mount(`
    <machvive-chat-syncopation-services>
      <machvive-chat-syncopation-canvas></machvive-chat-syncopation-canvas>
    </machvive-chat-syncopation-services>
  `);
  const services = query('machvive-chat-syncopation-services');
  const canvas = query('machvive-chat-syncopation-canvas');
  await until(() => services.conversation && canvas.shadowRoot.querySelector('ol'));

  const recorder = new Recorder(services.bus).start();
  services.conversation.add({ role: 'user', text: 'replay me' });
  recorder.stop();
  await until(() => canvas.shadowRoot.querySelectorAll('li').length === 1);

  services.conversation.clear();
  await until(() => canvas.shadowRoot.querySelectorAll('li').length === 0);

  await recorder.replay();
  await until(() => canvas.shadowRoot.querySelectorAll('li').length === 1,
    { timeoutMs: 1000 });
  assert.match(canvas.shadowRoot.querySelector('.bubble').textContent, /replay me/);
  remove();
});

test('renderConfigForm builds controls for every schema type', () => {
  const host = document.createElement('div');
  renderConfigForm(host, {
    s: { type: 'string', default: 'x', label: 'S' },
    n: { type: 'number', default: 1, label: 'N' },
    b: { type: 'boolean', default: true, label: 'B' },
    o: { type: 'string', default: 'a', label: 'O', options: ['a', 'b'] }
  }, { s: 'x', n: 1, b: true, o: 'a' }, () => {});
  assert.ok(host.querySelector('input[type="text"]'));
  assert.ok(host.querySelector('input[type="number"]'));
  assert.ok(host.querySelector('input[type="checkbox"]'));
  assert.ok(host.querySelector('select'));
  assert.equal(host.querySelectorAll('.design-row').length, 4);
});
