# Planning draft — 2026-11-13 (Phase 2: the rules engine)

The pipeline's PLANNING.md step 5 file for one batch. **Superseded by the Beads issues at
freeze**; delete it once the tasks have run.

Done interactively first (DESIGN.md §12, change-log row `phase-2-planning`): an empty
placeholder `src/engine/rules/<id>.ts` for every remaining rule, all registered in
`score.ts`, and `src/engine/curated.ts` exporting `LUCKY`, `SEASONAL` and `TRASH`. So the
seven tasks below edit disjoint files and can run in one batch. Every reading the sources
leave open is fixed in DESIGN.md §6 ("Readings this table fixes") and §5.1.

**Shared by every task** (stated once here, repeated in each issue's Constraints):
- Edit only the files the task names. The engine stays pure (§2.1): no I/O, clock,
  randomness or React, and never import `catalog.json`.
- A rule adds at most one line per room (room rules) or one line (house rules), with
  non-zero points only, a non-empty `detail`, and `items` listing each credited catalog
  name once (§6, "One line per rule").
- Erasable TypeScript only, and relative imports with `.ts` extensions.
- Every test uses a small inline catalog in the §4.2.1 format and checks **only its own
  rule's lines**, selected by `rule`. No test pins `lines.length`, a room total or
  `total`: other rules will add lines to the same rooms once all seven tasks merge.
  (Task 7 is the exception, and it uses fixtures no rule can touch.)
- Where a criterion names the credited items, `items` must equal exactly that set of
  names: no fewer, no extra.
- Wherever a criterion gives a rule's points for a room or the house, that rule produced
  **exactly one** line there.

---

## Task 1 — Furniture count and wall-hung items (hha-4vl)

**Difficulty:** trivial · **design-ref:** DESIGN.md §6.2, §6.3, §6 readings · **Depends on:** nothing

### Description
Implement the `count` rule (§6.2) in `src/engine/rules/count.ts` and the `wall-hung` rule
(§6.3) in `src/engine/rules/wall-hung.ts`, to the readings in DESIGN.md §6.

### Constraints
- Edit only `src/engine/rules/count.ts`, `src/engine/rules/wall-hung.ts`, and its own unit test file `tests/unit/count-wall-hung.test.ts`.
- The shared constraints at the top of this draft apply.

### Done means
1. The `count` line is +1,000 at each of 6, 10, 15 and 20 furniture pieces counted with
   quantity: 5 pieces → no line; 6 → 1,000; 9 → 1,000; 10 → 2,000; 15 → 3,000;
   19 → 3,000; 20 → 4,000; 40 → 4,000. One item with quantity 6 counts as 6.
2. Every placed item is furniture except Rugs-sheet items and trash (names in
   `trash.json`): 6 pieces made of 3 floor items, 1 tabletop item, 1 Wall-mounted item on
   the wall and 1 Ceiling Decor item on the ceiling → 1,000, `items` exactly those 6
   names. A room with 5 furniture pieces, 3 rugs, `boot` ×2 (sheet Other), wallpaper and
   flooring → no `count` line; one more furniture piece → 1,000, `items` naming no rug,
   trash, wallpaper or flooring.
3. The `wall-hung` line is +400 per placed item with surface `wall` from the Wall-mounted,
   Artwork, Photos or Posters sheet, counted with quantity and capped at 3 (1,200). One item
   from any one of those sheets alone → 400, checked for each of the four sheets. One from
   each of the four → 1,200, `items` all four names. One Wall-mounted item with quantity 2
   → 800, `items` that one name. A Wall-mounted item on surface `tabletop` → no line. A
   Housewares item on `wall` → no line.
4. Each line has a non-empty `detail`.

---

## Task 2 — Series and set completion (hha-ny7)

**Difficulty:** medium · **design-ref:** DESIGN.md §6.4, §6.5, §6 readings · **Depends on:** nothing

### Description
Implement the `series` rule (§6.4) in `src/engine/rules/series.ts` and the `set` rule
(§6.5) in `src/engine/rules/set.ts`, to the readings in DESIGN.md §6. Set membership comes
from `catalog.sets`.

### Constraints
- Edit only `src/engine/rules/series.ts`, `src/engine/rules/set.ts`, and its own unit test file `tests/unit/series-set.test.ts`.
- The shared constraints at the top of this draft apply.

### Done means
1. Series counts unique names for the threshold and every item for the points: 4 unique
   `wooden` items, one of them ×2 → 5,000. 3 unique `wooden` names with total quantity 9
   → no line. 3 unique `wooden` names, one placed twice as two different variants → no
   line (two variants of one item are one unique item).
2. Series are ranked by unique count, not total, and `items` names only the winner:
   `wooden` with 4 unique items ×3 each, placed first, against `log` with 5 unique items
   → 5,000 with `items` exactly the 5 `log` names. On a tie in unique count the name that
   sorts first wins: 4 unique `wooden` items ×2, placed first, and 4 unique `log` items
   ×1 → 4,000 with `items` exactly the 4 `log` names.
3. Wallpaper and flooring count toward series: 3 unique `wooden` placed items plus
   `wooden` wallpaper → 4,000, `items` the 3 names plus the wallpaper's. The same with
   `wooden` flooring instead → 4,000, `items` including the flooring's name.
4. Set: a room holding every member of a 4-member set → 3,200, `items` exactly the 4
   members; missing one member → no line; two copies of every member → still 3,200; that
   set plus a complete 3-member set → one `set` line of 5,600, `items` exactly the 7
   members. A set whose fourth member is the room's flooring is complete: 3,200, with the
   flooring's name in `items`.
5. Each line has a non-empty `detail`.

---

## Task 3 — Concept and category (hha-bu0)

**Difficulty:** medium · **design-ref:** DESIGN.md §6.6, §6.7, §8, §6 readings · **Depends on:** nothing

### Description
Implement the `concept` rule (§6.6) in `src/engine/rules/concept.ts` and the `category`
rule (§6.7) in `src/engine/rules/category.ts`, including the `categoryBonus` option (§8),
to the readings in DESIGN.md §6.

### Constraints
- Edit only `src/engine/rules/concept.ts`, `src/engine/rules/category.ts`, and its own unit test file `tests/unit/concept-category.test.ts`.
- The shared constraints at the top of this draft apply.

### Done means
1. Concept counts duplicates: 2 unique `garden` items with quantities 3 and 2 → 2,000; a
   total of 4 → no line.
2. Concepts are ranked by count with duplicates, not by unique items: `garden` 2 unique
   ×3 (6) against `nature` 4 unique ×1 → 2,400, `items` exactly the 2 `garden` names.
   An item counts toward each concept its variant lists: 3 items with
   `["garden","nature"]` and 3 with `["nature"]` → 2,400, `items` exactly the 6 names.
   On a tie the name that sorts first wins: 5 unique `garden` items, placed first, and
   5 unique `fancy` items → 2,000, `items` exactly the 5 `fancy` names.
3. Wallpaper and flooring concepts count: 4 placed `garden` items plus `garden` flooring
   → 2,000; 4 placed `garden` items plus `garden` wallpaper → 2,000. Concepts come from the
   placed variant: 4 `ocean` items plus an item whose first variant is `garden`, placed as
   its `ocean` variant → 2,000 with that item's name in `items` (reading the first variant
   gives no line).
4. Category under the default `per-category`: 3 unique `Lighting` items → 500, `items`
   exactly those 3. 2 unique `Lighting` names with total quantity 6 → no line. 2 unique
   `Lighting` names, one placed twice as two variants → no line. 3 unique `Lighting` and
   3 unique `Plant` → 1,000, `items` exactly the 6. Category comes from the placed
   variant: 2 `Lighting` items plus an item whose first variant is `Plant`, placed as its
   `Lighting` variant → 500. Three unique items with category `null` → no line.
5. Category under `{ categoryBonus: "per-item" }`: 3 unique `Lighting` (one with quantity
   3, another placed twice) plus 4 unique `Plant` → 3,500. The default gives 1,000 for the same room.
6. Each line has a non-empty `detail`.

---

## Task 4 — Color and feng shui (hha-09f)

**Difficulty:** medium · **design-ref:** DESIGN.md §6.8, §6.9, §8, §6 readings · **Depends on:** nothing

### Description
Implement the `color` rule (§6.8) in `src/engine/rules/color.ts` and the `feng-shui` rule
(§6.9) in `src/engine/rules/feng-shui.ts`, including the `fengShui` option (§8), to the
readings in DESIGN.md §6.

### Constraints
- Edit only `src/engine/rules/color.ts`, `src/engine/rules/feng-shui.ts`, and its own unit test file `tests/unit/color-feng-shui.test.ts`.
- The shared constraints at the top of this draft apply.

### Done means
1. Color counts with quantity and pays per unique matching item: 3 unique Red items ×3
   each plus 1 Blue item (90% Red) → 1,800, `items` exactly the 3 Red names. 7 unique Red
   of 10 (70%) → 1,400. 6 Red of 10 → no line. 7 items, all Red → no line (fewer than 8).
   Exactly 8 placed items is enough: 4 unique Red items ×2 → 2,400.
2. An item matches either of its two colors. 4 unique items colored `["Red","Blue"]`,
   4 colored `["Green","Red"]` and 2 colored `["White","White"]` → Red 80% → 1,600,
   `items` exactly the 8 Red-bearing names (reading only the first color gives no line).
   Ties go to the color name that sorts first: A `["Red","White"]` ×5, B and C
   `["Red","Green"]` ×1 each, D `["White","Green"]` ×2, E `["Blue","Blue"]` ×1 → Red
   and White both 7 of 10, Red wins → 200 × 3 = 600, `items` exactly A, B and C. Items
   with no colors count in the total and match nothing: 8 unique Red items plus 2 colorless
   (80%) → 1,600.
3. Wallpaper and flooring do not count: 5 Red and 3 Blue placed items (62.5%) with Red
   wallpaper and Red flooring → no line; counting them would make 7 of 10 (70%). 7 Red
   placed items with Red wallpaper → no line (fewer than 8 placed items).
4. Feng shui pays 500 per wall at most: a Red item east → 500; two different Red items east
   plus one Red item east with quantity 3 → 500. Red east, Green south and Yellow west →
   1,500; two of each on those walls → still 1,500, `items` exactly the six names. No line
   for: Green east; Yellow south; Red north; Red with no `nearWall`; Red east under
   `{ fengShui: "off" }`. An item colored `["White","Red"]` east → 500. `items` names
   only the items that earned a wall, never a Red item on the north wall placed beside them.
5. Each line has a non-empty `detail`.

---

## Task 5 — Lucky, seasonal and type bonuses (hha-bku)

**Difficulty:** medium · **design-ref:** DESIGN.md §4.3, §6.10–6.12, §6 readings · **Depends on:** nothing

### Description
Implement the house rules `lucky` (§6.10) in `src/engine/rules/lucky.ts`, `seasonal`
(§6.11) in `src/engine/rules/seasonal.ts` and `type` (§6.12) in
`src/engine/rules/type.ts`, to the readings in DESIGN.md §6. Lucky and seasonal names
come from `src/engine/curated.ts`.

### Constraints
- Edit only those three rule files and its own unit test file `tests/unit/house-rules.test.ts`.
- The shared constraints at the top of this draft apply. These lines belong in
  `result.house.lines`, never in a room's lines.

### Done means
1. Lucky reads the frozen `lucky.json`: a house holding every name in its `items` list
   (72) → one house `lucky` line of 777 × 72, `items` exactly those names. Duplicates
   across rooms score once: `katana` ×2 in one room, `katana` in another and `lucky gold
   cat` in a third → 1,554, `items` exactly `["katana","lucky gold cat"]`. A house with no
   lucky item has no `lucky` line.
2. Seasonal reads the frozen `seasonal.json` and `house.season`: a house holding every
   seasonal name → 777 × that season's list size, with `items` exactly that season's
   names, for each of the four seasons. `bamboo shelf` placed in two rooms in spring → 777.
   `frozen tree` alone in summer → no line.
3. Type pays 2,500 once when all four slots are filled anywhere in the house: chair (`tag`
   Chair or `interact` Chair), table (`tag` Table), bed (`tag` Bed or `interact` Bed),
   wardrobe or dresser (`interact` Wardrobe or variant category Dresser), one per room
   over four rooms → 2,500, `items` exactly those four names. Dropping any one slot →
   no line (checked for each of the four). Two of every slot → still 2,500, `items` all
   eight names. A chair by `interact` only, a bed by `interact` only and a wardrobe by
   `interact` only also fill their slots. A `TableClock`-tagged item is not a table, and
   an item tagged `Dresser` with no Dresser category and no Wardrobe interact is not a
   dresser: substituting either → no line.
4. These lines are read from `result.house.lines`, and each has a non-empty `detail`.

---

## Task 6 — Penalties (hha-a1o)

**Difficulty:** trivial · **design-ref:** DESIGN.md §4.3, §6.13–6.16, §6 readings · **Depends on:** nothing

### Description
Implement the room rules `trash` (§6.13), `facing-wall` (§6.14), `dropped` (§6.15) and
`cockroach` (§6.16) in their files under `src/engine/rules/`, to the readings in
DESIGN.md §6. Trash names come from `src/engine/curated.ts`. Validate `droppedItems` and
`cockroaches`.

### Constraints
- Edit only `src/engine/rules/trash.ts`, `facing-wall.ts`, `dropped.ts`, `cockroach.ts`,
  `src/engine/resolve.ts` (only if validation belongs there), and its own unit test file `tests/unit/penalties.test.ts`.
- The shared constraints at the top of this draft apply. Penalty lines carry negative
  points.

### Done means
1. Trash is recognised by name from `trash.json`: `boot` ×2 and `empty can` (sheet Other)
   → `trash` −1,500, `items` exactly `["boot","empty can"]`. A `garbage can` (category
   Trash, not in the list) → no `trash` line. An item on sheet Other that is not in the
   list → no `trash` line.
2. Facing a wall: item X with `facingWall: true` and quantity 2, plus item Y with
   `facingWall: true` → −900, `items` exactly `["X","Y"]`. An item with `facingWall:
   false` or unset → no line.
3. `droppedItems: 7` → `dropped` −7. `cockroaches: 2` → `cockroach` −5,000. Both
   absent, or both explicitly 0 → no error and neither line.
4. `score()` throws an Error whose message contains `droppedItems` and not
   `cockroaches` for `droppedItems` of `-1` or `1.5`, and one whose message contains
   `cockroaches` and not `droppedItems` for `cockroaches` of `-2` or `0.5`.
5. Each line has a non-empty `detail`.

---

## Task 7 — Rank and rewards (hha-80n)

**Difficulty:** trivial · **design-ref:** DESIGN.md §5.1 (`Result.rank`), §7 · **Depends on:** nothing

### Description
Add `rank` to the result of `score()` to the `Result.rank` contract in DESIGN.md §5.1 and
the §7 tables: the B/A/S letter for `house.stage`, the highest reward reached, and the
next reward with the points still needed.

### Constraints
- Edit only `src/engine/score.ts`, `src/engine/types.ts`, a new `src/engine/rank.ts` if
  wanted, and its own unit test file `tests/unit/rank.test.ts`. Do not edit any rule file.
- The shared constraints at the top of this draft apply. The rank is computed from
  `total` and nothing else.

### Done means
Every total below comes from an **inert fixture**: one room holding one placed item named
`R` with `basePoints` = N, quantity 1, surface `floor`, no wallpaper or flooring, every
optional field null, false or empty, and `sets: {}`. No other rule can touch it, so the
test asserts `total === N` first. A total of 0 comes from one empty room.
1. `rank.stage` equals `house.stage`, and `rank.letter` follows the §7 table at every
   boundary, each tested with its own stage. The A threshold gives A and 1 point less gives
   B: `house` 10,000; `main-upgrade` 17,000; `back` 25,000; `left` 38,000; `right`
   50,000; `second-floor` 64,000; `basement` 80,000. The S threshold gives S and 1 point
   less gives A: 15,000; 23,000; 35,000; 47,000; 60,000; 75,000; 90,000. (Second-floor
   63,999 → B is the input that catches the Nookipedia typo DESIGN.md §7 warns about.)
2. Every reward threshold T (10,000 `HHA pennant`, 20,000 `bronze HHA plaque`, 30,000
   `silver HHA plaque`, 50,000 `gold HHA plaque`, 70,000 `bronze HHA trophy`, 100,000
   `silver HHA trophy`, 150,000 `gold HHA trophy`) gives `reward` = that name. T − 1
   gives the previous reward (`null` below 10,000) and `next` deep-equal to
   `{ reward: <that name>, points: T, needed: 1 }`. At 0, `reward` is `null` and `next`
   is `{ reward: "HHA pennant", points: 10000, needed: 10000 }`. At 150,000 and 200,000,
   `next` is `null`.
3. Below zero (an inert item with `basePoints` −500): `total` −500, letter `B`, `reward`
   `null`, `next` `{ reward: "HHA pennant", points: 10000, needed: 10500 }`.
4. The rank depends on `total` and stage alone: an inert one-item house and a house of
   two rooms with two inert items, same total and stage, give deep-equal `rank`.
5. Adding `rank` adds nothing else: `Object.keys(result).sort()` is exactly
   `["house","rank","rooms","total"]`, and on the inert fixture with N = 12,345, `total`
   is 12,345, `rooms[0].total` is 12,345, and `house` is `{ total: 0, lines: [] }`.

---

## Critic panel dispositions

Four fresh-context testability critics read the specs, each with the pipeline's
`advisors/testability.md` charter. Closely related specs were paired, as PLANNING.md
allows: Tasks 1+6, 2+3, 4+5, and 7 alone. All four returned `concerns`: 41 findings,
**39 accepted, 0 rejected, 2 recorded as non-checks** (below).

- **Tasks 1 and 6 (11 findings, all accepted).**
  - Each wall-hung sheet is checked alone, because the cap of 3 hid a missing sheet.
  - `items` is pinned exactly. For wall-hung, every qualifying name is listed, even past the cap.
  - Exactly one line per rule.
  - `droppedItems: 0` and `cockroaches: 0` are valid and give no line.
  - Error messages name only their own field.
  - One trash reading everywhere: names in `trash.json`. An Other-sheet item outside the list is not trash.
  - The count includes wall, ceiling and tabletop pieces.
  - The DESIGN.md §6.3 table row contradicted the readings. Amended.
  - The curated JSON import was confirmed to load under the image's Node.
  - Each task has its own unit-test filename.
- **Tasks 2 and 3 (10 findings, all accepted).**
  - Placed-variant fixtures where the answer flips with the variant read.
  - Two variants of one item count as one unique item.
  - Tie-breaks are pinned through exact `items`, with the losing names placed first.
  - Concepts are ranked by count with duplicates, tested against ranking by unique items.
  - The per-item category fixture includes a duplicate.
  - Wallpaper **and** flooring are covered for series, set, concept and category.
  - Exact `items` throughout.
  - No test pins `lines.length` or a total.
  - A `null` category is no category (added to DESIGN.md §6).
- **Tasks 4 and 5 (13 findings, 12 accepted).**
  - Four single-slot-missing type negatives, a paid-once case, and `TableClock` / tag-`Dresser` lookalike traps (recorded in DESIGN.md §6).
  - Lucky and seasonal tests read the frozen lists and place every name, so a hard-coded shortlist fails.
  - A seasonal item in two rooms scores once.
  - Color: a tie-break with different unique counts, a match only through the second color, and the exact 8-item boundary.
  - Feng shui: one 500 per wall, the 1,500 cap, and Yellow south giving nothing.
  - Exact `items`, and full-field fixtures.
  - **Recorded as a non-check:** "no room carries a house line" cannot fail, since `score.ts` routes those rules to the house. The clause was replaced by reading the lines from `result.house.lines`.
- **Task 7 (7 findings, all accepted).**
  - Inert single-item fixtures, with `total` asserted before `rank`.
  - "Changes nothing else" restated as exact result keys and hand-computed values.
  - A and S boundaries for every stage, including second-floor 63,999/64,000, which catches the Nookipedia typo.
  - Every reward threshold at T and T−1.
  - `next` written with its field names.
  - A below-zero case.
  - Same total and stage give the same rank.
- **Recorded as a non-check (mine, from mutation testing):** "a negative total marked as having a reward" produced identical output to the correct code. It was a bad mutation, not a missed bug.

## Coverage and freeze gate

| Task | Criteria | Test file |
|---|---|---|
| hha-4vl count + wall-hung | 1–4 | `count-wall-hung.test.ts` (6 tests) |
| hha-ny7 series + set | 1–5 | `series-set.test.ts` (6) |
| hha-bu0 concept + category | 1–6 | `concept-category.test.ts` (8) |
| hha-09f color + feng shui | 1–5 | `color-feng-shui.test.ts` (5) |
| hha-bku lucky, seasonal, type | 1–4 | `house-rules.test.ts` (8) |
| hha-a1o penalties | 1–5 | `penalties.test.ts` (4) |
| hha-80n rank | 1–5 | `rank.test.ts` (6) |

Every criterion is asserted in its task's file, and every test serves a criterion.

**Freeze gate:** all seven suites are **red** against the placeholders, with the control
green. Guards declared: 0. Spec lint: clean.

**Beyond the gate:**
- Throwaway reference implementations of all seven tasks, written in a scratch copy and
  never committed, pass every suite offline in the pipeline image.
- Each suite also passes against a copy with **only its own** task implemented (the state
  of its branch).
- The existing hha-6wy suite still passes with **all** rules implemented, the state after
  the merge.
- 28 deliberate mistakes, at least two per task, were run against the tests: 27 caught,
  plus 1 equivalent mutation that changes no output. Among those caught:
  - counting rugs, or using `>` instead of `≥` at the count tiers;
  - forgetting the Posters sheet, or dropping the wall-hung cap;
  - ranking series by total copies, or counting placements as unique items;
  - reading only the first color, or `TableClock` counting as a table;
  - recognising trash by sheet, or rejecting `droppedItems: 0`;
  - the second-floor rank typo.
