// hha-md3, criterion 1: the committed catalog is exactly what the script produces, the
// script is deterministic, and --upstream and the default paths are honoured.
import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('../../../', import.meta.url));
const SCRIPT = path.join(ROOT, 'scripts', 'import-catalog.ts');
const COMMITTED = path.join(ROOT, 'src', 'data', 'catalog.json');

function cleanEnv() {
  const env = { ...process.env };
  delete env.NODE_TEST_CONTEXT;
  delete env.NODE_OPTIONS;
  return env;
}

function run(args: string[], cwd: string) {
  return spawnSync(process.execPath, [SCRIPT, ...args], {
    cwd, env: cleanEnv(), encoding: 'utf8', timeout: 180000,
  });
}

function tmp() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'hha-md3-'));
}

function sameBytes(a: string, b: string) {
  return Buffer.compare(fs.readFileSync(a), fs.readFileSync(b)) === 0;
}

test('committed catalog.json equals a fresh run, and runs are deterministic', () => {
  assert.ok(fs.existsSync(COMMITTED), 'src/data/catalog.json is committed');
  const dir = tmp();
  const a = path.join(dir, 'a.json');
  const b = path.join(dir, 'b.json');
  const r1 = run(['--out', a], ROOT);
  assert.equal(r1.status, 0, `first run failed: ${r1.stderr}`);
  assert.ok(sameBytes(a, COMMITTED), 'fresh output differs from the committed catalog.json');
  const r2 = run(['--out', b], ROOT);
  assert.equal(r2.status, 0, `second run failed: ${r2.stderr}`);
  assert.ok(sameBytes(a, b), 'two runs gave different bytes');
});

test('--upstream pointing at a copy elsewhere gives the same bytes', () => {
  const dir = tmp();
  const up = path.join(dir, 'elsewhere', 'sheets');
  fs.cpSync(path.join(ROOT, 'data', 'upstream'), up, { recursive: true });
  const out = path.join(dir, 'c.json');
  const r = run(['--upstream', up, '--out', out], ROOT);
  assert.equal(r.status, 0, `run failed: ${r.stderr}`);
  assert.ok(sameBytes(out, COMMITTED), '--upstream copy produced different bytes');
});

test('with no options, paths are relative to the working directory', () => {
  const dir = tmp();
  fs.cpSync(path.join(ROOT, 'data', 'upstream'), path.join(dir, 'data', 'upstream'), { recursive: true });
  fs.cpSync(path.join(ROOT, 'data', 'SOURCE.md'), path.join(dir, 'data', 'SOURCE.md'));
  fs.cpSync(path.join(ROOT, 'src', 'data', 'curated'), path.join(dir, 'src', 'data', 'curated'), { recursive: true });
  const r = run([], dir);
  assert.equal(r.status, 0, `run failed: ${r.stderr}`);
  const written = path.join(dir, 'src', 'data', 'catalog.json');
  assert.ok(fs.existsSync(written), 'default --out src/data/catalog.json was not written in the working directory');
  assert.ok(sameBytes(written, COMMITTED), 'default-path output differs from the committed catalog.json');
});
