# Frozen acceptance tests

Tests land here during planning (the pipeline's PLANNING.md step 6), one directory per
Beads issue (`tests/acceptance/<issue-id>/`), and are committed to `main` **before** the
run. The pipeline's verifier diffs this whole tree, plus every path in
`pipeline.config.json`'s `frozenPaths`, against the task branch's fork point. Any change
during a run, by anyone, even whitespace, is the "tampered" outcome.

- Each directory is run by `tools/run-acceptance.sh`: every `*.test.ts` file, through
  Node's built-in test runner (`node:test` + `node:assert`), with Node running the
  TypeScript directly. Any failure fails the task.
- Tests run in a sealed container with no network and no browser. They import pure modules
  (the scoring engine in `src/engine/`, the catalog in `src/data/`) by relative path with
  the `.ts` extension (`../../../src/engine/score.ts`), never React or Vite. The season and
  every other input are passed in; a test never reads the wall clock (DESIGN.md §2).
- Every assertion pins a **value**, chosen so that a plausible wrong reading of the rule
  produces a different number (DESIGN.md §11).
- Frozen tests inline what they need. They must not import shared test helpers that a
  task could edit, or the task could change what judges it without touching this tree.
- `_control/` holds the freeze gate's control: one test that asserts nothing. Leave it.
- Old directories stay forever as the record of past promises.
