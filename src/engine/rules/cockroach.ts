// §6.16 Cockroaches: −2,500 each, for the roaches that appear in a house left unvisited.
// Like dropped items they are counted, not named (§5); the count is validated when the
// house is resolved (`resolve.ts`), so it is a non-negative integer here.
// Confidence: supported (RULES.cockroach).
import type { Line, RoomContext, RoomRule } from '../types.ts';

/** §6.16: per cockroach. */
const PER_ROACH = -2500;

export const cockroachRule: RoomRule = (context: RoomContext): Line[] => {
  const roaches = context.room.cockroaches ?? 0;

  // No roaches, no line (§5.1).
  if (roaches === 0) return [];

  return [
    {
      rule: 'cockroach',
      points: PER_ROACH * roaches,
      detail: `${String(roaches)} ${roaches === 1 ? 'cockroach' : 'cockroaches'}, -2,500 each`,
      // Cockroaches are not catalog items, so this line credits none.
      items: [],
    },
  ];
};
