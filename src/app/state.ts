// The app reducer (DESIGN.md §10.5): every edit the screens make to `AppState`, as one
// pure function. No I/O, no clock, no randomness and no React — and it never mutates its
// arguments, so a state object handed out once can be compared by identity and kept in
// React state safely.
//
// The reducer does not validate values: a quantity of 0, an unknown item name or a
// nonsense count all travel through to the engine, which reports them, and the screen
// shows that error (§10.5). What it does check is *addressing*: an action naming a room
// or an item position that does not exist is a no-op that returns the very same state
// object, so a stale click after a stage change cannot corrupt the house.
import { DEFAULT_ROOM_NAMES, ROOMS_BY_STAGE } from './model.ts';
import type { AppState } from './model.ts';
import type { ItemRef, Options, PlacedItem, Room, Season, Stage } from '../engine/types.ts';

/** `{ type: "setOption", option, value }` for one option at a time, each value its own (§8). */
type SetOptionAction = {
  [K in keyof Options]: { type: 'setOption'; option: K; value: Options[K] };
}[keyof Options];

/** Every edit the screens can make. `room` and `index` are zero-based positions. */
export type Action =
  | { type: 'setStage'; stage: Stage }
  | { type: 'setSeason'; season: Season }
  | SetOptionAction
  | { type: 'renameRoom'; room: number; name: string }
  | { type: 'setWallpaper'; room: number; ref: ItemRef | null }
  | { type: 'setFlooring'; room: number; ref: ItemRef | null }
  | { type: 'addItem'; room: number; item: PlacedItem }
  | { type: 'updateItem'; room: number; index: number; patch: Partial<PlacedItem> }
  | { type: 'removeItem'; room: number; index: number }
  | { type: 'setDroppedItems'; room: number; count: number }
  | { type: 'setCockroaches'; room: number; count: number }
  | { type: 'replace'; state: AppState };

/**
 * Replace one room. `change` returning the room it was given means "nothing to do" — that
 * is how the item actions report an index that does not exist — and then the original
 * state object comes back unchanged.
 */
function withRoom(state: AppState, room: number, change: (room: Room) => Room): AppState {
  const rooms = state.house.rooms;
  const current = Number.isInteger(room) ? rooms[room] : undefined;
  if (current === undefined) return state;
  const next = change(current);
  if (next === current) return state;
  const copy = rooms.slice();
  copy[room] = next;
  return { ...state, house: { ...state.house, rooms: copy } };
}

/**
 * Replace one room's items, or return the room untouched when `index` addresses nothing.
 * `change` edits a fresh copy of the array and is handed the item already at `index`.
 */
function withItems(
  room: Room,
  index: number,
  change: (items: PlacedItem[], item: PlacedItem) => void,
): Room {
  const current = Number.isInteger(index) ? room.items[index] : undefined;
  if (current === undefined) return room;
  const items = room.items.slice();
  change(items, current);
  return { ...room, items };
}

export function reduce(state: AppState, action: Action): AppState {
  switch (action.type) {
    case 'setStage': {
      // Grow or shrink from the end: the rooms that survive keep their names and contents,
      // and a new room arrives with its default name and nothing in it (§10.5).
      const count = ROOMS_BY_STAGE[action.stage];
      const rooms = state.house.rooms.slice(0, count);
      for (const name of DEFAULT_ROOM_NAMES.slice(rooms.length, count)) {
        rooms.push({ name, items: [] });
      }
      return { ...state, house: { ...state.house, stage: action.stage, rooms } };
    }
    case 'setSeason':
      return { ...state, house: { ...state.house, season: action.season } };
    case 'setOption':
      return { ...state, options: { ...state.options, [action.option]: action.value } };
    case 'renameRoom':
      return withRoom(state, action.room, (room) => ({ ...room, name: action.name }));
    case 'setWallpaper':
      return withRoom(state, action.room, (room) => ({ ...room, wallpaper: action.ref }));
    case 'setFlooring':
      return withRoom(state, action.room, (room) => ({ ...room, flooring: action.ref }));
    case 'setDroppedItems':
      return withRoom(state, action.room, (room) => ({ ...room, droppedItems: action.count }));
    case 'setCockroaches':
      return withRoom(state, action.room, (room) => ({ ...room, cockroaches: action.count }));
    case 'addItem':
      return withRoom(state, action.room, (room) => ({
        ...room,
        items: [...room.items, action.item],
      }));
    case 'updateItem':
      return withRoom(state, action.room, (room) =>
        withItems(room, action.index, (items, item) => {
          items[action.index] = { ...item, ...action.patch };
        }));
    case 'removeItem':
      return withRoom(state, action.room, (room) =>
        withItems(room, action.index, (items) => {
          items.splice(action.index, 1);
        }));
    case 'replace':
      // The caller already holds the state it wants (an import, or an undo): hand back that
      // object itself, so a screen can tell a replace from an edit by identity.
      return action.state;
    default:
      return state;
  }
}
