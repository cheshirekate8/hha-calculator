// hha-6wy, criterion 5: each room is scored on its own items, rooms come back in input
// order, and the totals add up (§2.2). Distinct per-room totals catch an engine that
// scores the wrong room's items.
import test from 'node:test';
import assert from 'node:assert/strict';
import { score } from '../../../src/engine/score.ts';

const variant = () => ({ variation: null, pattern: null, colors: ['Gray', 'Gray'], concepts: [], category: null });
const item = (name: string, basePoints: number, sheet: string) =>
  ({ name, sheet, basePoints, series: null, set: null, tag: null, interact: false, variants: [variant()] });
const catalog = {
  source: { repo: 'test', commit: '0'.repeat(40) },
  items: [item('A', 151, 'Housewares'), item('B', 103, 'Housewares'), item('F', 201, 'Floors'), item('W', 451, 'Wallpaper')],
  sets: {},
};
const house = {
  stage: 'back', season: 'autumn',
  rooms: [
    { name: 'North', items: [{ name: 'A', quantity: 3, surface: 'floor' }] },
    { name: 'Middle', wallpaper: { name: 'W' }, items: [{ name: 'B', quantity: 2, surface: 'tabletop' }] },
    { name: 'South', flooring: { name: 'F' }, items: [] },
  ],
};

test('rooms keep input order, names and their own totals', () => {
  const r = score(house as any, catalog as any);
  assert.deepEqual(r.rooms.map((x: any) => [x.name, x.total]), [['North', 453], ['Middle', 657], ['South', 201]]);
  assert.equal(r.total, 1311);
});

test('totals are sums of lines and rooms', () => {
  const r = score(house as any, catalog as any);
  const sum = (lines: any[]) => lines.reduce((s, l) => s + l.points, 0);
  for (const room of r.rooms) assert.equal(room.total, sum(room.lines), `${room.name}`);
  assert.equal(r.house.total, sum(r.house.lines));
  assert.equal(r.total, r.rooms.reduce((s: number, x: any) => s + x.total, 0) + r.house.total);
});
