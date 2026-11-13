// Persistence (DESIGN.md §10.4, §10.5): the save file format, its validation, the
// localStorage fallback and the export file name.
//
// A saved file is `{ "format": "hha-calculator", "version": 1, "house": …, "options": … }`.
// `parse` checks the shape and names the field at fault; it does not check item names
// against the catalog, because the engine does that (§10.5). Storage that is missing,
// invalid or throws falls back to `initialState()`, so a broken save can never stop the
// app opening.
//
// The module is pure apart from the storage object it is handed: no clock (the export date
// is an argument), no randomness, and it never mutates its arguments — a deep-frozen state
// serializes and saves fine.
import { DEFAULT_OPTIONS } from '../engine/score.ts';
import type {
  CategoryBonusOption,
  FacingWallScopeOption,
  FengShuiOption,
  House,
  ItemRef,
  NearWall,
  Options,
  PlacedItem,
  Room,
  Season,
  Stage,
  Surface,
} from '../engine/types.ts';
import { ROOMS_BY_STAGE, SEASONS, STAGES, initialState } from './model.ts';
import type { AppState } from './model.ts';

/** Where the autosave lives (§10.4). */
export const STORAGE_KEY = 'hha-calculator/state';

const FORMAT = 'hha-calculator';
const VERSION = 1;

/** Any object with `getItem`/`setItem`, as `localStorage` has. */
export type StateStorage = {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
};

export type ParseResult = { ok: true; state: AppState } | { ok: false; error: string };

const SURFACES = ['floor', 'tabletop', 'wall', 'ceiling'] as const satisfies readonly Surface[];
const NEAR_WALLS = ['north', 'east', 'south', 'west', 'none'] as const satisfies readonly NearWall[];
const CATEGORY_BONUSES = ['per-category', 'per-item'] as const satisfies readonly CategoryBonusOption[];
const FENG_SHUI = ['on', 'off'] as const satisfies readonly FengShuiOption[];
const FACING_WALL_SCOPES = ['any-tagged'] as const satisfies readonly FacingWallScopeOption[];

/** Writes the state as a save file. Key order is fixed, so the text is deterministic. */
export function serialize(state: AppState): string {
  return JSON.stringify({
    format: FORMAT,
    version: VERSION,
    house: state.house,
    options: state.options,
  });
}

/**
 * Reads a save file. Checks in order: JSON, format, version, stage, season, the rooms and
 * their contents, then options — so the first thing wrong is the thing reported.
 */
export function parse(text: string): ParseResult {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return { ok: false, error: 'not JSON: the file could not be read' };
  }
  try {
    return { ok: true, state: readFile(raw) };
  } catch (error) {
    if (error instanceof ParseError) return { ok: false, error: error.message };
    throw error;
  }
}

/** The saved state, or `initialState()` if nothing usable is stored (§10.5). */
export function loadState(storage: StateStorage): AppState {
  let text: string | null = null;
  try {
    text = storage.getItem(STORAGE_KEY);
  } catch {
    return initialState();
  }
  if (typeof text !== 'string') return initialState();
  const result = parse(text);
  return result.ok ? result.state : initialState();
}

/** Autosaves the state. `false` means storage refused it (quota, private mode). */
export function saveState(storage: StateStorage, state: AppState): boolean {
  try {
    storage.setItem(STORAGE_KEY, serialize(state));
    return true;
  } catch {
    return false;
  }
}

/** The download name for an export, by the date's UTC day so it never shifts by zone. */
export function exportFileName(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  const day = `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}`;
  return `hha-house-${day}.json`;
}

// --- Validation ---

class ParseError extends Error {}

function fail(message: string): never {
  throw new ParseError(message);
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isOneOf<T extends string>(allowed: readonly T[], value: unknown): value is T {
  return typeof value === 'string' && (allowed as readonly string[]).includes(value);
}

function readFile(raw: unknown): AppState {
  if (!isObject(raw)) fail('the file is not an object');
  if (raw.format !== FORMAT) fail(`format must be "${FORMAT}"`);
  if (raw.version !== VERSION) fail(`version must be ${VERSION}, not ${String(raw.version)}`);
  return { house: readHouse(raw.house), options: readOptions(raw.options) };
}

function readHouse(raw: unknown): House {
  if (!isObject(raw)) fail('house must be an object');
  // Stage and season come first, so an unknown stage is never blamed on the room count it
  // happens to disagree with.
  const stage = readChoice(raw.stage, STAGES, 'stage');
  const season = readChoice(raw.season, SEASONS, 'season');
  const expected = ROOMS_BY_STAGE[stage];
  const list = raw.rooms;
  if (!Array.isArray(list)) fail('rooms must be a list');
  if (list.length !== expected) {
    fail(`rooms must hold ${expected} room(s) at stage "${stage}", not ${list.length}`);
  }
  return { stage, season, rooms: list.map((room, i) => readRoom(room, `room ${i + 1}`)) };
}

function readRoom(raw: unknown, where: string): Room {
  if (!isObject(raw)) fail(`${where} must be an object`);
  const room: Room = { name: readString(raw.name, `${where} name`), items: [] };
  if ('wallpaper' in raw) room.wallpaper = readOptionalRef(raw.wallpaper, `${where} wallpaper`);
  if ('flooring' in raw) room.flooring = readOptionalRef(raw.flooring, `${where} flooring`);
  const items = raw.items;
  if (!Array.isArray(items)) fail(`${where} items must be a list`);
  room.items = items.map((item, i) => readItem(item, `${where} item ${i + 1}`));
  if ('droppedItems' in raw) room.droppedItems = readCount(raw.droppedItems, `${where} droppedItems`);
  if ('cockroaches' in raw) room.cockroaches = readCount(raw.cockroaches, `${where} cockroaches`);
  return room;
}

function readItem(raw: unknown, where: string): PlacedItem {
  if (!isObject(raw)) fail(`${where} must be an object`);
  const item: PlacedItem = {
    ...readRef(raw, where),
    surface: readChoice(raw.surface, SURFACES, `${where} surface`),
  };
  if ('quantity' in raw) item.quantity = readQuantity(raw.quantity, `${where} quantity`);
  if ('nearWall' in raw) item.nearWall = readChoice(raw.nearWall, NEAR_WALLS, `${where} nearWall`);
  if ('facingWall' in raw) {
    if (typeof raw.facingWall !== 'boolean') fail(`${where} facingWall must be true or false`);
    item.facingWall = raw.facingWall;
  }
  return item;
}

/** A catalog reference: a name, plus the variation and pattern that pick its variant (§5.1). */
function readRef(raw: Record<string, unknown>, where: string): ItemRef {
  const ref: ItemRef = { name: readString(raw.name, `${where} name`) };
  if ('variation' in raw) ref.variation = readNullableString(raw.variation, `${where} variation`);
  if ('pattern' in raw) ref.pattern = readNullableString(raw.pattern, `${where} pattern`);
  return ref;
}

function readOptionalRef(raw: unknown, where: string): ItemRef | null {
  if (raw === null || raw === undefined) return null;
  if (!isObject(raw)) fail(`${where} must be an object or null`);
  return readRef(raw, where);
}

function readOptions(raw: unknown): Options {
  if (raw === null || raw === undefined) return { ...DEFAULT_OPTIONS };
  if (!isObject(raw)) fail('options must be an object');
  // Each option is optional in a file: an older save simply gets the current default (§8).
  return {
    categoryBonus: raw.categoryBonus === undefined
      ? DEFAULT_OPTIONS.categoryBonus
      : readChoice(raw.categoryBonus, CATEGORY_BONUSES, 'options categoryBonus'),
    fengShui: raw.fengShui === undefined
      ? DEFAULT_OPTIONS.fengShui
      : readChoice(raw.fengShui, FENG_SHUI, 'options fengShui'),
    facingWallScope: raw.facingWallScope === undefined
      ? DEFAULT_OPTIONS.facingWallScope
      : readChoice(raw.facingWallScope, FACING_WALL_SCOPES, 'options facingWallScope'),
  };
}

function readChoice<T extends string>(value: unknown, allowed: readonly T[], where: string): T {
  if (!isOneOf(allowed, value)) {
    fail(`${where} must be one of: ${allowed.join(', ')}`);
  }
  return value;
}

function readString(value: unknown, where: string): string {
  if (typeof value !== 'string') fail(`${where} must be a string`);
  return value;
}

function readNullableString(value: unknown, where: string): string | null {
  if (value === null || value === undefined) return null;
  return readString(value, where);
}

function readQuantity(value: unknown, where: string): number {
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 1) {
    fail(`${where} must be a whole number of 1 or more`);
  }
  return value;
}

function readCount(value: unknown, where: string): number {
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 0) {
    fail(`${where} must be a whole number of 0 or more`);
  }
  return value;
}
