# Planning draft — 2026-11-13 (Phase 3a: app logic)

The pipeline's PLANNING.md step 5 file for one batch. **Superseded by the Beads issues at
freeze**; delete it once the tasks have run.

Done interactively first (DESIGN.md §12, change-log row `phase-3-planning`):
`src/app/model.ts`, holding `AppState`, `STAGES`, `SEASONS`, `ROOMS_BY_STAGE`,
`DEFAULT_ROOM_NAMES` and `initialState()`. The four tasks below create disjoint new files
and can run in one batch. The screens that use them are Phase 3b, planned once these merge.

**Shared by every task:**
- Create only the files the task names, plus its own unit test file. Do not edit
  `src/app/model.ts`, the engine, or any other task's file.
- The module is pure: no I/O, no clock, no randomness, no React, and it never mutates its
  arguments. The only exception is `persist.ts`, which touches the storage object it is
  given and nothing else.
- Erasable TypeScript only, and relative imports with `.ts` extensions.

---

## Task 1 — State and house editing (hha-66x)

**Difficulty:** trivial · **design-ref:** DESIGN.md §5, §10.5 · **Depends on:** nothing

### Description
Create `src/app/state.ts` exporting `reduce(state: AppState, action: Action): AppState` and
the `Action` type, to DESIGN.md §10.5. The actions, exactly:
`{ type: "setStage", stage }`, `{ type: "setSeason", season }`,
`{ type: "setOption", option, value }`, `{ type: "renameRoom", room, name }`,
`{ type: "setWallpaper", room, ref }`, `{ type: "setFlooring", room, ref }` (`ref` an
`ItemRef` or `null`), `{ type: "addItem", room, item }`,
`{ type: "updateItem", room, index, patch }`, `{ type: "removeItem", room, index }`,
`{ type: "setDroppedItems", room, count }`, `{ type: "setCockroaches", room, count }`,
`{ type: "replace", state }`. `room` and `index` are zero-based positions.

### Constraints
- Create only `src/app/state.ts` and its own unit test file `tests/unit/state.test.ts`.
- The shared constraints above apply.

### Done means
1. `setStage` resizes the rooms to `ROOMS_BY_STAGE`. From the initial state with the main
   room renamed `Den` and holding one item, `setStage("basement")` gives 6 rooms: `Den`
   with its item, then `Back room`, `Left room`, `Right room`, `Upstairs`, `Basement`, each
   with `items: []`. Then `setStage("back")` gives 2 rooms, `Den` (item intact) and `Back
   room`. `setStage("main-upgrade")` from `back` gives 1 room. The stage is set each time.
   A non-first room keeps its contents too: at `back`, with room 1 renamed `Study` and
   holding an item, `setStage("left")` gives `Study` with its item at index 1 and `Left
   room` at index 2.
2. Item editing, each on the named room only (checked on room 0 and on room 1 of a
   two-room house, with the other room unchanged): `addItem` appends; `updateItem` merges
   `patch` into the item at `index` (for example `{ quantity: 3, nearWall: "east" }`),
   keeping its other fields; `removeItem` removes the item at `index`, keeping the order
   of the rest (removing the middle of three items).
3. `setWallpaper` and `setFlooring` set the ref and clear it with `null`; `renameRoom`,
   `setDroppedItems` and `setCockroaches` set their field on the named room only;
   `setSeason` sets the season; `setOption` sets one option and keeps the others.
   `replace` returns the given state object itself (`===`).
4. A `room` or `index` that does not exist (−1, or one past the end) returns the very same
   state object (`===`), for every room- and item-addressed action.
5. Purity: every action applied to a deep-frozen state does not throw, and leaves the
   input unchanged.

---

## Task 2 — Catalog search and variant labels (hha-3tf)

**Difficulty:** trivial · **design-ref:** DESIGN.md §4.2.1, §10.2, §10.5 · **Depends on:** nothing

### Description
Create `src/app/search.ts` exporting
`searchCatalog(catalog: Catalog, query, kind, limit = 50): CatalogItem[]` (searching
`catalog.items`) and
`variantLabel(variant): string`, to DESIGN.md §10.5.

### Constraints
- Create only `src/app/search.ts` and its own unit test file `tests/unit/search.test.ts`.
- The shared constraints above apply. Results are the catalog's own item objects, never
  copies.

### Done means
1. An empty or all-space query returns `[]`. Matching ignores case on both sides and
   surrounding spaces: `"  CHAIR "` returns exactly the list in criterion 2.
2. Results come in three groups, each in catalog order. In a catalog of `Rocking Chair`,
   `antique chair`, `armchair`, `chair`, `chair cushion`, `highchair`, `sofa` and `wooden
   chair`, the query `chair` returns exactly `chair`, `chair cushion` (names starting with
   it), then `Rocking Chair`, `antique chair`, `wooden chair` (a later word starting with
   it), then `armchair`, `highchair` (containing it).
3. `kind` filters by sheet: `"wallpaper"` returns only Wallpaper items, `"flooring"` only
   Floors items, and `"item"` every other sheet, never Wallpaper or Floors. Checked with
   matching items on Wallpaper, Floors, Rugs, Housewares, Wall-mounted, Ceiling Decor, Fish
   and Other.
4. `limit` caps the results after ranking: 60 matching items return 50 by default and 3
   with `limit` 3, and those are the first 3 of the full ranking.
5. `variantLabel`: variation `Red`, pattern null → `"Red"`; variation null, pattern
   `Striped` → `"Striped"`; both → `"Red / Striped"`; both null → `"Default"`.
6. Every result is the catalog's own object (`===`), and the catalog is not mutated.

---

## Task 3 — Breakdown view model and number formatting (hha-ucz)

**Difficulty:** trivial · **design-ref:** DESIGN.md §6, §7, §8, §10.3, §10.5 · **Depends on:** nothing

### Description
Create `src/app/breakdown.ts` exporting `buildBreakdown(result)`, `formatPoints(n)`,
`formatTotal(n)`, `RULE_LABELS` and `TOGGLES`, to DESIGN.md §10.5. `buildBreakdown`
returns at least `{ total, totalText, rank, sections }`. Each section has at least
`{ title, total, totalText, lines }`, and each line is the engine line plus at least
`label`, `section`, `confidence`, `pointsText` and `toggle` (a `TOGGLES` entry or `null`).
Outputs are compared by value, so copies are fine and extra fields are allowed.

### Constraints
- Create only `src/app/breakdown.ts` and its own unit test file
  `tests/unit/breakdown.test.ts`.
- The shared constraints above apply. Tests build `Result` objects by hand, so this module
  depends on the engine's types and `RULES` only, never on `score()`.

### Done means
1. Sections: one per `result.rooms` entry in order, titled with the room's name, then a
   final section titled `Whole house` from `result.house`. Each carries its `total` and
   `totalText`. A room with no lines has `lines: []`. `total`, `totalText` and `rank` come
   from the result (`rank` passed through unchanged).
2. Every line keeps `rule`, `points`, `detail` and `items`, and gains `label` from
   `RULE_LABELS`, which is exactly: base "Base points", count "Furniture count",
   wall-hung "Wall-hung items", series "Series", set "Set completion", concept "Concept",
   category "Category", color "Color", feng-shui "Feng shui", lucky "Lucky items",
   seasonal "Seasonal items", type "Daily-life essentials", trash "Trash", facing-wall
   "Facing a wall", dropped "Dropped items", cockroach "Cockroaches". `section` and
   `confidence` equal `RULES[rule].section` and `.confidence`.
3. `toggle` is `null` except on `category` lines, where it equals the `TOGGLES` entry
   `{ option: "categoryBonus", rule: "category", label: "Category bonus", values:
   [{ value: "per-category", label: "500 per category" }, { value: "per-item", label:
   "500 per item" }] }`, and on `feng-shui` lines, where it is `{ option: "fengShui",
   rule: "feng-shui", label: "Feng shui", values: [{ value: "on", label: "On" },
   { value: "off", label: "Off" }] }`. `TOGGLES` is exactly those two entries, category
   first. The test fixture includes `category`, `feng-shui`, `facing-wall` and `base` lines.
4. `formatPoints`: 1057 → `"+1,057"`, 1234567 → `"+1,234,567"`, −500 → `"−500"` (U+2212
   minus sign), −12345 → `"−12,345"`, 0 → `"0"`. `formatTotal`: 12345 → `"12,345"`, −500
   → `"−500"`, 0 → `"0"`. Lines use `formatPoints`; totals use `formatTotal`. The output
   does not depend on the machine's locale: the same strings come back when the module is
   run with `LANG=de_DE.UTF-8`.
5. The result passed in is not mutated (deep-frozen input does not throw).

---

## Task 4 — Persistence (hha-3gm)

**Difficulty:** medium · **design-ref:** DESIGN.md §5, §10.4, §10.5 · **Depends on:** nothing

### Description
Create `src/app/persist.ts` exporting `serialize(state)`, `parse(text)`,
`loadState(storage)`, `saveState(storage, state)`, `exportFileName(date)` and
`STORAGE_KEY = "hha-calculator/state"`, to DESIGN.md §10.5. `storage` is any object with
`getItem(key)` and `setItem(key, value)`, as `localStorage` has.

### Constraints
- Create only `src/app/persist.ts` and its own unit test file `tests/unit/persist.test.ts`.
- The shared constraints above apply; `persist.ts` touches only the storage object it is
  given.

### Done means
1. `serialize(state)` is JSON whose top level is exactly `{ format: "hha-calculator",
   version: 1, house, options }`. `parse(serialize(s))` returns `{ ok: true, state }` with
   `state` deep-equal to `s`, for `initialState()` and for a 6-room house whose items use
   every optional field.
2. `parse` checks in this order: JSON, format, version, stage, season, then the rooms and
   their contents, then options. Each case below is a valid saved file with exactly one
   thing broken, and `parse` returns `{ ok: false, error }` with `error` a string naming
   the field, for each of: text that is not JSON (`"JSON"`); a wrong `format` (`"format"`); `version` 2
   (`"version"`); an unknown stage (`"stage"`); an unknown season (`"season"`); a room
   count that does not match the stage (`"rooms"`); a room without a string `name`
   (`"name"`); an item with an unknown `surface` (`"surface"`); an item `quantity` of 0 or
   1.5 (`"quantity"`); an unknown `nearWall` (`"nearWall"`); a non-boolean `facingWall`
   (`"facingWall"`); a negative `droppedItems` (`"droppedItems"`); a `cockroaches` of 1.5
   (`"cockroaches"`); and an unknown `categoryBonus` value (`"categoryBonus"`). The errors
   for an unknown stage and an unknown season do not mention `rooms`.
3. Options are optional in a file: absent → `DEFAULT_OPTIONS`; `{ fengShui: "off" }` → the
   defaults with `fengShui` `"off"`.
4. `loadState` returns `initialState()` when the key is missing, when the stored text is
   not JSON, when it is JSON that `parse` rejects (version 2), and when `getItem` throws;
   otherwise it returns the parsed state.
   `saveState` stores `serialize(state)` under `STORAGE_KEY` and returns `true`, or returns
   `false` when `setItem` throws.
5. `exportFileName(new Date(Date.UTC(2026, 10, 13, 23, 30)))` is
   `"hha-house-2026-11-13.json"`, using the UTC date even when the process time zone is
   ahead of UTC (`TZ=Asia/Tokyo`, where it is already the 14th). Month and day are padded:
   5 January 2027 gives `"hha-house-2027-01-05.json"`.
6. `serialize`, `saveState` and `parse` do not mutate their input: a deep-frozen state can
   be serialized and saved without throwing.

---

## Critic panel dispositions

Two fresh-context testability critics read the specs, each with the pipeline's
`advisors/testability.md` charter, paired as PLANNING.md allows: Tasks 1+4 and 2+3. Both
returned `concerns`: 19 findings, **14 accepted with changes, 3 already satisfied by the
tests as written, 2 recorded as unchecked constraints**.

- **Tasks 1 and 4 (9 findings).**
  - **Accepted:**
    - The export file name is tested under `TZ=Asia/Tokyo`, where 23:30 UTC is already the 14th, and the test asserts the zone took effect.
    - A fixed validation order, each bad file breaking exactly one field, and the stage and season errors must not mention `rooms`.
    - `setStage` must keep a renamed, filled non-first room.
    - Item edits are checked on room 1 with room 0 asserted unchanged, and the middle of three items is removed.
    - Stored JSON that `parse` rejects (version 2) also falls back to a fresh state.
    - `serialize`, `saveState` and `parse` are checked on frozen input.
    - `replace` is pinned as `===`.
  - **Already satisfied:** the storage stub is key-aware, and the loaded state differs from `initialState()`.
  - **Recorded:** the `Action` type export and the unit-test file cannot be asserted at run time; the build gate and review cover them.
- **Tasks 2 and 3 (10 findings).**
  - **Accepted:**
    - `searchCatalog` takes the whole `Catalog`.
    - The exact list is asserted for `"  CHAIR "`, with a capitalised `Rocking Chair` in the fixture.
    - The item-kind fixture adds Ceiling Decor, Fish and Other.
    - Outputs are "at least these fields", compared by value.
    - The `TOGGLES` order is pinned.
    - Formatting must not depend on locale, checked in a child process under `LANG=de_DE.UTF-8`. Node's default formatting really does print `1.057` there, so the check bites.
  - **Already satisfied:** the limit fixture puts a later-word match first in catalog order; positive totals and positive lines are both asserted; the fixture includes `category`, `feng-shui`, `facing-wall` and `base` lines.
  - **Recorded:** each task's own unit-test file is regression evidence, with no frozen check.

## Coverage and freeze gate

| Task | Criteria | Test file |
|---|---|---|
| hha-66x state | 1–5 | `state.test.ts` (5 tests) |
| hha-3tf search | 1–6 | `search.test.ts` (6) |
| hha-ucz breakdown | 1–5 | `breakdown.test.ts` (6) |
| hha-3gm persistence | 1–6 | `persist.test.ts` (21) |

**Freeze gate:** all four suites are **red** against the repo, with the control green.
Guards declared: 0. Spec lint: clean.

**Beyond the gate:**
- Throwaway reference implementations of all four modules, written in a scratch copy and
  never committed, pass every suite offline in the pipeline image, and the build gate
  passes with them.
- 22 deliberate mistakes, at least four per task, are all caught. Among them:
  - a reducer that rebuilds non-first rooms, edits only room 0, or returns a copy for a bad index;
  - search that slices before ranking, is case-sensitive, or whitelists the familiar sheets;
  - formatting through `toLocaleString`, totals with a plus sign, or an ASCII hyphen for negatives;
  - an export name in local time or without zero-padding;
  - validation that checks rooms before stage;
  - a `loadState` that skips validation;
  - a `serialize` that writes into its input.
