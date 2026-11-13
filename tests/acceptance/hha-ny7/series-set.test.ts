// hha-ny7: series (§6.4) and set completion (§6.5). Only `series` and `set` lines are
// inspected, so other rules may add lines once merged.
import test from 'node:test';
import assert from 'node:assert/strict';
import { score } from '../../../src/engine/score.ts';

const v = (o: any = {}) => ({ variation: null, pattern: null, colors: [], concepts: [], category: null, ...o });
const item = (name: string, o: any = {}) =>
  ({ name, sheet: 'Housewares', basePoints: 0, series: null, set: null, tag: null, interact: false, variants: [v()], ...o });
const catalog = (items: any[], sets: Record<string, string[]> = {}) => ({
  source: { repo: 'test', commit: '0'.repeat(40) },
  items: [...items].sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0)),
  sets,
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

const W = ['wooden 1', 'wooden 2', 'wooden 3', 'wooden 4'];
const L = ['log 1', 'log 2', 'log 3', 'log 4', 'log 5'];
const seriesCat = catalog([
  ...W.map((n) => item(n, { series: 'wooden' })),
  item('wooden two-tone', { series: 'wooden', variants: [v({ variation: 'Dark' }), v({ variation: 'Light' })] }),
  ...L.map((n) => item(n, { series: 'log' })),
  item('wooden wall', { sheet: 'Wallpaper', series: 'wooden' }),
  item('wooden floor', { sheet: 'Floors', series: 'wooden' }),
]);

test('series: unique names for the threshold, every item for the points', () => {
  one(run(seriesCat, [place(W[0]), place(W[1]), place(W[2]), place(W[3], { quantity: 2 })]).rooms[0].lines,
    'series', 5000, W);
  none(run(seriesCat, [place(W[0], { quantity: 3 }), place(W[1], { quantity: 3 }), place(W[2], { quantity: 3 })]).rooms[0].lines, 'series');
});

test('series: two variants of one item are one unique item', () => {
  const lines = run(seriesCat, [
    place(W[0]), place(W[1]),
    place('wooden two-tone', { variation: 'Dark' }), place('wooden two-tone', { variation: 'Light' }),
  ]).rooms[0].lines;
  none(lines, 'series');
});

test('series: ranked by unique count; ties go to the name that sorts first', () => {
  const byUnique = run(seriesCat, [
    ...W.map((n) => place(n, { quantity: 3 })),
    ...L.map((n) => place(n)),
  ]).rooms[0].lines;
  one(byUnique, 'series', 5000, L);
  const tie = run(seriesCat, [
    ...W.map((n) => place(n, { quantity: 2 })),
    ...L.slice(0, 4).map((n) => place(n)),
  ]).rooms[0].lines;
  one(tie, 'series', 4000, L.slice(0, 4));
});

test('series: wallpaper and flooring count', () => {
  const three = W.slice(0, 3).map((n) => place(n));
  one(run(seriesCat, three, { wallpaper: { name: 'wooden wall' } }).rooms[0].lines, 'series', 4000, [...W.slice(0, 3), 'wooden wall']);
  one(run(seriesCat, three, { flooring: { name: 'wooden floor' } }).rooms[0].lines, 'series', 4000, [...W.slice(0, 3), 'wooden floor']);
});

const BEAR = ['Baby bear', 'Mama bear', 'Papa bear', 'giant teddy bear'];
const PANDA = ['Baby panda', 'Mama panda', 'Papa panda'];
const TILE = ['tile chair', 'tile table', 'tile lamp', 'tile floor'];
const setCat = catalog([
  ...BEAR.map((n) => item(n, { set: 'bear' })),
  ...PANDA.map((n) => item(n, { set: 'panda' })),
  ...TILE.slice(0, 3).map((n) => item(n, { set: 'tile' })),
  item('tile floor', { sheet: 'Floors', set: 'tile' }),
], {
  bear: [...BEAR].sort(),
  panda: [...PANDA].sort(),
  tile: [...TILE].sort(),
});

test('set: complete sets score 800 per member, once', () => {
  one(run(setCat, BEAR.map((n) => place(n))).rooms[0].lines, 'set', 3200, BEAR);
  none(run(setCat, BEAR.slice(0, 3).map((n) => place(n))).rooms[0].lines, 'set');
  one(run(setCat, BEAR.map((n) => place(n, { quantity: 2 }))).rooms[0].lines, 'set', 3200, BEAR);
  one(run(setCat, [...BEAR, ...PANDA].map((n) => place(n))).rooms[0].lines, 'set', 5600, [...BEAR, ...PANDA]);
});

test('set: the room\'s flooring can complete a set', () => {
  const lines = run(setCat, TILE.slice(0, 3).map((n) => place(n)), { flooring: { name: 'tile floor' } }).rooms[0].lines;
  one(lines, 'set', 3200, TILE);
});
