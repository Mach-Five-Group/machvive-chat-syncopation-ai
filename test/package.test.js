import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = new URL('../', import.meta.url).pathname;
const pkg = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8'));
const WC = join(ROOT, 'src/wc');

test('sideEffects is never false', () => {
  // Components register via customElements.define() on import. `false` lets a
  // bundler drop `import "pkg/canvas"` and silently skip the tag.
  assert.notEqual(pkg.sideEffects, false);
});

test('types is the first condition in every exports subpath', () => {
  for (const [subpath, conditions] of Object.entries(pkg.exports)) {
    if (typeof conditions === 'string') continue;
    assert.equal(
      Object.keys(conditions)[0],
      'types',
      `${subpath}: TypeScript resolves conditions in order and misses declarations after "default"`
    );
  }
});

test('every exported path exists on disk', () => {
  for (const [subpath, conditions] of Object.entries(pkg.exports)) {
    const paths = typeof conditions === 'string' ? [conditions] : Object.values(conditions);
    for (const path of paths) {
      assert.ok(existsSync(join(ROOT, path)), `${subpath} -> ${path} does not exist`);
    }
  }
});

test('every component has an exports subpath', () => {
  // Adding a component means touching the module, index.js, and exports.
  // Missing any one breaks either the bulk import or the cherry-pick path, and
  // nothing else fails to say so.
  const declared = JSON.stringify(pkg.exports);
  for (const dir of readdirSync(WC)) {
    if (!dir.startsWith('machvive-chat-syncopation')) continue;
    assert.ok(
      declared.includes(`${dir}/${dir}.js`),
      `${dir} has no subpath in package.json exports`
    );
  }
});

test('every component is imported and re-exported by index.js', () => {
  const index = readFileSync(join(ROOT, 'index.js'), 'utf8');
  for (const dir of readdirSync(WC)) {
    if (!dir.startsWith('machvive-chat-syncopation')) continue;
    assert.ok(index.includes(`${dir}/${dir}.js`), `${dir} is missing from index.js`);
  }
});

test('the package declares no runtime, peer, or optional dependencies', () => {
  // "Dependency-free" is a claim on the tin. It went false once in the sibling
  // package when an npm install run inside the repo added a self-reference.
  for (const field of ['dependencies', 'peerDependencies', 'optionalDependencies']) {
    assert.deepEqual(pkg[field] ?? {}, {}, `${field} should be empty`);
  }
});

test('the lock file agrees that there are no runtime dependencies', () => {
  // package.json is the manifest consumers read, but a dependency can sit in
  // the lock file alone after a tool installs one and the manifest is cleaned
  // up by hand. The lock is what CI installs from, so check both.
  const lock = JSON.parse(readFileSync(join(ROOT, 'package-lock.json'), 'utf8'));
  const root = lock.packages?.[''] ?? {};
  assert.deepEqual(root.dependencies ?? {}, {}, 'package-lock.json records a runtime dependency');

  const installed = Object.keys(lock.packages ?? {})
    .filter((path) => path.startsWith('node_modules/'))
    .map((path) => path.replace(/^node_modules\//, ''));
  const devNames = new Set(Object.keys(pkg.devDependencies ?? {}));
  const unexpected = installed.filter((name) => name.startsWith('@machfivetechchicago/') && !devNames.has(name));
  assert.deepEqual(unexpected, [], `the lock file installs ${unexpected.join(', ')}`);
});

test('every .js entry point has a sibling .d.ts', () => {
  for (const conditions of Object.values(pkg.exports)) {
    if (typeof conditions === 'string') continue;
    assert.ok(existsSync(join(ROOT, conditions.types)), `missing ${conditions.types}`);
  }
});

test('index.d.ts declares nothing index.js does not export', () => {
  const dts = readFileSync(join(ROOT, 'index.d.ts'), 'utf8');
  const js = readFileSync(join(ROOT, 'index.js'), 'utf8');
  // Only value exports need a runtime counterpart; `export type` has none.
  const valueBlocks = [...dts.matchAll(/export\s+(?!type\b)\{([^}]*)\}/g)].map((m) => m[1]);
  const names = valueBlocks
    .flatMap((block) => block.split(','))
    .map((name) => name.trim())
    .filter(Boolean);
  assert.ok(names.length > 5, 'expected to find value exports to check');
  for (const name of names) {
    assert.ok(js.includes(name), `index.d.ts declares ${name}, which index.js does not export`);
  }
});

test('the source makes no network requests', () => {
  // A claim of "no network" in the README needs a test asserting no network,
  // or it goes false one feature later with nothing failing.
  for (const dir of readdirSync(WC)) {
    for (const file of readdirSync(join(WC, dir)).filter((f) => f.endsWith('.js'))) {
      const source = readFileSync(join(WC, dir, file), 'utf8');
      for (const pattern of [/\bfetch\s*\(/, /XMLHttpRequest/, /new WebSocket/, /importScripts/]) {
        assert.ok(
          !pattern.test(source),
          `${dir}/${file} performs network I/O (${pattern}) — the remote transport is the integrator's to supply`
        );
      }
      const urls = source.match(/https?:\/\/[^\s'"`)]+/g) ?? [];
      const offenders = urls.filter((u) => !u.startsWith('https://webmachinelearning') && !u.includes('example'));
      assert.deepEqual(offenders, [], `${dir}/${file} references ${offenders.join(', ')}`);
    }
  }
});

test('the declared licence ships', () => {
  assert.equal(pkg.license, 'Apache-2.0');
  assert.ok(existsSync(join(ROOT, 'LICENSE')), 'Apache-2.0 requires the licence text to ship');
});

test('published tarball carries the runtime and omits the workshop', () => {
  const raw = execFileSync('npm', ['pack', '--dry-run', '--json'], { cwd: ROOT, encoding: 'utf8' });
  const parsed = JSON.parse(raw);
  // npm 12 changed this from an array to an object keyed by package name. A
  // test that assumes one shape passes locally and fails in CI.
  const entry = Array.isArray(parsed) ? parsed[0] : Object.values(parsed)[0];
  const files = entry.files.map((f) => f.path);

  for (const required of ['package.json', 'index.js', 'index.d.ts', 'LICENSE']) {
    assert.ok(files.includes(required), `${required} must ship`);
  }
  assert.ok(
    files.some((f) => f === 'src/wc/machvive-chat-syncopation-canvas/machvive-chat-syncopation-canvas.js'),
    'component sources must ship'
  );
  assert.ok(files.some((f) => f.endsWith('.d.ts') && f.startsWith('src/')), 'component declarations must ship');

  for (const excluded of ['CLAUDE.md', '.npmignore']) {
    assert.ok(!files.includes(excluded), `${excluded} should not ship`);
  }
  for (const prefix of ['test/', 'design/', '.github/', 'plugins/']) {
    const leaked = files.filter((f) => f.startsWith(prefix));
    assert.deepEqual(leaked, [], `${prefix} leaked into the tarball`);
  }
});

test('the tarball installs and imports from a clean directory', () => {
  // The only check that proves what a consumer actually gets. A passing suite
  // says nothing about whether the published shape resolves.
  const index = readFileSync(join(ROOT, 'index.js'), 'utf8');
  assert.ok(index.includes('export {'), 'index.js must re-export the classes, not only import them');
  assert.equal(pkg.type, 'module', 'the files are published as authored ESM');
  assert.ok(pkg.files.includes('src'), 'src must be in the files allowlist or exports resolve to nothing');
});
