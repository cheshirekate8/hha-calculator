// The engine contract (§5.1): `score(house, catalog, options?)` and `DEFAULT_OPTIONS`.
//
// The engine is pure and deterministic (§2.1): the catalog and the season arrive as
// arguments, nothing is read from a clock, a random source or the file system, and the
// inputs are never mutated — a deep-frozen house scores fine.
//
// The total is the sum of its lines (§2.2): each room's total is the sum of its lines, the
// house total is the sum of the house-scope lines, and `total` is every room total plus
// the house total. There is no adjustment anywhere else in this file.
//
// Every rule is registered below. A rule not yet implemented returns no lines (DESIGN.md §12).
import { baseRule } from './rules/base.ts';
import { countRule } from './rules/count.ts';
import { wallHungRule } from './rules/wall-hung.ts';
import { seriesRule } from './rules/series.ts';
import { setRule } from './rules/set.ts';
import { conceptRule } from './rules/concept.ts';
import { categoryRule } from './rules/category.ts';
import { colorRule } from './rules/color.ts';
import { fengShuiRule } from './rules/feng-shui.ts';
import { luckyRule } from './rules/lucky.ts';
import { seasonalRule } from './rules/seasonal.ts';
import { typeRule } from './rules/type.ts';
import { trashRule } from './rules/trash.ts';
import { facingWallRule } from './rules/facing-wall.ts';
import { droppedRule } from './rules/dropped.ts';
import { cockroachRule } from './rules/cockroach.ts';
import { indexItems, resolveRoom } from './resolve.ts';
import type {
  Catalog,
  House,
  HouseContext,
  HouseRule,
  Line,
  Options,
  Result,
  RoomContext,
  RoomResult,
  RoomRule,
} from './types.ts';

/** The best-supported reading of every disputed or unknown rule (§8). */
export const DEFAULT_OPTIONS = {
  categoryBonus: 'per-category',
  fengShui: 'on',
  facingWallScope: 'any-tagged',
} as const satisfies Options;

// Every §6 rule is registered here, in §6 order; an unimplemented rule returns no lines.
const ROOM_RULES: RoomRule[] = [
  baseRule,
  countRule,
  wallHungRule,
  seriesRule,
  setRule,
  conceptRule,
  categoryRule,
  colorRule,
  fengShuiRule,
  trashRule,
  facingWallRule,
  droppedRule,
  cockroachRule,
];

const HOUSE_RULES: HouseRule[] = [
  luckyRule,
  seasonalRule,
  typeRule,
];

export function score(house: House, catalog: Catalog, options?: Partial<Options>): Result {
  const resolvedOptions = resolveOptions(options);
  const index = indexItems(catalog);

  // Resolve the whole house first, so a bad reference anywhere is an error before any
  // rule runs and no partially-scored result can escape (§5.1).
  const contexts = house.rooms.map((room) =>
    resolveRoom(room, index, catalog, house, resolvedOptions),
  );

  const rooms: RoomResult[] = contexts.map((context) => {
    const lines = runRoomRules(context);
    return { name: context.room.name, total: sum(lines), lines };
  });

  const houseContext: HouseContext = {
    house,
    rooms: contexts,
    catalog,
    options: resolvedOptions,
  };
  const houseLines = runHouseRules(houseContext);

  return {
    total: rooms.reduce((running, room) => running + room.total, 0) + sum(houseLines),
    rooms,
    house: { total: sum(houseLines), lines: houseLines },
  };
}

/** A partial `options` object is merged over the defaults; an absent field keeps its default. */
export function resolveOptions(options?: Partial<Options>): Options {
  return {
    categoryBonus: options?.categoryBonus ?? DEFAULT_OPTIONS.categoryBonus,
    fengShui: options?.fengShui ?? DEFAULT_OPTIONS.fengShui,
    facingWallScope: options?.facingWallScope ?? DEFAULT_OPTIONS.facingWallScope,
  };
}

function runRoomRules(context: RoomContext): Line[] {
  const lines: Line[] = [];
  for (const rule of ROOM_RULES) lines.push(...rule(context));
  return lines;
}

function runHouseRules(context: HouseContext): Line[] {
  const lines: Line[] = [];
  for (const rule of HOUSE_RULES) lines.push(...rule(context));
  return lines;
}

function sum(lines: Line[]): number {
  return lines.reduce((running, line) => running + line.points, 0);
}
