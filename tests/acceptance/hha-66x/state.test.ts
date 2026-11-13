// hha-66x: the app reducer (DESIGN.md §10.5).
import test from 'node:test';
import assert from 'node:assert/strict';
import { reduce } from '../../../src/app/state.ts';
import { initialState } from '../../../src/app/model.ts';

function deepFreeze<T>(o: T): T {
  if (o && typeof o === 'object' && !Object.isFrozen(o)) {
    Object.freeze(o);
    for (const v of Object.values(o as object)) deepFreeze(v);
  }
  return o;
}
const R = (state: any, action: any) => reduce(state, action);
const chair = { name: 'chair', surface: 'floor' };
const lamp = { name: 'lamp', surface: 'tabletop', quantity: 2 };
const rug = { name: 'rug', surface: 'floor', variation: 'Red' };

function denState() {
  let s: any = initialState();
  s = R(s, { type: 'renameRoom', room: 0, name: 'Den' });
  s = R(s, { type: 'addItem', room: 0, item: chair });
  return s;
}

test('setStage grows and shrinks the rooms, keeping contents', () => {
  const big = R(denState(), { type: 'setStage', stage: 'basement' });
  assert.equal(big.house.stage, 'basement');
  assert.deepEqual(big.house.rooms.map((r: any) => r.name),
    ['Den', 'Back room', 'Left room', 'Right room', 'Upstairs', 'Basement']);
  assert.deepEqual(big.house.rooms[0].items, [chair]);
  for (const room of big.house.rooms.slice(1)) assert.deepEqual(room.items, []);
  const back = R(big, { type: 'setStage', stage: 'back' });
  assert.equal(back.house.stage, 'back');
  assert.deepEqual(back.house.rooms.map((r: any) => r.name), ['Den', 'Back room']);
  assert.deepEqual(back.house.rooms[0].items, [chair]);
  let study = R(back, { type: 'renameRoom', room: 1, name: 'Study' });
  study = R(study, { type: 'addItem', room: 1, item: lamp });
  const left = R(study, { type: 'setStage', stage: 'left' });
  assert.deepEqual(left.house.rooms.map((r: any) => r.name), ['Den', 'Study', 'Left room']);
  assert.deepEqual(left.house.rooms[1].items, [lamp]);
  const main = R(back, { type: 'setStage', stage: 'main-upgrade' });
  assert.equal(main.house.stage, 'main-upgrade');
  assert.equal(main.house.rooms.length, 1);
});

test('addItem, updateItem and removeItem act on the named room only', () => {
  let s = R(denState(), { type: 'setStage', stage: 'back' });
  s = R(s, { type: 'addItem', room: 0, item: lamp });
  s = R(s, { type: 'addItem', room: 0, item: rug });
  s = R(s, { type: 'addItem', room: 1, item: chair });
  assert.deepEqual(s.house.rooms[0].items, [chair, lamp, rug]);
  const updated = R(s, { type: 'updateItem', room: 0, index: 1, patch: { quantity: 3, nearWall: 'east' } });
  assert.deepEqual(updated.house.rooms[0].items[1], { name: 'lamp', surface: 'tabletop', quantity: 3, nearWall: 'east' });
  assert.deepEqual(updated.house.rooms[0].items[0], chair);
  assert.deepEqual(updated.house.rooms[1].items, [chair]);
  const removed = R(s, { type: 'removeItem', room: 0, index: 1 });
  assert.deepEqual(removed.house.rooms[0].items, [chair, rug]);
  assert.deepEqual(removed.house.rooms[1].items, [chair]);
  let two = R(s, { type: 'addItem', room: 1, item: rug });
  two = R(two, { type: 'updateItem', room: 1, index: 1, patch: { quantity: 4 } });
  assert.deepEqual(two.house.rooms[1].items, [chair, { ...rug, quantity: 4 }]);
  assert.deepEqual(two.house.rooms[0].items, [chair, lamp, rug]);
  const less = R(two, { type: 'removeItem', room: 1, index: 0 });
  assert.deepEqual(less.house.rooms[1].items, [{ ...rug, quantity: 4 }]);
  assert.deepEqual(less.house.rooms[0].items, [chair, lamp, rug]);
});

test('room fields, season, options and replace', () => {
  let s = R(denState(), { type: 'setStage', stage: 'back' });
  s = R(s, { type: 'setWallpaper', room: 1, ref: { name: 'wall', variation: 'Blue' } });
  s = R(s, { type: 'setFlooring', room: 1, ref: { name: 'floor' } });
  s = R(s, { type: 'setDroppedItems', room: 1, count: 4 });
  s = R(s, { type: 'setCockroaches', room: 1, count: 2 });
  s = R(s, { type: 'renameRoom', room: 1, name: 'Study' });
  const room = s.house.rooms[1];
  assert.deepEqual(room.wallpaper, { name: 'wall', variation: 'Blue' });
  assert.deepEqual(room.flooring, { name: 'floor' });
  assert.equal(room.droppedItems, 4);
  assert.equal(room.cockroaches, 2);
  assert.equal(room.name, 'Study');
  const first = s.house.rooms[0];
  assert.equal(first.name, 'Den');
  assert.ok(!first.wallpaper && !first.flooring && !first.droppedItems && !first.cockroaches, 'room 0 untouched');
  s = R(s, { type: 'setWallpaper', room: 1, ref: null });
  s = R(s, { type: 'setFlooring', room: 1, ref: null });
  assert.equal(s.house.rooms[1].wallpaper ?? null, null);
  assert.equal(s.house.rooms[1].flooring ?? null, null);
  s = R(s, { type: 'setSeason', season: 'autumn' });
  assert.equal(s.house.season, 'autumn');
  s = R(s, { type: 'setOption', option: 'fengShui', value: 'off' });
  assert.deepEqual(s.options, { categoryBonus: 'per-category', fengShui: 'off', facingWallScope: 'any-tagged' });
  const other = initialState();
  assert.equal(R(s, { type: 'replace', state: other }), other);
});

test('a room or item that does not exist returns the same state object', () => {
  const s = R(denState(), { type: 'setStage', stage: 'back' });
  const roomActions = (room: number) => [
    { type: 'renameRoom', room, name: 'x' }, { type: 'setWallpaper', room, ref: { name: 'w' } },
    { type: 'setFlooring', room, ref: { name: 'f' } }, { type: 'addItem', room, item: chair },
    { type: 'setDroppedItems', room, count: 1 }, { type: 'setCockroaches', room, count: 1 },
    { type: 'updateItem', room, index: 0, patch: { quantity: 2 } }, { type: 'removeItem', room, index: 0 },
  ];
  for (const room of [-1, 2]) for (const a of roomActions(room)) assert.equal(R(s, a), s, `${a.type} room ${room}`);
  for (const index of [-1, 1]) {
    assert.equal(R(s, { type: 'updateItem', room: 0, index, patch: { quantity: 2 } }), s, `updateItem index ${index}`);
    assert.equal(R(s, { type: 'removeItem', room: 0, index }), s, `removeItem index ${index}`);
  }
});

test('every action leaves a deep-frozen input unchanged', () => {
  const base = R(denState(), { type: 'setStage', stage: 'back' });
  const snapshot = JSON.stringify(base);
  deepFreeze(base);
  const actions = [
    { type: 'setStage', stage: 'basement' }, { type: 'setStage', stage: 'house' },
    { type: 'setSeason', season: 'winter' }, { type: 'setOption', option: 'categoryBonus', value: 'per-item' },
    { type: 'renameRoom', room: 1, name: 'Study' }, { type: 'setWallpaper', room: 0, ref: { name: 'w' } },
    { type: 'setFlooring', room: 0, ref: null }, { type: 'addItem', room: 1, item: lamp },
    { type: 'updateItem', room: 0, index: 0, patch: { facingWall: true } }, { type: 'removeItem', room: 0, index: 0 },
    { type: 'setDroppedItems', room: 0, count: 3 }, { type: 'setCockroaches', room: 0, count: 1 },
    { type: 'replace', state: initialState() },
  ];
  for (const a of actions) assert.doesNotThrow(() => R(base, a), a.type);
  assert.equal(JSON.stringify(base), snapshot);
});
