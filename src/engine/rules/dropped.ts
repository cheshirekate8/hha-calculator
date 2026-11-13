// §6.15 Dropped items: −1 for every non-furniture item left on the floor (clothing,
// materials, and so on), which the input model counts rather than names (§5). The count is
// validated when the house is resolved (`resolve.ts`), so it is a non-negative integer here.
// Confidence: supported (RULES.dropped).
import type { Line, RoomContext, RoomRule } from '../types.ts';

/** §6.15: per dropped item. */
const PER_ITEM = -1;

export const droppedRule: RoomRule = (context: RoomContext): Line[] => {
  const dropped = context.room.droppedItems ?? 0;

  // Nothing dropped, no line (§5.1).
  if (dropped === 0) return [];

  return [
    {
      rule: 'dropped',
      points: PER_ITEM * dropped,
      detail: `${String(dropped)} ${dropped === 1 ? 'item' : 'items'} dropped on the floor, -1 each`,
      // Dropped items are counted, not named, so this line credits no catalog item.
      items: [],
    },
  ];
};
