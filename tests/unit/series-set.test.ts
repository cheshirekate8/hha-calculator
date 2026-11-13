import { describe, expect, it } from 'vitest';
import { score } from '../../src/engine/score.ts';
import type { Catalog, CatalogVariant, House, ItemRef, Line, PlacedItem, Room } from '../../src/engine/types.ts';

// The project's own cover for §6.4 series and §6.5 set, alongside the frozen tests in
// tests/acceptance/hha-ny7/. Each fixture pins a number a wrong reading would change:
// unique names decide the series threshold while every item decides its points, and a
// complete set scores once per set however many copies the room holds. Only `series` and
// `set` lines are read, so other rules may add lines to the same rooms (DESIGN.md §6).

const variant = (o: Partial<CatalogVariant> = {}): CatalogVariant => ({
  variation: null,
  pattern: null,
  colors: [],
  concepts: [],
  category: null,
  ...o,
});

const item = (
  name: string,
  o: { sheet?: string; series?: string | null; set?: string | null; variants?: CatalogVariant[] } = {},
) => ({
  name,
  sheet: 'Housewares',
  basePoints: 0,
  series: null,
  set: null,
  tag: null,
  interact: false,
  variants: [variant()],
  ...o,
});

const catalogOf = (items: ReturnType<typeof item>[], sets: Record<string, string[]> = {}): Catalog => ({
  source: { repo: 'test', commit: '0'.repeat(40) },
  items: [...items].sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0)),
  sets,
});

const place = (name: string, o: Partial<PlacedItem> = {}): PlacedItem => ({
  name,
  surface: 'floor',
  ...o,
});

type Surfaces = { wallpaper?: ItemRef; flooring?: ItemRef };

/** Scores a one-room house and returns just the lines the rule under test produced. */
function linesFor(catalog: Catalog, rule: 'series' | 'set', items: PlacedItem[], surfaces: Surfaces = {}): Line[] {
  const room: Room = { name: 'Den', items, ...surfaces };
  const house: House = { stage: 'house', season: 'spring', rooms: [room] };
  return score(house, catalog).rooms[0].lines.filter((line) => line.rule === rule);
}

/** The rule's single line, asserting §6's "one line per rule" along the way. */
function only(lines: Line[]): Line {
  expect(lines).toHaveLength(1);
  expect(lines[0].detail.length).toBeGreaterThan(0);
  return lines[0];
}

describe('§6.4 series', () => {
  const cat = catalogOf([
    item('cabin bed', { series: 'cabin' }),
    item('cabin chair', { series: 'cabin' }),
    item('cabin clock', { series: 'cabin' }),
    item('cabin table', { series: 'cabin' }),
    item('cabin wardrobe', { series: 'cabin' }),
    item('cabin wall', { sheet: 'Wallpaper', series: 'cabin' }),
    item('cabin floor', { sheet: 'Floors', series: 'cabin' }),
    item('plain lamp'),
  ]);

  it('awards nothing below four unique items, however many copies', () => {
    const items = ['cabin bed', 'cabin chair', 'cabin table'].map((n) => place(n, { quantity: 4 }));
    expect(linesFor(cat, 'series', items)).toEqual([]);
  });

  it('awards nothing when no item carries a series', () => {
    expect(linesFor(cat, 'series', [place('plain lamp', { quantity: 9 })])).toEqual([]);
  });

  it('pays 1,000 for every item of the winning series, duplicates included', () => {
    const line = only(linesFor(cat, 'series', [
      place('cabin bed'),
      place('cabin chair', { quantity: 3 }),
      place('cabin table'),
      place('cabin clock', { quantity: 2 }),
    ]));
    // 4 unique items clears the threshold; 7 items in all set the points.
    expect(line.points).toBe(7000);
    expect([...line.items].sort()).toEqual(['cabin bed', 'cabin chair', 'cabin clock', 'cabin table']);
  });

  it('counts the wallpaper and the flooring once each, toward both threshold and points', () => {
    const items = ['cabin bed', 'cabin chair'].map((n) => place(n));
    const line = only(linesFor(cat, 'series', items, {
      wallpaper: { name: 'cabin wall' },
      flooring: { name: 'cabin floor' },
    }));
    expect(line.points).toBe(4000);
    expect([...line.items].sort()).toEqual(['cabin bed', 'cabin chair', 'cabin floor', 'cabin wall']);
  });

  it('breaks a tie in unique count under plain `<`, not locale order', () => {
    // 'Zen' sorts before 'azalea' by code unit and after it in most locales, so this
    // fails if the comparison ever becomes `localeCompare` (§4.2.1 note).
    const tied = catalogOf([
      ...[1, 2, 3, 4].map((n) => item(`Zen ${String(n)}`, { series: 'Zen' })),
      ...[1, 2, 3, 4].map((n) => item(`azalea ${String(n)}`, { series: 'azalea' })),
    ]);
    const line = only(linesFor(tied, 'series', [
      ...[1, 2, 3, 4].map((n) => place(`azalea ${String(n)}`, { quantity: 5 })),
      ...[1, 2, 3, 4].map((n) => place(`Zen ${String(n)}`)),
    ]));
    // The tie goes to 'Zen', so the larger 'azalea' total never scores.
    expect(line.points).toBe(4000);
    expect([...line.items].sort()).toEqual(['Zen 1', 'Zen 2', 'Zen 3', 'Zen 4']);
  });

  it('names the winning series in its detail', () => {
    const items = ['cabin bed', 'cabin chair', 'cabin table', 'cabin clock'].map((n) => place(n));
    expect(only(linesFor(cat, 'series', items)).detail).toContain('cabin');
  });
});

describe('§6.5 set', () => {
  const BATH = ['bath mat', 'bath mirror', 'bath sink', 'bath tub'];
  const DINER = ['diner counter', 'diner stool'];
  const cat = catalogOf([
    ...BATH.map((n) => item(n, { set: 'bath' })),
    ...DINER.map((n) => item(n, { set: 'diner' })),
    item('diner wall', { sheet: 'Wallpaper', set: 'diner-wall' }),
    item('diner neon', { set: 'diner-wall' }),
    item('loose stool'),
  ], {
    bath: [...BATH].sort(),
    diner: [...DINER].sort(),
    'diner-wall': ['diner neon', 'diner wall'],
  });

  it('awards nothing while a member is missing', () => {
    expect(linesFor(cat, 'set', BATH.slice(0, 3).map((n) => place(n)))).toEqual([]);
  });

  it('pays 800 per member once, whatever the copies', () => {
    const line = only(linesFor(cat, 'set', BATH.map((n) => place(n, { quantity: 3 }))));
    expect(line.points).toBe(3200);
    expect([...line.items].sort()).toEqual([...BATH].sort());
  });

  it('sums every complete set into one line and credits only their members', () => {
    const line = only(linesFor(cat, 'set', [
      ...BATH.map((n) => place(n)),
      ...DINER.map((n) => place(n)),
      place('loose stool'),
    ]));
    expect(line.points).toBe(3200 + 1600);
    expect([...line.items].sort()).toEqual([...BATH, ...DINER].sort());
    expect(line.detail).toContain('bath');
    expect(line.detail).toContain('diner');
  });

  it('lets the wallpaper complete a set', () => {
    expect(linesFor(cat, 'set', [place('diner neon')])).toEqual([]);
    const line = only(linesFor(cat, 'set', [place('diner neon')], { wallpaper: { name: 'diner wall' } }));
    expect(line.points).toBe(1600);
    expect([...line.items].sort()).toEqual(['diner neon', 'diner wall']);
  });
});
