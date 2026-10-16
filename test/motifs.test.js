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
  motifCSS
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

test('a motif cascade mirrors the base theme: light, dark media, explicit dark', () => {
  const css = motifCSS('corp', MOTIFS.corp);
  const lightIdx = css.indexOf(':host([theme="corp"])');
  const mediaIdx = css.indexOf('prefers-color-scheme: dark');
  const explicitDarkIdx = css.indexOf('[theme="corp-dark"]');
  assert.ok(lightIdx > -1 && mediaIdx > lightIdx && explicitDarkIdx > mediaIdx,
    'order is load-bearing: light, then dark media, then explicit dark wins');
});

test('registerMotif adds a custom motif selectable at runtime', () => {
  registerMotif('testmotif', {
    light: { accent: '#123456' },
    dark: { accent: '#abcdef' }
  });
  assert.ok(motifNames().includes('testmotif'));
  const out = motifCSSOutput();
  assert.ok(out.includes('[theme="testmotif"]'), 'the accumulated CSS includes the new motif');
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

test('a component with a motif theme picks up the motif tokens', async () => {
  const { query, remove } = mount('<machvive-chat-syncopation theme="artdeco"></machvive-chat-syncopation>');
  await tick(20);
  const container = query('machvive-chat-syncopation');
  const css = container.shadowRoot.querySelector('style').textContent;
  assert.ok(css.includes('[theme="artdeco"]'), 'the motif rule is in the component stylesheet');
  remove();
});
