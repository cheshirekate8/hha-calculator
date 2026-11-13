// hha-a1o: the four penalties — trash (§6.13), facing a wall (§6.14), dropped items
// (§6.15) and cockroaches (§6.16). Each test inspects only its own rule's lines, so the
// rules still unimplemented on this branch cannot change the outcome.
import { describe, expect, it } from 'vitest';
import { score } from '../../src/engine/score.ts';
import type { Catalog, CatalogItem, CatalogVariant, House, Line, PlacedItem } from '../../src/engine/types.ts';

const variant = (over: Partial<CatalogVariant> = {}): CatalogVariant => ({
  variation: null,
  pattern: null,
  colors: [],
  concepts: [],
  category: null,
  ...over,
});

const item = (name: string, over: Partial<CatalogItem> = {}): CatalogItem => ({
  name,
  sheet: 'Housewares',
  basePoints: 0,
  series: null,
  set: null,
  tag: null,
  interact: false,
  variants: [variant()],
  ...over,
});

// A small catalog in the §4.2.1 format: two curated trash names, a garbage can (category
// Trash but *not* trash), an `Other`-sheet item that is not trash, and two plain items.
const catalog: Catalog = {
  source: { repo: 'test', commit: '0'.repeat(40) },
  items: [
    item('X'),
    item('Y'),
    item('boot', { sheet: 'Other' }),
    item('empty can', { sheet: 'Other' }),
    item('garbage can', { variants: [variant({ category: 'Trash' })] }),
    item('old tire', { sheet: 'Other' }),
    item('wrapping paper', { sheet: 'Other' }),
  ].sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0)),
  sets: {},
};

const place = (name: string, over: Partial<PlacedItem> = {}): PlacedItem => ({
  name,
  surface: 'floor',
  ...over,
});

type RoomExtra = { droppedItems?: number; cockroaches?: number };

function lines(items: PlacedItem[], extra: RoomExtra = {}): Line[] {
  const house: House = {
    stage: 'house',
    season: 'spring',
    rooms: [{ name: 'Den', items, ...extra }],
  };
  return score(house, catalog).rooms[0].lines;
}

const of = (all: Line[], rule: string): Line[] => all.filter((line) => line.rule === rule);

function only(all: Line[], rule: string): Line {
  const found = of(all, rule);
  expect(found).toHaveLength(1);
  expect(found[0].detail.length).toBeGreaterThan(0);
  return found[0];
}

describe('trash (§6.13)', () => {
  it('penalises each curated trash name, counted with quantity', () => {
    const line = only(lines([place('boot', { quantity: 2 }), place('empty can')]), 'trash');
    expect(line.points).toBe(-1500);
    expect([...line.items].sort()).toEqual(['boot', 'empty can']);
  });

  it('names each trash item once however many copies it has', () => {
    const line = only(lines([place('old tire', { quantity: 3 })]), 'trash');
    expect(line.points).toBe(-1500);
    expect(line.items).toEqual(['old tire']);
  });

  it('leaves a garbage can alone: category Trash is furniture, not trash', () => {
    expect(of(lines([place('garbage can', { quantity: 4 })]), 'trash')).toHaveLength(0);
  });

  it('does not penalise an Other-sheet item that is not on the curated list', () => {
    expect(of(lines([place('wrapping paper')]), 'trash')).toHaveLength(0);
  });

  it('adds no line to a room with no trash', () => {
    expect(of(lines([place('X'), place('Y')]), 'trash')).toHaveLength(0);
  });
});

describe('facing a wall (§6.14)', () => {
  it('penalises every tagged item, counted with quantity', () => {
    const line = only(
      lines([place('X', { facingWall: true, quantity: 2 }), place('Y', { facingWall: true })]),
      'facing-wall',
    );
    expect(line.points).toBe(-900);
    expect([...line.items].sort()).toEqual(['X', 'Y']);
  });

  it('ignores an item tagged false and an item with no tag at all', () => {
    expect(of(lines([place('X', { facingWall: false }), place('Y')]), 'facing-wall')).toHaveLength(0);
  });

  it('adds one line per room, not one per item', () => {
    const line = only(
      lines([place('X', { facingWall: true }), place('Y', { facingWall: true })]),
      'facing-wall',
    );
    expect(line.points).toBe(-600);
  });
});

describe('dropped items (§6.15) and cockroaches (§6.16)', () => {
  it('charges -1 per dropped item', () => {
    const line = only(lines([], { droppedItems: 7 }), 'dropped');
    expect(line.points).toBe(-7);
    expect(line.items).toEqual([]);
  });

  it('charges -2,500 per cockroach', () => {
    const line = only(lines([], { cockroaches: 2 }), 'cockroach');
    expect(line.points).toBe(-5000);
    expect(line.items).toEqual([]);
  });

  it.each([{}, { droppedItems: 0, cockroaches: 0 }])('adds no line for %j', (extra) => {
    const all = lines([], extra);
    expect(of(all, 'dropped')).toHaveLength(0);
    expect(of(all, 'cockroach')).toHaveLength(0);
  });

  it.each([-1, 1.5])('rejects droppedItems of %p, naming only that field', (droppedItems) => {
    expect(() => lines([], { droppedItems })).toThrow(/droppedItems/);
    expect(() => lines([], { droppedItems })).not.toThrow(/cockroaches/);
  });

  it.each([-2, 0.5])('rejects cockroaches of %p, naming only that field', (cockroaches) => {
    expect(() => lines([], { cockroaches })).toThrow(/cockroaches/);
    expect(() => lines([], { cockroaches })).not.toThrow(/droppedItems/);
  });
});
