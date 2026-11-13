// Catalog search and variant labels for the room editor (DESIGN.md §10.2, §10.5).
// Pure: it reads the catalog it is given, returns the catalog's own item objects, and
// never mutates anything (§2.1).
import type { Catalog, CatalogItem, CatalogVariant } from '../engine/types.ts';

/** Which slot the editor is filling: a placed item, the wallpaper, or the flooring. */
export type SearchKind = 'item' | 'wallpaper' | 'flooring';

/** The sheets that hold the two whole-room surfaces; everything else is an item (§4.2.1). */
const WALLPAPER_SHEET = 'Wallpaper';
const FLOORING_SHEET = 'Floors';

function matchesKind(item: CatalogItem, kind: SearchKind): boolean {
  if (kind === 'wallpaper') return item.sheet === WALLPAPER_SHEET;
  if (kind === 'flooring') return item.sheet === FLOORING_SHEET;
  return item.sheet !== WALLPAPER_SHEET && item.sheet !== FLOORING_SHEET;
}

/**
 * Where a name matches the query, best first: 0 the name starts with it, 1 a later word
 * (after a space) starts with it, 2 it appears anywhere else. -1 means no match.
 */
function rankOf(name: string, query: string): number {
  const lower = name.toLowerCase();
  if (lower.startsWith(query)) return 0;
  if (lower.includes(` ${query}`)) return 1;
  if (lower.includes(query)) return 2;
  return -1;
}

/**
 * The catalog items of `kind` whose name matches `query`, best matches first and each
 * group in catalog order, capped at `limit`. Matching ignores case and surrounding
 * spaces; an empty query finds nothing. Results are the catalog's own objects.
 */
export function searchCatalog(
  catalog: Catalog,
  query: string,
  kind: SearchKind,
  limit = 50,
): CatalogItem[] {
  const needle = query.trim().toLowerCase();
  if (needle === '') return [];

  const prefix: CatalogItem[] = [];
  const laterWord: CatalogItem[] = [];
  const inside: CatalogItem[] = [];
  for (const item of catalog.items) {
    if (!matchesKind(item, kind)) continue;
    const rank = rankOf(item.name, needle);
    if (rank === 0) prefix.push(item);
    else if (rank === 1) laterWord.push(item);
    else if (rank === 2) inside.push(item);
  }
  // Concatenating keeps each group in the order the catalog itself is in (§4.2.1).
  return prefix.concat(laterWord, inside).slice(0, limit);
}

/** How a variant reads in the editor: variation and pattern joined, or "Default". */
export function variantLabel(variant: CatalogVariant): string {
  const parts: string[] = [];
  if (variant.variation !== null) parts.push(variant.variation);
  if (variant.pattern !== null) parts.push(variant.pattern);
  return parts.length === 0 ? 'Default' : parts.join(' / ');
}
