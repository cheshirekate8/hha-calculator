# Planning draft — 2026-11-13 (Phase 1)

The pipeline's PLANNING.md step 5 file: the specs for one batch, for the user to approve.
**Superseded by the Beads issues at freeze**; delete it once the tasks have run.

Done interactively in this session, before any task (DESIGN.md §12): the project scaffold,
the upstream copy in `data/upstream/` (pinned commit in `data/SOURCE.md`), and the curated
lists in `src/data/curated/`.

The two tasks are independent: neither reads the other's files, and both build on the
scaffold already on `main`. They can run in the same batch.

---

## Task 1 — Import the item catalog (hha-md3)

**Difficulty:** medium · **design-ref:** DESIGN.md §4.1, §4.2, §4.2.1, §4.3 · **Depends on:** nothing

### Description
Write `scripts/import-catalog.ts`, a Node script run as `node scripts/import-catalog.ts`
(TypeScript through Node's type stripping). It reads the upstream sheets in
`data/upstream/` and the curated lists in `src/data/curated/`, and writes
`src/data/catalog.json` in exactly the DESIGN.md §4.2.1 format. Commit the generated
`src/data/catalog.json`.

Options, each optional, paths relative to the current directory:
`--upstream <dir>` (default `data/upstream`), `--curated <dir>` (default
`src/data/curated`), `--out <file>` (default `src/data/catalog.json`). The catalog's
`source.commit` is the 40-character SHA read from `data/SOURCE.md` in the current directory.

Before writing anything, the script checks that every curated name (`lucky.json`'s
`items` and `excludedNpcPhotos`; `seasonal.json`'s `spring`, `summer`, `autumn` and
`winter`; `trash.json`'s `items`) equals a catalog item name exactly. If any does not, it
prints each missing name to stderr, exits non-zero, and writes no output file.

### Constraints
- Do not modify anything in `data/` or `src/data/curated/`. They are planning-time data,
  frozen like the tests: `pipeline.config.json`'s `frozenPaths` lists them, so any change
  ends the task as tampered.
- Node built-ins only; no new packages. The script imports only Node built-ins and files
  under `scripts/`.
- The output is deterministic: the same inputs always give byte-identical output.
- Erasable TypeScript only, relative imports with `.ts` extensions (`CLAUDE.md`).
- Do not create or modify anything under `src/engine/`; another task owns it.

### Done means
1. Run from the repo root, `node scripts/import-catalog.ts --out <temp file>` exits 0, and
   its output is byte-identical to the committed `src/data/catalog.json`. A second run
   gives identical bytes again. So does a run with `--upstream` pointing at a copy of
   `data/upstream/` elsewhere. Run with no options from a working directory holding copies
   of `data/upstream/` and `src/data/curated/`, it writes `src/data/catalog.json` there,
   byte-identical to the committed file.
2. The committed catalog has exactly one item per upstream row (3,993 for the pinned
   data), every item name is unique, every item's `sheet` equals its upstream row's
   `sourceSheet`, and `source` is `{ "repo": "Norviah/animal-crossing", "commit": <the SHA
   in data/SOURCE.md> }`. Every item has exactly the §4.2.1 item fields (`basePoints` a
   number; `interact` a string, boolean or `null`) and at least one variant, and every
   variant has exactly the §4.2.1 variant fields (`colors` and `concepts` always arrays).
3. Item names strictly increase under plain JavaScript string comparison (`<`), and these
   items carry exactly these values:
   - `katana`: sheet `Housewares`, basePoints 451.
   - `famous painting`: basePoints 451; `famous painting (forgery)`: basePoints 17.
   - `log stool`: tag `Chair`, interact `Chair`, series `log`, 4 variants; its
     `White birch` variant has colors `["White","Beige"]` and concepts
     `["garden","nature"]`.
   - `Moroccan lights`: its `Silver` variant has category `Lighting` (upstream gives the
     category only per variation).
   - `koi`: sheet `Fish`, basePoints 71, series `null`, set `null`, exactly one variant:
     variation `null`, pattern `null`, colors `["Red","White"]`, concepts `[]`,
     category `Pet`.
   - `drapery`: 8 variants whose patterns are, in order, Berry red, Green, Yellow, Light
     blue, White, Navy blue, Black, Purple (upstream order); the `Berry red` one has
     variation `null` and colors `["Red","Red"]`.
4. `sets` has exactly the 29 distinct set values as keys.
   `sets.bear` is `["Baby bear","Mama bear","Papa bear","giant teddy bear"]` and
   `sets["imperial dining"]` is `["imperial dining chair","imperial dining lantern",
   "imperial dining table"]`. Every item listed under a set has that set as its `set`,
   every item with a non-null `set` is listed under it, and both the keys and each member
   list strictly increase under plain JavaScript string comparison.
5. Given a curated folder (`--curated`) where one list holds a name that is not in the
   catalog, the script exits non-zero, prints that name to stderr, and does not create the
   `--out` file. This holds separately for each of the seven lists (`lucky.items`,
   `lucky.excludedNpcPhotos`, `seasonal.spring`, `summer`, `autumn`, `winter`,
   `trash.items`), and for `Katana`, which differs from a real item only by case.
6. `scripts/import-catalog.ts`, and every file under `scripts/` it imports, imports only
   `node:`-prefixed modules or relative `.ts` paths inside `scripts/`.

---

## Task 2 — Engine core and base points (hha-6wy)

**Difficulty:** medium · **design-ref:** DESIGN.md §2, §5.1, §6, §6.1, §8 · **Depends on:** nothing

### Description
Create the scoring engine's core to the DESIGN.md §5.1 contract:
- `src/engine/types.ts`: the types for House, Room, ItemRef, PlacedItem, Catalog (the
  §4.2.1 format), Options, Result, RoomResult, Line and RuleId.
- `src/engine/rules.ts`: exports `RULES`, the registry of the 16 rules in §6, each with
  its section, scope, confidence and source.
- `src/engine/score.ts`: exports `score(house, catalog, options?)` and `DEFAULT_OPTIONS`.

Implement input validation and the **base points** rule (§6.1) only. Every other rule is
a later task and produces no lines yet.

### Constraints
- The engine is pure: no I/O, no clock, no randomness, no React, and it never imports
  `catalog.json`. The catalog always arrives as an argument (§2.1).
- Erasable TypeScript only, relative imports with `.ts` extensions (`CLAUDE.md`).
- Do not create or modify anything under `scripts/`, `data/` or `src/data/`; another task
  owns them.

### Done means
1. `RULES` has exactly these 16 keys: `base`, `count`, `wall-hung`, `series`, `set`,
   `concept`, `category`, `color`, `feng-shui`, `lucky`, `seasonal`, `type`, `trash`,
   `facing-wall`, `dropped`, `cockroach`. `scope` is `house` for `lucky`, `seasonal` and
   `type`, `room` for the rest. `confidence` is `disputed` for `category` and
   `feng-shui`, `supported` for the rest. `section` is the rule's §6 number as a string
   (`base` → `"6.1"` … `cockroach` → `"6.16"`). Every `source` names the chibisnorlax
   FAQ (contains `chibisnorlax`), the source all 16 rules come from (DESIGN.md Sources).
2. `DEFAULT_OPTIONS` equals `{ categoryBonus: "per-category", fengShui: "on",
   facingWallScope: "any-tagged" }`. `score(house, catalog, {})` and
   `score(house, catalog, { fengShui: "off" })` do not throw and equal the result with no
   options (no implemented rule reads an option yet).
3. A house whose rooms have no items, wallpaper or flooring scores `total` 0, with one
   room result per room in input order, each carrying the room's name, `total` 0 and no
   lines, and `house` equal to `{ total: 0, lines: [] }`.
4. Base points, on a small test catalog that meets §4.2.1 in full (sorted names, every
   field present, item A with two variants): a room with item A (151 points) ×2 on the
   floor, item B (103) on the wall **with no `quantity` field** (so the default of 1
   applies), wallpaper W (451) and flooring F (201) produces exactly one line, rule
   `base`, 1,057 points, a non-empty `detail`, and `items` listing each contributing
   catalog name exactly once (A, B, W, F; order not checked); the room total
   and the overall total are 1,057. A room holding only a 0-point item has no lines.
   Placing a different variant of A gives the same points.
5. Across a three-room house, rooms come back in input order with their own names and
   their own totals: 453 (A ×3), 657 (wallpaper W, B ×2) and 201 (flooring F). `total` is
   1,311, every room's `total` equals the sum of its lines' points, and `total` equals
   the sum of the room totals plus `house.total`.
6. `score()` throws an Error whose message contains the offending value for: a placed
   item, wallpaper or flooring name not in the catalog; a `variation` none of the item's
   variants has; a `variation` that exists paired with a `pattern` that variant does not
   have; and a `quantity` of `0`, `-1` or `1.5`, where the message also contains the
   word `quantity`. (Test rooms have names without digits, so a stray room index cannot
   satisfy the check.)
7. Purity (§2.1): scoring a deep-frozen house and catalog does not throw; two calls give
   deep-equal results; scoring with `Date.now` and `Math.random` replaced by functions
   that throw still succeeds; and no file under `src/engine/` imports a `node:` module,
   `react`, or any path ending in `catalog.json`.

---

## Critic panel dispositions

Both tasks are **medium**, so each got one fresh-context testability critic (the charter
from the pipeline's `advisors/testability.md`, pasted verbatim). Both returned `concerns`.
Every finding is listed with what was done about it.

### hha-md3 (catalog import): 10 findings
1. **The inputs were not frozen**, so an agent could delete curated names to get past the
   check. **Accepted:** `data/upstream/`, `data/SOURCE.md` and `src/data/curated/` added to
   `frozenPaths`; the constraint now says so.
2. **Criterion 5 tested only one curated list.** **Accepted:** one failing case for each
   of the seven lists, plus `Katana` (wrong case only).
3. **The exact §4.2.1 shape had no criterion.** **Accepted:** criterion 2 pins the exact
   item and variant field sets and their types.
4. **"Sorted" did not say which order.** **Accepted:** strictly increasing under plain
   JavaScript `<`.
5. **Set membership was checked in one direction only, and not for order.** **Accepted:**
   both directions, sorted keys and sorted members.
6. **`--upstream` and the default `--out` were never exercised.** **Accepted:** both are
   in criterion 1.
7. **Working-directory and byte-level comparison hazards.** **Accepted:** tests set the
   child's cwd explicitly, strip `NODE_TEST_CONTEXT` and `NODE_OPTIONS`, write under the OS
   temp directory, and compare Buffers.
8. **Upstream variant order had no criterion.** **Accepted:** drapery's eight patterns
   pinned in upstream order.
9. **Two constraints had no check.** "Imports only built-ins and `scripts/`":
   **accepted**, as criterion 6. "Do not touch `src/engine/`": **rejected**, because this
   project has no file-scope gate, and an overlap with the parallel task would surface as a
   merge conflict at review, which is cheaper than a frozen check.
10. **The "else the item's value" fallback never fires on this data.** **Deferred**
    until a data refresh produces such a row; recorded here so it is not mistaken for
    covered.

### hha-6wy (engine core): 9 findings
1. **The sum invariant passed for an engine scoring the wrong room.** **Accepted:**
   per-room totals 453 / 657 / 201, checked by name and order.
2. **The format of a line's `items` was unstated.** **Accepted:** each contributing
   catalog name exactly once; order not checked.
3. **"Message contains the value" was near-trivial for quantities, and the spec used a
   Unicode minus.** **Accepted:** ASCII values, the word `quantity` required, and room
   names without digits.
4. **Unknown wallpaper or flooring and an unmatched `pattern` were not covered.**
   **Accepted:** all three are error cases.
5. **The quantity default of 1 was untested.** **Accepted:** item B has no `quantity`.
6. **A hand-written test catalog that broke §4.2.1 could fail a correct engine.**
   **Accepted:** every test catalog is sorted, has every field, and gives A two variants.
7. **The purity constraints had no criterion.** **Accepted:** criterion 7 now freezes the
   input, replaces `Date.now` and `Math.random` with functions that throw, and checks that
   `src/engine/` imports nothing from Node, React or `catalog.json`.
8. **Option merging had no criterion.** **Accepted:** `{}` and `{ fengShui: "off" }`
   give the same result as no options.
9. **`source` was only checked for presence.** **Accepted:** every source must name the
   chibisnorlax FAQ.

### Spec lint: 11 findings
All 11 are lines that tell the agent to **read** `data/upstream/`, `data/SOURCE.md` or
`src/data/curated/`, or forbid editing them. None orders an edit. **Rejected**, for that
reason.

## Coverage and freeze gate

Every criterion has a test file and every test file serves one criterion:

| Task | Criterion | Test |
|---|---|---|
| hha-md3 | 1 fresh, deterministic, `--upstream`, default paths | `freshness.test.ts` |
| hha-md3 | 2 one item per row, provenance, exact fields | `shape.test.ts` |
| hha-md3 | 3 sort order and pinned values | `values.test.ts` |
| hha-md3 | 4 sets | `sets.test.ts` |
| hha-md3 | 5 curated names, all seven lists and a case-only miss | `curated.test.ts` |
| hha-md3 | 6 import boundary | `imports.test.ts` |
| hha-6wy | 1 `RULES` | `rules.test.ts` |
| hha-6wy | 2 options | `options.test.ts` |
| hha-6wy | 3 empty house | `empty.test.ts` |
| hha-6wy | 4 base points | `base.test.ts` |
| hha-6wy | 5 per-room totals and sums | `rooms.test.ts` |
| hha-6wy | 6 errors | `errors.test.ts` |
| hha-6wy | 7 purity | `purity.test.ts` |

**Freeze gate:** both suites are **red** against the repo as it stands, with the control
green (exit 0). **Guards declared: 0.**

**Beyond the gate**, to make sure a correct implementation is not failed by a broken test:
throwaway reference implementations of both tasks (written in a scratch copy, never
committed) pass every test offline in the pipeline image (26/26 and 36/36), and the
build gate passes with them. Eight deliberately wrong variants each fail at least one
test: sorting with `localeCompare`, writing missing concepts as `null`, matching curated
names case-insensitively, checking only `lucky.items`, ignoring quantity, skipping
wallpaper and flooring, ignoring `pattern`, and emitting zero-point lines.
