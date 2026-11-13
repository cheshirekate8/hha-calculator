import { describe, expect, it } from 'vitest';
import { score } from '../../src/engine/score.ts';
import type { Catalog, CatalogVariant, House, Line, Options, PlacedItem } from '../../src/engine/types.ts';

// The project's own suite for color (§6.8) and feng shui (§6.9): the readings in DESIGN.md
// §6 that the frozen acceptance tests leave implicit — the exact threshold boundaries, the
// winning colour when it is not the first one met, and what each line's `detail` says.

const variant = (colors: string[]): CatalogVariant => ({
  variation: null,
  pattern: null,
  colors,
  concepts: [],
  category: null,
});

const item = (name: string, colors: string[], sheet = 'Housewares') => ({
  name,
  sheet,
  basePoints: 0,
  series: null,
  set: null,
  tag: null,
  interact: false,
  variants: [variant(colors)],
});

const catalog: Catalog = {
  source: { repo: 'test', commit: '0'.repeat(40) },
  items: [
    item('amber lamp', ['Yellow', 'Red']),
    item('blue chair', ['Blue', 'Blue']),
    item('green stool', ['Green', 'Green']),
    item('plain crate', []),
    item('red bed', ['Red', 'Red']),
    item('red rug', ['Red', 'Red'], 'Rugs'),
    item('red table', ['Red', 'Red']),
    item('red wallpaper', ['Red', 'Red'], 'Wallpaper'),
    item('red flooring', ['Red', 'Red'], 'Floors'),
    item('twice red', ['Red', 'Red']),
    item('white shelf', ['White', 'White']),
    item('yellow desk', ['Yellow', 'Yellow']),
  ],
  sets: {},
};

const place = (name: string, extra: Partial<PlacedItem> = {}): PlacedItem => ({
  name,
  surface: 'floor',
  ...extra,
});

function lines(items: PlacedItem[], options?: Partial<Options>, room: Partial<House['rooms'][number]> = {}): Line[] {
  const house: House = {
    stage: 'house',
    season: 'spring',
    rooms: [{ name: 'Den', items, ...room }],
  };
  return score(house, catalog, options).rooms[0].lines;
}

const only = (items: PlacedItem[], rule: string, options?: Partial<Options>, room?: Partial<House['rooms'][number]>) =>
  lines(items, options, room).filter((line) => line.rule === rule);

/** Eight placed items: `reds` of them red, the rest blue. */
const mix = (reds: number, blues: number): PlacedItem[] => [
  ...(reds > 0 ? [place('red bed', { quantity: reds })] : []),
  ...(blues > 0 ? [place('blue chair', { quantity: blues })] : []),
];

describe('color (§6.8)', () => {
  it('pays nothing below 70%, 200 per unique item at exactly 70%', () => {
    expect(only(mix(13, 7), 'color')).toEqual([]); // 65%
    const seventy = only(mix(14, 6), 'color'); // exactly 70%
    expect(seventy).toHaveLength(1);
    expect(seventy[0].points).toBe(200);
    expect(seventy[0].items).toEqual(['red bed']);
  });

  it('pays 600 per unique item from exactly 90% up, never 200 as well', () => {
    const under = only([place('red bed', { quantity: 8 }), place('blue chair')], 'color'); // 8/9 ≈ 88.9%
    expect(under[0].points).toBe(200);
    const ninety = only([place('red bed', { quantity: 9 }), place('blue chair')], 'color');
    expect(ninety).toHaveLength(1);
    expect(ninety[0].points).toBe(600);
  });

  it('needs eight placed items counted with quantity: seven is never enough', () => {
    expect(only([place('red bed', { quantity: 7 })], 'color')).toEqual([]);
    expect(only([place('red bed', { quantity: 8 })], 'color')[0].points).toBe(600);
  });

  it('picks the highest share, not the first colour met', () => {
    const result = only(
      [place('blue chair'), place('red bed', { quantity: 5 }), place('red table', { quantity: 3 })],
      'color',
    );
    expect(result).toHaveLength(1);
    // Red 8 of 9 (≥70%, under 90%): 200 × the two unique red items.
    expect(result[0].points).toBe(400);
    expect(result[0].items).toEqual(['red bed', 'red table']);
  });

  it('counts an item once for a colour its variant lists twice', () => {
    const result = only([place('twice red', { quantity: 7 }), place('blue chair')], 'color');
    expect(result[0].points).toBe(200); // 7 of 8 is 87.5%: the 70% band, one unique item
    expect(result[0].items).toEqual(['twice red']);
  });

  it('credits an item once however many placements name it', () => {
    const result = only(
      [place('red bed', { quantity: 4 }), place('red bed', { quantity: 4 }), place('blue chair')],
      'color',
    );
    expect(result[0].items).toEqual(['red bed']);
    expect(result[0].points).toBe(200); // 8 of 9, one unique item
  });

  it('matches on either variant colour and breaks a tie on the name that sorts first', () => {
    // Red: amber lamp ×4 + red bed ×3 = 7. Yellow: amber lamp ×4 + yellow desk ×3 = 7.
    const result = only(
      [place('amber lamp', { quantity: 4 }), place('red bed', { quantity: 3 }), place('yellow desk', { quantity: 3 })],
      'color',
    );
    expect(result).toHaveLength(1);
    expect(result[0].points).toBe(400); // Red wins the tie: 200 × amber lamp and red bed
    expect(result[0].items).toEqual(['amber lamp', 'red bed']);
  });

  it('ignores wallpaper and flooring, and a room of colourless items scores nothing', () => {
    const room = { wallpaper: { name: 'red wallpaper' }, flooring: { name: 'red flooring' } };
    expect(only(mix(5, 5), 'color', undefined, room)).toEqual([]);
    expect(only([place('plain crate', { quantity: 10 })], 'color')).toEqual([]);
  });

  it('names the colour, the share and the multiplier in its detail', () => {
    const [line] = only([place('red bed', { quantity: 9 }), place('blue chair')], 'color');
    expect(line.detail).toBe('Red is on 9 of 10 placed items (at least 90%): 600 × 1 unique Red item');
  });
});

describe('feng shui (§6.9)', () => {
  it('pays each wall once and caps at three walls', () => {
    const all = only(
      [
        place('red bed', { nearWall: 'east' }),
        place('red table', { nearWall: 'east', quantity: 9 }),
        place('green stool', { nearWall: 'south' }),
        place('yellow desk', { nearWall: 'west' }),
      ],
      'feng-shui',
    );
    expect(all).toHaveLength(1);
    expect(all[0].points).toBe(1500);
    expect(all[0].items).toEqual(['red bed', 'red table', 'green stool', 'yellow desk']);
  });

  it('pairs each colour with its own wall only', () => {
    expect(only([place('red bed', { nearWall: 'south' })], 'feng-shui')).toEqual([]);
    expect(only([place('green stool', { nearWall: 'west' })], 'feng-shui')).toEqual([]);
    expect(only([place('yellow desk', { nearWall: 'east' })], 'feng-shui')).toEqual([]);
    expect(only([place('red bed', { nearWall: 'none' })], 'feng-shui')).toEqual([]);
  });

  it('credits only the items that earned a wall', () => {
    const [line] = only(
      [
        place('red bed', { nearWall: 'east' }),
        place('red table', { nearWall: 'north' }),
        place('blue chair', { nearWall: 'east' }),
      ],
      'feng-shui',
    );
    expect(line.points).toBe(500);
    expect(line.items).toEqual(['red bed']);
  });

  it('matches on either variant colour', () => {
    expect(only([place('amber lamp', { nearWall: 'east' })], 'feng-shui')[0].points).toBe(500);
  });

  it('awards nothing with the §8 toggle off, and names its walls in the detail', () => {
    const items = [place('red bed', { nearWall: 'east' }), place('yellow desk', { nearWall: 'west' })];
    expect(only(items, 'feng-shui', { fengShui: 'off' })).toEqual([]);
    const [line] = only(items, 'feng-shui', { fengShui: 'on' });
    expect(line.detail).toBe('Feng shui: red on the east wall and yellow on the west wall (500 per wall)');
  });
});
