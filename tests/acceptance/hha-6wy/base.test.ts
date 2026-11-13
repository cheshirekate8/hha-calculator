// hha-6wy, criterion 4: base points (§6.1) on a catalog that meets §4.2.1 in full.
// 1,057 = 151 × 2 + 103 + 451 + 201. Ignoring quantity gives 906; dropping wallpaper and
// flooring gives 405; a broken quantity default gives NaN.
import test from 'node:test';
import assert from 'node:assert/strict';
import { score } from '../../../src/engine/score.ts';

const variant = (variation: string | null, colors = ['Gray', 'Gray']) =>
  ({ variation, pattern: null, colors, concepts: [], category: null });
const item = (name: string, basePoints: number, sheet: string, variants = [variant(null)]) =>
  ({ name, sheet, basePoints, series: null, set: null, tag: null, interact: false, variants });
const catalog = {
  source: { repo: 'test', commit: '0'.repeat(40) },
  items: [
    item('A', 151, 'Housewares', [variant('Red', ['Red', 'Red']), variant('Blue', ['Blue', 'Blue'])]),
    item('B', 103, 'Housewares'),
    item('F', 201, 'Floors'),
    item('W', 451, 'Wallpaper'),
    item('Z', 0, 'Housewares'),
  ],
  sets: {},
};

const houseWith = (aVariation?: string) => ({
  stage: 'house', season: 'summer',
  rooms: [
    {
      name: 'Main',
      wallpaper: { name: 'W' },
      flooring: { name: 'F' },
      items: [
        aVariation ? { name: 'A', variation: aVariation, quantity: 2, surface: 'floor' }
          : { name: 'A', quantity: 2, surface: 'floor' },
        { name: 'B', surface: 'wall' },
      ],
    },
    { name: 'Spare', items: [{ name: 'Z', surface: 'floor' }] },
  ],
});

test('one base line of 1,057 points with each contributing name once', () => {
  const r = score(houseWith() as any, catalog as any);
  const main = r.rooms[0];
  assert.equal(main.lines.length, 1);
  const line = main.lines[0];
  assert.equal(line.rule, 'base');
  assert.equal(line.points, 1057);
  assert.equal(typeof line.detail, 'string');
  assert.ok(line.detail.length > 0, 'detail is non-empty');
  assert.deepEqual([...line.items].sort(), ['A', 'B', 'F', 'W']);
  assert.equal(main.total, 1057);
  assert.equal(r.total, 1057);
});

test('a room holding only a 0-point item has no lines', () => {
  const r = score(houseWith() as any, catalog as any);
  assert.equal(r.rooms[1].name, 'Spare');
  assert.deepEqual(r.rooms[1].lines, []);
  assert.equal(r.rooms[1].total, 0);
});

test('a different variant of A scores the same base points', () => {
  const r = score(houseWith('Blue') as any, catalog as any);
  assert.equal(r.rooms[0].lines[0].points, 1057);
  assert.equal(r.total, 1057);
});
