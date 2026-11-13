// §6.14 Facing a wall: −300 for every placed item tagged `facingWall: true`, counted with
// quantity. Which items can really incur this is unknown (§8): only "directional" items
// should, but that flag is not in our data, so under the only `facingWallScope` reading we
// have — `any-tagged` — every tagged item is penalised.
// Confidence: supported, with the scope unknown (RULES['facing-wall']).
import type { Line, RoomContext, RoomRule } from '../types.ts';

/** §6.14: per item, multiplied by quantity (§6, "Penalties"). */
const PER_ITEM = -300;

export const facingWallRule: RoomRule = (context: RoomContext): Line[] => {
  let facing = 0;
  /** The names penalised, each once, in the order they were met. */
  const items: string[] = [];
  const credited = new Set<string>();

  for (const placement of context.items) {
    // Only an explicit tag counts: `false` and an absent flag are both "not facing a wall".
    if (placement.placed.facingWall !== true) continue;
    facing += placement.quantity;
    if (!credited.has(placement.item.name)) {
      credited.add(placement.item.name);
      items.push(placement.item.name);
    }
  }

  // Nothing tagged, no line (§5.1).
  if (facing === 0) return [];

  return [
    {
      rule: 'facing-wall',
      points: PER_ITEM * facing,
      detail: `${String(facing)} ${facing === 1 ? 'item faces' : 'items face'} a wall, -300 each`,
      items,
    },
  ];
};
