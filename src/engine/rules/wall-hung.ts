// §6.3 wall-hung items: +400 per placed item hung on a wall, for at most 3 of them (1,200).
// Confidence: supported (RULES['wall-hung']).
//
// An item hangs (§6 readings) when its `surface` is `wall` and its sheet is one of the four
// whose items can hang. Copies count, so one item ×2 fills two of the three paid slots, but
// the line's `items` names every qualifying item, even past the cap.
import type { Line, ResolvedPlacement, RoomContext, RoomRule } from '../types.ts';

/** The sheets whose items can hang on a wall (§6 readings). */
const HANGING_SHEETS: ReadonlySet<string> = new Set([
  'Wall-mounted',
  'Artwork',
  'Photos',
  'Posters',
]);

const POINTS_PER_ITEM = 400;

const MAX_ITEMS = 3;

export const wallHungRule: RoomRule = (context: RoomContext): Line[] => {
  let hung = 0;
  /** Every qualifying name, each once, in the order it was met — the cap hides none. */
  const items: string[] = [];
  const credited = new Set<string>();

  for (const placement of context.items) {
    if (!isWallHung(placement)) continue;
    hung += placement.quantity;
    if (!credited.has(placement.item.name)) {
      credited.add(placement.item.name);
      items.push(placement.item.name);
    }
  }

  // Nothing hanging is no award, so the rule adds no line (§5.1).
  if (hung === 0) return [];

  const paid = Math.min(hung, MAX_ITEMS);
  const detail =
    `${String(hung)} wall-hung ${hung === 1 ? 'item' : 'items'}: ` +
    `400 each for ${String(paid)} of them${hung > MAX_ITEMS ? ', capped at 3' : ''}`;

  return [{ rule: 'wall-hung', points: paid * POINTS_PER_ITEM, detail, items }];
};

function isWallHung(placement: ResolvedPlacement): boolean {
  return placement.placed.surface === 'wall' && HANGING_SHEETS.has(placement.item.sheet);
}
