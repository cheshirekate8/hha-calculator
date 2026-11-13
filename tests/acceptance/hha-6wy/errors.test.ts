// hha-6wy, criterion 6: bad references and quantities are errors that name the value,
// never a silent zero. Room names carry no digits so a room index cannot satisfy a check.
import test from 'node:test';
import assert from 'node:assert/strict';
import { score } from '../../../src/engine/score.ts';

const variant = (variation: string | null, pattern: string | null) =>
  ({ variation, pattern, colors: ['Gray', 'Gray'], concepts: [], category: null });
const item = (name: string, sheet: string, variants = [variant(null, null)]) =>
  ({ name, sheet, basePoints: 100, series: null, set: null, tag: null, interact: false, variants });
const catalog = {
  source: { repo: 'test', commit: '0'.repeat(40) },
  items: [
    item('A', 'Housewares', [variant('Red', 'Plain'), variant('Blue', 'Plain')]),
    item('F', 'Floors'),
    item('W', 'Wallpaper'),
  ],
  sets: {},
};
const houseWithRoom = (room: object) => ({ stage: 'house', season: 'spring', rooms: [{ name: 'Den', items: [], ...room }] });

function throwsMentioning(house: object, ...needles: (string | RegExp)[]) {
  assert.throws(() => score(house as any, catalog as any), (e: unknown) => {
    assert.ok(e instanceof Error, 'throws an Error');
    for (const n of needles) {
      const ok = typeof n === 'string' ? e.message.includes(n) : n.test(e.message);
      assert.ok(ok, `message ${JSON.stringify(e.message)} mentions ${n}`);
    }
    return true;
  });
}

test('unknown placed item name', () => {
  throwsMentioning(houseWithRoom({ items: [{ name: 'Nonexistent sofa', surface: 'floor' }] }), 'Nonexistent sofa');
});

test('unknown wallpaper name', () => {
  throwsMentioning(houseWithRoom({ wallpaper: { name: 'Mystery wall' } }), 'Mystery wall');
});

test('unknown flooring name', () => {
  throwsMentioning(houseWithRoom({ flooring: { name: 'Mystery floor' } }), 'Mystery floor');
});

test('a variation the item does not have', () => {
  throwsMentioning(houseWithRoom({ items: [{ name: 'A', variation: 'Green', surface: 'floor' }] }), 'Green');
});

test('an existing variation with a pattern it does not have', () => {
  throwsMentioning(houseWithRoom({ items: [{ name: 'A', variation: 'Red', pattern: 'Striped', surface: 'floor' }] }), 'Striped');
});

for (const q of [0, -1, 1.5]) {
  test(`quantity ${String(q)}`, () => {
    throwsMentioning(houseWithRoom({ items: [{ name: 'A', quantity: q, surface: 'floor' }] }), /quantity/i, String(q));
  });
}
