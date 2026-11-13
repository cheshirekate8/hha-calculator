// §6.9 Feng shui: +500 for each of east/red, south/green and west/yellow where at least one
// placed item near that wall wears the matching colour. Three walls, so 1,500 at most, and
// a second item on a wall already earned adds nothing — quantity never helps either. Only
// placed items are looked at, because only they carry `nearWall` (§6 readings). The rule is
// disputed (§8): with `options.fengShui` set to `off` it awards nothing at all.
// Confidence: disputed (RULES['feng-shui']).
import type { Line, NearWall, RoomContext, RoomRule } from '../types.ts';

const POINTS_PER_WALL = 500;

/** The three scoring walls, in §6.9 order. A wall not listed here never scores. */
const WALLS = [
  { wall: 'east', color: 'Red', label: 'red on the east wall' },
  { wall: 'south', color: 'Green', label: 'green on the south wall' },
  { wall: 'west', color: 'Yellow', label: 'yellow on the west wall' },
] as const satisfies readonly { wall: NearWall; color: string; label: string }[];

export const fengShuiRule: RoomRule = (context: RoomContext): Line[] => {
  if (context.options.fengShui === 'off') return [];

  const earned: string[] = [];
  /** Names that put a colour on a wall, each once; a red item near north is not one. */
  const items: string[] = [];
  const credited = new Set<string>();

  for (const { wall, color, label } of WALLS) {
    let scored = false;
    for (const placement of context.items) {
      if (placement.placed.nearWall !== wall) continue;
      // Either of the item's two variant colours counts (§6 readings).
      if (!placement.variant.colors.includes(color)) continue;
      scored = true;
      if (!credited.has(placement.item.name)) {
        credited.add(placement.item.name);
        items.push(placement.item.name);
      }
    }
    if (scored) earned.push(label);
  }

  if (earned.length === 0) return [];

  return [
    {
      rule: 'feng-shui',
      points: POINTS_PER_WALL * earned.length,
      detail: `Feng shui: ${list(earned)} (${String(POINTS_PER_WALL)} per wall)`,
      items,
    },
  ];
};

function list(parts: string[]): string {
  if (parts.length <= 1) return parts.join('');
  return `${parts.slice(0, -1).join(', ')} and ${String(parts[parts.length - 1])}`;
}
