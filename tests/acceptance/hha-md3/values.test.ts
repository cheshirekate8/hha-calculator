// hha-md3, criterion 3: sort order and exact field values on items chosen so that a
// plausible wrong mapping gives a different answer.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('../../../', import.meta.url));
const catalog = JSON.parse(fs.readFileSync(path.join(ROOT, 'src', 'data', 'catalog.json'), 'utf8'));
const get = (name: string) => {
  const item = catalog.items.find((i: any) => i.name === name);
  assert.ok(item, `catalog has ${name}`);
  return item;
};

test('item names strictly increase under plain string comparison', () => {
  for (let i = 1; i < catalog.items.length; i++) {
    const a = catalog.items[i - 1].name;
    const b = catalog.items[i].name;
    assert.ok(a < b, `out of order at ${i}: ${JSON.stringify(a)} then ${JSON.stringify(b)}`);
  }
});

test('katana', () => {
  const k = get('katana');
  assert.equal(k.sheet, 'Housewares');
  assert.equal(k.basePoints, 451);
});

test('forgeries are separate items named "(forgery)"', () => {
  assert.equal(get('famous painting').basePoints, 451);
  assert.equal(get('famous painting (forgery)').basePoints, 17);
});

test('log stool: item fields and a non-first variant', () => {
  const s = get('log stool');
  assert.equal(s.tag, 'Chair');
  assert.equal(s.interact, 'Chair');
  assert.equal(s.series, 'log');
  assert.equal(s.variants.length, 4);
  const birch = s.variants.find((v: any) => v.variation === 'White birch');
  assert.ok(birch, 'White birch variant');
  assert.deepEqual(birch.colors, ['White', 'Beige']);
  assert.deepEqual(birch.concepts, ['garden', 'nature']);
});

test('Moroccan lights: category comes from the variation', () => {
  const silver = get('Moroccan lights').variants.find((v: any) => v.variation === 'Silver');
  assert.ok(silver, 'Silver variant');
  assert.equal(silver.category, 'Lighting');
});

test('koi: a row with no variations becomes one variant; absent values are null or []', () => {
  const koi = get('koi');
  assert.equal(koi.sheet, 'Fish');
  assert.equal(koi.basePoints, 71);
  assert.equal(koi.series, null);
  assert.equal(koi.set, null);
  assert.deepEqual(koi.variants, [
    { variation: null, pattern: null, colors: ['Red', 'White'], concepts: [], category: 'Pet' },
  ]);
});

test('drapery: pattern variants in upstream order', () => {
  const d = get('drapery');
  assert.deepEqual(
    d.variants.map((v: any) => v.pattern),
    ['Berry red', 'Green', 'Yellow', 'Light blue', 'White', 'Navy blue', 'Black', 'Purple'],
  );
  const berry = d.variants[0];
  assert.equal(berry.variation, null);
  assert.deepEqual(berry.colors, ['Red', 'Red']);
});
