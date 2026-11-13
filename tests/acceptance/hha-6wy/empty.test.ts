// hha-6wy, criterion 3: an empty house scores 0 with no lines, rooms in input order.
// Fields are checked one by one, never the whole result, so later rules may add fields.
import test from 'node:test';
import assert from 'node:assert/strict';
import { score } from '../../../src/engine/score.ts';

const catalog = {
  source: { repo: 'test', commit: '0'.repeat(40) },
  items: [{
    name: 'A', sheet: 'Housewares', basePoints: 151, series: null, set: null, tag: null, interact: false,
    variants: [{ variation: null, pattern: null, colors: ['Gray', 'Gray'], concepts: [], category: null }],
  }],
  sets: {},
};

test('a house with empty rooms scores 0 and has no lines', () => {
  const house = {
    stage: 'back', season: 'winter',
    rooms: [{ name: 'Living', items: [] }, { name: 'Bedroom', items: [] }, { name: 'Study', items: [] }],
  };
  const r = score(house as any, catalog as any);
  assert.equal(r.total, 0);
  assert.deepEqual(r.rooms.map((x: any) => x.name), ['Living', 'Bedroom', 'Study']);
  for (const room of r.rooms) {
    assert.equal(room.total, 0, `${room.name} total`);
    assert.deepEqual(room.lines, [], `${room.name} lines`);
  }
  assert.equal(r.house.total, 0);
  assert.deepEqual(r.house.lines, []);
});
