// hha-md3, criterion 5: a curated name with no exact catalog match stops the import,
// names itself, and leaves no output — checked for every list, and for a case-only miss.
import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('../../../', import.meta.url));
const SCRIPT = path.join(ROOT, 'scripts', 'import-catalog.ts');
const CURATED = path.join(ROOT, 'src', 'data', 'curated');

function cleanEnv() {
  const env = { ...process.env };
  delete env.NODE_TEST_CONTEXT;
  delete env.NODE_OPTIONS;
  return env;
}

// [file, key path, planted name]
const CASES: [string, string[], string][] = [
  ['lucky.json', ['items'], 'not-an-item-lucky'],
  ['lucky.json', ['excludedNpcPhotos'], 'not-an-item-excluded'],
  ['seasonal.json', ['spring'], 'not-an-item-spring'],
  ['seasonal.json', ['summer'], 'not-an-item-summer'],
  ['seasonal.json', ['autumn'], 'not-an-item-autumn'],
  ['seasonal.json', ['winter'], 'not-an-item-winter'],
  ['trash.json', ['items'], 'not-an-item-trash'],
  ['lucky.json', ['items'], 'Katana'],
];

for (const [file, [key], planted] of CASES) {
  test(`unknown ${JSON.stringify(planted)} in ${file} ${key} stops the import`, () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'hha-md3-cur-'));
    const cur = path.join(dir, 'curated');
    fs.cpSync(CURATED, cur, { recursive: true });
    const target = path.join(cur, file);
    const json = JSON.parse(fs.readFileSync(target, 'utf8'));
    assert.ok(Array.isArray(json[key]), `${file} has a ${key} list`);
    json[key].push(planted);
    fs.writeFileSync(target, JSON.stringify(json, null, 2));
    const out = path.join(dir, 'out.json');
    const r = spawnSync(process.execPath, [SCRIPT, '--curated', cur, '--out', out], {
      cwd: ROOT, env: cleanEnv(), encoding: 'utf8', timeout: 180000,
    });
    assert.notEqual(r.status, 0, 'exit status is non-zero');
    assert.ok(r.stderr.includes(planted), `stderr names ${planted}; got: ${r.stderr.slice(0, 500)}`);
    assert.ok(!fs.existsSync(out), 'no output file is written');
  });
}
