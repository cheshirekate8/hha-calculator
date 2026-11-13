# hha-calculator

A single-page app that calculates an *Animal Crossing: New Horizons* Happy Home Academy
score from a description of the player's house, and explains every point. TypeScript,
React, Vite, Vitest; static hosting on GitHub Pages.

This project is developed by a multi-agent pipeline: work arrives as Beads issues with
frozen acceptance tests, runs autonomously in a locked-down container, and comes back as
a pull request.

## Read these first

| File | What it is |
|---|---|
| `DESIGN.md` | **Authoritative.** Scope, invariants, the data plan, the input model, every scoring rule with its source and confidence, and the change log. When reality disagrees with it, amend it with a change-log row; never ignore it silently. |
| `tests/acceptance/README.md` | How frozen tests are written and run. |
| `docs/IDEAS.md` | The idea inbox. Parked notes, not work. |

**Spec authority:** task specs are Beads issues; the frozen tests in
`tests/acceptance/<issue-id>/` are the proof. `DESIGN.md` holds intent. There is no
`SPEC.md`.

## Invariants (DESIGN.md §2)

1. The scoring engine (`src/engine/`) is pure and deterministic: no I/O, no clock, no
   randomness, no React. The season is an input.
2. The total is the sum of its breakdown lines, and every line names its rule id.
3. Every rule carries a source and a confidence level (`supported`, `disputed`, `unknown`).
4. Item data is vendored and pinned. Nothing is fetched at run time or build time.
5. Hand-curated lists (`src/data/curated/`) are separate from imported data, so a
   re-import can never overwrite them.

Never change a rule's numbers or a default reading to make something pass. That is a
design decision, made with the user and recorded in the DESIGN.md change log.

## Code conventions

- **Erasable TypeScript only.** `tsconfig.json` sets `erasableSyntaxOnly`, because the
  frozen acceptance tests run on Node with type stripping. No `enum`, no `namespace`, no
  constructor parameter properties. Use union types and `as const` objects.
- **Relative imports carry the `.ts` extension** (`./rules/series.ts`), so the same file
  loads under Vite, Vitest and plain Node.
- **The engine takes the catalog as an argument**; it never imports `catalog.json`
  itself. Tests load the catalog and pass it in.
- **Call tools directly** (`tsc`, `vite`, `vitest`), never through `npx`, which tries the
  network when it cannot find a local binary.
- Project tests (Vitest) live in `tests/unit/` and run with `vitest run`. The frozen
  acceptance tests use `node:test` instead, so no config a task can edit decides them.

## Working inside the pipeline container (read this when you are the coding agent in a run)
- This is a locked-down Docker container: the network reaches Anthropic endpoints only.
  No package installs, no web lookups — everything you need is in this repo, the issue
  file, or the memory file.
- Your task is `/workspace/.run/issue.md`; project memory is `/workspace/.run/memory.md`.
  Both are read-only exports — use them, don't edit them.
- NEVER touch `tests/acceptance/` or any path in `pipeline.config.json`'s `frozenPaths`.
  The verifier diffs them against the fork point; any change — even whitespace — ends
  the task as "tampered".
- The frozen verifier decides pass/fail, not you. Run tests while you work, but the
  authoritative check runs after you exit.
- You cannot push (no credentials, no git-host network). Commit locally at every
  meaningful boundary; the host pushes your branch after the container exits.
- Insights worth keeping across tasks go in the status file's memory notes as the run
  scaffolding instructs — never in ad-hoc memory files.
- If you conclude the frozen spec or its tests are themselves wrong, say so with
  `node /pipeline/status.js concern "<what is wrong and why>"` (§3.7). That is a
  first-class result, not a failure — but it is evidence only: it cannot change your
  outcome, so keep doing the best work the spec allows rather than contorting correct
  code to satisfy a gate you believe is broken.

Run a task's acceptance tests with `sh tools/run-acceptance.sh tests/acceptance/<issue-id>/`.
The npm packages are installed above the clone at `/node_modules`; there is no
`node_modules` in the workspace and you must not create one.


<!-- BEGIN BEADS INTEGRATION v:1 profile:minimal hash:6cd5cc61 -->
## Beads Issue Tracker

This project uses **bd (beads)** for issue tracking. Run `bd prime` to see full workflow context and commands.

### Quick Reference

```bash
bd ready              # Find available work
bd show <id>          # View issue details
bd update <id> --claim  # Claim work
bd close <id>         # Complete work
```

### Rules

- Use `bd` for ALL task tracking — do NOT use TodoWrite, TaskCreate, or markdown TODO lists
- Run `bd prime` for detailed command reference and session close protocol
- Use `bd remember` for persistent knowledge — do NOT use MEMORY.md files

**Architecture in one line:** issues live in a local Dolt DB; sync uses `refs/dolt/data` on your git remote; `.beads/issues.jsonl` is a passive export. See https://github.com/gastownhall/beads/blob/main/docs/SYNC_CONCEPTS.md for details and anti-patterns.

## Agent Context Profiles

The managed Beads block is task-tracking guidance, not permission to override repository, user, or orchestrator instructions.

- **Conservative (default)**: Use `bd` for task tracking. Do not run git commits, git pushes, or Dolt remote sync unless explicitly asked. At handoff, report changed files, validation, and suggested next commands.
- **Minimal**: Keep tool instruction files as pointers to `bd prime`; use the same conservative git policy unless active instructions say otherwise.
- **Team-maintainer**: Only when the repository explicitly opts in, agents may close beads, run quality gates, commit, and push as part of session close. A current "do not commit" or "do not push" instruction still wins.

## Session Completion

This protocol applies when ending a Beads implementation workflow. It is subordinate to explicit user, repository, and orchestrator instructions.

1. **File issues for remaining work** - Create beads for anything that needs follow-up
2. **Run quality gates** (if code changed) - Tests, linters, builds
3. **Update issue status** - Close finished work, update in-progress items
4. **Handle git/sync by active profile**:
   ```bash
   # Conservative/minimal/default: report status and proposed commands; wait for approval.
   git status

   # Team-maintainer opt-in only, unless current instructions forbid it:
   git pull --rebase
   git push
   git status
   ```
5. **Hand off** - Summarize changes, validation, issue status, and any blocked sync/commit/push step

**Critical rules:**
- Explicit user or orchestrator instructions override this Beads block.
- Do not commit or push without clear authority from the active profile or the current user request.
- If a required sync or push is blocked, stop and report the exact command and error.
<!-- END BEADS INTEGRATION -->
