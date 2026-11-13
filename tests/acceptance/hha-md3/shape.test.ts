// hha-md3, criterion 2: one item per upstream row, unique names, sheet and source
// provenance, and exactly the DESIGN.md §4.2.1 fields with the right types.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('../../../', import.meta.url));
const catalog = JSON.parse(fs.readFileSync(path.join(ROOT, 'src', 'data', 'catalog.json'), 'utf8'));
const upDir = path.join(ROOT, 'data', 'upstream');
const upstream: any[] = fs.readdirSync(upDir)
  .filter((f) => f.endsWith('.json'))
  .flatMap((f) => JSON.parse(fs.readFileSync(path.join(upDir, f), 'utf8')));

const ITEM_KEYS = ['basePoints', 'interact', 'name', 'series', 'set', 'sheet', 'tag', 'variants'];
const VARIANT_KEYS = ['category', 'colors', 'concepts', 'pattern', 'variation'];

test('one catalog item per upstream row, 3,993 for the pinned data', () => {
  assert.equal(upstream.length, 3993, 'vendored data changed; this test pins the 2026-11-13 copy');
  assert.equal(catalog.items.length, upstream.length);
});

test('item names are unique and each item keeps its upstream sheet', () => {
  const byName = new Map<string, any>();
  for (const item of catalog.items) {
    assert.ok(!byName.has(item.name), `duplicate name ${item.name}`);
    byName.set(item.name, item);
  }
  for (const row of upstream) {
    const name = row.genuine === false ? `${row.name} (forgery)` : row.name;
    const item = byName.get(name);
    assert.ok(item, `no catalog item for upstream row ${row.sourceSheet}/${name}`);
    assert.equal(item.sheet, row.sourceSheet, `${name}: sheet`);
  }
});

test('source names the repo and the pinned commit from data/SOURCE.md', () => {
  const src = fs.readFileSync(path.join(ROOT, 'data', 'SOURCE.md'), 'utf8');
  const sha = (src.match(/`([0-9a-f]{40})`/) || [])[1];
  assert.ok(sha, 'data/SOURCE.md carries a 40-char commit');
  assert.deepEqual(catalog.source, { repo: 'Norviah/animal-crossing', commit: sha });
});

test('every item and variant has exactly the §4.2.1 fields and types', () => {
  for (const item of catalog.items) {
    assert.deepEqual(Object.keys(item).sort(), ITEM_KEYS, `${item.name}: item fields`);
    assert.equal(typeof item.basePoints, 'number', `${item.name}: basePoints`);
    assert.ok(item.interact === null || ['string', 'boolean'].includes(typeof item.interact), `${item.name}: interact`);
    assert.ok(Array.isArray(item.variants) && item.variants.length > 0, `${item.name}: variants`);
    for (const v of item.variants) {
      assert.deepEqual(Object.keys(v).sort(), VARIANT_KEYS, `${item.name}: variant fields`);
      assert.ok(Array.isArray(v.colors), `${item.name}: colors is an array`);
      assert.ok(Array.isArray(v.concepts), `${item.name}: concepts is an array`);
    }
  }
});
