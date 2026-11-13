// hha-09f: color (§6.8) and feng shui (§6.9) with the fengShui option (§8). Only `color`
// and `feng-shui` lines are inspected, so other rules may add lines once merged.
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
const colored = (ns: string[], colors: string[], o: any = {}) => ns.map((n) => item(n, { variants: [v({ colors })], ...o }));

const R = names('red', 8), B = names('blue', 4), RB = names('red-blue', 4), GR = names('green-red', 4);
const WH = names('white', 2), CL = names('clear', 2);
const cat = catalog([
  ...colored(R, ['Red', 'Red']), ...colored(B, ['Blue', 'Blue']),
  ...colored(RB, ['Red', 'Blue']), ...colored(GR, ['Green', 'Red']),
  ...colored(WH, ['White', 'White']), ...CL.map((n) => item(n)),
  ...colored(['A'], ['Red', 'White']), ...colored(['B', 'C'], ['Red', 'Green']),
  ...colored(['D'], ['White', 'Green']), ...colored(['E'], ['Blue', 'Blue']),
  item('red wall', { sheet: 'Wallpaper', variants: [v({ colors: ['Red', 'Red'] })] }),
  item('red floor', { sheet: 'Floors', variants: [v({ colors: ['Red', 'Red'] })] }),
  ...colored(['G1', 'G2'], ['Green', 'Green']), ...colored(['Y1', 'Y2'], ['Yellow', 'Yellow']),
  ...colored(['WR'], ['White', 'Red']),
]);

test('color counts with quantity and pays per unique matching item', () => {
  one(run(cat, [...R.slice(0, 3).map((n) => place(n, { quantity: 3 })), place(B[0])]).rooms[0].lines, 'color', 1800, R.slice(0, 3));
  one(run(cat, [...R.slice(0, 7), ...B.slice(0, 3)].map((n) => place(n))).rooms[0].lines, 'color', 1400, R.slice(0, 7));
  none(run(cat, [...R.slice(0, 6), ...B.slice(0, 4)].map((n) => place(n))).rooms[0].lines, 'color');
  none(run(cat, R.slice(0, 7).map((n) => place(n))).rooms[0].lines, 'color');
  one(run(cat, R.slice(0, 4).map((n) => place(n, { quantity: 2 }))).rooms[0].lines, 'color', 2400, R.slice(0, 4));
});

test('an item matches either color; ties go to the name that sorts first; colorless items count', () => {
  one(run(cat, [...RB, ...GR, ...WH].map((n) => place(n))).rooms[0].lines, 'color', 1600, [...RB, ...GR]);
  const tie = run(cat, [
    place('A', { quantity: 5 }), place('B'), place('C'), place('D', { quantity: 2 }), place('E'),
  ]).rooms[0].lines;
  one(tie, 'color', 600, ['A', 'B', 'C']);
  one(run(cat, [...R, ...CL].map((n) => place(n))).rooms[0].lines, 'color', 1600, R);
});

test('wallpaper and flooring do not count toward color', () => {
  const extra = { wallpaper: { name: 'red wall' }, flooring: { name: 'red floor' } };
  none(run(cat, [...R.slice(0, 5), ...B.slice(0, 3)].map((n) => place(n)), extra).rooms[0].lines, 'color');
  none(run(cat, R.slice(0, 7).map((n) => place(n)), { wallpaper: { name: 'red wall' } }).rooms[0].lines, 'color');
});

test('feng shui pays 500 per wall at most', () => {
  one(run(cat, [place(R[0], { nearWall: 'east' })]).rooms[0].lines, 'feng-shui', 500, [R[0]]);
  one(run(cat, [
    place(R[0], { nearWall: 'east' }), place(R[1], { nearWall: 'east' }), place(R[2], { nearWall: 'east', quantity: 3 }),
  ]).rooms[0].lines, 'feng-shui', 500, R.slice(0, 3));
  one(run(cat, [
    place(R[0], { nearWall: 'east' }), place('G1', { nearWall: 'south' }), place('Y1', { nearWall: 'west' }),
  ]).rooms[0].lines, 'feng-shui', 1500, [R[0], 'G1', 'Y1']);
  one(run(cat, [
    place(R[0], { nearWall: 'east' }), place(R[1], { nearWall: 'east' }),
    place('G1', { nearWall: 'south' }), place('G2', { nearWall: 'south' }),
    place('Y1', { nearWall: 'west' }), place('Y2', { nearWall: 'west' }),
    place(R[2], { nearWall: 'north' }),
  ]).rooms[0].lines, 'feng-shui', 1500, [R[0], R[1], 'G1', 'G2', 'Y1', 'Y2']);
  one(run(cat, [place('WR', { nearWall: 'east' })]).rooms[0].lines, 'feng-shui', 500, ['WR']);
});

test('feng shui: wrong wall, wrong color, no wall, or switched off gives nothing', () => {
  none(run(cat, [place('G1', { nearWall: 'east' })]).rooms[0].lines, 'feng-shui');
  none(run(cat, [place('Y1', { nearWall: 'south' })]).rooms[0].lines, 'feng-shui');
  none(run(cat, [place(R[0], { nearWall: 'north' })]).rooms[0].lines, 'feng-shui');
  none(run(cat, [place(R[0])]).rooms[0].lines, 'feng-shui');
  none(run(cat, [place(R[0], { nearWall: 'east' })], {}, { fengShui: 'off' }).rooms[0].lines, 'feng-shui');
});
