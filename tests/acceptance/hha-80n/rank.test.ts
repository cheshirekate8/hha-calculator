// hha-80n: rank and rewards (§5.1 Result.rank, §7). Every total comes from an inert
// fixture no scoring rule can touch: one room, one item named R, basePoints = N.
import test from 'node:test';
import assert from 'node:assert/strict';
import { score } from '../../../src/engine/score.ts';

const inertItem = (name: string, basePoints: number) => ({
  name, sheet: 'Housewares', basePoints, series: null, set: null, tag: null, interact: false,
  variants: [{ variation: null, pattern: null, colors: [], concepts: [], category: null }],
});
const catalogFor = (items: any[]) => ({
  source: { repo: 'test', commit: '0'.repeat(40) },
  items: [...items].sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0)),
  sets: {},
});
function inert(n: number, stage = 'house') {
  const house = { stage, season: 'spring', rooms: [{ name: 'Den', items: n === 0 ? [] : [{ name: 'R', surface: 'floor' }] }] };
  const r = score(house as any, catalogFor([inertItem('R', n)]) as any);
  assert.equal(r.total, n, `inert fixture total ${n}`);
  return r;
}

const STAGES: [string, number, number][] = [
  ['house', 10000, 15000], ['main-upgrade', 17000, 23000], ['back', 25000, 35000],
  ['left', 38000, 47000], ['right', 50000, 60000], ['second-floor', 64000, 75000], ['basement', 80000, 90000],
];

test('letter at every A and S boundary, each with its own stage', () => {
  for (const [stage, a, s] of STAGES) {
    for (const [n, letter] of [[a - 1, 'B'], [a, 'A'], [s - 1, 'A'], [s, 'S']] as [number, string][]) {
      const r = inert(n, stage);
      assert.equal(r.rank.stage, stage, `${stage} ${n}: stage`);
      assert.equal(r.rank.letter, letter, `${stage} ${n}: letter`);
    }
  }
});

const REWARDS: [number, string][] = [
  [10000, 'HHA pennant'], [20000, 'bronze HHA plaque'], [30000, 'silver HHA plaque'],
  [50000, 'gold HHA plaque'], [70000, 'bronze HHA trophy'], [100000, 'silver HHA trophy'],
  [150000, 'gold HHA trophy'],
];

test('every reward threshold T and T - 1', () => {
  REWARDS.forEach(([t, name], i) => {
    const at = inert(t);
    assert.equal(at.rank.reward, name, `${t}: reward`);
    const below = inert(t - 1);
    assert.equal(below.rank.reward, i === 0 ? null : REWARDS[i - 1][1], `${t - 1}: reward`);
    assert.deepEqual(below.rank.next, { reward: name, points: t, needed: 1 }, `${t - 1}: next`);
  });
});

test('zero, the top, and beyond', () => {
  const zero = inert(0);
  assert.equal(zero.rank.reward, null);
  assert.deepEqual(zero.rank.next, { reward: 'HHA pennant', points: 10000, needed: 10000 });
  for (const n of [150000, 200000]) {
    const r = inert(n);
    assert.equal(r.rank.reward, 'gold HHA trophy');
    assert.equal(r.rank.next, null);
  }
});

test('below zero', () => {
  const r = inert(-500);
  assert.equal(r.rank.letter, 'B');
  assert.equal(r.rank.reward, null);
  assert.deepEqual(r.rank.next, { reward: 'HHA pennant', points: 10000, needed: 10500 });
});

test('rank depends on total and stage alone', () => {
  const single = inert(42000, 'left');
  const house = {
    stage: 'left', season: 'winter',
    rooms: [{ name: 'One', items: [{ name: 'P', surface: 'floor' }] }, { name: 'Two', items: [{ name: 'Q', surface: 'floor' }] }],
  };
  const split = score(house as any, catalogFor([inertItem('P', 40000), inertItem('Q', 2000)]) as any);
  assert.equal(split.total, 42000);
  assert.deepEqual(split.rank, single.rank);
});

test('adding rank adds nothing else', () => {
  const r = inert(12345);
  assert.deepEqual(Object.keys(r).sort(), ['house', 'rank', 'rooms', 'total']);
  assert.equal(r.rooms[0].total, 12345);
  assert.deepEqual(r.house, { total: 0, lines: [] });
});
