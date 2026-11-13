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
// Rules are added by registering them below; §6.1 is the only one implemented so far, so
// every other rule produces no lines yet.
import { baseRule } from './rules/base.ts';
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

const ROOM_RULES: RoomRule[] = [baseRule];

const HOUSE_RULES: HouseRule[] = [];

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
