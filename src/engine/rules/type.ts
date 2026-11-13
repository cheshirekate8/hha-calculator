// §6.12 Type bonus: +2,500 once when the house holds a chair, a table, a bed, and a
// wardrobe or dresser, in any rooms. Detection is by exact tag, `interact` value and
// variant category (§6, "Type-bonus detection"), so a `TableClock` tag is not a table and
// a `Dresser` tag alone fills nothing. The line credits every item that fills any slot.
// Confidence: supported (RULES.type).
import type { HouseContext, Line, HouseRule, ResolvedPlacement } from '../types.ts';

const AWARD = 2500;

/** The four slots, each with the §6 reading of what fills it. */
const SLOTS = [
  {
    label: 'a chair',
    fills: (p: ResolvedPlacement): boolean => p.item.tag === 'Chair' || p.item.interact === 'Chair',
  },
  {
    label: 'a table',
    fills: (p: ResolvedPlacement): boolean => p.item.tag === 'Table',
  },
  {
    label: 'a bed',
    fills: (p: ResolvedPlacement): boolean => p.item.tag === 'Bed' || p.item.interact === 'Bed',
  },
  {
    label: 'a wardrobe or dresser',
    fills: (p: ResolvedPlacement): boolean =>
      p.item.interact === 'Wardrobe' || p.variant.category === 'Dresser',
  },
] as const;

export const typeRule: HouseRule = (context: HouseContext): Line[] => {
  const filled = SLOTS.map(() => false);
  /** Each item filling any slot, named once, in the order the house's rooms place them. */
  const items: string[] = [];
  const credited = new Set<string>();

  for (const room of context.rooms) {
    for (const placement of room.items) {
      let fillsAny = false;
      for (const [index, slot] of SLOTS.entries()) {
        if (!slot.fills(placement)) continue;
        filled[index] = true;
        fillsAny = true;
      }
      const name = placement.item.name;
      if (!fillsAny || credited.has(name)) continue;
      credited.add(name);
      items.push(name);
    }
  }

  // All or nothing: a missing slot means no line at all (§5.1).
  if (!filled.every(Boolean)) return [];

  return [
    {
      rule: 'type',
      points: AWARD,
      detail: `The house has ${SLOTS.map((slot) => slot.label).join(', ')}`,
      items,
    },
  ];
};
