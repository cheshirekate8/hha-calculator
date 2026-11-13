// The app's shared model (DESIGN.md §10.5): the state the screens edit and the facts about
// house stages that both the reducer (src/app/state.ts) and persistence (src/app/persist.ts)
// rely on. Written at planning time so parallel tasks never both create it.
import { DEFAULT_OPTIONS } from '../engine/score.ts';
import type { House, Options, Season, Stage } from '../engine/types.ts';

/** Everything the app saves: the house being scored and the disputed-rule switches (§8). */
export type AppState = { house: House; options: Options };

export const STAGES: readonly Stage[] = [
  'house', 'main-upgrade', 'back', 'left', 'right', 'second-floor', 'basement',
];

export const SEASONS: readonly Season[] = ['spring', 'summer', 'autumn', 'winter'];

/** How many rooms each stage has (§5): one, then one more per addition. */
export const ROOMS_BY_STAGE: Readonly<Record<Stage, number>> = {
  house: 1,
  'main-upgrade': 1,
  back: 2,
  left: 3,
  right: 4,
  'second-floor': 5,
  basement: 6,
};

/** The name a room gets when a stage change creates it, by position. */
export const DEFAULT_ROOM_NAMES: readonly string[] = [
  'Main room', 'Back room', 'Left room', 'Right room', 'Upstairs', 'Basement',
];

/** A fresh house: the first stage, spring, one empty main room, default options. */
export function initialState(): AppState {
  return {
    house: { stage: 'house', season: 'spring', rooms: [{ name: 'Main room', items: [] }] },
    options: { ...DEFAULT_OPTIONS },
  };
}
