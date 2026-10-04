import test from 'node:test';
import assert from 'node:assert/strict';
import { PubSub } from '../src/wc/machvive-chat-syncopation-services/pubsub.js';
import { Conversation } from '../src/wc/machvive-chat-syncopation-services/conversation.js';
import { Daemon } from '../src/wc/machvive-chat-syncopation-services/daemon.js';
import { Cache } from '../src/wc/machvive-chat-syncopation-services/cache.js';
import { createRecord, ROLES, isPending } from '../src/wc/machvive-chat-syncopation-services/record.js';
import { META, annotate, readMeta, userMeta } from '../src/wc/machvive-chat-syncopation-services/metadata.js';
import { resolveConfig, DEFAULTS } from '../src/wc/machvive-chat-syncopation-services/config.js';
import { until } from './helpers.js';

test('pubsub delivers, unsubscribes, and survives a throwing subscriber', () => {
  const bus = new PubSub();
  const seen = [];
  const off = bus.on('x', (p) => seen.push(p));
  bus.on('x', () => { throw new Error('subscriber exploded'); });
  const after = [];
  bus.on('x', (p) => after.push(p));

  bus.emit('x', 1);
  // The throwing listener sits between two healthy ones; both must still fire,
  // or one bad render silences the rest of the surface.
  assert.deepEqual(seen, [1]);
  assert.deepEqual(after, [1]);

  off();
  bus.emit('x', 2);
  assert.deepEqual(seen, [1]);
  assert.deepEqual(after, [1, 2]);
});

test('pubsub wildcard reports topic and payload', () => {
  const bus = new PubSub();
  const all = [];
  bus.on('*', (e) => all.push(e));
  bus.emit('a', { n: 1 });
  assert.deepEqual(all, [{ topic: 'a', payload: { n: 1 } }]);
});

test('pubsub is not an EventTarget', () => {
  // Deliberate: EventTarget binds the bus to the realm that supplied the
  // global, and an event built in another realm throws on dispatch.
  assert.equal(new PubSub() instanceof EventTarget, false);
});

test('once fires a single time', () => {
  const bus = new PubSub();
  let count = 0;
  bus.once('x', () => count++);
  bus.emit('x');
  bus.emit('x');
  assert.equal(count, 1);
});

test('createRecord rejects an unknown role', () => {
  assert.throws(() => createRecord({ role: 'wizard' }), TypeError);
  for (const role of ROLES) assert.equal(createRecord({ role }).role, role);
});

test('record ids are unique within a tick', () => {
  const ids = new Set(Array.from({ length: 50 }, () => createRecord({}).id));
  assert.equal(ids.size, 50);
});

test('isPending reads status, not text', () => {
  assert.equal(isPending(createRecord({ status: 'pending' })), true);
  assert.equal(isPending(createRecord({ text: '' })), false);
  assert.equal(isPending(null), false);
});

test('conversation announces every mutation on the bus', () => {
  const bus = new PubSub();
  const topics = [];
  bus.on('*', ({ topic }) => topics.push(topic));
  const conversation = new Conversation({ bus });

  const record = conversation.add({ role: 'user', text: 'hi' });
  conversation.append(record.id, '!');
  conversation.update(record.id, { status: 'complete' });
  conversation.clear();

  assert.deepEqual(topics, ['record:added', 'record:appended', 'record:updated', 'conversation:cleared']);
});

test('conversation trims the oldest turns past maxTurns', () => {
  const conversation = new Conversation({ maxTurns: 3 });
  for (const text of ['a', 'b', 'c', 'd']) conversation.add({ text });
  assert.deepEqual(conversation.records.map((r) => r.text), ['b', 'c', 'd']);
  assert.equal(conversation.length, 3);
});

test('append and update on an unknown id return null rather than throwing', () => {
  const conversation = new Conversation();
  assert.equal(conversation.append('nope', 'x'), null);
  assert.equal(conversation.update('nope', {}), null);
});

test('conversation.records is a copy', () => {
  const conversation = new Conversation();
  conversation.add({ text: 'a' });
  conversation.records.push({ id: 'injected' });
  assert.equal(conversation.length, 1);
});

test('daemon produces a user turn and a streamed assistant turn', async () => {
  const bus = new PubSub();
  const conversation = new Conversation({ bus });
  const daemon = new Daemon({ bus, conversation, config: resolveConfig(null, { transport: 'echo' }) });

  const reply = await daemon.send('hello');
  assert.equal(conversation.records.length, 2);
  assert.equal(conversation.records[0].role, 'user');
  assert.equal(conversation.records[0].text, 'hello');
  assert.equal(reply.role, 'assistant');
  assert.equal(reply.status, 'complete');
  assert.match(reply.text, /^You said: hello/);
  assert.equal(readMeta(reply, META.SOURCE), 'echo');
  assert.ok(typeof readMeta(reply, META.LATENCY) === 'number');
});

test('daemon refuses a concurrent send', async () => {
  const bus = new PubSub();
  const conversation = new Conversation({ bus });
  const daemon = new Daemon({ bus, conversation, config: resolveConfig(null, { transport: 'echo' }) });

  const first = daemon.send('one');
  // Dropping the second send is the contract; interleaving two streams into one
  // transcript produces output no reader can attribute.
  assert.equal(await daemon.send('two'), null);
  await first;
  assert.deepEqual(conversation.records.map((r) => r.role), ['user', 'assistant']);
});

test('daemon.stop keeps the partial turn the user already saw', async () => {
  const bus = new PubSub();
  const conversation = new Conversation({ bus });
  const daemon = new Daemon({ bus, conversation, config: resolveConfig(null, { transport: 'echo' }) });

  const pending = daemon.send('a few words here');
  await until(() => conversation.records[1]?.text.length > 0);
  const partial = conversation.records[1].text;
  daemon.stop();
  await pending;

  const reply = conversation.records[1];
  assert.ok(reply.text.startsWith(partial));
  assert.ok(reply.text.length < 'You said: a few words here'.length);
});

test('a transport that throws produces a visible error turn', async () => {
  const bus = new PubSub();
  const conversation = new Conversation({ bus });
  const config = resolveConfig(null, { transport: 'echo' });
  const daemon = new Daemon({ bus, conversation, config });
  let errored = null;
  bus.on('daemon:error', (e) => { errored = e; });

  // Force the failure through the real path rather than stubbing the daemon.
  config.transport = 'nonexistent-but-falls-back';
  const original = conversation.append.bind(conversation);
  conversation.append = () => { throw new Error('render blew up'); };
  const reply = await daemon.send('x');
  conversation.append = original;

  assert.equal(reply.status, 'error');
  assert.match(readMeta(reply, META.ERROR), /render blew up/);
  assert.ok(errored, 'daemon:error should announce the failure');
});

test('config precedence is explicit > attribute > default', () => {
  const element = document.createElement('div');
  element.setAttribute('transport', 'local');
  element.setAttribute('max-turns', '7');
  element.setAttribute('persist', '');

  const config = resolveConfig(element, { model: 'from-code' });
  assert.equal(config.transport, 'local');
  assert.equal(config.maxTurns, 7);
  assert.equal(config.persist, true, 'a bare attribute means on');
  assert.equal(config.model, 'from-code');
  assert.equal(config.streaming, DEFAULTS.streaming);
});

test('persist defaults off', () => {
  // Storing someone's conversation is a decision a page has to make, not a
  // default it inherits.
  assert.equal(DEFAULTS.persist, false);
  assert.equal(resolveConfig(null).persist, false);
});

test('persist="false" turns it off', () => {
  const element = document.createElement('div');
  element.setAttribute('persist', 'false');
  assert.equal(resolveConfig(element).persist, false);
});

test('metadata keeps integrator keys and hides reserved ones', () => {
  const record = annotate(createRecord({ text: 'x' }), { [META.TOKENS]: 12, crmId: 'A-1' });
  assert.equal(readMeta(record, META.TOKENS), 12);
  assert.deepEqual(userMeta(record), { crmId: 'A-1' });
  assert.equal(readMeta(record, 'mcs:nothing', 'fallback'), 'fallback');
});

test('cache round-trips, lists, and really deletes', async () => {
  const cache = new Cache();
  assert.equal(cache.available, true, 'fake-indexeddb should be installed by setup.js');

  await cache.put({ id: 'c1', records: [{ id: 'm1', text: 'a' }] });
  await cache.put({ id: 'c2', records: [] });
  assert.equal((await cache.get('c1')).records.length, 1);
  assert.equal((await cache.list()).length, 2);

  await cache.remove('c1');
  assert.equal(await cache.get('c1'), null, 'remove must drop the memory copy too');

  await cache.clear();
  assert.deepEqual(await cache.list(), []);
});
