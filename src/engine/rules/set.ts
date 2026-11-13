// §6.5 Set completion. A set is complete when every name in `catalog.sets[set]` is in the
// room; each complete set adds 800 × its member count, once, however many copies are
// present. One line for the room, summing every complete set (§6 readings). The room's
// wallpaper and flooring can complete a set, like any other item.
// Confidence: supported (RULES.set).
import type { Line, ResolvedRef, RoomContext, RoomRule } from '../types.ts';

const POINTS_PER_MEMBER = 800;

export const setRule: RoomRule = (context: RoomContext): Line[] => {
  /** Every catalog name in the room, so membership is a lookup rather than a scan. */
  const present = new Set<string>();
  /** The sets worth checking: a member in the room names its own set (§4.2). */
  const candidates = new Set<string>();

  const note = (ref: ResolvedRef): void => {
    present.add(ref.item.name);
    if (ref.item.set !== null) candidates.add(ref.item.set);
  };

  for (const placement of context.items) note(placement);
  if (context.wallpaper) note(context.wallpaper);
  if (context.flooring) note(context.flooring);

  let points = 0;
  const completed: string[] = [];
  const items: string[] = [];
  // Sorted so the line reads the same whatever order the room was written in.
  for (const set of [...candidates].sort(compare)) {
    const members = context.catalog.sets[set];
    if (!members || members.length === 0) continue;
    if (!members.every((name) => present.has(name))) continue;
    points += POINTS_PER_MEMBER * members.length;
    completed.push(set);
    // Each credited name once: a set's members are distinct, and sets do not overlap.
    for (const name of members) if (!items.includes(name)) items.push(name);
  }

  if (points === 0) return [];

  const detail = `Complete ${completed.length === 1 ? 'set' : 'sets'}: `
    + completed.map((set) => `"${set}"`).join(', ');
  return [{ rule: 'set', points, detail, items }];
};

/** Plain code-unit order: `localeCompare` would depend on ICU data (§4.2.1). */
function compare(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}
