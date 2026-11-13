// The engine's data contract (DESIGN.md §4.2.1, §5, §5.1). Every type here is
// JSON-compatible: a house round-trips through export and import (§10.4), and the catalog
// is read straight from the generated `catalog.json` by whoever loads it — never by the
// engine itself (§2.1, §2.4).

// --- The house (§5) ---

export type Stage =
  | 'house'
  | 'main-upgrade'
  | 'back'
  | 'left'
  | 'right'
  | 'second-floor'
  | 'basement';

export type Season = 'spring' | 'summer' | 'autumn' | 'winter';

export type Surface = 'floor' | 'tabletop' | 'wall' | 'ceiling';

/** Which wall an item sits on or within two squares of; feng shui only (§6.9). */
export type NearWall = 'north' | 'east' | 'south' | 'west' | 'none';

/**
 * A reference to one catalog variant. With no `variation` and no `pattern` it means the
 * item's first variant; otherwise the variant matching every field given (§5.1).
 */
export type ItemRef = {
  name: string;
  variation?: string | null;
  pattern?: string | null;
};

export type PlacedItem = ItemRef & {
  /** Defaults to 1; a positive integer. Duplicates are allowed and count (§5.1). */
  quantity?: number;
  surface: Surface;
  nearWall?: NearWall;
  facingWall?: boolean;
};

export type Room = {
  name: string;
  wallpaper?: ItemRef | null;
  flooring?: ItemRef | null;
  items: PlacedItem[];
  /** Non-furniture dropped on the floor: clothing, materials, etc. (§6.15). */
  droppedItems?: number;
  cockroaches?: number;
};

export type House = {
  stage: Stage;
  season: Season;
  rooms: Room[];
};

// --- The catalog (§4.2.1) ---

export type CatalogVariant = {
  variation: string | null;
  pattern: string | null;
  /** The variation's colors, else the item's; usually 2, empty for items such as trash. */
  colors: string[];
  /** The variation's concepts, else the item's; up to 2. */
  concepts: string[];
  /** The variation's `hhaCategory`, else the item's. */
  category: string | null;
};

export type CatalogItem = {
  /** Unique across the catalog; forgeries are suffixed " (forgery)". */
  name: string;
  /** The upstream `sourceSheet`, e.g. "Wall-mounted". */
  sheet: string;
  basePoints: number;
  series: string | null;
  set: string | null;
  tag: string | null;
  interact: string | boolean | null;
  /** Upstream order; never empty. */
  variants: CatalogVariant[];
};

export type Catalog = {
  source: { repo: string; commit: string };
  /** Sorted by name. */
  items: CatalogItem[];
  /** Set name to the distinct item names carrying it (§4.2). */
  sets: Record<string, string[]>;
};

// --- Options (§8) ---

export type CategoryBonusOption = 'per-category' | 'per-item';
export type FengShuiOption = 'on' | 'off';
/** No alternative yet: the directional flag the other reading needs is not in our data. */
export type FacingWallScopeOption = 'any-tagged';

export type Options = {
  categoryBonus: CategoryBonusOption;
  fengShui: FengShuiOption;
  facingWallScope: FacingWallScopeOption;
};

// --- The rule registry (§6) ---

export type RuleId =
  | 'base'
  | 'count'
  | 'wall-hung'
  | 'series'
  | 'set'
  | 'concept'
  | 'category'
  | 'color'
  | 'feng-shui'
  | 'lucky'
  | 'seasonal'
  | 'type'
  | 'trash'
  | 'facing-wall'
  | 'dropped'
  | 'cockroach';

export type RuleScope = 'room' | 'house';

export type Confidence = 'supported' | 'disputed' | 'unknown';

export type Rule = {
  /** The rule's §6 number, e.g. "6.1". */
  section: string;
  scope: RuleScope;
  confidence: Confidence;
  /** Where the rule comes from; a rule with no source is a bug (§2.3). */
  source: string;
};

// --- The result (§5.1) ---

export type Line = {
  rule: RuleId;
  points: number;
  detail: string;
  /** The catalog names this line credits, each once. */
  items: string[];
};

export type RoomResult = {
  name: string;
  total: number;
  lines: Line[];
};

export type RankLetter = 'B' | 'A' | 'S';

/** The lowest reward not yet reached, with the points still needed for it (§7). */
export type NextReward = {
  reward: string;
  points: number;
  /** The reward's threshold minus the total; always positive. */
  needed: number;
};

/**
 * The house's standing at its total (§7): the letter for the stage's cutoffs, the highest
 * reward whose threshold the total has reached (`null` below 10,000), and the next reward
 * (`null` at 150,000 and above).
 */
export type Rank = {
  stage: Stage;
  letter: RankLetter;
  reward: string | null;
  next: NextReward | null;
};

export type Result = {
  total: number;
  /** Same order as `house.rooms`. */
  rooms: RoomResult[];
  house: { total: number; lines: Line[] };
  /** Derived from `total` and `house.stage` alone (§7). */
  rank: Rank;
};

// --- What a rule is given ---

/** An `ItemRef` resolved against the catalog: the item and the single variant it names. */
export type ResolvedRef = {
  ref: ItemRef;
  item: CatalogItem;
  variant: CatalogVariant;
};

/** A placed item resolved against the catalog, with its quantity defaulted and checked. */
export type ResolvedPlacement = ResolvedRef & {
  placed: PlacedItem;
  quantity: number;
};

/** Everything a room-scope rule may read. Resolution happens once, before any rule runs. */
export type RoomContext = {
  room: Room;
  items: ResolvedPlacement[];
  wallpaper: ResolvedRef | null;
  flooring: ResolvedRef | null;
  catalog: Catalog;
  house: House;
  options: Options;
};

/** Everything a house-scope rule may read, including every room's resolved context. */
export type HouseContext = {
  house: House;
  rooms: RoomContext[];
  catalog: Catalog;
  options: Options;
};

/** A rule returns one line per non-zero award, and no line when it awards nothing (§5.1). */
export type RoomRule = (context: RoomContext) => Line[];
export type HouseRule = (context: HouseContext) => Line[];
