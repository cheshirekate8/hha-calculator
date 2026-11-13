// §6.4 Series. The room's series are ranked by how many *unique* items of each the room
// holds; the largest one scores 1,000 per item in it, duplicates included. Only the
// largest series scores, and a tie goes to the series name that sorts first under plain
// `<` (§6 readings). The room's wallpaper and flooring count toward a series, each once.
// Confidence: supported (the unique-vs-all multiplier is our reading).
import type { Line, ResolvedRef, RoomContext, RoomRule } from '../types.ts';

/** The threshold the largest series must reach, in unique items (§6.4). */
const UNIQUE_THRESHOLD = 4;
const POINTS_PER_ITEM = 1000;

type Tally = {
  /** Distinct catalog names, in the order they were met: two variants of one item is one. */
  names: string[];
  unique: Set<string>;
  /** Every item of the series in the room, duplicates included. */
  count: number;
};

export const seriesRule: RoomRule = (context: RoomContext): Line[] => {
  const tallies = new Map<string, Tally>();

  const add = (ref: ResolvedRef, quantity: number): void => {
    const series = ref.item.series;
    if (series === null) return;
    let tally = tallies.get(series);
    if (!tally) {
      tally = { names: [], unique: new Set<string>(), count: 0 };
      tallies.set(series, tally);
    }
    tally.count += quantity;
    if (!tally.unique.has(ref.item.name)) {
      tally.unique.add(ref.item.name);
      tally.names.push(ref.item.name);
    }
  };

  for (const placement of context.items) add(placement, placement.quantity);
  // Wallpaper and flooring are not placed items, so each counts once (§6 readings).
  if (context.wallpaper) add(context.wallpaper, 1);
  if (context.flooring) add(context.flooring, 1);

  let winner: string | null = null;
  let best: Tally | null = null;
  for (const [series, tally] of tallies) {
    // Ranked by unique count, never by the total; a tie goes to the first-sorting name.
    const better = best === null
      || tally.unique.size > best.unique.size
      || (tally.unique.size === best.unique.size && series < (winner as string));
    if (better) {
      winner = series;
      best = tally;
    }
  }

  if (winner === null || best === null || best.unique.size < UNIQUE_THRESHOLD) return [];

  const points = POINTS_PER_ITEM * best.count;
  const detail = `Largest series "${winner}": ${String(best.unique.size)} unique `
    + `${best.unique.size === 1 ? 'item' : 'items'}, ${String(best.count)} in all`;
  return [{ rule: 'series', points, detail, items: best.names }];
};
