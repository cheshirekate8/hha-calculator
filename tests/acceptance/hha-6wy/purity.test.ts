// hha-6wy, criterion 7: the engine is pure (§2.1) — it does not mutate its input, reads
// no clock and no randomness, and imports no Node module, React, or the catalog file.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { builtinModules } from 'node:module';
import { fileURLToPath } from 'node:url';
import { score } from '../../../src/engine/score.ts';

const ROOT = fileURLToPath(new URL('../../../', import.meta.url));

function deepFreeze<T>(o: T): T {
  if (o && typeof o === 'object' && !Object.isFrozen(o)) {
    Object.freeze(o);
    for (const v of Object.values(o as object)) deepFreeze(v);
  }
  return o;
}

const build = () => ({
  catalog: {
    source: { repo: 'test', commit: '0'.repeat(40) },
    items: [
      { name: 'A', sheet: 'Housewares', basePoints: 151, series: null, set: null, tag: null, interact: false,
        variants: [{ variation: null, pattern: null, colors: ['Gray', 'Gray'], concepts: [], category: null }] },
      { name: 'W', sheet: 'Wallpaper', basePoints: 451, series: null, set: null, tag: null, interact: false,
        variants: [{ variation: null, pattern: null, colors: ['Gray', 'Gray'], concepts: [], category: null }] },
    ],
    sets: {},
  },
  house: {
    stage: 'house', season: 'spring',
    rooms: [{ name: 'Main', wallpaper: { name: 'W' }, items: [{ name: 'A', quantity: 2, surface: 'floor' }] }],
  },
});

test('frozen input is not mutated and results repeat exactly', () => {
  const { catalog, house } = build();
  deepFreeze(catalog);
  deepFreeze(house);
  const a = score(house as any, catalog as any);
  const b = score(house as any, catalog as any);
  assert.equal(a.total, 753);
  assert.deepEqual(a, b);
});

test('no clock and no randomness', () => {
  const { catalog, house } = build();
  const now = Date.now;
  const random = Math.random;
  Date.now = () => { throw new Error('engine read the clock'); };
  Math.random = () => { throw new Error('engine used randomness'); };
  try {
    assert.equal(score(house as any, catalog as any).total, 753);
  } finally {
    Date.now = now;
    Math.random = random;
  }
});

test('src/engine imports no Node module, React, or catalog.json', () => {
  const dir = path.join(ROOT, 'src', 'engine');
  const files: string[] = [];
  const walk = (d: string) => {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, e.name);
      if (e.isDirectory()) walk(p);
      else if (/\.(ts|tsx|js|mjs)$/.test(e.name)) files.push(p);
    }
  };
  walk(dir);
  assert.ok(files.length > 0, 'src/engine has source files');
  const builtins = new Set(builtinModules);
  const SPEC = /(?:\bfrom\s*|\bimport\s*\(\s*|\bimport\s+|\brequire\s*\(\s*)['"]([^'"]+)['"]/g;
  for (const f of files) {
    for (const m of fs.readFileSync(f, 'utf8').matchAll(SPEC)) {
      const spec = m[1] as string;
      const where = `${path.relative(ROOT, f)} imports ${spec}`;
      assert.ok(!spec.startsWith('node:') && !builtins.has(spec), `${where}: a Node module`);
      assert.ok(spec !== 'react' && !spec.startsWith('react/') && !spec.startsWith('react-dom'), `${where}: React`);
      assert.ok(!spec.endsWith('catalog.json'), `${where}: the catalog file`);
    }
  }
});
