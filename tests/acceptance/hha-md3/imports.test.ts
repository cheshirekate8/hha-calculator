// hha-md3, criterion 6: the import script reaches only Node built-ins and files under
// scripts/, so it runs anywhere the repo is checked out, with nothing installed.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('../../../', import.meta.url));
const SCRIPTS = path.join(ROOT, 'scripts');
const SPEC = /(?:\bfrom\s*|\bimport\s*\(\s*|\bimport\s+)['"]([^'"]+)['"]/g;

test('import-catalog.ts imports only node: modules and relative .ts files in scripts/', () => {
  const start = path.join(SCRIPTS, 'import-catalog.ts');
  assert.ok(fs.existsSync(start), 'scripts/import-catalog.ts exists');
  const seen = new Set<string>();
  const queue = [start];
  while (queue.length) {
    const file = queue.pop() as string;
    if (seen.has(file)) continue;
    seen.add(file);
    const src = fs.readFileSync(file, 'utf8');
    for (const m of src.matchAll(SPEC)) {
      const spec = m[1] as string;
      if (spec.startsWith('node:')) continue;
      assert.ok(spec.startsWith('./') || spec.startsWith('../'), `${path.relative(ROOT, file)} imports ${spec}`);
      assert.ok(spec.endsWith('.ts'), `${path.relative(ROOT, file)} imports ${spec} without .ts`);
      const resolved = path.resolve(path.dirname(file), spec);
      assert.ok(resolved.startsWith(SCRIPTS + path.sep), `${spec} resolves outside scripts/`);
      assert.ok(fs.existsSync(resolved), `${spec} exists`);
      queue.push(resolved);
    }
  }
});
