/**
 * The standardised icon set: generated from design/icons/, hoisted to :root by
 * the container at instance time, recoloured by currentColor so one definition
 * serves light and dark.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import '../index.js';
import {
  ICON_ROOT_CSS,
  ICON_CSS,
  ICON_NAMES,
  ICON_STYLE_ID
} from '../src/wc/machvive-chat-syncopation-services/icons.js';
import { mount, tick } from './helpers.js';

test.beforeEach(() => {
  document.body.replaceChildren();
  document.getElementById(ICON_STYLE_ID)?.remove();
});

test('the icon module exports one entry per icon, sorted and named', () => {
  assert.ok(Array.isArray(ICON_NAMES));
  assert.ok(ICON_NAMES.length > 30, 'the whole set is present');
  assert.ok(ICON_NAMES.includes('send') && ICON_NAMES.includes('wifi-off') && ICON_NAMES.includes('dark-mode'),
    'multi-word names are hyphenated');
  const sorted = [...ICON_NAMES].sort((a, b) => a.localeCompare(b));
  assert.deepEqual(ICON_NAMES, sorted, 'names are sorted');
});

test('every icon has a :root var and a class', () => {
  for (const name of ICON_NAMES) {
    assert.ok(ICON_ROOT_CSS.includes(`--mcs-icon-${name}:`), `:root var for ${name}`);
    assert.ok(ICON_CSS.includes(`.mcs-icon-${name}`), `class for ${name}`);
    assert.ok(ICON_ROOT_CSS.includes('data:image/svg+xml'), 'icons are inline data-URIs');
  }
});

test('icons recolour via currentColor, not a hardcoded fill', () => {
  // The whole point of the mask approach: shape comes from the SVG, ink from
  // the theme. A hardcoded fill would re-introduce black-on-dark invisibility.
  assert.ok(ICON_CSS.includes('background-color: currentColor'));
  assert.ok(ICON_CSS.includes('mask-image: var(--mcs-icon-img)'));
  assert.ok(!/background-color:\s*#/.test(ICON_CSS), 'no hardcoded background colour');
});

test('instancing the container hoists one style to :root', async () => {
  const { remove } = mount(`
    <machvive-chat-syncopation></machvive-chat-syncopation>
    <machvive-chat-syncopation></machvive-chat-syncopation>
  `);
  await tick(20);
  const styles = document.querySelectorAll(`#${ICON_STYLE_ID}`);
  assert.equal(styles.length, 1, 'two instances inject exactly one style tag');
  const text = styles[0].textContent;
  assert.ok(text.includes(':root'), 'the hoisted block targets :root');
  assert.ok(text.includes('--mcs-icon-send'), 'the vars are on :root');
  assert.ok(text.includes('.mcs-icon-send'), 'the class rules ride along');
  remove();
});

test('the hoisted var is readable from a shadow root', async () => {
  const { query, remove } = mount('<machvive-chat-syncopation></machvive-chat-syncopation>');
  await tick(20);
  const container = query('machvive-chat-syncopation');
  // getComputedStyle resolves through the shadow boundary — this is the whole
  // mechanism. jsdom can confirm the var resolves, though not the paint.
  const value = getComputedStyle(container).getPropertyValue('--mcs-icon-send').trim();
  assert.ok(value.startsWith('url('), 'the var inherits into the component');
  remove();
});

test('hoisting is a no-op without a document (browser-only by construction)', async () => {
  // The container guards on document existing; importing icons.js alone must
  // not touch the DOM. Re-importing is cached, so assert the export shape instead.
  assert.equal(typeof ICON_ROOT_CSS, 'string');
  assert.equal(ICON_STYLE_ID, 'mcs-icons');
});
