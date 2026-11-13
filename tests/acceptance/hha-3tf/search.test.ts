// hha-3tf: catalog search and variant labels (DESIGN.md §10.5).
import test from 'node:test';
import assert from 'node:assert/strict';
import { searchCatalog, variantLabel } from '../../../src/app/search.ts';

const v = (o: any = {}) => ({ variation: null, pattern: null, colors: [], concepts: [], category: null, ...o });
const item = (name: string, sheet = 'Housewares') =>
  ({ name, sheet, basePoints: 0, series: null, set: null, tag: null, interact: false, variants: [v()] });
const catalogOf = (items: any[]) => ({
  source: { repo: 'test', commit: '0'.repeat(40) },
  items: [...items].sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0)),
  sets: {},
});
const names = (xs: any[]) => xs.map((x) => x.name);

const chairs = catalogOf([
  item('Rocking Chair'), item('antique chair'), item('armchair'), item('chair'), item('chair cushion'),
  item('highchair'), item('wooden chair'), item('sofa'),
]);

test('empty and all-space queries find nothing; case and spaces are ignored', () => {
  assert.deepEqual(searchCatalog(chairs as any, '', 'item'), []);
  assert.deepEqual(searchCatalog(chairs as any, '   ', 'item'), []);
  assert.deepEqual(names(searchCatalog(chairs as any, '  CHAIR ', 'item')),
    ['chair', 'chair cushion', 'Rocking Chair', 'antique chair', 'wooden chair', 'armchair', 'highchair']);
});

test('three ranked groups, each in catalog order', () => {
  assert.deepEqual(names(searchCatalog(chairs as any, 'chair', 'item')),
    ['chair', 'chair cushion', 'Rocking Chair', 'antique chair', 'wooden chair', 'armchair', 'highchair']);
});

test('kind filters by sheet', () => {
  const mixed = catalogOf([
    item('blue wall', 'Wallpaper'), item('blue floor', 'Floors'), item('blue rug', 'Rugs'),
    item('blue chair'), item('blue clock', 'Wall-mounted'), item('blue lamp', 'Ceiling Decor'),
    item('blue tang', 'Fish'), item('blue tin', 'Other'),
  ]);
  assert.deepEqual(names(searchCatalog(mixed as any, 'blue', 'wallpaper')), ['blue wall']);
  assert.deepEqual(names(searchCatalog(mixed as any, 'blue', 'flooring')), ['blue floor']);
  assert.deepEqual(names(searchCatalog(mixed as any, 'blue', 'item')).sort(),
    ['blue chair', 'blue clock', 'blue lamp', 'blue rug', 'blue tang', 'blue tin']);
});

test('limit caps after ranking', () => {
  const many = catalogOf([
    ...Array.from({ length: 58 }, (_, i) => item(`box ${String(i).padStart(2, '0')}`)),
    item('a box'), item('toolbox'),
  ]);
  const all = searchCatalog(many as any, 'box', 'item', 1000);
  assert.equal(all.length, 60);
  assert.equal(searchCatalog(many as any, 'box', 'item').length, 50);
  assert.deepEqual(names(searchCatalog(many as any, 'box', 'item', 3)), names(all.slice(0, 3)));
  assert.deepEqual(names(searchCatalog(many as any, 'box', 'item', 3)), ['box 00', 'box 01', 'box 02']);
  assert.deepEqual(names(all.slice(-2)), ['a box', 'toolbox']);
});

test('variantLabel', () => {
  assert.equal(variantLabel(v({ variation: 'Red' }) as any), 'Red');
  assert.equal(variantLabel(v({ pattern: 'Striped' }) as any), 'Striped');
  assert.equal(variantLabel(v({ variation: 'Red', pattern: 'Striped' }) as any), 'Red / Striped');
  assert.equal(variantLabel(v() as any), 'Default');
});

test('results are the catalog\'s own objects, and the catalog is untouched', () => {
  const snapshot = JSON.stringify(chairs);
  const hits = searchCatalog(chairs as any, 'chair', 'item');
  for (const hit of hits) assert.ok(chairs.items.includes(hit), `${hit.name} is the catalog's object`);
  assert.equal(JSON.stringify(chairs), snapshot);
});
