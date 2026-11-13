import { describe, expect, it } from 'vitest';
import {
  STORAGE_KEY,
  exportFileName,
  loadState,
  parse,
  saveState,
  serialize,
} from '../../src/app/persist.ts';
import { initialState } from '../../src/app/model.ts';
import { DEFAULT_OPTIONS } from '../../src/engine/score.ts';
import type { AppState } from '../../src/app/model.ts';

// The project's suite for persistence (DESIGN.md §10.4, §10.5). The frozen acceptance test
// covers the round trip and the named-field errors of the save format; this one covers the
// corners around them: the parts of the shape no acceptance case breaks, and what storage
// does when it misbehaves in other ways.

const twoRoomState = (): AppState => ({
  house: {
    stage: 'back',
    season: 'autumn',
    rooms: [
      {
        name: 'Main room',
        wallpaper: { name: 'blue wall', variation: 'Blue', pattern: null },
        flooring: null,
        items: [{ name: 'stool', quantity: 2, surface: 'floor', nearWall: 'none', facingWall: false }],
        droppedItems: 0,
        cockroaches: 0,
      },
      { name: 'Back room', items: [] },
    ],
  },
  options: { categoryBonus: 'per-category', fengShui: 'on', facingWallScope: 'any-tagged' },
});

/** A save file built from a good state, with one thing changed. */
const fileWith = (change: (file: Record<string, any>) => void): string => {
  const file = JSON.parse(serialize(twoRoomState()));
  change(file);
  return JSON.stringify(file);
};

const errorOf = (text: string): string => {
  const result = parse(text);
  expect(result.ok).toBe(false);
  return result.ok ? '' : result.error;
};

describe('serialize', () => {
  it('writes the keys in a fixed order, so the same state gives the same text', () => {
    expect(serialize(twoRoomState())).toBe(serialize(twoRoomState()));
    expect(serialize(initialState()).startsWith('{"format":"hha-calculator","version":1,')).toBe(true);
  });

  it('keeps an absent optional field absent, rather than writing a null', () => {
    const file = JSON.parse(serialize(initialState()));
    expect(Object.keys(file.house.rooms[0]).sort()).toEqual(['items', 'name']);
  });
});

describe('parse', () => {
  it('preserves which optional fields a room and an item carried', () => {
    const result = parse(serialize(twoRoomState()));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(Object.keys(result.state.house.rooms[1]!).sort()).toEqual(['items', 'name']);
    const [item] = result.state.house.rooms[0]!.items;
    expect(Object.keys(item!).sort()).toEqual(['facingWall', 'name', 'nearWall', 'quantity', 'surface']);
  });

  it('accepts a house whose rooms carry no optional fields at all', () => {
    const bare = {
      format: 'hha-calculator',
      version: 1,
      house: { stage: 'house', season: 'spring', rooms: [{ name: 'Main room', items: [] }] },
    };
    const result = parse(JSON.stringify(bare));
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.state).toEqual(initialState());
  });

  it('names the wallpaper, the flooring and their variant fields', () => {
    expect(errorOf(fileWith((f) => { f.house.rooms[0].wallpaper = 7; }))).toContain('wallpaper');
    expect(errorOf(fileWith((f) => { f.house.rooms[0].wallpaper.name = 7; }))).toContain('name');
    expect(errorOf(fileWith((f) => { f.house.rooms[0].wallpaper.variation = 7; }))).toContain('variation');
    expect(errorOf(fileWith((f) => { f.house.rooms[0].wallpaper.pattern = 7; }))).toContain('pattern');
    expect(errorOf(fileWith((f) => { f.house.rooms[0].flooring = 'wood'; }))).toContain('flooring');
  });

  it('treats a null wallpaper or flooring as "none chosen"', () => {
    const result = parse(fileWith((f) => { f.house.rooms[0].wallpaper = null; }));
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.state.house.rooms[0]!.wallpaper).toBe(null);
  });

  it('names rooms and items when they are not lists', () => {
    expect(errorOf(fileWith((f) => { f.house.rooms = {}; }))).toContain('rooms');
    expect(errorOf(fileWith((f) => { f.house.rooms[0].items = 'none'; }))).toContain('items');
  });

  it('rejects a non-object file, house, room or item, and a missing house', () => {
    expect(errorOf('[]')).toContain('object');
    expect(errorOf('42')).toContain('object');
    expect(errorOf(fileWith((f) => { delete f.house; }))).toContain('house');
    expect(errorOf(fileWith((f) => { f.house.rooms[1] = 'Back room'; }))).toContain('room 2');
    expect(errorOf(fileWith((f) => { f.house.rooms[0].items[0] = 'stool'; }))).toContain('item 1');
  });

  it('points at the room and the item that is wrong', () => {
    const error = errorOf(fileWith((f) => { f.house.rooms[0].items[0].surface = 'roof'; }));
    expect(error).toContain('room 1');
    expect(error).toContain('item 1');
  });

  it('rejects a quantity that is negative or not a number, as well as 0', () => {
    for (const bad of [0, -2, 1.5, '3', null]) {
      expect(errorOf(fileWith((f) => { f.house.rooms[0].items[0].quantity = bad; }))).toContain('quantity');
    }
  });

  it('rejects counts that are not whole numbers of zero or more', () => {
    for (const bad of [-1, 0.5, '2', true]) {
      expect(errorOf(fileWith((f) => { f.house.rooms[0].droppedItems = bad; }))).toContain('droppedItems');
      expect(errorOf(fileWith((f) => { f.house.rooms[0].cockroaches = bad; }))).toContain('cockroaches');
    }
  });

  it('fills in every missing option and names any unknown value', () => {
    const empty = parse(fileWith((f) => { f.options = {}; }));
    expect(empty.ok).toBe(true);
    if (empty.ok) expect(empty.state.options).toEqual(DEFAULT_OPTIONS);
    expect(errorOf(fileWith((f) => { f.options.fengShui = 'maybe'; }))).toContain('fengShui');
    expect(errorOf(fileWith((f) => { f.options.facingWallScope = 'all'; }))).toContain('facingWallScope');
    expect(errorOf(fileWith((f) => { f.options = 'defaults'; }))).toContain('options');
  });

  it('checks the stage before the room count, so one break is reported once', () => {
    const both = errorOf(fileWith((f) => { f.house.stage = 'mansion'; f.house.rooms.pop(); }));
    expect(both).toContain('stage');
    expect(both).not.toContain('rooms');
  });

  it('does not check item names against the catalog (§10.5)', () => {
    expect(parse(fileWith((f) => { f.house.rooms[0].items[0].name = 'no such item'; })).ok).toBe(true);
  });
});

/** `localStorage` as far as this module is concerned, plus the ways it can fail. */
function memoryStorage(initial: Record<string, string> = {}) {
  const data: Record<string, string> = { ...initial };
  return {
    data,
    getItem: (key: string) => (key in data ? data[key]! : null),
    setItem: (key: string, value: string) => { data[key] = value; },
  };
}

describe('loadState and saveState', () => {
  it('round-trips a state through storage under the one key', () => {
    const store = memoryStorage();
    expect(saveState(store, twoRoomState())).toBe(true);
    expect(Object.keys(store.data)).toEqual([STORAGE_KEY]);
    expect(loadState(store)).toEqual(twoRoomState());
  });

  it('ignores anything else in storage', () => {
    const store = memoryStorage({ 'other-app/state': 'junk' });
    expect(loadState(store)).toEqual(initialState());
  });

  it('falls back when the stored value is not a string at all', () => {
    const odd = { getItem: () => undefined as unknown as string | null, setItem: () => {} };
    expect(loadState(odd)).toEqual(initialState());
  });

  it('falls back on a file that parses as JSON but fails validation', () => {
    const store = memoryStorage({ [STORAGE_KEY]: '{"format":"hha-calculator","version":1}' });
    expect(loadState(store)).toEqual(initialState());
  });

  it('returns a fresh initial state each time it falls back', () => {
    const first = loadState(memoryStorage());
    first.house.rooms[0]!.name = 'Edited';
    expect(loadState(memoryStorage()).house.rooms[0]!.name).toBe('Main room');
  });
});

describe('exportFileName', () => {
  it('pads the month and the day', () => {
    expect(exportFileName(new Date(Date.UTC(2027, 0, 5)))).toBe('hha-house-2027-01-05.json');
    expect(exportFileName(new Date(Date.UTC(2026, 11, 31)))).toBe('hha-house-2026-12-31.json');
  });

  it('uses the UTC day, not the local one', () => {
    const lateInUtc = new Date(Date.UTC(2026, 10, 13, 23, 59, 59));
    const earlyInUtc = new Date(Date.UTC(2026, 10, 13, 0, 0, 0));
    expect(exportFileName(lateInUtc)).toBe('hha-house-2026-11-13.json');
    expect(exportFileName(earlyInUtc)).toBe('hha-house-2026-11-13.json');
  });
});
