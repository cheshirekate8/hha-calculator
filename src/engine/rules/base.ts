// §6.1 base points: the sum of `basePoints` × quantity for every placed item in the room,
// plus the room's wallpaper and flooring, which score their base points once each.
// Confidence: supported (RULES.base).
import type { Line, ResolvedRef, RoomContext, RoomRule } from '../types.ts';

export const baseRule: RoomRule = (context: RoomContext): Line[] => {
  let points = 0;
  /** Catalog names that actually earned points, each once, in the order they were met. */
  const items: string[] = [];
  const credited = new Set<string>();

  const credit = (ref: ResolvedRef, earned: number): void => {
    points += earned;
    if (earned !== 0 && !credited.has(ref.item.name)) {
      credited.add(ref.item.name);
      items.push(ref.item.name);
    }
  };

  let pieces = 0;
  for (const placement of context.items) {
    pieces += placement.quantity;
    credit(placement, placement.item.basePoints * placement.quantity);
  }
  if (context.wallpaper) credit(context.wallpaper, context.wallpaper.item.basePoints);
  if (context.flooring) credit(context.flooring, context.flooring.item.basePoints);

  // A line exists only for non-zero points, so a room of 0-point items earns none (§5.1).
  if (points === 0) return [];

  const counted: string[] = [];
  if (pieces > 0) counted.push(`${String(pieces)} placed ${pieces === 1 ? 'piece' : 'pieces'}`);
  if (context.wallpaper) counted.push('wallpaper');
  if (context.flooring) counted.push('flooring');

  return [{ rule: 'base', points, detail: `Base points for ${list(counted)}`, items }];
};

function list(parts: string[]): string {
  if (parts.length <= 1) return parts.join('');
  return `${parts.slice(0, -1).join(', ')} and ${String(parts[parts.length - 1])}`;
}
