#!/bin/sh
# Acceptance-test runner: invoked by the pipeline verifier as
#   sh tools/run-acceptance.sh tests/acceptance/<issue-id>/
# Runs every *.test.ts in the given directory with Node's built-in test runner; Node runs
# the TypeScript directly through type stripping (DESIGN.md §11).
#
# Why a wrapper instead of `node --test <dir>/`: that form loads the directory as ONE
# module and fails with MODULE_NOT_FOUND — a red indistinguishable from a real assertion
# failure — and a directory with no test files passes. Both are verdicts the harness
# invented. This script names the files explicitly and refuses an empty directory.
#
# Why not Vitest: a task can edit a Vitest config and change what judges it. This script
# and Node's runner have no config a task can touch.
#
# Frozen path: listed in pipeline.config.json frozenPaths — never edited during a run.
set -u
DIR="${1:?usage: run-acceptance.sh <test-dir>}"
[ -d "$DIR" ] || { echo "FAIL: test dir not found: $DIR"; exit 1; }

set -- "${DIR%/}"/*.test.ts
[ -e "$1" ] || { echo "FAIL: no *.test.ts files in $DIR"; exit 1; }
exec node --test "$@"
