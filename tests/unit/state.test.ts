import { describe, expect, it } from 'vitest';
import { reduce } from '../../src/app/state.ts';
import type { Action } from '../../src/app/state.ts';
import { DEFAULT_ROOM_NAMES, ROOMS_BY_STAGE, STAGES, initialState } from '../../src/app/model.ts';
import type { AppState } from '../../src/app/model.ts';
import type { PlacedItem } from '../../src/engine/types.ts';

// The project's suite for the reducer (DESIGN.md §10.5). The frozen acceptance test pins
// the behaviour the screens depend on; this suite covers the edges around it — every
// stage, structural sharing, and the addressing checks on inputs a stale click can
// produce (a fractional index, a room number past the end).

const chair: PlacedItem = { name: 'chair', surface: 'floor' };
const lamp: PlacedItem = { name: 'lamp', surface: 'tabletop', quantity: 2 };

/** A two-room house with one item in each, built only through the reducer. */
function twoRooms(): AppState {
  let s = reduce(initialState(), { type: 'setStage', stage: 'back' });
  s = reduce(s, { type: 'addItem', room: 0, item: chair });
  s = reduce(s, { type: 'addItem', room: 1, item: lamp });
  return s;
}

describe('setStage', () => {
  it('gives every stage its room count and default names', () => {
    for (const stage of STAGES) {
      const next = reduce(initialState(), { type: 'setStage', stage });
      expect(next.house.stage).toBe(stage);
      expect(next.house.rooms.map((r) => r.name)).toEqual(
        DEFAULT_ROOM_NAMES.slice(0, ROOMS_BY_STAGE[stage]),
      );
      expect(next.house.rooms.every((r) => r.items.length === 0)).toBe(true);
    }
  });

  it('round-trips down and back up, losing only the rooms that went away', () => {
    let s = reduce(initialState(), { type: 'setStage', stage: 'basement' });
    s = reduce(s, { type: 'addItem', room: 0, item: chair });
    s = reduce(s, { type: 'addItem', room: 5, item: lamp });
    const shrunk = reduce(s, { type: 'setStage', stage: 'house' });
    expect(shrunk.house.rooms).toHaveLength(1);
    expect(shrunk.house.rooms[0]?.items).toEqual([chair]);
    const regrown = reduce(shrunk, { type: 'setStage', stage: 'basement' });
    expect(regrown.house.rooms[0]?.items).toEqual([chair]);
    expect(regrown.house.rooms[5]).toEqual({ name: 'Basement', items: [] });
  });

  it('keeps a renamed room and its wallpaper when the count does not change', () => {
    let s = reduce(initialState(), { type: 'renameRoom', room: 0, name: 'Den' });
    s = reduce(s, { type: 'setWallpaper', room: 0, ref: { name: 'wall' } });
    const next = reduce(s, { type: 'setStage', stage: 'main-upgrade' });
    expect(next.house.rooms).toEqual(s.house.rooms);
    expect(next.house.stage).toBe('main-upgrade');
  });
});

describe('addressing', () => {
  const addressed = (room: number): Action[] => [
    { type: 'renameRoom', room, name: 'x' },
    { type: 'setWallpaper', room, ref: { name: 'w' } },
    { type: 'setFlooring', room, ref: null },
    { type: 'addItem', room, item: chair },
    { type: 'setDroppedItems', room, count: 1 },
    { type: 'setCockroaches', room, count: 1 },
    { type: 'updateItem', room, index: 0, patch: { quantity: 2 } },
    { type: 'removeItem', room, index: 0 },
  ];

  it('returns the same state for a room that is not a position in the house', () => {
    const s = twoRooms();
    for (const room of [-1, 2, 7, 0.5, Number.NaN, Number.POSITIVE_INFINITY]) {
      for (const action of addressed(room)) expect(reduce(s, action)).toBe(s);
    }
  });

  it('returns the same state for an item index that is not a position in the room', () => {
    const s = twoRooms();
    for (const index of [-1, 1, 0.5, Number.NaN]) {
      expect(reduce(s, { type: 'updateItem', room: 0, index, patch: { quantity: 2 } })).toBe(s);
      expect(reduce(s, { type: 'removeItem', room: 0, index })).toBe(s);
    }
  });

  it('ignores an action it does not know', () => {
    const s = twoRooms();
    expect(reduce(s, { type: 'nope' } as unknown as Action)).toBe(s);
  });

  it('empties a room one item at a time and then stops', () => {
    let s = reduce(twoRooms(), { type: 'addItem', room: 0, item: lamp });
    s = reduce(s, { type: 'removeItem', room: 0, index: 0 });
    expect(s.house.rooms[0]?.items).toEqual([lamp]);
    s = reduce(s, { type: 'removeItem', room: 0, index: 0 });
    expect(s.house.rooms[0]?.items).toEqual([]);
    expect(reduce(s, { type: 'removeItem', room: 0, index: 0 })).toBe(s);
  });
});

describe('purity and sharing', () => {
  it('leaves the previous state untouched and shares the rooms it did not edit', () => {
    const before = twoRooms();
    const snapshot = structuredClone(before);
    const after = reduce(before, { type: 'addItem', room: 1, item: chair });
    expect(before).toEqual(snapshot);
    expect(after).not.toBe(before);
    expect(after.house.rooms[0]).toBe(before.house.rooms[0]);
    expect(after.house.rooms[1]).not.toBe(before.house.rooms[1]);
    expect(after.options).toBe(before.options);
  });

  it('does not alias the item it is given or the array it copies', () => {
    const item: PlacedItem = { name: 'chair', surface: 'floor' };
    const s = reduce(initialState(), { type: 'addItem', room: 0, item });
    const patched = reduce(s, { type: 'updateItem', room: 0, index: 0, patch: { quantity: 3 } });
    expect(item).toEqual({ name: 'chair', surface: 'floor' });
    expect(s.house.rooms[0]?.items).toEqual([item]);
    expect(patched.house.rooms[0]?.items[0]).toEqual({ ...item, quantity: 3 });
  });
});

describe('scalar fields', () => {
  it('sets each option without disturbing the other two', () => {
    const start = initialState();
    let s = reduce(start, { type: 'setOption', option: 'categoryBonus', value: 'per-item' });
    s = reduce(s, { type: 'setOption', option: 'fengShui', value: 'off' });
    expect(s.options).toEqual({
      ...start.options,
      categoryBonus: 'per-item',
      fengShui: 'off',
    });
    expect(s.house).toBe(start.house);
  });

  it('passes values through without validating them, as the engine does that', () => {
    let s = reduce(initialState(), { type: 'setDroppedItems', room: 0, count: -3 });
    s = reduce(s, { type: 'updateItem', room: 0, index: 0, patch: { quantity: 0 } });
    expect(s.house.rooms[0]?.droppedItems).toBe(-3);
    s = reduce(s, { type: 'renameRoom', room: 0, name: '' });
    expect(s.house.rooms[0]?.name).toBe('');
  });

  it('replace hands back the state object it was given', () => {
    const other = initialState();
    expect(reduce(twoRooms(), { type: 'replace', state: other })).toBe(other);
  });
});
