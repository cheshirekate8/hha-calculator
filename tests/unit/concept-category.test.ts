import { describe, expect, it } from 'vitest';
import { score } from '../../src/engine/score.ts';
import type { Catalog, CatalogVariant, House, Line, Options, Room } from '../../src/engine/types.ts';

// The project's own suite for concept (§6.6) and category (§6.7) with the `categoryBonus`
// option (§8). Each case pins a value chosen so a wrong reading gives a different number,
// and reads only its own rule's lines: other rules score the same fixtures.

const variant = (over: Partial<CatalogVariant> = {}): CatalogVariant => ({
  variation: null,
  pattern: null,
  colors: [],
  concepts: [],
  category: null,
  ...over,
});

const item = (name: string, variants = [variant()], sheet = 'Housewares') => ({
  name,
  sheet,
  basePoints: 0,
  series: null,
  set: null,
  tag: null,
  interact: false,
  variants,
});

const concepted = (name: string, concepts: string[]) =>
  item(name, [variant({ concepts })]);
const categorised = (name: string, category: string | null) =>
  item(name, [variant({ category })]);

const catalog: Catalog = {
  source: { repo: 'test', commit: '0'.repeat(40) },
  items: [
    ...['fancy 1', 'fancy 2', 'fancy 3', 'fancy 4', 'fancy 5'].map((n) => concepted(n, ['fancy'])),
    ...['garden 1', 'garden 2', 'garden 3', 'garden 4', 'garden 5'].map((n) =>
      concepted(n, ['garden']),
    ),
    concepted('both', ['fancy', 'garden']),
    concepted('garden rug', ['garden']),
    item('garden floor', [variant({ concepts: ['garden'] })], 'Floors'),
    item('garden wall', [variant({ concepts: ['garden'] })], 'Wallpaper'),
    item('plant floor', [variant({ category: 'Plant' })], 'Floors'),
    item('dual', [
      variant({ variation: 'Lit', category: 'Lighting', concepts: ['fancy'] }),
      variant({ variation: 'Potted', category: 'Plant', concepts: ['garden'] }),
    ]),
    ...['light 1', 'light 2', 'light 3'].map((n) => categorised(n, 'Lighting')),
    ...['plant 1', 'plant 2', 'plant 3', 'plant 4'].map((n) => categorised(n, 'Plant')),
    ...['plain 1', 'plain 2', 'plain 3'].map((n) => categorised(n, null)),
  ].sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0)),
  sets: {},
};

type Placement = { name: string; variation?: string; quantity?: number };

const place = (name: string, over: Omit<Placement, 'name'> = {}) =>
  ({ name, surface: 'floor', ...over }) as Room['items'][number];

function lines(
  items: Room['items'],
  rest: Partial<Room> = {},
  options?: Partial<Options>,
): Line[] {
  const house: House = {
    stage: 'house',
    season: 'spring',
    rooms: [{ name: 'Den', items, ...rest }],
  };
  return score(house, catalog, options).rooms[0].lines;
}

const of = (ls: Line[], rule: string): Line[] => ls.filter((line) => line.rule === rule);

function only(ls: Line[], rule: string): Line {
  const found = of(ls, rule);
  expect(found).toHaveLength(1);
  expect(found[0].detail.length).toBeGreaterThan(0);
  return found[0];
}

const names = (prefix: string, n: number) =>
  Array.from({ length: n }, (_, i) => `${prefix} ${i + 1}`);

describe('concept (§6.6)', () => {
  it('needs 5 items, duplicates included', () => {
    expect(of(lines(names('garden', 4).map((n) => place(n))), 'concept')).toHaveLength(0);
    const four = [place('garden 1', { quantity: 2 }), place('garden 2', { quantity: 2 })];
    expect(of(lines(four), 'concept')).toHaveLength(0);
    expect(only(lines([...four, place('garden 3')]), 'concept').points).toBe(2000);
  });

  it('scores 400 × the winning count, duplicates included', () => {
    const line = only(lines([place('garden 1', { quantity: 6 }), place('garden 2')]), 'concept');
    expect(line.points).toBe(2800);
    expect(line.items).toEqual(['garden 1', 'garden 2']);
  });

  it('counts an item toward each concept its variant lists', () => {
    // garden: 5 (4 + `both`), fancy: 6 (5 + `both`), so fancy wins on count, not on the tie.
    const line = only(
      lines([...names('garden', 4), ...names('fancy', 5), 'both'].map((n) => place(n))),
      'concept',
    );
    expect(line.points).toBe(2400);
    expect(line.items).toEqual([...names('fancy', 5), 'both']);
  });

  it('breaks a tie on the concept name, not on placement order', () => {
    const garden = names('garden', 5).map((n) => place(n));
    const fancy = names('fancy', 5).map((n) => place(n));
    for (const items of [[...garden, ...fancy], [...fancy, ...garden]]) {
      const line = only(lines(items), 'concept');
      expect(line.points).toBe(2000);
      expect(line.items).toEqual(names('fancy', 5));
    }
  });

  it('counts wallpaper and flooring once each, never by quantity', () => {
    const three = names('garden', 3).map((n) => place(n));
    const line = only(
      lines(three, { wallpaper: { name: 'garden wall' }, flooring: { name: 'garden floor' } }),
      'concept',
    );
    expect(line.points).toBe(2000);
    expect(line.items).toEqual([...names('garden', 3), 'garden wall', 'garden floor']);
  });

  it('reads the placed variant, not the first one', () => {
    const four = names('garden', 4).map((n) => place(n));
    // `dual`'s first variant is fancy; placed as Potted it is garden, which completes 5.
    expect(of(lines([...four, place('dual', { variation: 'Lit' })]), 'concept')).toHaveLength(0);
    const line = only(lines([...four, place('dual', { variation: 'Potted' })]), 'concept');
    expect(line.points).toBe(2000);
    expect(line.items).toEqual([...names('garden', 4), 'dual']);
  });
});

describe('category (§6.7)', () => {
  it('needs 3 unique names, so neither quantity nor a second variant qualifies one', () => {
    expect(
      of(lines([place('light 1', { quantity: 9 }), place('light 2')]), 'category'),
    ).toHaveLength(0);
    expect(
      of(
        lines([
          place('light 1'),
          place('dual', { variation: 'Lit' }),
          place('dual', { variation: 'Lit', quantity: 4 }),
        ]),
        'category',
      ),
    ).toHaveLength(0);
    const line = only(lines(names('light', 3).map((n) => place(n))), 'category');
    expect(line.points).toBe(500);
    expect(line.items).toEqual(names('light', 3));
  });

  it('ignores a null category however many items share it', () => {
    expect(of(lines(names('plain', 3).map((n) => place(n))), 'category')).toHaveLength(0);
  });

  it('credits only the qualifying categories', () => {
    const line = only(
      lines([...names('light', 3), ...names('plant', 2)].map((n) => place(n))),
      'category',
    );
    expect(line.points).toBe(500);
    expect(line.items).toEqual(names('light', 3));
  });

  it('counts flooring as a unique item of its category', () => {
    const two = names('plant', 2).map((n) => place(n));
    expect(of(lines(two), 'category')).toHaveLength(0);
    const line = only(lines(two, { flooring: { name: 'plant floor' } }), 'category');
    expect(line.points).toBe(500);
    expect(line.items).toEqual([...names('plant', 2), 'plant floor']);
  });

  it('adds 500 per qualifying category by default', () => {
    const line = only(
      lines([...names('light', 3), ...names('plant', 4)].map((n) => place(n))),
      'category',
    );
    expect(line.points).toBe(1000);
    expect(line.items).toEqual([...names('light', 3), ...names('plant', 4)]);
  });

  it('adds 500 × unique items per qualifying category under per-item', () => {
    const items = [...names('light', 3), ...names('plant', 4)].map((n) => place(n));
    expect(only(lines(items, {}, { categoryBonus: 'per-item' }), 'category').points).toBe(3500);
    // One qualifying category alone: 500 × 4, not 500 × every unique item in the room.
    const one = [...names('plant', 4), 'light 1'].map((n) => place(n));
    expect(only(lines(one, {}, { categoryBonus: 'per-item' }), 'category').points).toBe(2000);
  });

  it('credits an item once when its variants qualify in two categories', () => {
    const items = [
      place('light 1'),
      place('light 2'),
      place('dual', { variation: 'Lit' }),
      place('dual', { variation: 'Potted' }),
      place('plant 1'),
      place('plant 2'),
    ];
    const line = only(lines(items), 'category');
    expect(line.points).toBe(1000);
    expect(line.items).toEqual(['light 1', 'light 2', 'dual', 'plant 1', 'plant 2']);
    expect(only(lines(items, {}, { categoryBonus: 'per-item' }), 'category').points).toBe(3000);
  });
});

describe('both rules stay pure (§2.1)', () => {
  it('scores a deep-frozen house twice to the same lines', () => {
    const items = [
      ...names('garden', 5).map((n) => place(n)),
      ...names('light', 3).map((n) => place(n)),
    ];
    const house: House = {
      stage: 'house',
      season: 'spring',
      rooms: [{ name: 'Den', items, flooring: { name: 'garden floor' } }],
    };
    const frozen = freeze(house);
    const first = score(frozen, catalog).rooms[0].lines;
    const second = score(frozen, catalog).rooms[0].lines;
    expect(of(first, 'concept')).toEqual(of(second, 'concept'));
    expect(of(first, 'category')).toEqual(of(second, 'category'));
    expect(only(first, 'concept').points).toBe(2400);
    expect(only(first, 'category').points).toBe(500);
  });
});

function freeze<T>(value: T): T {
  if (value && typeof value === 'object') {
    for (const inner of Object.values(value)) freeze(inner);
    Object.freeze(value);
  }
  return value;
}
