import { describe, expect, it } from 'vitest';
import {
  buildCatalog,
  commitFromSourceMd,
  findCuratedMisses,
  serializeCatalog,
} from '../../scripts/build-catalog.ts';
import type { UpstreamRow } from '../../scripts/build-catalog.ts';

// Unit cover for the import's pure core (DESIGN.md §4.2.1) on synthetic rows, so the
// fallback and provenance rules are pinned without reading the 8 MB vendored copy.
// The committed catalog itself is judged by tests/acceptance/hha-md3/.

const SHA = '0123456789abcdef0123456789abcdef01234567';

const chair: UpstreamRow = {
  sourceSheet: 'Housewares',
  name: 'chair',
  hhaBasePoints: 103,
  hhaCategory: 'Seating',
  tag: 'Chair',
  interact: 'Chair',
  series: 'log',
  set: 'bear',
  colors: ['Brown', 'Beige'],
  concepts: ['garden'],
  variations: [
    { variation: 'Dark wood', pattern: null, hhaCategory: null, colors: ['Brown', 'Beige'], concepts: ['nature'] },
    { variation: 'White birch', pattern: 'Plain', hhaCategory: 'Lighting', colors: ['White', 'Beige'], concepts: [] },
  ],
};

const fish: UpstreamRow = {
  sourceSheet: 'Fish',
  name: 'koi',
  hhaBasePoints: 71,
  hhaCategory: 'Pet',
  colors: ['Red', 'White'],
};

describe('buildCatalog', () => {
  it('names forgeries apart and sorts items by plain string order', () => {
    const artwork = (genuine: boolean): UpstreamRow => ({
      sourceSheet: 'Artwork', name: 'famous painting', genuine, hhaBasePoints: genuine ? 451 : 17, colors: [],
    });
    const catalog = buildCatalog([artwork(false), fish, artwork(true), chair], SHA);
    expect(catalog.items.map((i) => i.name)).toEqual([
      'chair', 'famous painting', 'famous painting (forgery)', 'koi',
    ]);
    expect(catalog.source).toEqual({ repo: 'Norviah/animal-crossing', commit: SHA });
  });

  it('rejects two rows that would share a catalog name', () => {
    expect(() => buildCatalog([chair, { ...chair }], SHA)).toThrow(/duplicate item name "chair"/);
  });

  it('takes a variant\'s own colors, concepts and category, else the item\'s', () => {
    const [item] = buildCatalog([chair], SHA).items;
    expect(item?.variants).toEqual([
      { variation: 'Dark wood', pattern: null, colors: ['Brown', 'Beige'], concepts: ['nature'], category: 'Seating' },
      { variation: 'White birch', pattern: 'Plain', colors: ['White', 'Beige'], concepts: [], category: 'Lighting' },
    ]);
  });

  it('turns a row with no variations into one variant, absent values null or []', () => {
    const [item] = buildCatalog([fish], SHA).items;
    expect(item?.series).toBe(null);
    expect(item?.set).toBe(null);
    expect(item?.tag).toBe(null);
    expect(item?.interact).toBe(null);
    expect(item?.variants).toEqual([
      { variation: null, pattern: null, colors: ['Red', 'White'], concepts: [], category: 'Pet' },
    ]);
  });

  it('derives set membership across sheets, keys and members sorted', () => {
    const baby: UpstreamRow = {
      sourceSheet: 'Miscellaneous', name: 'Baby bear', hhaBasePoints: 151, set: 'bear', colors: [],
    };
    const lantern: UpstreamRow = {
      sourceSheet: 'Housewares', name: 'imperial lantern', hhaBasePoints: 151, set: 'imperial', colors: [],
    };
    const { sets } = buildCatalog([chair, baby, lantern, fish], SHA);
    expect(sets).toEqual({ bear: ['Baby bear', 'chair'], imperial: ['imperial lantern'] });
  });
});

describe('findCuratedMisses', () => {
  const items = buildCatalog([chair, fish], SHA).items;
  const curated = () => new Map<string, unknown>([
    ['lucky.json', { items: ['koi'], excludedNpcPhotos: [] }],
    ['seasonal.json', { spring: [], summer: [], autumn: [], winter: [] }],
    ['trash.json', { items: [] }],
  ]);

  it('passes when every curated name is a catalog item name', () => {
    expect(findCuratedMisses(curated(), items)).toEqual([]);
  });

  it('reports a name that differs only by case, with its file and list', () => {
    const lists = curated();
    lists.set('lucky.json', { items: ['Koi'], excludedNpcPhotos: [] });
    expect(findCuratedMisses(lists, items)).toEqual([
      { file: 'lucky.json', key: 'items', name: 'Koi' },
    ]);
  });

  it('checks every one of the seven lists', () => {
    const lists = curated();
    lists.set('seasonal.json', { spring: ['x'], summer: ['x'], autumn: ['x'], winter: ['x'] });
    lists.set('trash.json', { items: ['x'] });
    lists.set('lucky.json', { items: ['x'], excludedNpcPhotos: ['x'] });
    expect(findCuratedMisses(lists, items).map((m) => `${m.file}:${m.key}`)).toEqual([
      'lucky.json:items', 'lucky.json:excludedNpcPhotos', 'seasonal.json:spring',
      'seasonal.json:summer', 'seasonal.json:autumn', 'seasonal.json:winter', 'trash.json:items',
    ]);
  });
});

describe('provenance and serialization', () => {
  it('reads the 40-character SHA out of SOURCE.md prose', () => {
    expect(commitFromSourceMd(`- **Pinned commit:** \`${SHA}\`\n`, 'SOURCE.md')).toBe(SHA);
    expect(() => commitFromSourceMd('no sha here\n', 'SOURCE.md')).toThrow(/40-character/);
  });

  it('round-trips, ends in a newline, and gives one line per item', () => {
    const catalog = buildCatalog([chair, fish], SHA);
    const text = serializeCatalog(catalog);
    expect(JSON.parse(text)).toEqual(catalog);
    expect(text.endsWith('}\n')).toBe(true);
    expect(text.split('\n').filter((l) => l.startsWith('    {"name"'))).toHaveLength(2);
  });
});
