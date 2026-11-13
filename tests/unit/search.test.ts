import { describe, expect, it } from 'vitest';
import { searchCatalog, variantLabel } from '../../src/app/search.ts';
import type { Catalog, CatalogItem, CatalogVariant } from '../../src/engine/types.ts';

// The project's own suite for catalog search and variant labels (§10.5). The acceptance
// tests pin the three ranked groups and the kind filter; these cases cover the edges a
// screen will hit — punctuation, overlapping matches, odd limits and multi-variant items.

const variant = (over: Partial<CatalogVariant> = {}): CatalogVariant => ({
  variation: null,
  pattern: null,
  colors: [],
  concepts: [],
  category: null,
  ...over,
});

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

/** A catalog in the §4.2.1 order: names sorted with plain `<`, never `localeCompare`. */
const catalogOf = (items: CatalogItem[]): Catalog => ({
  source: { repo: 'test', commit: '0'.repeat(40) },
  items: [...items].sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0)),
  sets: {},
});

const names = (items: CatalogItem[]) => items.map((found) => found.name);

describe('searchCatalog', () => {
  it('finds nothing for a query that is empty or only spaces', () => {
    const catalog = catalogOf([item('chair')]);
    expect(searchCatalog(catalog, '', 'item')).toEqual([]);
    expect(searchCatalog(catalog, '  ', 'item')).toEqual([]);
    expect(searchCatalog(catalog, '\t \n', 'item')).toEqual([]);
  });

  it('finds nothing when no name matches', () => {
    expect(searchCatalog(catalogOf([item('chair')]), 'piano', 'item')).toEqual([]);
  });

  it('ignores case on both sides and spaces around the query', () => {
    const catalog = catalogOf([item('Rocking Chair'), item('wooden chair')]);
    expect(names(searchCatalog(catalog, ' ROCKING ', 'item'))).toEqual(['Rocking Chair']);
    expect(names(searchCatalog(catalog, 'WoOdEn', 'item'))).toEqual(['wooden chair']);
  });

  it('ranks a prefix above a later word above a match inside a word', () => {
    // One query, one item per group, deliberately out of catalog order.
    const catalog = catalogOf([item('vanity table'), item('turntable'), item('table lamp')]);
    expect(names(searchCatalog(catalog, 'table', 'item')))
      .toEqual(['table lamp', 'vanity table', 'turntable']);
  });

  it('keeps catalog order inside each group', () => {
    const catalog = catalogOf([
      item('Bamboo Stool'), item('bamboo bed'), item('tall bamboo'), item('Zen bamboo'),
    ]);
    // Group 1: uppercase sorts before lowercase under plain `<`, so "Bamboo Stool" leads.
    expect(names(searchCatalog(catalog, 'bamboo', 'item')))
      .toEqual(['Bamboo Stool', 'bamboo bed', 'Zen bamboo', 'tall bamboo']);
  });

  it('counts only a space as a word break, so a hyphen or bracket matches inside', () => {
    const catalog = catalogOf([item('wall-mounted clock'), item('clock (forgery)')]);
    expect(names(searchCatalog(catalog, 'mounted', 'item'))).toEqual(['wall-mounted clock']);
    // "clock (forgery)" starts with the query; the hyphenated name is an inside match.
    expect(names(searchCatalog(catalog, 'clock', 'item')))
      .toEqual(['clock (forgery)', 'wall-mounted clock']);
    expect(names(searchCatalog(catalog, 'forgery', 'item'))).toEqual(['clock (forgery)']);
  });

  it('puts each name in one group only, even when it matches several ways', () => {
    const catalog = catalogOf([item('box of boxes')]);
    expect(names(searchCatalog(catalog, 'box', 'item'))).toEqual(['box of boxes']);
  });

  it('filters by kind, and a kind with no match finds nothing', () => {
    const catalog = catalogOf([
      item('blue wall', 'Wallpaper'), item('blue floor', 'Floors'),
      item('blue rug', 'Rugs'), item('blue chair', 'Housewares'),
    ]);
    expect(names(searchCatalog(catalog, 'blue', 'wallpaper'))).toEqual(['blue wall']);
    expect(names(searchCatalog(catalog, 'blue', 'flooring'))).toEqual(['blue floor']);
    expect(names(searchCatalog(catalog, 'blue', 'item'))).toEqual(['blue chair', 'blue rug']);
    expect(searchCatalog(catalog, 'rug', 'wallpaper')).toEqual([]);
  });

  it('caps the results after ranking, with 50 as the default', () => {
    const catalog = catalogOf([
      ...Array.from({ length: 52 }, (_, i) => item(`lamp ${String(i).padStart(2, '0')}`)),
      item('desk lamp'),
    ]);
    expect(searchCatalog(catalog, 'lamp', 'item', 1000)).toHaveLength(53);
    expect(searchCatalog(catalog, 'lamp', 'item')).toHaveLength(50);
    // The cap bites the weakest group first: "desk lamp" ranks behind every "lamp NN".
    expect(names(searchCatalog(catalog, 'lamp', 'item'))).not.toContain('desk lamp');
    expect(names(searchCatalog(catalog, 'lamp', 'item', 2))).toEqual(['lamp 00', 'lamp 01']);
    expect(searchCatalog(catalog, 'lamp', 'item', 0)).toEqual([]);
  });

  it('returns the catalog\'s own objects and mutates nothing', () => {
    const catalog = catalogOf([item('chair'), item('armchair')]);
    const snapshot = JSON.stringify(catalog);
    const found = searchCatalog(catalog, 'chair', 'item');
    expect(found[0]).toBe(catalog.items.find((entry) => entry.name === 'chair'));
    expect(found[1]).toBe(catalog.items.find((entry) => entry.name === 'armchair'));
    expect(JSON.stringify(catalog)).toEqual(snapshot);
  });
});

describe('variantLabel', () => {
  it('joins variation and pattern, skipping nulls', () => {
    expect(variantLabel(variant({ variation: 'Red' }))).toEqual('Red');
    expect(variantLabel(variant({ pattern: 'Striped' }))).toEqual('Striped');
    expect(variantLabel(variant({ variation: 'Red', pattern: 'Striped' })))
      .toEqual('Red / Striped');
    expect(variantLabel(variant())).toEqual('Default');
  });

  it('keeps an empty-string variation rather than calling it default', () => {
    // Absent upstream values are null (§4.2.1), so "" is a real label, not a missing one.
    expect(variantLabel(variant({ variation: '', pattern: 'Striped' }))).toEqual(' / Striped');
  });
});
