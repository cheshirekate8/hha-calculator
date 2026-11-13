// §6.6 Concept: if the room's largest concept has at least 5 items, counting duplicates,
// it scores 400 × that count. An item counts toward each concept its placed variant lists,
// and the room's wallpaper and flooring count once each (§6, "Which items a room rule
// looks at"). Only the largest concept scores; a tie goes to the name that sorts first.
// Confidence: supported (RULES.concept).
import type { Line, ResolvedRef, RoomContext, RoomRule } from '../types.ts';

/** The fewest items, duplicates included, that make a concept score at all. */
const THRESHOLD = 5;
const POINTS_PER_ITEM = 400;

/** One concept's tally: how many items carry it, and each credited name once, in order. */
type Tally = {
  concept: string;
  count: number;
  items: string[];
  credited: Set<string>;
};

export const conceptRule: RoomRule = (context: RoomContext): Line[] => {
  const tallies = new Map<string, Tally>();

  const count = (ref: ResolvedRef, quantity: number): void => {
    for (const concept of ref.variant.concepts) {
      let tally = tallies.get(concept);
      if (!tally) {
        tally = { concept, count: 0, items: [], credited: new Set<string>() };
        tallies.set(concept, tally);
      }
      tally.count += quantity;
      if (!tally.credited.has(ref.item.name)) {
        tally.credited.add(ref.item.name);
        tally.items.push(ref.item.name);
      }
    }
  };

  for (const placement of context.items) count(placement, placement.quantity);
  // Wallpaper and flooring are not placed items, so each counts once (§6).
  if (context.wallpaper) count(context.wallpaper, 1);
  if (context.flooring) count(context.flooring, 1);

  const largest = rank([...tallies.values()]);
  if (!largest || largest.count < THRESHOLD) return [];

  return [
    {
      rule: 'concept',
      points: POINTS_PER_ITEM * largest.count,
      detail:
        `Largest concept "${largest.concept}": ${String(largest.count)} items ` +
        `× ${String(POINTS_PER_ITEM)}`,
      items: largest.items,
    },
  ];
};

/**
 * The tally with the most items; a tie goes to the concept name that sorts first under
 * plain `<`, never `localeCompare`, whose order depends on ICU data (§2.1).
 */
function rank(tallies: Tally[]): Tally | null {
  let best: Tally | null = null;
  for (const tally of tallies) {
    const better =
      !best || tally.count > best.count || (tally.count === best.count && tally.concept < best.concept);
    if (better) best = tally;
  }
  return best;
}
