// hha-bu0: concept (§6.6) and category (§6.7) with the categoryBonus option (§8). Only
// `concept` and `category` lines are inspected, so other rules may add lines once merged.
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
const run = (cat: any, items: any[], extra: any = {}, options?: any) =>
  score({ stage: 'house', season: 'spring', rooms: [{ name: 'Den', items, ...extra }] } as any, cat, options);
function one(lines: any[], rule: string, points: number, items?: string[]) {
  const ls = lines.filter((l) => l.rule === rule);
  assert.equal(ls.length, 1, `exactly one ${rule} line`);
  assert.equal(ls[0].points, points, `${rule} points`);
  assert.ok(typeof ls[0].detail === 'string' && ls[0].detail.length > 0, 'non-empty detail');
  if (items) assert.deepEqual([...ls[0].items].sort(), [...items].sort(), `${rule} items`);
}
const none = (lines: any[], rule: string) =>
  assert.equal(lines.filter((l) => l.rule === rule).length, 0, `no ${rule} line`);
const names = (prefix: string, n: number) => Array.from({ length: n }, (_, i) => `${prefix} ${i + 1}`);

const G = names('garden', 5), N = names('nature', 4), GN = names('both', 3), NO = names('nature only', 3);
const F = names('fancy', 5), O = names('ocean', 4);
const conceptCat = catalog([
  ...G.map((n) => item(n, { variants: [v({ concepts: ['garden'] })] })),
  ...N.map((n) => item(n, { variants: [v({ concepts: ['nature'] })] })),
  ...GN.map((n) => item(n, { variants: [v({ concepts: ['garden', 'nature'] })] })),
  ...NO.map((n) => item(n, { variants: [v({ concepts: ['nature'] })] })),
  ...F.map((n) => item(n, { variants: [v({ concepts: ['fancy'] })] })),
  ...O.map((n) => item(n, { variants: [v({ concepts: ['ocean'] })] })),
  item('shell', { variants: [v({ variation: 'Sand', concepts: ['garden'] }), v({ variation: 'Sea', concepts: ['ocean'] })] }),
  item('garden floor', { sheet: 'Floors', variants: [v({ concepts: ['garden'] })] }),
  item('garden wall', { sheet: 'Wallpaper', variants: [v({ concepts: ['garden'] })] }),
]);

test('concept counts duplicates', () => {
  one(run(conceptCat, [place(G[0], { quantity: 3 }), place(G[1], { quantity: 2 })]).rooms[0].lines, 'concept', 2000, [G[0], G[1]]);
  none(run(conceptCat, [place(G[0], { quantity: 2 }), place(G[1], { quantity: 2 })]).rooms[0].lines, 'concept');
});

test('concepts ranked by count with duplicates, not by unique items', () => {
  const lines = run(conceptCat, [
    place(G[0], { quantity: 3 }), place(G[1], { quantity: 3 }),
    ...N.map((n) => place(n)),
  ]).rooms[0].lines;
  one(lines, 'concept', 2400, [G[0], G[1]]);
});

test('an item counts toward each of its concepts', () => {
  one(run(conceptCat, [...GN, ...NO].map((n) => place(n))).rooms[0].lines, 'concept', 2400, [...GN, ...NO]);
});

test('concept ties go to the name that sorts first', () => {
  one(run(conceptCat, [...G, ...F].map((n) => place(n))).rooms[0].lines, 'concept', 2000, F);
});

test('wallpaper and flooring concepts count; the placed variant decides', () => {
  const four = G.slice(0, 4).map((n) => place(n));
  one(run(conceptCat, four, { flooring: { name: 'garden floor' } }).rooms[0].lines, 'concept', 2000, [...G.slice(0, 4), 'garden floor']);
  one(run(conceptCat, four, { wallpaper: { name: 'garden wall' } }).rooms[0].lines, 'concept', 2000, [...G.slice(0, 4), 'garden wall']);
  one(run(conceptCat, [...O.map((n) => place(n)), place('shell', { variation: 'Sea' })]).rooms[0].lines, 'concept', 2000, [...O, 'shell']);
});

const LT = names('light', 3), PL = names('plant', 4), NL = names('plain', 3);
const catCat = catalog([
  ...LT.map((n) => item(n, { variants: [v({ category: 'Lighting' })] })),
  ...PL.map((n) => item(n, { variants: [v({ category: 'Plant' })] })),
  ...NL.map((n) => item(n)),
  item('two-tone light', { variants: [v({ variation: 'A', category: 'Lighting' }), v({ variation: 'B', category: 'Lighting' })] }),
  item('lamp plant', { variants: [v({ variation: 'Pot', category: 'Plant' }), v({ variation: 'Lit', category: 'Lighting' })] }),
]);

test('category per-category: 3 unique items per category, 500 each', () => {
  one(run(catCat, LT.map((n) => place(n))).rooms[0].lines, 'category', 500, LT);
  none(run(catCat, [place(LT[0], { quantity: 3 }), place(LT[1], { quantity: 3 })]).rooms[0].lines, 'category');
  none(run(catCat, [place(LT[0]), place('two-tone light', { variation: 'A' }), place('two-tone light', { variation: 'B' })]).rooms[0].lines, 'category');
  one(run(catCat, [...LT, ...PL.slice(0, 3)].map((n) => place(n))).rooms[0].lines, 'category', 1000, [...LT, ...PL.slice(0, 3)]);
});

test('category comes from the placed variant; null is no category', () => {
  one(run(catCat, [place(LT[0]), place(LT[1]), place('lamp plant', { variation: 'Lit' })]).rooms[0].lines, 'category', 500, [LT[0], LT[1], 'lamp plant']);
  none(run(catCat, NL.map((n) => place(n))).rooms[0].lines, 'category');
});

test('category per-item option', () => {
  const room = [place(LT[0], { quantity: 3 }), place(LT[1]), place(LT[1]), place(LT[2]), ...PL.map((n) => place(n))];
  one(run(catCat, room, {}, { categoryBonus: 'per-item' }).rooms[0].lines, 'category', 3500, [...LT, ...PL]);
  one(run(catCat, room).rooms[0].lines, 'category', 1000, [...LT, ...PL]);
});
