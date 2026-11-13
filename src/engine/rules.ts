// The §6 rule registry: every rule id the engine can put on a breakdown line, with its
// DESIGN.md section, scope, confidence and source. A rule with no source is a bug (§2.3),
// so the registry — not the rule implementations — owns provenance, and the UI reads it
// straight from here to badge each line.
//
// All sixteen rules come from the chibisnorlax FAQ's HHA page (DESIGN.md Sources). A
// `supported` rule is one Nookipedia independently agrees with; a `disputed` one is where
// the sources conflict and §8 picks the default and the toggle.
import type { Rule, RuleId } from './types.ts';

const FAQ =
  'chibisnorlax ACNH FAQ, Happy Home Academy (updated 3 April 2022): ' +
  'https://chibisnorlax.github.io/acnhfaq/island-dev/hha/';

const NOOKIPEDIA =
  'Nookipedia, Happy Home Academy: https://nookipedia.com/wiki/Happy_Home_Academy';

/** Both sources agree on the rule, so it is `supported`. */
const AGREED = `${FAQ} — corroborated by ${NOOKIPEDIA}`;

/** The sources conflict on how the category bonus multiplies (§8 `categoryBonus`). */
const CATEGORY_DISPUTE =
  `${FAQ} — says 500 per qualifying category. Disputed by ${NOOKIPEDIA}, ` +
  'whose table says "500 × number of items"; §8 `categoryBonus` toggles the reading.';

/** The sources conflict on whether feng shui scores at all (§8 `fengShui`). */
const FENG_SHUI_DISPUTE =
  `${FAQ} — lists the bonus, as do datamine-based summaries. Disputed by a player ` +
  'experiment reporting 185k+ without it (https://medium.com/@modern.minecraft.dad/' +
  'how-to-get-a-gold-hha-trophy-in-animal-crossing-new-horizons-b12aeef9d110); ' +
  '§8 `fengShui` toggles it off.';

export const RULES = {
  /** Base points × quantity for every placed item plus wallpaper and flooring. */
  base: { section: '6.1', scope: 'room', confidence: 'supported', source: AGREED },
  /** +1,000 at each of ≥6, ≥10, ≥15 and ≥20 furniture pieces. What counts as furniture is our reading (§6). */
  count: { section: '6.2', scope: 'room', confidence: 'supported', source: AGREED },
  /** +400 per wall-mounted item hung on a wall, max 3. */
  'wall-hung': { section: '6.3', scope: 'room', confidence: 'supported', source: AGREED },
  /** +1,000 × items in the largest series, once it has ≥4 unique items. */
  series: { section: '6.4', scope: 'room', confidence: 'supported', source: AGREED },
  /** +800 × set size for each complete set. */
  set: { section: '6.5', scope: 'room', confidence: 'supported', source: AGREED },
  /** +400 × items in the largest concept, once it has ≥5 items. */
  concept: { section: '6.6', scope: 'room', confidence: 'supported', source: AGREED },
  /** +500 per category with ≥3 unique items, under the §8 `categoryBonus` default. */
  category: { section: '6.7', scope: 'room', confidence: 'disputed', source: CATEGORY_DISPUTE },
  /** +200 (≥70% share a color) or +600 (≥90%) × unique items, from 8 items up. */
  color: { section: '6.8', scope: 'room', confidence: 'supported', source: AGREED },
  /** +500 per matching coloured wall among east, south and west; max 1,500. */
  'feng-shui': { section: '6.9', scope: 'room', confidence: 'disputed', source: FENG_SHUI_DISPUTE },
  /** +777 per unique lucky item anywhere in the house. */
  lucky: { section: '6.10', scope: 'house', confidence: 'supported', source: AGREED },
  /** +777 per unique seasonal item for the season anywhere in the house. */
  seasonal: { section: '6.11', scope: 'house', confidence: 'supported', source: AGREED },
  /** +2,500 once for a chair, a table, a bed and a wardrobe or dresser. */
  type: { section: '6.12', scope: 'house', confidence: 'supported', source: AGREED },
  /** −500 per trash item × quantity. */
  trash: { section: '6.13', scope: 'room', confidence: 'supported', source: AGREED },
  /** −300 per item tagged as facing a wall (§8 `facingWallScope`). */
  'facing-wall': { section: '6.14', scope: 'room', confidence: 'supported', source: AGREED },
  /** −1 per dropped non-furniture item. */
  dropped: { section: '6.15', scope: 'room', confidence: 'supported', source: AGREED },
  /** −2,500 per cockroach. */
  cockroach: { section: '6.16', scope: 'room', confidence: 'supported', source: AGREED },
} as const satisfies Record<RuleId, Rule>;
