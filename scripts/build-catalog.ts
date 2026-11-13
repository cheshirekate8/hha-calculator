// Pure core of the catalog import (DESIGN.md §4.2, §4.2.1): upstream rows in, catalog
// out. No I/O and no process access, so it can be unit-tested and so the CLI in
// ./import-catalog.ts owns every path decision.
//
// Node built-ins only, relative imports with `.ts` (CLAUDE.md), and nothing outside
// scripts/ — hha-md3 criterion 6 walks this file's imports.

/** An upstream sheet row, read straight out of `data/upstream/<Sheet>.json`. */
export type UpstreamRow = Record<string, unknown>;

export type Variant = {
  variation: string | null;
  pattern: string | null;
  colors: string[];
  concepts: string[];
  category: string | null;
};

export type CatalogItem = {
  name: string;
  sheet: string;
  basePoints: number;
  series: string | null;
  set: string | null;
  tag: string | null;
  interact: string | boolean | null;
  variants: Variant[];
};

export type Catalog = {
  source: { repo: string; commit: string };
  items: CatalogItem[];
  sets: Record<string, string[]>;
};

/** The upstream repository the vendored sheets come from (DESIGN.md §4.1). */
export const SOURCE_REPO = 'Norviah/animal-crossing';

/**
 * Plain JavaScript string order (`<`), which for JS strings is UTF-16 code-unit order —
 * what DESIGN.md §4.2.1 calls code-point order and what the frozen tests assert with
 * `a < b`. Deliberately not `localeCompare`, whose order depends on ICU data.
 */
export function compareStrings(a: string, b: string): number {
  if (a < b) return -1;
  if (a > b) return 1;
  return 0;
}

function fail(message: string): never {
  throw new Error(message);
}

/** Absent upstream values become `null` (DESIGN.md §4.2.1). */
function optionalString(value: unknown, where: string): string | null {
  if (value === undefined || value === null) return null;
  if (typeof value !== 'string') fail(`${where}: expected a string, got ${typeof value}`);
  return value;
}

function requiredString(value: unknown, where: string): string {
  const s = optionalString(value, where);
  if (s === null) fail(`${where}: required`);
  return s;
}

/** Absent lists become `[]` (DESIGN.md §4.2.1). */
function stringList(value: unknown, where: string): string[] {
  if (value === undefined || value === null) return [];
  if (!Array.isArray(value)) fail(`${where}: expected an array, got ${typeof value}`);
  return value.map((entry, i) => requiredString(entry, `${where}[${i}]`));
}

function interactOf(value: unknown, where: string): string | boolean | null {
  if (value === undefined || value === null) return null;
  if (typeof value === 'string' || typeof value === 'boolean') return value;
  fail(`${where}: expected a string, boolean or null, got ${typeof value}`);
}

/**
 * The catalog name of an upstream row. Upstream names are unique across the imported
 * sheets except in Artwork, where a forgery repeats the genuine piece's name, so a
 * forgery is suffixed (DESIGN.md §4.2).
 */
export function catalogName(row: UpstreamRow): string {
  const name = requiredString(row.name, 'row.name');
  return row.genuine === false ? `${name} (forgery)` : name;
}

/**
 * The variants of one row, in upstream order and never empty. A row with no `variations`
 * becomes a single variant built from the row's own fields; colors, concepts and
 * category fall back to the row's when the variation does not carry them (DESIGN.md
 * §4.2.1).
 */
function variantsOf(row: UpstreamRow, where: string): Variant[] {
  const itemColors = stringList(row.colors, `${where}.colors`);
  const itemConcepts = stringList(row.concepts, `${where}.concepts`);
  const itemCategory = optionalString(row.hhaCategory, `${where}.hhaCategory`);

  const variations = row.variations;
  if (variations === undefined || variations === null) {
    return [{
      variation: optionalString(row.variation, `${where}.variation`),
      pattern: optionalString(row.pattern, `${where}.pattern`),
      colors: itemColors,
      concepts: itemConcepts,
      category: itemCategory,
    }];
  }
  if (!Array.isArray(variations)) fail(`${where}.variations: expected an array`);
  if (variations.length === 0) fail(`${where}.variations: empty`);

  return variations.map((raw, i) => {
    const at = `${where}.variations[${i}]`;
    if (typeof raw !== 'object' || raw === null) fail(`${at}: expected an object`);
    const v = raw as UpstreamRow;
    const colors = v.colors === undefined || v.colors === null
      ? itemColors
      : stringList(v.colors, `${at}.colors`);
    const concepts = v.concepts === undefined || v.concepts === null
      ? itemConcepts
      : stringList(v.concepts, `${at}.concepts`);
    const category = optionalString(v.hhaCategory, `${at}.hhaCategory`) ?? itemCategory;
    return {
      variation: optionalString(v.variation, `${at}.variation`),
      pattern: optionalString(v.pattern, `${at}.pattern`),
      colors,
      concepts,
      category,
    };
  });
}

/** One catalog item per upstream row, keeping only the §4.2 fields. */
export function itemFromRow(row: UpstreamRow): CatalogItem {
  const name = catalogName(row);
  const where = `item ${name}`;
  const basePoints = row.hhaBasePoints;
  if (typeof basePoints !== 'number') {
    fail(`${where}: hhaBasePoints is ${typeof basePoints}, expected a number`);
  }
  return {
    name,
    sheet: requiredString(row.sourceSheet, `${where}.sourceSheet`),
    basePoints,
    series: optionalString(row.series, `${where}.series`),
    set: optionalString(row.set, `${where}.set`),
    tag: optionalString(row.tag, `${where}.tag`),
    interact: interactOf(row.interact, `${where}.interact`),
    variants: variantsOf(row, where),
  };
}

/**
 * Set membership, derived across sheets: for each `set` value, the distinct item names
 * carrying it. §6.5 needs the full membership, which no single row gives.
 */
export function setsOf(items: CatalogItem[]): Record<string, string[]> {
  const members = new Map<string, string[]>();
  for (const item of items) {
    if (item.set === null) continue;
    const list = members.get(item.set);
    if (list === undefined) members.set(item.set, [item.name]);
    else list.push(item.name);
  }
  const sets: Record<string, string[]> = {};
  for (const set of [...members.keys()].sort(compareStrings)) {
    sets[set] = (members.get(set) ?? []).slice().sort(compareStrings);
  }
  return sets;
}

/** Build the catalog from every upstream row, sorted by name (DESIGN.md §4.2.1). */
export function buildCatalog(rows: UpstreamRow[], commit: string): Catalog {
  const items = rows.map(itemFromRow).sort((a, b) => compareStrings(a.name, b.name));
  for (let i = 1; i < items.length; i++) {
    const previous = items[i - 1];
    const current = items[i];
    if (previous !== undefined && current !== undefined && previous.name === current.name) {
      fail(`duplicate item name ${JSON.stringify(current.name)}`);
    }
  }
  return { source: { repo: SOURCE_REPO, commit }, items, sets: setsOf(items) };
}

/** The curated lists whose every name must be a catalog item name (DESIGN.md §4.3). */
export const CURATED_LISTS = [
  { file: 'lucky.json', key: 'items' },
  { file: 'lucky.json', key: 'excludedNpcPhotos' },
  { file: 'seasonal.json', key: 'spring' },
  { file: 'seasonal.json', key: 'summer' },
  { file: 'seasonal.json', key: 'autumn' },
  { file: 'seasonal.json', key: 'winter' },
  { file: 'trash.json', key: 'items' },
] as const;

export type CuratedMiss = { file: string; key: string; name: string };

/**
 * Every curated name must equal a catalog item name exactly, case included. A name with
 * no match is a loud failure, never a skip (DESIGN.md §4.3).
 */
export function findCuratedMisses(
  curated: Map<string, unknown>,
  items: CatalogItem[],
): CuratedMiss[] {
  const names = new Set(items.map((item) => item.name));
  const misses: CuratedMiss[] = [];
  for (const { file, key } of CURATED_LISTS) {
    const doc = curated.get(file);
    if (typeof doc !== 'object' || doc === null) fail(`curated/${file}: expected an object`);
    const list = (doc as Record<string, unknown>)[key];
    if (!Array.isArray(list)) fail(`curated/${file}: ${key} is not a list`);
    list.forEach((entry, i) => {
      const name = requiredString(entry, `curated/${file} ${key}[${i}]`);
      if (!names.has(name)) misses.push({ file, key, name });
    });
  }
  return misses;
}

/**
 * The 40-character commit SHA recorded in `data/SOURCE.md` (DESIGN.md §4.1), which the
 * catalog carries as its provenance.
 */
export function commitFromSourceMd(text: string, where: string): string {
  const match = /`([0-9a-f]{40})`/.exec(text);
  const sha = match?.[1];
  if (sha === undefined) fail(`${where}: no 40-character commit SHA found`);
  return sha;
}

/**
 * Serialize the catalog: one line per item and per set, so the committed file stays
 * readable and reviewable while every run of the same inputs gives byte-identical
 * output. Key order is fixed by the object literals above, which JSON.stringify
 * preserves.
 */
export function serializeCatalog(catalog: Catalog): string {
  const lines: string[] = ['{', `  "source": ${JSON.stringify(catalog.source)},`, '  "items": ['];
  catalog.items.forEach((item, i) => {
    lines.push(`    ${JSON.stringify(item)}${i === catalog.items.length - 1 ? '' : ','}`);
  });
  lines.push('  ],', '  "sets": {');
  const setNames = Object.keys(catalog.sets);
  setNames.forEach((set, i) => {
    const members = JSON.stringify(catalog.sets[set]);
    lines.push(`    ${JSON.stringify(set)}: ${members}${i === setNames.length - 1 ? '' : ','}`);
  });
  lines.push('  }', '}');
  return `${lines.join('\n')}\n`;
}
