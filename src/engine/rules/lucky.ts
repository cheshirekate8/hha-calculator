// §6.10 Lucky items: +777 for each unique lucky item placed anywhere in the house. The
// list is hand-curated (§4.3) and read through curated.ts, because the catalog carries no
// lucky flag. Copies never pay twice: a name scores once for the whole house, however many
// rooms hold it and whatever its quantity (§6, "Lucky and seasonal").
// Confidence: supported (RULES.lucky).
import { LUCKY } from '../curated.ts';
import type { HouseContext, Line, HouseRule } from '../types.ts';

const PER_ITEM = 777;

export const luckyRule: HouseRule = (context: HouseContext): Line[] => {
  /** Each credited catalog name once, in the order the house's rooms place them. */
  const items: string[] = [];
  const credited = new Set<string>();

  for (const room of context.rooms) {
    for (const placement of room.items) {
      const name = placement.item.name;
      if (!LUCKY.has(name) || credited.has(name)) continue;
      credited.add(name);
      items.push(name);
    }
  }

  // No lucky item, no line: a house rule adds at most one line, for non-zero points (§5.1).
  if (items.length === 0) return [];

  const count = items.length;
  return [
    {
      rule: 'lucky',
      points: PER_ITEM * count,
      detail: `${String(count)} lucky ${count === 1 ? 'item' : 'items'} placed, ${String(PER_ITEM)} each`,
      items,
    },
  ];
};
