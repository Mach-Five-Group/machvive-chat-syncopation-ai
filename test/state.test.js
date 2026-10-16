/**
 * The surface state — data-chat-state, owned by services, inherited by every
 * component it governs. enabled | disabled | loading | design, never blank.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import '../index.js';
import {
  CHAT_STATES,
  CHAT_STATE_ATTR,
  readChatState
} from '../src/wc/machvive-chat-syncopation-services/machvive-chat-syncopation-services.js';
import { mount, tick, until } from './helpers.js';

test.beforeEach(() => document.body.replaceChildren());

test('the four states are explicit and frozen', () => {
  assert.deepEqual([...CHAT_STATES], ['enabled', 'disabled', 'loading', 'design']);
  assert.ok(Object.isFrozen(CHAT_STATES));
});

test('a missing or blank state warns and defaults to enabled', async () => {
  const warnings = [];
  const original = console.warn;
  console.warn = (m) => warnings.push(m);
  try {
    const { query, remove } = mount('<machvive-chat-syncopation-services></machvive-chat-syncopation-services>');
    await tick(20);
    const services = query('machvive-chat-syncopation-services');
    assert.equal(services.state, 'enabled');
    assert.ok(warnings.some((w) => w.includes(CHAT_STATE_ATTR)), 'warns when the state is not set');
    remove();
  } finally {
    console.warn = original;
  }
});

test('an unrecognized state value warns and falls back to enabled', async () => {
  const warnings = [];
  const original = console.warn;
  console.warn = (m) => warnings.push(m);
  try {
    const { query, remove } = mount('<machvive-chat-syncopation-services data-chat-state="bogus"></machvive-chat-syncopation-services>');
    await tick(20);
    const services = query('machvive-chat-syncopation-services');
    assert.equal(services.state, 'enabled');
    assert.ok(warnings.some((w) => w.includes('bogus')), 'warns on the unrecognized value');
    remove();
  } finally {
    console.warn = original;
  }
});

test('state values are case-insensitive (data-* lowercases, but be safe)', () => {
  assert.equal(readChatState({ getAttribute: () => 'DESIGN' }, { warn: false }), 'design');
  assert.equal(readChatState({ getAttribute: () => 'Loading' }, { warn: false }), 'loading');
});

test('services.state setter reflects to the attribute and announces the change', async () => {
  const { query, remove } = mount('<machvive-chat-syncopation-services></machvive-chat-syncopation-services>');
  await tick(20);
  const services = query('machvive-chat-syncopation-services');
  const seen = [];
  services.bus.on('state:changed', (e) => seen.push(e));
  let domEvent = null;
  services.addEventListener('chat-state-changed', (e) => { domEvent = e.detail; });

  services.state = 'design';
  await tick(20);
  assert.equal(services.getAttribute(CHAT_STATE_ATTR), 'design');
  assert.deepEqual(seen.at(-1), { from: 'enabled', to: 'design' }, 'bus announces from/to');
  assert.deepEqual(domEvent, { from: 'enabled', to: 'design' }, 'a composed DOM event fires too');
  remove();
});

test('the container mirrors data-chat-state onto the services it creates', async () => {
  const { query, remove } = mount('<machvive-chat-syncopation data-chat-state="disabled"></machvive-chat-syncopation>');
  await tick(20);
  const container = query('machvive-chat-syncopation');
  const services = container.querySelector('machvive-chat-syncopation-services');
  assert.ok(services, 'the container created its services');
  assert.equal(services.getAttribute(CHAT_STATE_ATTR), 'disabled', 'state mirrored at creation');

  // And a later change on the container reaches the same services element.
  container.setAttribute(CHAT_STATE_ATTR, 'design');
  await tick(20);
  assert.equal(services.getAttribute(CHAT_STATE_ATTR), 'design');
  remove();
});

test('disabled state makes the composer inert and dims it', async () => {
  const { query, remove } = mount(`
    <machvive-chat-syncopation-services data-chat-state="disabled">
      <machvive-chat-syncopation-prompt></machvive-chat-syncopation-prompt>
    </machvive-chat-syncopation-services>
  `);
  await tick(30);
  const prompt = query('machvive-chat-syncopation-prompt');
  const form = prompt.shadowRoot.querySelector('form.composer');
  assert.equal(form.dataset.state, 'disabled');
  assert.ok(prompt.shadowRoot.querySelector('textarea').disabled, 'textarea disabled');
  assert.ok(prompt.shadowRoot.querySelector('button').disabled, 'button disabled');
  remove();
});

test('loading state keeps the composer editable and shows a progress bar', async () => {
  const { query, remove } = mount(`
    <machvive-chat-syncopation-services data-chat-state="loading">
      <machvive-chat-syncopation-prompt></machvive-chat-syncopation-prompt>
    </machvive-chat-syncopation-services>
  `);
  await tick(30);
  const prompt = query('machvive-chat-syncopation-prompt');
  assert.ok(prompt.shadowRoot.querySelector('.loading-bar'), 'a progress bar renders');
  assert.ok(!prompt.shadowRoot.querySelector('textarea').disabled, 'the prompt stays editable in loading');
  remove();
});

test('a state transition re-renders a governed component', async () => {
  const { query, remove } = mount(`
    <machvive-chat-syncopation-services data-chat-state="enabled">
      <machvive-chat-syncopation-prompt></machvive-chat-syncopation-prompt>
    </machvive-chat-syncopation-services>
  `);
  await tick(30);
  const services = query('machvive-chat-syncopation-services');
  const prompt = query('machvive-chat-syncopation-prompt');
  assert.equal(prompt.shadowRoot.querySelector('form.composer').dataset.state, 'enabled');
  services.state = 'disabled';
  await until(() => prompt.shadowRoot.querySelector('form.composer').dataset.state === 'disabled');
  remove();
});
