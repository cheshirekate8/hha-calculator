import { describe, expect, it } from 'vitest';
import { score } from '../../src/engine/score.ts';
import type { Catalog, CatalogVariant, House, PlacedItem, Room } from '../../src/engine/types.ts';

// The project's suite for the three house rules (DESIGN.md §11): lucky (§6.10), seasonal
// (§6.11) and type (§6.12). Each test reads only its own rule's lines, so the other rules
// are free to add lines to the same fixtures. Numbers are picked so a wrong reading — a
// per-copy award, a season ignored, a tag matched loosely — gives a different one.

const variant = (over: Partial<CatalogVariant> = {}): CatalogVariant => ({
  variation: null,
  pattern: null,
  colors: [],
  concepts: [],
  category: null,
  ...over,
});

const item = (name: string, over: Record<string, unknown> = {}) => ({
  name,
  sheet: 'Housewares',
  basePoints: 0,
  series: null,
  set: null,
  tag: null,
  interact: false as string | boolean | null,
  variants: [variant()],
  ...over,
});

const catalogOf = (items: ReturnType<typeof item>[]): Catalog => ({
  source: { repo: 'test', commit: '0'.repeat(40) },
  items: [...items].sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0)),
  sets: {},
});

const place = (name: string, over: Partial<PlacedItem> = {}): PlacedItem => ({
  name,
  surface: 'floor',
  ...over,
});

const houseOf = (rooms: PlacedItem[][], season: House['season'] = 'spring'): House => ({
  stage: 'right',
  season,
  rooms: rooms.map((items, index): Room => ({ name: `Room ${String(index + 1)}`, items })),
});

/** The house-scope lines one rule produced, which is where all three belong (§6.10–6.12). */
function linesFor(rule: string, house: House, catalog: Catalog) {
  const result = score(house, catalog);
  for (const room of result.rooms) {
    expect(room.lines.filter((line) => line.rule === rule)).toEqual([]);
  }
  return result.house.lines.filter((line) => line.rule === rule);
}

/** Asserts the one line a house rule may add, with its points and the names it credits. */
function expectOne(
  rule: string,
  house: House,
  catalog: Catalog,
  points: number,
  items: string[],
): void {
  const lines = linesFor(rule, house, catalog);
  expect(lines).toHaveLength(1);
  expect(lines[0].points).toBe(points);
  expect(lines[0].detail.length).toBeGreaterThan(0);
  expect([...lines[0].items].sort()).toEqual([...items].sort());
}

describe('lucky (§6.10)', () => {
  // Real names from the curated list (§4.3), which the rule reads through curated.ts.
  const catalog = catalogOf([
    item('katana'),
    item('lucky gold cat'),
    item('ring'),
    item('plain box'),
  ]);

  it('pays 777 per unique lucky item, counting a name once for the house', () => {
    expectOne(
      'lucky',
      houseOf([
        [place('katana', { quantity: 3 }), place('lucky gold cat')],
        [place('katana'), place('ring')],
      ]),
      catalog,
      777 * 3,
      ['katana', 'lucky gold cat', 'ring'],
    );
  });

  it('pays 777 for a single lucky item among non-lucky ones', () => {
    expectOne('lucky', houseOf([[place('plain box'), place('ring')]]), catalog, 777, ['ring']);
  });

  it('adds no line to a house with no lucky item', () => {
    expect(linesFor('lucky', houseOf([[place('plain box', { quantity: 9 })]]), catalog)).toEqual(
      [],
    );
  });
});

describe('seasonal (§6.11)', () => {
  // One real name per season, so the test pins the curated split as well as the rule.
  const catalog = catalogOf([
    item('bamboo shelf'),
    item('cherry-blossom bonsai'),
    item('scorpion'),
    item('cricket'),
    item('frozen tree'),
    item('plain box'),
  ]);
  const everything = [
    place('bamboo shelf'),
    place('cherry-blossom bonsai'),
    place('scorpion'),
    place('cricket'),
    place('frozen tree'),
  ];

  it('credits only the current season, whatever else is placed', () => {
    expectOne('seasonal', houseOf([everything], 'spring'), catalog, 777 * 2, [
      'bamboo shelf',
      'cherry-blossom bonsai',
    ]);
    expectOne('seasonal', houseOf([everything], 'summer'), catalog, 777, ['scorpion']);
    expectOne('seasonal', houseOf([everything], 'autumn'), catalog, 777, ['cricket']);
    expectOne('seasonal', houseOf([everything], 'winter'), catalog, 777, ['frozen tree']);
  });

  it('counts a name once for the house, across rooms and copies', () => {
    expectOne(
      'seasonal',
      houseOf([[place('bamboo shelf', { quantity: 4 })], [place('bamboo shelf')]], 'spring'),
      catalog,
      777,
      ['bamboo shelf'],
    );
  });

  it('adds no line when nothing placed is in season', () => {
    expect(
      linesFor('seasonal', houseOf([[place('frozen tree'), place('plain box')]], 'autumn'), catalog),
    ).toEqual([]);
  });
});

describe('type (§6.12)', () => {
  const catalog = catalogOf([
    item('kitchen chair', { tag: 'Chair' }),
    item('dining table', { tag: 'Table' }),
    item('simple bed', { tag: 'Bed' }),
    item('wooden dresser', { variants: [variant({ category: 'Dresser' })] }),
    item('stool', { interact: 'Chair' }),
    item('futon', { interact: 'Bed' }),
    item('closet', { interact: 'Wardrobe' }),
    item('table clock', { tag: 'TableClock' }),
    item('vanity', { tag: 'Dresser' }),
    item('lamp'),
    // Only this item's second variant is a dresser, so the placed variant decides (§4.2).
    item('cabinet', {
      variants: [variant({ variation: 'Shelves' }), variant({ variation: 'Drawers', category: 'Dresser' })],
    }),
  ]);
  const fourSlots = ['kitchen chair', 'dining table', 'simple bed', 'wooden dresser'];

  it('pays 2,500 once for all four slots spread over rooms, crediting each filler', () => {
    expectOne(
      'type',
      houseOf(fourSlots.map((name) => [place(name), place('lamp')])),
      catalog,
      2500,
      fourSlots,
    );
  });

  it('pays 2,500 once however many fillers there are, crediting them all', () => {
    expectOne(
      'type',
      houseOf([
        [place('kitchen chair'), place('stool'), place('dining table', { quantity: 2 })],
        [place('simple bed'), place('futon'), place('wooden dresser'), place('closet')],
      ]),
      catalog,
      2500,
      [...fourSlots, 'stool', 'futon', 'closet'],
    );
  });

  it('adds no line when any one slot is empty', () => {
    for (const missing of fourSlots) {
      expect(
        linesFor('type', houseOf([fourSlots.filter((n) => n !== missing).map((n) => place(n))]), catalog),
      ).toEqual([]);
    }
  });

  it('matches tags and interact values exactly', () => {
    // A TableClock is not a table, and a Dresser tag alone is not a dresser (§6).
    expect(
      linesFor(
        'type',
        houseOf([['kitchen chair', 'table clock', 'simple bed', 'wooden dresser'].map((n) => place(n))]),
        catalog,
      ),
    ).toEqual([]);
    expect(
      linesFor(
        'type',
        houseOf([['kitchen chair', 'dining table', 'simple bed', 'vanity'].map((n) => place(n))]),
        catalog,
      ),
    ).toEqual([]);
  });

  it('reads the dresser category from the placed variant', () => {
    const rooms = (variation: string): PlacedItem[][] => [
      [
        place('kitchen chair'),
        place('dining table'),
        place('simple bed'),
        place('cabinet', { variation }),
      ],
    ];
    expectOne('type', houseOf(rooms('Drawers')), catalog, 2500, [
      'kitchen chair',
      'dining table',
      'simple bed',
      'cabinet',
    ]);
    expect(linesFor('type', houseOf(rooms('Shelves')), catalog)).toEqual([]);
  });
});
