# DESIGN.md — hha-calculator

**Authoritative.** Every architectural decision and the reason for it. When reality
disagrees with this document, amend it and add a row to the §13 change log. Never ignore it
silently. Task specs cite a section of this file as their `design-ref`; a task that cites
nothing is scope creep.

Status: **approved**, 2026-11-13. Stack approved; the §6 readings marked `unknown` remain open for calibration (§9).

---

## 1. Purpose and scope

A single-page web app that calculates a player's *Animal Crossing: New Horizons* Happy Home
Academy (HHA) score from a description of their house, and **explains every point**: one
line per rule, per room, so a player can see what to change.

**In scope**
- Every scoring rule in §6: base points, furniture count, wall-hung items, series, set
  completion, concept, category, color, feng shui, lucky and seasonal items, the type bonus,
  and every penalty.
- The B/A/S rank for the house's stage, and the next reward threshold (§7).
- Rules whose correct reading is disputed, each with a default and a user toggle (§8).

**Out of scope**
- **A grid or room-layout editor.** Placement is described with tags (§5), not drawn.
  The data model must not rule out adding one later.
- **Exterior scoring.** No ACNH source scores the roof, siding, door or mailbox. The golden
  exterior-part thresholds found online are from *New Leaf*. Revisit only if evidence turns
  up (§8).
- Villager houses, Happy Home Paradise vacation homes, and island rating.
- Accounts, servers, or any network call at run time.

## 2. Invariants

These hold for every task. Each one exists because breaking it makes the calculator's
number untrustworthy.

1. **The scoring engine is pure and deterministic.** `score(house, catalog, options)` has
   no I/O, no clock, no randomness and no UI dependency. The season comes in as an input,
   never from `Date.now()`.
2. **The total is the sum of its lines.** Every point in the result belongs to exactly one
   breakdown line, and every line names its rule id (§6). There is no hidden adjustment.
3. **Every rule carries its provenance.** Each rule id maps to a source and a confidence
   level (`supported`, `disputed`, `unknown`) that the UI can show. A rule with no source is
   a bug.
4. **Item data is vendored and pinned.** The catalog is generated at build time from a
   pinned upstream commit and committed to the repo. Nothing is fetched at run time, and
   the build needs no network either, because pipeline containers have none.
5. **Hand-curated data is separate from imported data.** Lucky, seasonal and facing-wall
   lists (§4.3) live in their own files with a source note per entry, so re-importing the
   upstream catalog can never overwrite them.

## 3. Technology (approved 2026-11-13)

| Concern | Choice | Why |
|---|---|---|
| Language | TypeScript | The rules engine is a lot of small shape-sensitive functions, and types catch a mis-keyed field (`concepts` vs `concept`) before a test has to. |
| UI | React + Vite | Mainstream and well known to agents. Vite builds a static bundle. |
| Tests | Vitest | Same toolchain as Vite, so TypeScript runs with no separate build step. |
| Hosting | GitHub Pages | Static files only, matching the no-server scope. |
| Persistence | `localStorage` plus JSON export and import | The house belongs to one player on one device. Export makes it portable and backs it up. |

The engine (`src/engine/`) imports nothing from React. The UI is one consumer of it; the
tests are another.

## 4. Item data

### 4.1 Source and pin
- Upstream: [Norviah/animal-crossing](https://github.com/Norviah/animal-crossing) (MIT),
  a JSON conversion of the community **ACNH data spreadsheet**. Pinned by commit SHA in
  `data/SOURCE.md`, with attribution to both the converter and the spreadsheet project.
- **Sheets imported: every sheet whose rows a player can place in their house:**
  Housewares, Miscellaneous, Wall-mounted, Ceiling Decor, Wallpaper, Floors, Rugs, Photos,
  Posters, Gyroids, Fossils, Artwork, Fish, Insects, Sea Creatures, and Other reduced to
  its four trash rows. Fish, insects, gyroids and fossils are placeable and carry base
  points, and several lucky and seasonal items live there.
- **Not imported:** clothing (not placeable in a player's house; dropped clothing is the
  §6.15 penalty), tools, music, recipes, construction, fencing, and Happy Home Paradise
  interior structures (§8).

### 4.2 The import
**Upstream input is vendored at planning time, by the host.** Pipeline containers have no
network, so the pinned sheets are copied into `data/upstream/` before the import task
runs, with translation, image and filename fields removed (29.4 MB raw, 8.2 MB copied)
and the commit SHA recorded in `data/SOURCE.md`. Nothing else is changed in that copy
except that the Other sheet keeps only its trash rows. `tools/vendor-upstream.mjs` does
it. Refreshing it is a planning-session step, never a task.

`scripts/import-catalog` reads `data/upstream/` and writes a compact
`src/data/catalog.json` committed to the repo. Upstream `Housewares.json` alone is 15 MB,
so the import keeps only the fields below and drops translations and images.

| Field kept | Upstream key | Used by |
|---|---|---|
| name, sheet | `name`, `sourceSheet` | identity, wall-hung (§6.3), trash (§6.13) |
| base points | `hhaBasePoints` | §6.1 |
| series | `series` | §6.4 |
| set | `set` | §6.5 |
| category | `hhaCategory` (item- or variation-level) | §6.7 |
| concepts | `concepts` (per variation, up to 2) | §6.6 |
| colors | `colors` (per variation; usually 2, empty for 45 items such as trash) | §6.8, §6.9 |
| tag, interact | `tag`, `interact` | type bonus (§6.12) |
| variations | `variations[].variation`, plus the per-variation fields above | the user picks a variant |

**Colors, concepts and sometimes category live on the variation, not the item.** A red
and a blue version of the same chair score differently for color and feng shui, so the
house model stores the variant (§5).

The import also derives **set membership**: for each `set` value, the distinct item names
carrying it. §6.5 needs the full membership, which no single row gives. Sets can span
sheets: the `bear` set is Mama bear, Papa bear and giant teddy bear (Housewares) plus
Baby bear (Miscellaneous).

**Item names are unique in the catalog.** Upstream names are unique across the imported
sheets except Artwork, where a forgery shares the genuine piece's name. A forgery
(`genuine: false`) is named `"<name> (forgery)"` in the catalog.

#### 4.2.1 `catalog.json` format
This is the contract between the import and the engine. Absent upstream values become
`null`, or `[]` for lists.

```
{
  "source": { "repo": "Norviah/animal-crossing", "commit": "<40-char sha from data/SOURCE.md>" },
  "items": [                                  // sorted by name, code-point order
    {
      "name": string,                         // unique; forgeries suffixed " (forgery)"
      "sheet": string,                        // upstream sourceSheet, e.g. "Wall-mounted"
      "basePoints": number,                   // hhaBasePoints
      "series": string | null,
      "set": string | null,
      "tag": string | null,
      "interact": string | boolean | null,
      "variants": [                           // upstream order; never empty
        {
          "variation": string | null,
          "pattern": string | null,
          "colors": string[],                 // variation's colors, else the item's
          "concepts": string[],               // variation's concepts, else the item's
          "category": string | null           // variation's hhaCategory, else the item's
        }
      ]
    }
  ],
  "sets": { "<set>": [ "<item name>", ... ] } // keys sorted; names sorted, code-point order
}
```

An upstream row with no `variations` becomes one variant built from the row's own
`variation`, `pattern`, `colors`, `concepts` and `hhaCategory`. Category is
recorded on the variant because 285 upstream items carry it only per variation.

### 4.3 Hand-curated supplements
The upstream JSON has no lucky flag, no seasonal flag, and no facing-wall flag
(`ItemHHADirection` exists in the original spreadsheet but not in the conversion, and the
spreadsheet cannot be fetched without signing in). These live in `src/data/curated/`:

- `lucky.json`: ACNH Nintendo Switch, brewstoid, crescent-moon chair, gold bug trophy,
  gold fish trophy, gold rose wreath, gold turtle figurine, golden candlestick, golden
  samurai suit, katana, koi, lucky gold cat, Paradise Planning photo, pop-eyed goldfish,
  ring, robot hero, and **every NPC photo except** Brewster's, Isabelle's, Jingle's,
  Rover's, Timmy and Tommy's, and Tom Nook's (56 photos, enumerated from the upstream
  Special NPCs sheet). The six excluded photos are also the only NPC photos with non-zero
  base points, which supports the source's list.
  **Unresolved, and recorded in the file's `unresolved` list rather than dropped:**
  *kanji tee* (clothing, not placeable in a player's house) and *resident's photo* (no
  item has that name).
- `seasonal.json` (as listed by the source):
  - **Spring:** bamboo shelf, cherry-blossom bonsai, wobbling Zipper toy
  - **Summer:** anchor statue, artisanal bug cage, horned hercules, Napoleonfish,
    palm-tree lamp, scorpion, shell wreath
  - **Autumn:** cricket, mush parasol, tree's bounty big tree
  - **Winter:** tarantula, frozen tree, stringfish
- `trash.json`: boot, empty can, old tire, spoiled turnips (all 0 base points, `Other`
  sheet). Garbage *cans* (`hhaCategory: "Trash"`) are furniture, not trash, and must
  never be penalised.

Source for all three: the chibisnorlax ACNH FAQ, HHA page (updated 3 April 2022). The lists
are authored at planning time, like the upstream copy. Names match catalog names
**exactly**, case included (upstream spells `brewstoid` and `Napoleonfish`), and a curated
name with no matching catalog item fails the import loudly rather than being skipped.

## 5. Input model

```
House
  stage        : house | main-upgrade | back | left | right | second-floor | basement
  season       : spring | summer | autumn | winter   (picked directly, so no hemisphere logic)
  rooms[]      : one per room the stage unlocks (1 to 6 rooms)
Room
  name
  wallpaper?   : variant ref
  flooring?    : variant ref
  items[]      : PlacedItem
  droppedItems : number   (non-furniture dropped on the floor: clothing, materials, etc.)
  cockroaches  : number
PlacedItem
  item, variant          : catalog refs
  quantity               : number          (duplicates are allowed and count)
  surface                : floor | tabletop | wall | ceiling
  nearWall?              : north | east | south | west | none   (on the wall or within 2 squares)
  facingWall             : boolean
```

`nearWall` exists only for feng shui (§6.9). `facingWall` exists only for its penalty
(§6.14). Trash is entered as an ordinary placed item and recognised from `trash.json`.

### 5.1 The engine contract
`src/engine/score.ts` exports `score(house, catalog, options?)` and `DEFAULT_OPTIONS`;
`src/engine/rules.ts` exports `RULES`, the §6 registry. In JSON-compatible terms:

```
House      { stage: Stage, season: Season, rooms: Room[] }
Room       { name: string, wallpaper?: ItemRef | null, flooring?: ItemRef | null,
             items: PlacedItem[], droppedItems?: number, cockroaches?: number }
ItemRef    { name: string, variation?: string | null, pattern?: string | null }
PlacedItem ItemRef & { quantity?: number,            // default 1; a positive integer
                       surface: "floor" | "tabletop" | "wall" | "ceiling",
                       nearWall?: "north" | "east" | "south" | "west" | "none",
                       facingWall?: boolean }

Result     { total: number, rooms: RoomResult[], house: { total: number, lines: Line[] } }
RoomResult { name: string, total: number, lines: Line[] }   // same order as house.rooms
Line       { rule: RuleId, points: number, detail: string, items: string[] }
```

- An `ItemRef` names a catalog item exactly. With no `variation` or `pattern` it means
  the item's first variant; otherwise it means the variant matching every field given.
  An unknown name or an unmatched variant is an error naming it, never a silent zero.
- **A line exists only for non-zero points.** A room or house that earns nothing has no
  lines, so an empty house scores 0 with no lines under every future rule.
- `room.total` is the sum of its lines, `house.total` the sum of its lines, and `total`
  the sum of every room total plus the house total (§2.2).
- `DEFAULT_OPTIONS` is `{ categoryBonus: "per-category", fengShui: "on",
  facingWallScope: "any-tagged" }` (§8). `score()` merges a partial `options` over it.
- `RULES[id]` is `{ section, scope: "room" | "house", confidence: "supported" |
  "disputed" | "unknown", source }` for each of the 16 ids in §6.

## 6. Scoring rules

Each rule has a stable id that appears on every breakdown line it produces. **Scope** says
whether it is computed per room or once for the whole house.

**Confidence:**
- `supported`: two independent sources agree (chibisnorlax FAQ and Nookipedia).
- `disputed`: sources conflict. §8 sets the default and the toggle.
- `unknown`: no source specifies the reading. The default is ours, and calibration (§9)
  settles it.

| § | Id | Scope | Rule | Confidence |
|---|---|---|---|---|
| 6.1 | `base` | room | Sum of `hhaBasePoints` × quantity, for every placed item plus wallpaper and flooring | supported |
| 6.2 | `count` | room | +1,000 at each of ≥6, ≥10, ≥15 and ≥20 furniture pieces (stacking, max 4,000) | supported (what counts as furniture: unknown) |
| 6.3 | `wall-hung` | room | +400 per item with `surface = wall` from the Wall-mounted sheet, max 3 items (1,200) | supported |
| 6.4 | `series` | room | If the room's largest series has ≥4 **unique** items: +1,000 × the number of items in that series. Only the largest series scores. | supported (unique-vs-all multiplier: unknown) |
| 6.5 | `set` | room | For each set whose full membership (§4.2) is present: +800 × set size. A duplicate copy of a set scores nothing extra. | supported |
| 6.6 | `concept` | room | If the room's largest concept has ≥5 items (duplicates count): +400 × the number of those items. An item counts toward each of its concepts. | supported |
| 6.7 | `category` | room | For each `hhaCategory` with ≥3 **unique** items: +500 | **disputed** (§8) |
| 6.8 | `color` | room | Needs ≥8 items, excluding wallpaper and flooring. If ≥70% share a color: +200 × unique items. If ≥90%: +600 × unique items instead. | supported |
| 6.9 | `feng-shui` | room | +500 for each of east (red), south (green) and west (yellow) where at least one item of that color has the matching `nearWall`. Max 1,500. | **disputed** (§8) |
| 6.10 | `lucky` | house | +777 per **unique** lucky item placed anywhere | supported |
| 6.11 | `seasonal` | house | +777 per **unique** seasonal item for the current season, placed anywhere | supported |
| 6.12 | `type` | house | +2,500 once if the house has a chair, a table, a bed, and a wardrobe or dresser, in any rooms | supported |
| 6.13 | `trash` | room | −500 per trash item (`trash.json`) × quantity | supported |
| 6.14 | `facing-wall` | room | −300 per placed item with `facingWall = true` | supported (which items can incur it: unknown, §8) |
| 6.15 | `dropped` | room | −1 × `droppedItems` | supported |
| 6.16 | `cockroach` | room | −2,500 × `cockroaches` | supported |

**Readings this table fixes**, each `unknown` in the sources and a candidate for §9
calibration:
- **Unique** means a distinct item name. Two variants of one chair are one unique item.
- **Furniture** (§6.2) means every placed item with `surface` floor, tabletop, wall or
  ceiling, duplicates included. Wallpaper, flooring and rugs are not counted.
- **Item color match** (§6.8, §6.9): an item matches color C if either of its two variant
  colors is C. The color-bonus share is matching items ÷ all items, counted with quantity.
- **Series multiplier** (§6.4) is every item in the series, duplicates included, once the
  unique threshold is met.
- **Type-bonus detection**: chair = `tag` Chair or `interact` Chair; table = `tag` Table;
  bed = `tag` Bed or `interact` Bed; wardrobe or dresser = `interact` Wardrobe or
  `hhaCategory` Dresser.
- **Basement rooms are scored** like any other room. The rank table includes a basement
  stage, and players report HHA comments about their basement. Storage is not scored.

## 7. Rank and rewards

**Rank cutoffs by stage (B / A / S):**

| Stage | B | A | S |
|---|---|---|---|
| house | 0–9,999 | 10,000–14,999 | 15,000+ |
| main-upgrade | 0–16,999 | 17,000–22,999 | 23,000+ |
| back | 0–24,999 | 25,000–34,999 | 35,000+ |
| left | 0–37,999 | 38,000–46,999 | 47,000+ |
| right | 0–49,999 | 50,000–59,999 | 60,000+ |
| second-floor | 0–63,999 | 64,000–74,999 | 75,000+ |
| basement | 0–79,999 | 80,000–89,999 | 90,000+ |

Nookipedia's copy contains typos (59,000 and 63,000 where 59,999 and 63,999 are meant), so
the chibisnorlax values above are used. Nookipedia confirms the A and S cutoffs.

**Rewards** (one per threshold reached): 10,000 HHA pennant · 20,000 bronze HHA plaque ·
30,000 silver HHA plaque · 50,000 gold HHA plaque · 70,000 bronze HHA trophy · 100,000
silver HHA trophy · 150,000 gold HHA trophy. The result names the highest reward reached
and the points needed for the next one.

## 8. Disputed and unknown rules: defaults and toggles

Every entry is an `options` field on `score()`, shown in the UI as a toggle beside the
lines it affects. The default is the best-supported reading.

| Option | Default | Alternative | Evidence |
|---|---|---|---|
| `categoryBonus` | `per-category`: 500 per qualifying category | `per-item`: 500 × unique items in each qualifying category | The chibisnorlax FAQ says per category. Nookipedia's table says "500 × number of items". |
| `fengShui` | `on` | `off` | Datamine-based summaries list it. One player's experiment reports 185k+ without it and calls it inert. |
| `facingWallScope` | `any-tagged`: every item the user tags is penalised | none until data exists | Only "directional" items (`ItemHHADirection = 1`) can incur it, but that flag is not in our data (§4.3). The UI warns that tagging a non-directional item over-counts. |

**Rules not modelled, for lack of any evidence**: per-room size caps, lower value for
duplicate items, and scoring of Happy Home Paradise interior structures (partitions,
pillars, counters). Ceiling decor scores like any item: base points and furniture count.
Each is a candidate for §9.

## 9. Calibration against the real game

Fan sources disagree and nothing found is a primary datamine, so the strongest evidence is
the game itself. A **calibration fixture** is one real house written in the §5 input model,
plus the score from that Sunday's HHA letter, saved under
`tests/calibration/<date>-<label>.json`.

- A calibration test asserts the engine reproduces the recorded score **under the current
  defaults**. When it fails, the response is a design decision recorded in the §13 change
  log: flip a default, or add a rule. Never fudge a number to make it pass.
- Single-room houses are the most useful: there are fewer interacting rules, so a mismatch
  points at one reading.
- Fixtures are evidence the player supplies, not something a pipeline task creates.

## 10. User interface

1. **House setup:** stage and season.
2. **Room editor:** one tab per room. Choose wallpaper and flooring. Search the catalog by
   name, pick a variant, then set quantity, surface, `nearWall` and `facingWall`. Enter
   counts of dropped items and cockroaches.
3. **Breakdown:** the total, rank and next reward, then one collapsible section per room
   and one for the house. Each line shows its rule, points and the items behind it (for
   example "series: wooden, 6 items, +6,000"). Disputed and unknown rules carry a badge
   and their toggle.
4. **Persistence:** autosaves to `localStorage`, with JSON export and import.

Accessible by keyboard; usable at phone width. Item images are not shipped in v1.

## 11. Testing and verification

- The engine is tested at the rule level: one fixture house per rule that isolates it,
  plus interaction fixtures, for example a room that qualifies for series and set at once.
- Every fixture asserts the **value**, and is chosen so that a plausible wrong reading
  gives a different number. Example: a series room whose unique count and total count
  differ, so the §6.4 multiplier reading is actually exercised.
- §2's sum invariant is asserted on every engine test result.
- Calibration fixtures (§9) run in the same suite.
- Pipeline acceptance tests live in `tests/acceptance/<issue-id>/` and are frozen at
  planning time. They run under **Node's built-in test runner** (`node:test`, TypeScript
  through type stripping) via the frozen `tools/run-acceptance.sh`, not under Vitest: a
  task can edit a Vitest config and change what judges it, while the runner script is
  frozen and Node's runner has no config. That is why the code is erasable TypeScript
  only and relative imports carry `.ts` extensions (see `CLAUDE.md`).
- Vitest is the project's own suite (`tests/unit/`), run as the pipeline's
  `regressionCommand`. That is evidence, not a gate.
- The build gate is `tsc --noEmit -p tsconfig.json && vite build`, with `tsconfig.json`
  frozen so a task cannot loosen type checking to pass it.

## 12. Build phases

Ticked boxes carry the issue id that ticked them, for example `- [x] … (hha-abc)`.

**Done interactively at planning time** (not pipeline tasks): the project scaffold (§3),
the upstream copy (§4.2) and the curated lists (§4.3). Every task's build gate needs the
scaffold, and tasks in one run cannot see each other's unmerged work, so the scaffold
could not be a task in the same batch as anything else.

**Phase 1: foundation**
- [ ] Catalog import: `catalog.json` in the §4.2.1 format, set membership, curated names validated (§4.1–4.3)
- [ ] Engine core: types, `RULES`, `score()`, the sum invariant, and base points (§2, §5.1, §6.1)

**Phase 2: the rules engine**
- [ ] Furniture count and wall-hung items (§6.2, §6.3)
- [ ] Series and set completion (§6.4, §6.5)
- [ ] Concept and category, with the `categoryBonus` option (§6.6, §6.7, §8)
- [ ] Color and feng shui, with the `fengShui` option (§6.8, §6.9, §8)
- [ ] House-level rules: lucky, seasonal and type (§6.10–6.12)
- [ ] Penalties (§6.13–6.16)
- [ ] Rank and rewards (§7)

**Phase 3: the app**
- [ ] House setup and room editor with catalog search (§10.1, §10.2)
- [ ] Breakdown view with provenance badges and toggles (§10.3)
- [ ] Persistence: autosave, export and import (§10.4)

**Phase 4: evidence and release**
- [ ] First calibration fixtures from real HHA letters (§9)
- [ ] Deploy to GitHub Pages

## 13. Change log

Rows are chronological ascending; append new rows at the bottom. A row is identified by
the slug in its **Ref** column: a pipeline task's issue id, or a short kebab-case name for
a planning-session decision. Never by a version number.

| Ref | Date | Change | Why |
|---|---|---|---|
| `initial-design` | 2026-11-13 | First design: scope, invariants, data plan, input model, 16 rules, rank, options, calibration, phases. Stack (§3) approved | Planning session. Input is lists plus placement tags, chosen over a grid editor. Disputed rules use the majority reading with toggles. |
| `pipeline-onboarding` | 2026-11-13 | §11: acceptance tests run under `node:test` through frozen `tools/run-acceptance.sh`; Vitest becomes the regression suite; build gate is `tsc` plus `vite build` with `tsconfig.json` frozen. §4.2: upstream sheets vendored at planning time into `data/upstream/`. §12: lint dropped from the scaffold. | Onboarding. A gate a task can configure is not a gate. Containers are offline, so the import's input must be in the repo. Lint adds dependencies and judges nothing the build and tests don't already check. |
| `phase-1-planning` | 2026-11-13 | §4.1: import every placeable sheet (adds Gyroids, Fossils, Artwork, Fish, Insects, Sea Creatures); Other reduced to trash rows. §4.2: forgeries renamed "(forgery)"; new §4.2.1 pins the `catalog.json` format. §4.3: curated lists authored at planning time and matched exactly; kanji tee and resident's photo recorded as unresolved. New §5.1 pins the engine contract. §12: scaffold, upstream copy and curated lists done interactively; Phase 1 is two tasks; base points move into the engine-core task. | First planning session. Most lucky and seasonal items live in sheets the first draft left out. Tasks in one run cannot see each other's unmerged work, and every build needs the scaffold. Two parallel tasks need a written contract between them, and an engine-core task needs one real rule so its tests have something that can fail. |

## Sources

- [chibisnorlax ACNH FAQ: Happy Home Academy](https://chibisnorlax.github.io/acnhfaq/island-dev/hha/)
  (updated 3 April 2022): the rule set, the lucky and seasonal lists, and the rank table.
- [Nookipedia: Happy Home Academy](https://nookipedia.com/wiki/Happy_Home_Academy):
  corroborates bonuses, penalties, ranks and rewards.
- [Norviah/animal-crossing](https://github.com/Norviah/animal-crossing) (MIT): the item
  data, converted from the community ACNH data spreadsheet.
- [Player feng-shui experiment](https://medium.com/@modern.minecraft.dad/how-to-get-a-gold-hha-trophy-in-animal-crossing-new-horizons-b12aeef9d110):
  the dissenting evidence behind §8 `fengShui`.

*Not affiliated with Nintendo. Animal Crossing is a trademark of Nintendo.*
