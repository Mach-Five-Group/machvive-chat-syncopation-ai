/**
 * Motifs — named light/dark token bundles, registered like transports and
 * selected with the theme attribute. These pin the registry, the token
 * discipline, and the cascade that lets an explicit motif win over the OS.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import '../index.js';
import {
  MOTIFS,
  MOTIF_NAMES,
  MOTIF_TOKENS,
  buildMotifScopeCSS
} from '../src/wc/machvive-chat-syncopation-services/motifs.js';
import { registerMotif, motifNames, motifCSSOutput } from '../src/wc/machvive-chat-syncopation-services/theme.js';
import { mount, tick } from './helpers.js';

test.beforeEach(() => document.body.replaceChildren());

test('the built-in motifs register at import', () => {
  assert.ok(MOTIF_NAMES.includes('corp'));
  assert.ok(MOTIF_NAMES.includes('artdeco'));
  assert.ok(motifNames().includes('corp'), 'the registry picked them up');
});

test('every motif sets both a light and a dark token set', () => {
  for (const [name, bundle] of Object.entries(MOTIFS)) {
    assert.ok(bundle.light, `${name} needs a light set`);
    assert.ok(bundle.dark, `${name} needs a dark set`);
    // And the sets cover the same keys, so neither mode inherits a stale token.
    assert.deepEqual(Object.keys(bundle.light).sort(), Object.keys(bundle.dark).sort(),
      `${name} light and dark set the same tokens`);
  }
});

test('motifs only set tokens the theme defines', () => {
  for (const [name, bundle] of Object.entries(MOTIFS)) {
    for (const key of [...Object.keys(bundle.light), ...Object.keys(bundle.dark)]) {
      assert.ok(MOTIF_TOKENS.includes(key), `${name} sets unknown token "${key}" — a motif may not invent tokens`);
    }
  }
});

test('a motif emits scope rules whose dark set follows the scheme', () => {
  const css = buildMotifScopeCSS('corp', MOTIFS.corp);
  assert.ok(css.includes('[data-mcs-motif="corp"]'), 'the motif scope rule exists');
  assert.ok(css.includes('[data-mcs-theme="dark"] [data-mcs-motif="corp"]') || css.includes('[data-mcs-motif="corp"][data-mcs-theme="dark"]'),
    'the dark set applies under a dark scheme');
  assert.ok(css.includes('prefers-color-scheme: dark'), 'the dark set also follows the OS');
});

test('registerMotif adds a custom motif selectable at runtime', () => {
  registerMotif('testmotif', {
    light: { accent: '#123456' },
    dark: { accent: '#abcdef' }
  });
  assert.ok(motifNames().includes('testmotif'));
  const out = motifCSSOutput();
  assert.ok(out.includes('[data-mcs-motif="testmotif"]'), 'the accumulated CSS includes the new motif scope');
  assert.ok(out.includes('--mcs-accent: #123456'), 'its light tokens are emitted');
});

test('registerTheme on the services element registers and announces', async () => {
  const { query, remove } = mount('<machvive-chat-syncopation-services data-chat-state="enabled"></machvive-chat-syncopation-services>');
  await tick(20);
  const services = query('machvive-chat-syncopation-services');
  const seen = [];
  services.bus.on('theme:registered', (e) => seen.push(e.name));
  services.registerTheme('pagebrand', { light: { accent: '#0a0a0a' }, dark: { accent: '#f5f5f5' } });
  assert.deepEqual(seen, ['pagebrand']);
  assert.ok(services.themes.includes('pagebrand'));
  remove();
});

test('a motif scope sets the motif tokens for its subtree', async () => {
  const { query, remove } = mount('<machvive-chat-syncopation data-mcs-motif="artdeco"></machvive-chat-syncopation>');
  await tick(20);
  const container = query('machvive-chat-syncopation');
  // The hoisted theme style carries the motif scope rule; the component inherits it.
  const hoisted = document.getElementById('mcs-theme');
  assert.ok(hoisted, 'the theme is hoisted to document head');
  assert.ok(hoisted.textContent.includes('[data-mcs-motif="artdeco"]'), 'the artdeco scope rule is hoisted');
  remove();
});
