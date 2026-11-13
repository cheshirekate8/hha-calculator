// §6.2 furniture count: +1,000 at each of 6, 10, 15 and 20 furniture pieces in the room,
// stacking to a maximum of 4,000. Confidence: supported (RULES.count); what counts as
// furniture is our reading (§6).
//
// Furniture (§6 readings) is every placed item, duplicates included, except items from the
// Rugs sheet and trash (`trash.json`). Wallpaper and flooring are not placed items, so the
// rule never sees them. Pieces are counted with quantity: one item ×6 reaches the first
// threshold on its own.
import { TRASH } from '../curated.ts';
import type { Line, ResolvedPlacement, RoomContext, RoomRule } from '../types.ts';

/** Each threshold reached adds 1,000; past 20 nothing more is earned (max 4,000). */
const THRESHOLDS = [6, 10, 15, 20];

const POINTS_PER_THRESHOLD = 1000;

export const countRule: RoomRule = (context: RoomContext): Line[] => {
  let pieces = 0;
  /** The names counted, each once, in the order they were met. */
  const items: string[] = [];
  const credited = new Set<string>();

  for (const placement of context.items) {
    if (!isFurniture(placement)) continue;
    pieces += placement.quantity;
    if (!credited.has(placement.item.name)) {
      credited.add(placement.item.name);
      items.push(placement.item.name);
    }
  }

  const reached = THRESHOLDS.filter((threshold) => pieces >= threshold);
  // Below the first threshold the rule awards nothing, so it adds no line (§5.1).
  if (reached.length === 0) return [];

  const detail =
    `${String(pieces)} furniture ${pieces === 1 ? 'piece' : 'pieces'}: ` +
    `1,000 for each of the ${list(reached.map(String))} thresholds reached`;

  return [
    { rule: 'count', points: reached.length * POINTS_PER_THRESHOLD, detail, items },
  ];
};

function isFurniture(placement: ResolvedPlacement): boolean {
  return placement.item.sheet !== 'Rugs' && !TRASH.has(placement.item.name);
}

function list(parts: string[]): string {
  if (parts.length <= 1) return parts.join('');
  return `${parts.slice(0, -1).join(', ')} and ${String(parts[parts.length - 1])}`;
}
