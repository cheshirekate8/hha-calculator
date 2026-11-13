// §6.13 Trash: −500 for every piece of trash on the floor, counted with quantity.
// Trash is recognised by name from the curated list (§4.3), never from a category: a
// garbage *can* is furniture (`hhaCategory: "Trash"`) and must never be penalised, and an
// item on the upstream `Other` sheet that is not in the list is not trash either.
// Confidence: supported (RULES.trash).
import { TRASH } from '../curated.ts';
import type { Line, RoomContext, RoomRule } from '../types.ts';

/** §6.13: per piece, multiplied by quantity (§6, "Penalties"). */
const PER_PIECE = -500;

export const trashRule: RoomRule = (context: RoomContext): Line[] => {
  let pieces = 0;
  /** The trash names penalised, each once, in the order they were met. */
  const items: string[] = [];
  const credited = new Set<string>();

  for (const placement of context.items) {
    if (!TRASH.has(placement.item.name)) continue;
    pieces += placement.quantity;
    if (!credited.has(placement.item.name)) {
      credited.add(placement.item.name);
      items.push(placement.item.name);
    }
  }

  // No trash, no line (§5.1).
  if (pieces === 0) return [];

  return [
    {
      rule: 'trash',
      points: PER_PIECE * pieces,
      detail: `${String(pieces)} ${pieces === 1 ? 'piece' : 'pieces'} of trash, -500 each`,
      items,
    },
  ];
};
