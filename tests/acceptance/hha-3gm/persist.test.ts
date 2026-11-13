// hha-3gm: persistence — save format, validation, storage, export file name (§10.5).
import test from 'node:test';
import assert from 'node:assert/strict';
import { serialize, parse, loadState, saveState, exportFileName, STORAGE_KEY } from '../../../src/app/persist.ts';
import { initialState } from '../../../src/app/model.ts';
import { DEFAULT_OPTIONS } from '../../../src/engine/score.ts';

const richState = () => ({
  house: {
    stage: 'basement', season: 'winter',
    rooms: ['Den', 'Back room', 'Left room', 'Right room', 'Upstairs', 'Basement'].map((name, i) => ({
      name,
      wallpaper: i === 0 ? { name: 'wall', variation: 'Blue', pattern: null } : null,
      flooring: i === 1 ? { name: 'floor' } : null,
      items: i === 0 ? [
        { name: 'chair', variation: 'Red', pattern: 'Striped', quantity: 3, surface: 'floor', nearWall: 'east', facingWall: true },
        { name: 'lamp', surface: 'tabletop' },
      ] : [],
      droppedItems: i,
      cockroaches: i === 5 ? 2 : 0,
    })),
  },
  options: { categoryBonus: 'per-item', fengShui: 'off', facingWallScope: 'any-tagged' },
});
const fileOf = (state: any, over: (f: any) => void = () => {}) => {
  const f = JSON.parse(serialize(state as any));
  over(f);
  return JSON.stringify(f);
};

test('serialize writes the file format, and parse round-trips it', () => {
  const top = JSON.parse(serialize(initialState()));
  assert.deepEqual(Object.keys(top).sort(), ['format', 'house', 'options', 'version']);
  assert.equal(top.format, 'hha-calculator');
  assert.equal(top.version, 1);
  for (const s of [initialState(), richState()]) {
    const r: any = parse(serialize(s as any));
    assert.equal(r.ok, true, JSON.stringify(r));
    assert.deepEqual(r.state, s);
  }
});

const CASES: [string, string, (f: any) => void][] = [
  ['JSON', 'not json', () => {}],
  ['format', '', (f) => { f.format = 'something-else'; }],
  ['version', '', (f) => { f.version = 2; }],
  ['stage', '', (f) => { f.house.stage = 'mansion'; }],
  ['season', '', (f) => { f.house.season = 'monsoon'; }],
  ['rooms', '', (f) => { f.house.rooms.pop(); }],
  ['name', '', (f) => { delete f.house.rooms[2].name; }],
  ['surface', '', (f) => { f.house.rooms[0].items[0].surface = 'roof'; }],
  ['quantity', '', (f) => { f.house.rooms[0].items[0].quantity = 0; }],
  ['quantity', '', (f) => { f.house.rooms[0].items[0].quantity = 1.5; }],
  ['nearWall', '', (f) => { f.house.rooms[0].items[0].nearWall = 'up'; }],
  ['facingWall', '', (f) => { f.house.rooms[0].items[0].facingWall = 'yes'; }],
  ['droppedItems', '', (f) => { f.house.rooms[1].droppedItems = -1; }],
  ['cockroaches', '', (f) => { f.house.rooms[1].cockroaches = 1.5; }],
  ['categoryBonus', '', (f) => { f.options.categoryBonus = 'per-room'; }],
];

for (const [field, raw, mutate] of CASES) {
  test(`parse rejects a bad ${field}, naming it`, () => {
    const text = raw || fileOf(richState(), mutate);
    const r: any = parse(text);
    assert.equal(r.ok, false);
    assert.equal(typeof r.error, 'string');
    assert.ok(r.error.includes(field), `error ${JSON.stringify(r.error)} names ${field}`);
    if (field === 'stage' || field === 'season') {
      assert.ok(!r.error.includes('rooms'), `error ${JSON.stringify(r.error)} must not blame rooms`);
    }
  });
}

test('options are optional in a file', () => {
  const none: any = parse(fileOf(initialState(), (f) => { delete f.options; }));
  assert.equal(none.ok, true);
  assert.deepEqual(none.state.options, DEFAULT_OPTIONS);
  const partial: any = parse(fileOf(initialState(), (f) => { f.options = { fengShui: 'off' }; }));
  assert.equal(partial.ok, true);
  assert.deepEqual(partial.state.options, { ...DEFAULT_OPTIONS, fengShui: 'off' });
});

function memoryStorage(initial: Record<string, string> = {}) {
  const data: Record<string, string> = { ...initial };
  return { data, getItem: (k: string) => (k in data ? data[k] : null), setItem: (k: string, v: string) => { data[k] = v; } };
}

test('loadState falls back to the initial state, otherwise returns the saved one', () => {
  assert.equal(STORAGE_KEY, 'hha-calculator/state');
  assert.deepEqual(loadState(memoryStorage() as any), initialState());
  assert.deepEqual(loadState(memoryStorage({ [STORAGE_KEY]: '{broken' }) as any), initialState());
  const v2 = JSON.parse(serialize(richState() as any));
  v2.version = 2;
  assert.deepEqual(loadState(memoryStorage({ [STORAGE_KEY]: JSON.stringify(v2) }) as any), initialState());
  const throwing = { getItem: () => { throw new Error('blocked'); }, setItem: () => {} };
  assert.deepEqual(loadState(throwing as any), initialState());
  assert.deepEqual(loadState(memoryStorage({ [STORAGE_KEY]: serialize(richState() as any) }) as any), richState());
});

test('saveState writes under the key, or reports failure', () => {
  const store = memoryStorage();
  assert.equal(saveState(store as any, richState() as any), true);
  assert.equal(store.data[STORAGE_KEY], serialize(richState() as any));
  const full = { getItem: () => null, setItem: () => { throw new Error('quota'); } };
  assert.equal(saveState(full as any, richState() as any), false);
});

test('exportFileName uses the UTC date, even ahead of UTC', () => {
  const saved = process.env.TZ;
  process.env.TZ = 'Asia/Tokyo';
  try {
    const late = new Date(Date.UTC(2026, 10, 13, 23, 30));
    assert.equal(late.getDate(), 14, 'the time zone took effect');
    assert.equal(exportFileName(late), 'hha-house-2026-11-13.json');
    assert.equal(exportFileName(new Date(Date.UTC(2027, 0, 5, 0, 0))), 'hha-house-2027-01-05.json');
  } finally {
    if (saved === undefined) delete process.env.TZ; else process.env.TZ = saved;
  }
});

function deepFreeze<T>(o: T): T {
  if (o && typeof o === 'object' && !Object.isFrozen(o)) {
    Object.freeze(o);
    for (const v of Object.values(o as object)) deepFreeze(v);
  }
  return o;
}

test('serialize, saveState and parse do not mutate their input', () => {
  const s = deepFreeze(richState());
  const text = serialize(s as any);
  assert.equal(saveState(memoryStorage() as any, s as any), true);
  const r: any = parse(deepFreeze(text) as any);
  assert.equal(r.ok, true);
  assert.deepEqual(JSON.parse(text).house, richState().house);
});
