// hha-4vl: furniture count (§6.2) and wall-hung items (§6.3). Only `count` and
// `wall-hung` lines are inspected, so other rules may add lines once merged.
import test from 'node:test';
import assert from 'node:assert/strict';
import { score } from '../../../src/engine/score.ts';

const v = (o: any = {}) => ({ variation: null, pattern: null, colors: [], concepts: [], category: null, ...o });
const item = (name: string, o: any = {}) =>
  ({ name, sheet: 'Housewares', basePoints: 0, series: null, set: null, tag: null, interact: false, variants: [v()], ...o });
const catalog = (items: any[]) => ({
  source: { repo: 'test', commit: '0'.repeat(40) },
  items: [...items].sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0)),
  sets: {},
});
const place = (name: string, o: any = {}) => ({ name, surface: 'floor', ...o });
const run = (cat: any, items: any[], extra: any = {}) =>
  score({ stage: 'house', season: 'spring', rooms: [{ name: 'Den', items, ...extra }] } as any, cat);
function one(lines: any[], rule: string, points: number, items?: string[]) {
  const ls = lines.filter((l) => l.rule === rule);
  assert.equal(ls.length, 1, `exactly one ${rule} line`);
  assert.equal(ls[0].points, points, `${rule} points`);
  assert.ok(typeof ls[0].detail === 'string' && ls[0].detail.length > 0, 'non-empty detail');
  if (items) assert.deepEqual([...ls[0].items].sort(), [...items].sort(), `${rule} items`);
}
const none = (lines: any[], rule: string) =>
  assert.equal(lines.filter((l) => l.rule === rule).length, 0, `no ${rule} line`);

const furniture = catalog([
  item('Stool'), item('Lamp'), item('Desk'), item('Mug'),
  item('Clock', { sheet: 'Wall-mounted' }), item('Chandelier', { sheet: 'Ceiling Decor' }),
  item('Rug', { sheet: 'Rugs' }), item('boot', { sheet: 'Other' }),
  item('Wall', { sheet: 'Wallpaper' }), item('Floor', { sheet: 'Floors' }),
]);

test('count thresholds, counted with quantity', () => {
  const expect: [number, number | null][] = [[5, null], [6, 1000], [9, 1000], [10, 2000], [15, 3000], [19, 3000], [20, 4000], [40, 4000]];
  for (const [n, pts] of expect) {
    const lines = run(furniture, [place('Stool', { quantity: n })]).rooms[0].lines;
    if (pts === null) none(lines, 'count');
    else one(lines, 'count', pts, ['Stool']);
  }
});

test('floor, tabletop, wall and ceiling pieces all count', () => {
  const lines = run(furniture, [
    place('Stool'), place('Lamp'), place('Desk'),
    place('Mug', { surface: 'tabletop' }),
    place('Clock', { surface: 'wall' }),
    place('Chandelier', { surface: 'ceiling' }),
  ]).rooms[0].lines;
  one(lines, 'count', 1000, ['Stool', 'Lamp', 'Desk', 'Mug', 'Clock', 'Chandelier']);
});

test('rugs, trash, wallpaper and flooring are not furniture', () => {
  const base = [place('Stool', { quantity: 5 }), place('Rug', { quantity: 3 }), place('boot', { quantity: 2 })];
  const extra = { wallpaper: { name: 'Wall' }, flooring: { name: 'Floor' } };
  none(run(furniture, base, extra).rooms[0].lines, 'count');
  const lines = run(furniture, [...base, place('Lamp')], extra).rooms[0].lines;
  one(lines, 'count', 1000, ['Stool', 'Lamp']);
});

const hanging = catalog([
  item('Clock', { sheet: 'Wall-mounted' }), item('Painting', { sheet: 'Artwork' }),
  item('Photo', { sheet: 'Photos' }), item('Poster', { sheet: 'Posters' }),
  item('Shelf'),
]);

test('wall-hung: each hanging sheet alone gives 400', () => {
  for (const name of ['Clock', 'Painting', 'Photo', 'Poster']) {
    one(run(hanging, [place(name, { surface: 'wall' })]).rooms[0].lines, 'wall-hung', 400, [name]);
  }
});

test('wall-hung: capped at 3, counted with quantity, names every qualifying item', () => {
  const four = ['Clock', 'Painting', 'Photo', 'Poster'].map((n) => place(n, { surface: 'wall' }));
  one(run(hanging, four).rooms[0].lines, 'wall-hung', 1200, ['Clock', 'Painting', 'Photo', 'Poster']);
  one(run(hanging, [place('Clock', { surface: 'wall', quantity: 2 })]).rooms[0].lines, 'wall-hung', 800, ['Clock']);
});

test('wall-hung: needs surface wall and a hanging sheet', () => {
  none(run(hanging, [place('Clock', { surface: 'tabletop' })]).rooms[0].lines, 'wall-hung');
  none(run(hanging, [place('Shelf', { surface: 'wall' })]).rooms[0].lines, 'wall-hung');
});
