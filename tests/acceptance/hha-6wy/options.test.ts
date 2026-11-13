// hha-6wy, criterion 2: DEFAULT_OPTIONS, and a partial options object is merged without
// changing a result no implemented rule makes option-dependent.
import test from 'node:test';
import assert from 'node:assert/strict';
import { score, DEFAULT_OPTIONS } from '../../../src/engine/score.ts';

const variant = (variation: string | null) =>
  ({ variation, pattern: null, colors: ['Gray', 'Gray'], concepts: [], category: null });
const item = (name: string, basePoints: number, sheet = 'Housewares') =>
  ({ name, sheet, basePoints, series: null, set: null, tag: null, interact: false, variants: [variant(null)] });
const catalog = {
  source: { repo: 'test', commit: '0'.repeat(40) },
  items: [item('A', 151), item('F', 201, 'Floors')],
  sets: {},
};
const house = {
  stage: 'house', season: 'spring',
  rooms: [{ name: 'Main', flooring: { name: 'F' }, items: [{ name: 'A', surface: 'floor' }] }],
};

test('DEFAULT_OPTIONS', () => {
  assert.deepEqual(DEFAULT_OPTIONS, {
    categoryBonus: 'per-category', fengShui: 'on', facingWallScope: 'any-tagged',
  });
});

test('empty and partial options give the same result as none', () => {
  const none = score(house as any, catalog as any);
  assert.equal(none.total, 352);
  assert.deepEqual(score(house as any, catalog as any, {} as any), none);
  assert.deepEqual(score(house as any, catalog as any, { fengShui: 'off' } as any), none);
});
