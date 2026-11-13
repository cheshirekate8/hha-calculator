import { describe, expect, it } from 'vitest';
import { DEFAULT_OPTIONS, resolveOptions, score } from '../../src/engine/score.ts';
import { RULES } from '../../src/engine/rules.ts';
import type { Catalog, House, Result, Room } from '../../src/engine/types.ts';

// The project's own suite for the engine core (DESIGN.md §11): one fixture per rule, every
// assertion pinning a value chosen so a wrong reading gives a different number, and §2's
// sum invariant checked on every result.

const variant = (variation: string | null = null, pattern: string | null = null) => ({
  variation,
  pattern,
  colors: ['Gray', 'Gray'],
  concepts: [],
  category: null,
});

const item = (
  name: string,
  basePoints: number,
  sheet = 'Housewares',
  variants = [variant()],
) => ({
  name,
  sheet,
  basePoints,
  series: null,
  set: null,
  tag: null,
  interact: false,
  variants,
});

const catalog: Catalog = {
  source: { repo: 'test', commit: '0'.repeat(40) },
  items: [
    item('chair', 151, 'Housewares', [variant('Red', 'Plain'), variant('Blue', 'Plain')]),
    item('lamp', 103),
    item('simple flooring', 201, 'Floors'),
    item('simple wallpaper', 451, 'Wallpaper'),
    item('spoiled turnips', 0, 'Other'),
  ],
  sets: {},
};

const houseOf = (...rooms: Room[]): House => ({ stage: 'house', season: 'spring', rooms });

/** Scores a house and asserts §2.2 — the total is the sum of its lines — on the result. */
function scored(house: House, options?: Parameters<typeof score>[2]): Result {
  const result = score(house, catalog, options);
  const sumLines = (lines: { points: number }[]) =>
    lines.reduce((running, line) => running + line.points, 0);
  for (const room of result.rooms) expect(room.total).toBe(sumLines(room.lines));
  expect(result.house.total).toBe(sumLines(result.house.lines));
  expect(result.total).toBe(
    result.rooms.reduce((running, room) => running + room.total, 0) + result.house.total,
  );
  return result;
}

describe('RULES', () => {
  it('registers all 16 §6 rules with a source each', () => {
    expect(Object.keys(RULES)).toHaveLength(16);
    for (const [id, rule] of Object.entries(RULES)) {
      expect(rule.source, id).toContain('chibisnorlax');
      expect(rule.section, id).toMatch(/^6\.\d+$/);
    }
  });
});

describe('options', () => {
  it('merges a partial object over the defaults', () => {
    expect(resolveOptions()).toEqual(DEFAULT_OPTIONS);
    expect(resolveOptions({ fengShui: 'off' })).toEqual({ ...DEFAULT_OPTIONS, fengShui: 'off' });
    expect(resolveOptions({ categoryBonus: 'per-item' })).toEqual({
      ...DEFAULT_OPTIONS,
      categoryBonus: 'per-item',
    });
  });
});

describe('base points (§6.1)', () => {
  it('sums base points × quantity plus wallpaper and flooring', () => {
    const result = scored(
      houseOf({
        name: 'Main',
        wallpaper: { name: 'simple wallpaper' },
        flooring: { name: 'simple flooring' },
        items: [
          { name: 'chair', variation: 'Red', quantity: 2, surface: 'floor' },
          { name: 'lamp', surface: 'tabletop' },
        ],
      }),
    );
    // 151 × 2 + 103 + 451 + 201; ignoring quantity would give 906.
    expect(result.total).toBe(1057);
    expect(result.rooms[0]?.lines).toHaveLength(1);
    const line = result.rooms[0]?.lines[0];
    expect(line?.rule).toBe('base');
    expect(line?.detail).toBe('Base points for 3 placed pieces, wallpaper and flooring');
    expect(line?.items).toEqual(['chair', 'lamp', 'simple wallpaper', 'simple flooring']);
  });

  it('credits a name once however many copies are placed', () => {
    const result = scored(
      houseOf({ name: 'Main', items: [{ name: 'chair', quantity: 3, surface: 'floor' }] }),
    );
    expect(result.rooms[0]?.lines[0]?.points).toBe(453);
    expect(result.rooms[0]?.lines[0]?.items).toEqual(['chair']);
  });

  it('writes no line for a room that earns nothing', () => {
    const result = scored(
      houseOf(
        { name: 'Empty', items: [] },
        { name: 'Bin', items: [{ name: 'spoiled turnips', quantity: 4, surface: 'floor' }] },
      ),
    );
    expect(result.total).toBe(0);
    expect(result.rooms.map((room) => room.lines)).toEqual([[], []]);
  });

  it('scores each room on its own items, in input order', () => {
    const result = scored(
      houseOf(
        { name: 'North', items: [{ name: 'chair', quantity: 3, surface: 'floor' }] },
        {
          name: 'Middle',
          wallpaper: { name: 'simple wallpaper' },
          items: [{ name: 'lamp', quantity: 2, surface: 'tabletop' }],
        },
        { name: 'South', flooring: { name: 'simple flooring' }, items: [] },
      ),
    );
    expect(result.rooms.map((room) => [room.name, room.total])).toEqual([
      ['North', 453],
      ['Middle', 657],
      ['South', 201],
    ]);
    expect(result.total).toBe(1311);
  });
});

describe('input validation (§5.1)', () => {
  const failing = (room: Room) => () => score(houseOf(room), catalog);

  it('names an unknown item, wallpaper or flooring', () => {
    expect(failing({ name: 'Den', items: [{ name: 'throne', surface: 'floor' }] })).toThrow(
      /"throne"/,
    );
    expect(failing({ name: 'Den', items: [], wallpaper: { name: 'mural' } })).toThrow(/"mural"/);
    expect(failing({ name: 'Den', items: [], flooring: { name: 'lava' } })).toThrow(/"lava"/);
  });

  it('names an unmatched variation or pattern', () => {
    expect(
      failing({ name: 'Den', items: [{ name: 'chair', variation: 'Green', surface: 'floor' }] }),
    ).toThrow(/variation "Green"/);
    expect(
      failing({
        name: 'Den',
        items: [{ name: 'chair', variation: 'Red', pattern: 'Striped', surface: 'floor' }],
      }),
    ).toThrow(/pattern "Striped"/);
  });

  it('rejects a quantity that is not a positive integer', () => {
    for (const quantity of [0, -1, 1.5, Number.NaN]) {
      expect(
        failing({ name: 'Den', items: [{ name: 'chair', quantity, surface: 'floor' }] }),
        String(quantity),
      ).toThrow(/quantity/i);
    }
  });
});

describe('purity (§2.1)', () => {
  it('does not mutate a deep-frozen house and repeats its result', () => {
    const house = houseOf({
      name: 'Main',
      wallpaper: { name: 'simple wallpaper' },
      items: [{ name: 'chair', quantity: 2, surface: 'floor' }],
    });
    const freeze = (value: unknown): void => {
      if (value && typeof value === 'object' && !Object.isFrozen(value)) {
        Object.freeze(value);
        for (const nested of Object.values(value)) freeze(nested);
      }
    };
    freeze(house);
    freeze(catalog);
    expect(scored(house)).toEqual(scored(house));
    expect(scored(house).total).toBe(753);
  });
});
