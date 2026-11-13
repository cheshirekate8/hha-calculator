// §6.7 Category: every `hhaCategory` with at least 3 unique items in the room scores.
// Categories come from the placed variant, and a `null` category is no category; the
// room's wallpaper and flooring count once each (§6, "Which items a room rule looks at").
// The award is the `categoryBonus` option (§8): `per-category` adds 500 per qualifying
// category, `per-item` adds 500 × the unique items in each qualifying category.
// Confidence: disputed (RULES.category).
import type { Line, ResolvedRef, RoomContext, RoomRule } from '../types.ts';

/** The fewest unique items — distinct catalog names (§6) — that make a category qualify. */
const THRESHOLD = 3;
const POINTS = 500;

export const categoryRule: RoomRule = (context: RoomContext): Line[] => {
  /** Category to the distinct item names carrying it, in the order they were met. */
  const categories = new Map<string, string[]>();

  const count = (ref: ResolvedRef): void => {
    const category = ref.variant.category;
    if (category === null) return;
    let names = categories.get(category);
    if (!names) {
      names = [];
      categories.set(category, names);
    }
    // Unique means a distinct name, so a second copy or a second variant adds nothing.
    if (!names.includes(ref.item.name)) names.push(ref.item.name);
  };

  for (const placement of context.items) count(placement);
  if (context.wallpaper) count(context.wallpaper);
  if (context.flooring) count(context.flooring);

  const qualifying = [...categories.entries()]
    .filter(([, names]) => names.length >= THRESHOLD)
    // Plain `<`, never `localeCompare`, whose order depends on ICU data (§2.1).
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
  if (qualifying.length === 0) return [];

  const perItem = context.options.categoryBonus === 'per-item';
  let points = 0;
  const items: string[] = [];
  const credited = new Set<string>();
  for (const [, names] of qualifying) {
    points += perItem ? POINTS * names.length : POINTS;
    for (const name of names) {
      // One item can qualify in two categories when its variants differ; credit it once.
      if (!credited.has(name)) {
        credited.add(name);
        items.push(name);
      }
    }
  }

  const listed = qualifying.map(([category, names]) =>
    perItem ? `${category} (${String(names.length)})` : category,
  );
  const detail = perItem
    ? `${String(POINTS)} per unique item in ${String(qualifying.length)} ` +
      `${qualifying.length === 1 ? 'category' : 'categories'} of ${String(THRESHOLD)}+: ${listed.join(', ')}`
    : `${String(POINTS)} per category with ${String(THRESHOLD)}+ unique items: ${listed.join(', ')}`;

  return [{ rule: 'category', points, detail, items }];
};
