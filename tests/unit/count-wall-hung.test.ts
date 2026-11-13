// Unit tests for §6.2 `count` and §6.3 `wall-hung` (hha-4vl). Each test builds a small
// inline catalog in the §4.2.1 format and inspects only its own rule's lines, so the other
// rules may add lines to the same rooms without disturbing it.
import { describe, expect, it } from 'vitest';
import { score } from '../../src/engine/score.ts';
import type { Catalog, CatalogItem, House, Line, PlacedItem } from '../../src/engine/types.ts';

const variant = () => ({ variation: null, pattern: null, colors: [], concepts: [], category: null });

const item = (name: string, sheet = 'Housewares'): CatalogItem => ({
  name,
  sheet,
  basePoints: 0,
  series: null,
  set: null,
  tag: null,
  interact: false,
  variants: [variant()],
});

const catalog = (items: CatalogItem[]): Catalog => ({
  source: { repo: 'test', commit: '0'.repeat(40) },
  items: [...items].sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0)),
  sets: {},
});

const place = (name: string, extra: Partial<PlacedItem> = {}): PlacedItem => ({
  name,
  surface: 'floor',
  ...extra,
});

function roomLines(cat: Catalog, items: PlacedItem[], extra: Record<string, unknown> = {}): Line[] {
  const house = { stage: 'house', season: 'spring', rooms: [{ name: 'Den', items, ...extra }] } as House;
  return score(house, cat).rooms[0].lines;
}

/** The lines one rule produced, which §6's "one line per rule" caps at one per room. */
const linesFor = (lines: Line[], rule: string): Line[] => lines.filter((line) => line.rule === rule);

function onlyLine(lines: Line[], rule: string): Line {
  const found = linesFor(lines, rule);
  expect(found).toHaveLength(1);
  expect(found[0].detail.length).toBeGreaterThan(0);
  return found[0];
}

const shelves = catalog([
  item('Stool'),
  item('Lamp'),
  item('Desk'),
  item('Teacup'),
  item('Wall Clock', 'Wall-mounted'),
  item('Chandelier', 'Ceiling Decor'),
  item('Round Rug', 'Rugs'),
  item('boot', 'Other'),
  item('Mossy Wall', 'Wallpaper'),
  item('Tatami Floor', 'Floors'),
]);

describe('count (§6.2)', () => {
  it('awards 1,000 at each of the 6, 10, 15 and 20 thresholds, counting quantity', () => {
    expect(linesFor(roomLines(shelves, [place('Stool', { quantity: 5 })]), 'count')).toHaveLength(0);
    for (const [pieces, expected] of [[6, 1000], [9, 1000], [10, 2000], [15, 3000], [19, 3000], [20, 4000], [40, 4000]]) {
      const line = onlyLine(roomLines(shelves, [place('Stool', { quantity: pieces })]), 'count');
      expect(line.points).toBe(expected);
      expect(line.items).toEqual(['Stool']);
    }
  });

  it('counts pieces on every surface, naming each credited item once', () => {
    const line = onlyLine(
      roomLines(shelves, [
        place('Stool'),
        place('Stool'),
        place('Lamp'),
        place('Desk'),
        place('Teacup', { surface: 'tabletop' }),
        place('Wall Clock', { surface: 'wall' }),
        place('Chandelier', { surface: 'ceiling' }),
      ]),
      'count',
    );

    expect(line.points).toBe(1000);
    expect([...line.items].sort()).toEqual(['Chandelier', 'Desk', 'Lamp', 'Stool', 'Teacup', 'Wall Clock']);
  });

  it('counts neither rugs, trash, wallpaper nor flooring as furniture', () => {
    const surroundings = [place('Round Rug', { quantity: 3 }), place('boot', { quantity: 2 })];
    const dressing = { wallpaper: { name: 'Mossy Wall' }, flooring: { name: 'Tatami Floor' } };

    // Five furniture pieces, however much else fills the room: short of the first threshold.
    expect(linesFor(roomLines(shelves, [place('Stool', { quantity: 5 }), ...surroundings], dressing), 'count')).toHaveLength(0);

    const line = onlyLine(
      roomLines(shelves, [place('Stool', { quantity: 5 }), ...surroundings, place('Lamp')], dressing),
      'count',
    );
    expect(line.points).toBe(1000);
    expect([...line.items].sort()).toEqual(['Lamp', 'Stool']);
  });
});

const hanging = catalog([
  item('Wall Clock', 'Wall-mounted'),
  item('Famous Painting', 'Artwork'),
  item('Family Photo', 'Photos'),
  item('Band Poster', 'Posters'),
  item('Shelf'),
]);

describe('wall-hung (§6.3)', () => {
  it('awards 400 for an item from any of the four hanging sheets', () => {
    for (const name of ['Wall Clock', 'Famous Painting', 'Family Photo', 'Band Poster']) {
      const line = onlyLine(roomLines(hanging, [place(name, { surface: 'wall' })]), 'wall-hung');
      expect(line.points).toBe(400);
      expect(line.items).toEqual([name]);
    }
  });

  it('counts quantity and caps the award at three items, still naming them all', () => {
    const doubled = onlyLine(roomLines(hanging, [place('Wall Clock', { surface: 'wall', quantity: 2 })]), 'wall-hung');
    expect(doubled.points).toBe(800);
    expect(doubled.items).toEqual(['Wall Clock']);

    const four = ['Wall Clock', 'Famous Painting', 'Family Photo', 'Band Poster'].map((name) =>
      place(name, { surface: 'wall' }),
    );
    const capped = onlyLine(roomLines(hanging, four), 'wall-hung');
    expect(capped.points).toBe(1200);
    expect([...capped.items].sort()).toEqual(['Band Poster', 'Family Photo', 'Famous Painting', 'Wall Clock']);
  });

  it('needs both surface wall and a hanging sheet', () => {
    expect(linesFor(roomLines(hanging, [place('Wall Clock', { surface: 'tabletop' })]), 'wall-hung')).toHaveLength(0);
    expect(linesFor(roomLines(hanging, [place('Shelf', { surface: 'wall' })]), 'wall-hung')).toHaveLength(0);
  });
});
