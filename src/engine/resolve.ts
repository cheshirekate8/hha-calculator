// Resolving the house against the catalog, once, before any rule runs: every placed item,
// wallpaper and flooring becomes the catalog item and the single variant it names, with a
// checked quantity. An unknown name, an unmatched variant or a quantity that is not a
// positive integer is an Error naming the offending value, never a silent zero (§5.1).
import type {
  Catalog,
  CatalogItem,
  CatalogVariant,
  House,
  ItemRef,
  Options,
  PlacedItem,
  ResolvedPlacement,
  ResolvedRef,
  Room,
  RoomContext,
} from './types.ts';

/** Catalog names are unique (§4.2), so one lookup table serves the whole house. */
export function indexItems(catalog: Catalog): Map<string, CatalogItem> {
  const index = new Map<string, CatalogItem>();
  for (const item of catalog.items) index.set(item.name, item);
  return index;
}

export function resolveRoom(
  room: Room,
  index: Map<string, CatalogItem>,
  catalog: Catalog,
  house: House,
  options: Options,
): RoomContext {
  const where = `room "${room.name}"`;
  // The two counted penalties (§6.15, §6.16) are inputs like any other, so they are checked
  // here with everything else, before a rule runs — never clamped to 0 in the rule (§5.1).
  checkCount(room.droppedItems, 'droppedItems', where);
  checkCount(room.cockroaches, 'cockroaches', where);
  return {
    room,
    items: room.items.map((placed) => resolvePlacement(placed, index, where)),
    wallpaper: room.wallpaper ? resolveRef(room.wallpaper, index, `${where} wallpaper`) : null,
    flooring: room.flooring ? resolveRef(room.flooring, index, `${where} flooring`) : null,
    catalog,
    house,
    options,
  };
}

function resolvePlacement(
  placed: PlacedItem,
  index: Map<string, CatalogItem>,
  where: string,
): ResolvedPlacement {
  const resolved = resolveRef(placed, index, where);
  return { ...resolved, placed, quantity: resolveQuantity(placed, where) };
}

function resolveRef(ref: ItemRef, index: Map<string, CatalogItem>, where: string): ResolvedRef {
  const item = index.get(ref.name);
  if (!item) {
    throw new Error(`${where}: no catalog item is named "${ref.name}"`);
  }
  if (item.variants.length === 0) {
    throw new Error(`${where}: catalog item "${item.name}" has no variants`);
  }
  const variant = findVariant(item, ref);
  if (!variant) {
    throw new Error(`${where}: catalog item "${item.name}" has no variant with ${describe(ref)}`);
  }
  return { ref, item, variant };
}

/**
 * With neither field given, the item's first variant; otherwise the first variant matching
 * every field that is given (§5.1).
 */
function findVariant(item: CatalogItem, ref: ItemRef): CatalogVariant | undefined {
  const variation = ref.variation ?? null;
  const pattern = ref.pattern ?? null;
  if (variation === null && pattern === null) return item.variants[0];
  return item.variants.find(
    (variant) =>
      (variation === null || variant.variation === variation) &&
      (pattern === null || variant.pattern === pattern),
  );
}

function describe(ref: ItemRef): string {
  const given: string[] = [];
  if (ref.variation != null) given.push(`variation "${ref.variation}"`);
  if (ref.pattern != null) given.push(`pattern "${ref.pattern}"`);
  return given.join(' and ');
}

/**
 * `droppedItems` and `cockroaches` default to 0 and must be non-negative integers; anything
 * else is an Error naming that field, and only that field, so the UI can point at it (§6).
 */
function checkCount(count: number | undefined, field: string, where: string): void {
  if (count === undefined) return;
  if (!Number.isInteger(count) || count < 0) {
    throw new Error(
      `${where}: ${field} is ${String(count)}, but it must be a non-negative integer`,
    );
  }
}

/** Absent quantity means one copy; anything but a positive integer is a bad input (§5.1). */
function resolveQuantity(placed: PlacedItem, where: string): number {
  const quantity = placed.quantity ?? 1;
  if (!Number.isInteger(quantity) || quantity < 1) {
    throw new Error(
      `${where}: catalog item "${placed.name}" has quantity ${String(quantity)}, ` +
        'but quantity must be a positive integer',
    );
  }
  return quantity;
}
