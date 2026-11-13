// hha-md3, criterion 4: set membership derived across sheets, complete in both
// directions, and sorted.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('../../../', import.meta.url));
const catalog = JSON.parse(fs.readFileSync(path.join(ROOT, 'src', 'data', 'catalog.json'), 'utf8'));

const increasing = (xs: string[]) => xs.every((x, i) => i === 0 || xs[i - 1] < x);

test('29 sets, keys sorted', () => {
  const keys = Object.keys(catalog.sets);
  assert.equal(keys.length, 29);
  assert.ok(increasing(keys), 'set keys strictly increase');
});

test('sets that span sheets have their full membership', () => {
  assert.deepEqual(catalog.sets.bear, ['Baby bear', 'Mama bear', 'Papa bear', 'giant teddy bear']);
  assert.deepEqual(catalog.sets['imperial dining'], [
    'imperial dining chair', 'imperial dining lantern', 'imperial dining table',
  ]);
});

test('membership agrees with each item\'s set field, in both directions', () => {
  const byName = new Map(catalog.items.map((i: any) => [i.name, i]));
  for (const [set, members] of Object.entries(catalog.sets) as [string, string[]][]) {
    assert.ok(increasing(members), `${set}: members strictly increase`);
    for (const name of members) {
      const item: any = byName.get(name);
      assert.ok(item, `${set}: member ${name} exists`);
      assert.equal(item.set, set, `${name}: set field`);
    }
  }
  for (const item of catalog.items) {
    if (item.set === null) continue;
    assert.ok((catalog.sets[item.set] || []).includes(item.name), `${item.name} missing from sets[${item.set}]`);
  }
});
