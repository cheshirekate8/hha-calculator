// §6.11 Seasonal items: +777 for each unique seasonal item placed anywhere in the house,
// counting only the list for `house.season` — the season is an input, never a clock (§2.1).
// Like lucky (§6.10) a name scores once for the whole house however many copies there are,
// and an item out of its season scores nothing.
// Confidence: supported (RULES.seasonal).
import { SEASONAL } from '../curated.ts';
import type { HouseContext, Line, HouseRule } from '../types.ts';

const PER_ITEM = 777;

export const seasonalRule: HouseRule = (context: HouseContext): Line[] => {
  const season = context.house.season;
  const inSeason = SEASONAL[season];
  // A season outside the union can only come from an unchecked input: it earns nothing
  // rather than throwing here, since resolve.ts owns input errors.
  if (!inSeason) return [];

  /** Each credited catalog name once, in the order the house's rooms place them. */
  const items: string[] = [];
  const credited = new Set<string>();

  for (const room of context.rooms) {
    for (const placement of room.items) {
      const name = placement.item.name;
      if (!inSeason.has(name) || credited.has(name)) continue;
      credited.add(name);
      items.push(name);
    }
  }

  if (items.length === 0) return [];

  const count = items.length;
  return [
    {
      rule: 'seasonal',
      points: PER_ITEM * count,
      detail: `${String(count)} ${season} ${count === 1 ? 'item' : 'items'} placed, ${String(PER_ITEM)} each`,
      items,
    },
  ];
};
