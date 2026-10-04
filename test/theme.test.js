import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { THEME_CSS, CONTROL_CSS } from '../src/wc/machvive-chat-syncopation-services/theme.js';

const WC = new URL('../src/wc/', import.meta.url).pathname;

/** Every component module, by tag directory. */
const COMPONENTS = readdirSync(WC)
  .filter((dir) => dir.startsWith('machvive-chat-syncopation'))
  // The services element is headless — its only rule is `display: none`, so it
  // has no palette to get wrong.
  .filter((dir) => dir !== 'machvive-chat-syncopation-services')
  .map((dir) => ({ dir, source: readFileSync(join(WC, dir, `${dir}.js`), 'utf8') }));

test('every component is accounted for', () => {
  // Eight visible surfaces; the services element renders nothing.
  assert.equal(COMPONENTS.length, 8, `found ${COMPONENTS.map((c) => c.dir).join(', ')}`);
});

test('the dark media query is guarded against an explicit light choice', () => {
  const media = THEME_CSS.indexOf('@media (prefers-color-scheme: dark)');
  assert.ok(media > 0);
  const guard = THEME_CSS.indexOf(':host(:not([theme="light"]))');
  assert.ok(guard > media, 'the guard belongs inside the media block');
});

test('an explicit dark theme is declared after the media query so it wins in a light OS', () => {
  const mediaEnd = THEME_CSS.indexOf('}\n  :host([theme="dark"])');
  const explicitDark = THEME_CSS.indexOf(':host([theme="dark"])');
  const media = THEME_CSS.indexOf('@media (prefers-color-scheme: dark)');
  assert.ok(explicitDark > media, 'cascade order is load-bearing: later wins at equal specificity');
  assert.ok(mediaEnd > 0, 'the explicit dark block should follow the closing brace of the media query');
});

test('color-scheme is declared', () => {
  // Without it the browser paints light scrollbars, select popups and
  // checkboxes onto a dark panel.
  assert.match(THEME_CSS, /color-scheme:\s*light dark/);
});

test('light and dark define the same token set', () => {
  const tokens = (block) => new Set([...block.matchAll(/--mcs-[a-z-]+/g)].map((m) => m[0]));
  const blocks = THEME_CSS.split('@media (prefers-color-scheme: dark)');
  const light = tokens(blocks[0]);
  const dark = tokens(blocks[1]);
  // A token defined only in light inherits the light value under dark, which is
  // how a surface ends up light-on-light.
  const missing = [...light].filter((t) => !dark.has(t) && !['--mcs-radius', '--mcs-font', '--mcs-mono'].includes(t));
  assert.deepEqual(missing, [], 'every colour token needs a dark value');
});

test('controls set their own colour', () => {
  // Form controls do not inherit `color` from :host, so the UA supplies a
  // per-theme default — which is how every button became white-on-white.
  assert.match(CONTROL_CSS, /button[^{]*\{[^}]*color:/s);
  assert.match(CONTROL_CSS, /background:/);
});

test('no component hardcodes a colour outside the token blocks', () => {
  for (const { dir, source } of COMPONENTS) {
    // Strip the interpolated theme, then anything left is the component's own.
    const own = source.replace('${THEME_CSS}', '').replace('${CONTROL_CSS}', '');
    const literals = own.match(/#[0-9a-fA-F]{3,8}\b/g) ?? [];
    assert.deepEqual(literals, [], `${dir} hardcodes ${literals.join(', ')} instead of using a token`);
    const named = own.match(/(?:color|background)\s*:\s*(white|black|red|blue|green|grey|gray)\b/g) ?? [];
    assert.deepEqual(named, [], `${dir} uses a named colour: ${named.join(', ')}`);
  }
});

test('a component that themes its text also paints its surface', () => {
  for (const { dir, source } of COMPONENTS) {
    const host = source.match(/:host\s*\{([^}]*)\}/s);
    assert.ok(host, `${dir} should style :host`);
    const block = host[1];
    if (!/color:/.test(block)) continue;
    // Analytics in the sibling package once set a light colour with no
    // background and rendered at 1.21:1 inside a light page.
    assert.match(block, /background:/, `${dir} sets a themed colour without painting a background`);
  }
});

test('every component interpolates the shared theme rather than copying tokens', () => {
  for (const { dir, source } of COMPONENTS) {
    assert.ok(source.includes('${THEME_CSS}'), `${dir} should interpolate THEME_CSS`);
    assert.ok(
      !/--mcs-[a-z-]+\s*:/.test(source.replace('${THEME_CSS}', '')),
      `${dir} redefines a token; theme.js holds the only copy`
    );
  }
});

test('reduced motion is respected wherever something animates', () => {
  for (const { dir, source } of COMPONENTS) {
    if (!/animation:|transition:/.test(source.replace('${THEME_CSS}', ''))) continue;
    assert.match(
      source,
      /prefers-reduced-motion/,
      `${dir} animates without honouring prefers-reduced-motion`
    );
  }
});

test('focus is visible in both themes', () => {
  for (const { dir, source } of COMPONENTS) {
    if (!/<button|<input|<textarea|<select/.test(source)) continue;
    assert.match(source, /:focus-visible/, `${dir} has controls but no visible focus style`);
  }
});
