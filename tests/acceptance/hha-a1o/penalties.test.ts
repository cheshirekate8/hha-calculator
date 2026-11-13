// hha-a1o: trash (§6.13), facing a wall (§6.14), dropped items (§6.15) and cockroaches
// (§6.16). Only penalty lines are inspected, so other rules may add lines once merged.
import test from 'node:test';
import assert from 'node:assert/strict';
import { score } from '../../../src/engine/score.ts';

const v = (o: any = {}) => ({ variation: null, pattern: null, colors: [], concepts: [], category: null, ...o });
const item = (name: string, o: any = {}) =>
  ({ name, sheet: 'Housewares', basePoints: 0, series: null, set: null, tag: null, interact: false, variants: [v()], ...o });
const cat = {
  source: { repo: 'test', commit: '0'.repeat(40) },
  items: [
    item('X'), item('Y'), item('Z'),
    item('boot', { sheet: 'Other' }), item('empty can', { sheet: 'Other' }),
    item('garbage can', { variants: [v({ category: 'Trash' })] }),
    item('odd thing', { sheet: 'Other' }),
  ].sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0)),
  sets: {},
};
const place = (name: string, o: any = {}) => ({ name, surface: 'floor', ...o });
const run = (items: any[], extra: any = {}) =>
  score({ stage: 'house', season: 'spring', rooms: [{ name: 'Den', items, ...extra }] } as any, cat as any);
function one(lines: any[], rule: string, points: number, items?: string[]) {
  const ls = lines.filter((l) => l.rule === rule);
  assert.equal(ls.length, 1, `exactly one ${rule} line`);
  assert.equal(ls[0].points, points, `${rule} points`);
  assert.ok(typeof ls[0].detail === 'string' && ls[0].detail.length > 0, 'non-empty detail');
  if (items) assert.deepEqual([...ls[0].items].sort(), [...items].sort(), `${rule} items`);
}
const none = (lines: any[], rule: string) =>
  assert.equal(lines.filter((l) => l.rule === rule).length, 0, `no ${rule} line`);

test('trash is recognised by name from trash.json', () => {
  one(run([place('boot', { quantity: 2 }), place('empty can')]).rooms[0].lines, 'trash', -1500, ['boot', 'empty can']);
  none(run([place('garbage can')]).rooms[0].lines, 'trash');
  none(run([place('odd thing')]).rooms[0].lines, 'trash');
});

test('facing a wall: -300 per item, with quantity', () => {
  one(run([place('X', { facingWall: true, quantity: 2 }), place('Y', { facingWall: true })]).rooms[0].lines, 'facing-wall', -900, ['X', 'Y']);
  none(run([place('X', { facingWall: false }), place('Z')]).rooms[0].lines, 'facing-wall');
});

test('dropped items and cockroaches', () => {
  one(run([], { droppedItems: 7 }).rooms[0].lines, 'dropped', -7);
  one(run([], { cockroaches: 2 }).rooms[0].lines, 'cockroach', -5000);
  for (const extra of [{}, { droppedItems: 0, cockroaches: 0 }]) {
    const lines = run([], extra).rooms[0].lines;
    none(lines, 'dropped');
    none(lines, 'cockroach');
  }
});

function throwsNaming(extra: object, field: string, other: string) {
  assert.throws(() => run([], extra), (e: unknown) => {
    assert.ok(e instanceof Error, 'throws an Error');
    assert.ok(e.message.includes(field), `message ${JSON.stringify(e.message)} names ${field}`);
    assert.ok(!e.message.includes(other), `message ${JSON.stringify(e.message)} does not name ${other}`);
    return true;
  });
}

test('invalid droppedItems and cockroaches throw, naming only their field', () => {
  throwsNaming({ droppedItems: -1 }, 'droppedItems', 'cockroaches');
  throwsNaming({ droppedItems: 1.5 }, 'droppedItems', 'cockroaches');
  throwsNaming({ cockroaches: -2 }, 'cockroaches', 'droppedItems');
  throwsNaming({ cockroaches: 0.5 }, 'cockroaches', 'droppedItems');
});
