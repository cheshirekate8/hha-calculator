// §6.8 Color: a room where enough of the placed items share one colour.
//
// The share for a colour is (placed items whose variant colours include it, counted with
// quantity) ÷ (all placed items, counted with quantity). Wallpaper and flooring are not
// placed items and never count, as the source says (§6 readings). An item matches a colour
// if *either* of its two variant colours is that colour; an item with no colours still
// counts in the total and matches nothing. The best colour is the highest share, ties going
// to the name that sorts first under plain `<` (never `localeCompare`, whose order depends
// on ICU data — §2.1). The room needs ≥8 placed items; then ≥90% pays 600 and ≥70% pays
// 200, each × the *unique* items matching that colour.
// Confidence: supported (RULES.color).
import type { Line, RoomContext, RoomRule } from '../types.ts';

const HIGH_SHARE_POINTS = 600;
const SHARE_POINTS = 200;
/** Fewer than this many placed items (with quantity) and the bonus does not apply at all. */
const MINIMUM_ITEMS = 8;

export const colorRule: RoomRule = (context: RoomContext): Line[] => {
  let total = 0;
  /** Colour to the placed items (with quantity) wearing it, and the names behind them. */
  const tally = new Map<string, { count: number; names: string[]; credited: Set<string> }>();

  for (const placement of context.items) {
    total += placement.quantity;
    // A variant may list the same colour twice ("Red", "Red"): that is still one item.
    for (const color of new Set(placement.variant.colors)) {
      let entry = tally.get(color);
      if (!entry) {
        entry = { count: 0, names: [], credited: new Set<string>() };
        tally.set(color, entry);
      }
      entry.count += placement.quantity;
      if (!entry.credited.has(placement.item.name)) {
        entry.credited.add(placement.item.name);
        entry.names.push(placement.item.name);
      }
    }
  }

  if (total < MINIMUM_ITEMS) return [];

  let best: { color: string; count: number; names: string[] } | null = null;
  for (const [color, entry] of tally) {
    // Highest share wins, and every colour shares the denominator, so the count decides.
    const better =
      best === null || entry.count > best.count || (entry.count === best.count && color < best.color);
    if (better) best = { color, count: entry.count, names: entry.names };
  }
  if (best === null) return [];

  // Integer arithmetic, so a share like 7/10 lands exactly on its threshold.
  const highShare = best.count * 100 >= total * 90;
  if (!highShare && best.count * 100 < total * 70) return [];

  const perItem = highShare ? HIGH_SHARE_POINTS : SHARE_POINTS;
  const threshold = highShare ? '90%' : '70%';
  const unique = best.names.length;

  return [
    {
      rule: 'color',
      points: perItem * unique,
      detail:
        `${best.color} is on ${String(best.count)} of ${String(total)} placed items ` +
        `(at least ${threshold}): ${String(perItem)} × ${String(unique)} unique ` +
        `${best.color} ${unique === 1 ? 'item' : 'items'}`,
      items: best.names,
    },
  ];
};
