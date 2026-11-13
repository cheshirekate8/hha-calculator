// The breakdown view model (DESIGN.md §10.3, §10.5): it turns an engine `Result` into the
// data the breakdown screen renders, and nothing else. Pure, and it never mutates the
// result it is given — the screen may hand it a frozen or shared object.
//
// Everything a line needs to explain itself comes from the §6 registry (`RULES`), not from
// a second copy of the rule facts kept here: only the human label is this module's own.
// Number formatting is hand-rolled rather than `toLocaleString`, because the output must
// not depend on the machine's locale (§2.1 determinism, applied to the UI).
import { RULES } from '../engine/rules.ts';
import type {
  CategoryBonusOption,
  Confidence,
  FengShuiOption,
  Line,
  Rank,
  Result,
  RuleId,
} from '../engine/types.ts';

// --- Number formatting (§10.3) ---

/** U+2212 MINUS SIGN: a real minus, not the hyphen `String(n)` gives us. */
const MINUS = '−';

/** Thousands separators for a run of digits, with no locale anywhere near it. */
function group(digits: string): string {
  return digits.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

/** A total: grouped, signed only when negative. `12345` → `"12,345"`, `0` → `"0"`. */
export function formatTotal(n: number): string {
  return n < 0 ? MINUS + group(String(-n)) : group(String(n));
}

/**
 * A breakdown line's points: always signed, so a line reads as a change to the total.
 * `1057` → `"+1,057"`, `-500` → `"−500"`, `0` → `"0"`.
 */
export function formatPoints(n: number): string {
  return n > 0 ? `+${group(String(n))}` : formatTotal(n);
}

// --- Labels (§6) ---

/** The human name for every rule id; the id itself is never shown. */
export const RULE_LABELS = {
  base: 'Base points',
  count: 'Furniture count',
  'wall-hung': 'Wall-hung items',
  series: 'Series',
  set: 'Set completion',
  concept: 'Concept',
  category: 'Category',
  color: 'Color',
  'feng-shui': 'Feng shui',
  lucky: 'Lucky items',
  seasonal: 'Seasonal items',
  type: 'Daily-life essentials',
  trash: 'Trash',
  'facing-wall': 'Facing a wall',
  dropped: 'Dropped items',
  cockroach: 'Cockroaches',
} as const satisfies Record<RuleId, string>;

// --- Toggles for the disputed rules (§8) ---

/** One switchable `Options` field. `facingWallScope` has no second reading yet (§8). */
export type ToggleOption = 'categoryBonus' | 'fengShui';

export type ToggleChoice = {
  value: CategoryBonusOption | FengShuiOption;
  label: string;
};

/** The control the screen shows beside a disputed line: which option it sets, and to what. */
export type Toggle = {
  option: ToggleOption;
  rule: RuleId;
  label: string;
  values: ToggleChoice[];
};

const CATEGORY_TOGGLE: Toggle = {
  option: 'categoryBonus',
  rule: 'category',
  label: 'Category bonus',
  values: [
    { value: 'per-category', label: '500 per category' },
    { value: 'per-item', label: '500 per item' },
  ],
};

const FENG_SHUI_TOGGLE: Toggle = {
  option: 'fengShui',
  rule: 'feng-shui',
  label: 'Feng shui',
  values: [
    { value: 'on', label: 'On' },
    { value: 'off', label: 'Off' },
  ],
};

/** Every toggle the app offers, in the order the options screen lists them. */
export const TOGGLES: Toggle[] = [CATEGORY_TOGGLE, FENG_SHUI_TOGGLE];

/** The toggle a rule's lines carry, if any. Keyed by rule so a line looks its own up. */
const TOGGLE_BY_RULE: Partial<Record<RuleId, Toggle>> = {
  category: CATEGORY_TOGGLE,
  'feng-shui': FENG_SHUI_TOGGLE,
};

// --- The view model ---

/** An engine line plus everything needed to render it: no lookups left for the screen. */
export type BreakdownLine = Line & {
  label: string;
  /** The rule's DESIGN.md §6 number, from `RULES`. */
  section: string;
  confidence: Confidence;
  pointsText: string;
  toggle: Toggle | null;
};

export type BreakdownSection = {
  title: string;
  total: number;
  totalText: string;
  lines: BreakdownLine[];
};

export type Breakdown = {
  total: number;
  totalText: string;
  rank: Rank;
  sections: BreakdownSection[];
};

/** The title of the final section, which holds the house-scope rules (§6.10–§6.12). */
export const WHOLE_HOUSE_TITLE = 'Whole house';

function buildLine(line: Line): BreakdownLine {
  const rule = RULES[line.rule];
  return {
    rule: line.rule,
    points: line.points,
    detail: line.detail,
    items: [...line.items],
    label: RULE_LABELS[line.rule],
    section: rule.section,
    confidence: rule.confidence,
    pointsText: formatPoints(line.points),
    toggle: TOGGLE_BY_RULE[line.rule] ?? null,
  };
}

function buildSection(title: string, total: number, lines: readonly Line[]): BreakdownSection {
  return { title, total, totalText: formatTotal(total), lines: lines.map(buildLine) };
}

/**
 * Display data for one scored house: one section per room in input order, then
 * `"Whole house"`. The rank is passed straight through — it is already the §7 answer for
 * this total, and re-deriving it here could only disagree with it.
 */
export function buildBreakdown(result: Result): Breakdown {
  return {
    total: result.total,
    totalText: formatTotal(result.total),
    rank: result.rank,
    sections: [
      ...result.rooms.map((room) => buildSection(room.name, room.total, room.lines)),
      buildSection(WHOLE_HOUSE_TITLE, result.house.total, result.house.lines),
    ],
  };
}
