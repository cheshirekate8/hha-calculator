// The hand-curated lists (DESIGN.md §4.3), loaded for the rules that need them: lucky
// (§6.10), seasonal (§6.11) and trash (§6.13). They are engine rule data, frozen at planning
// time like the tests, so the engine imports them directly. The catalog, by contrast,
// always arrives as an argument (§2.1).
import lucky from '../data/curated/lucky.json' with { type: 'json' };
import seasonal from '../data/curated/seasonal.json' with { type: 'json' };
import trash from '../data/curated/trash.json' with { type: 'json' };
import type { Season } from './types.ts';

/** Lucky item names (§6.10); every name matches a catalog item exactly. */
export const LUCKY: ReadonlySet<string> = new Set(lucky.items);

/** Seasonal item names by season (§6.11). */
export const SEASONAL: Readonly<Record<Season, ReadonlySet<string>>> = {
  spring: new Set(seasonal.spring),
  summer: new Set(seasonal.summer),
  autumn: new Set(seasonal.autumn),
  winter: new Set(seasonal.winter),
};

/** Trash item names (§6.13). Garbage cans are furniture and are not in this list. */
export const TRASH: ReadonlySet<string> = new Set(trash.items);
