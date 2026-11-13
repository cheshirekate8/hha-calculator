// hha-ucz: the breakdown view model and number formatting (DESIGN.md §10.5). Results are
// built by hand, so this suite never depends on score().
import test from 'node:test';
import assert from 'node:assert/strict';
import { buildBreakdown, formatPoints, formatTotal, RULE_LABELS, TOGGLES } from '../../../src/app/breakdown.ts';
import { RULES } from '../../../src/engine/rules.ts';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

function deepFreeze<T>(o: T): T {
  if (o && typeof o === 'object' && !Object.isFrozen(o)) {
    Object.freeze(o);
    for (const v of Object.values(o as object)) deepFreeze(v);
  }
  return o;
}
const line = (rule: string, points: number) => ({ rule, points, detail: `${rule} detail`, items: [`${rule} item`] });
const result = () => ({
  total: 4823,
  rooms: [
    { name: 'Den', total: 1057 + 500 - 300, lines: [line('base', 1057), line('feng-shui', 500), line('facing-wall', -300)] },
    { name: 'Empty', total: 0, lines: [] },
    { name: 'Study', total: 1000 + 500, lines: [line('count', 1000), line('category', 500)] },
  ],
  house: { total: 2066, lines: [line('lucky', 1554), line('type', 2500), line('seasonal', -1988)] },
  rank: { stage: 'house', letter: 'B', reward: null, next: { reward: 'HHA pennant', points: 10000, needed: 5177 } },
});

const LABELS: Record<string, string> = {
  base: 'Base points', count: 'Furniture count', 'wall-hung': 'Wall-hung items', series: 'Series',
  set: 'Set completion', concept: 'Concept', category: 'Category', color: 'Color', 'feng-shui': 'Feng shui',
  lucky: 'Lucky items', seasonal: 'Seasonal items', type: 'Daily-life essentials', trash: 'Trash',
  'facing-wall': 'Facing a wall', dropped: 'Dropped items', cockroach: 'Cockroaches',
};
const CATEGORY_TOGGLE = {
  option: 'categoryBonus', rule: 'category', label: 'Category bonus',
  values: [{ value: 'per-category', label: '500 per category' }, { value: 'per-item', label: '500 per item' }],
};
const FENG_TOGGLE = {
  option: 'fengShui', rule: 'feng-shui', label: 'Feng shui',
  values: [{ value: 'on', label: 'On' }, { value: 'off', label: 'Off' }],
};

test('sections: rooms in order, then the whole house', () => {
  const r = result();
  const b = buildBreakdown(r as any);
  assert.deepEqual(b.sections.map((s: any) => s.title), ['Den', 'Empty', 'Study', 'Whole house']);
  assert.deepEqual(b.sections.map((s: any) => s.total), [1257, 0, 1500, 2066]);
  assert.deepEqual(b.sections.map((s: any) => s.totalText), ['1,257', '0', '1,500', '2,066']);
  assert.deepEqual(b.sections[1].lines, []);
  assert.equal(b.total, 4823);
  assert.equal(b.totalText, '4,823');
  assert.deepEqual(b.rank, r.rank);
});

test('lines keep their engine fields and gain label, section, confidence and text', () => {
  assert.deepEqual(RULE_LABELS, LABELS);
  const b = buildBreakdown(result() as any);
  const all = b.sections.flatMap((s: any) => s.lines);
  assert.equal(all.length, 8);
  for (const l of all) {
    assert.equal(l.label, LABELS[l.rule], `${l.rule} label`);
    assert.equal(l.section, (RULES as any)[l.rule].section, `${l.rule} section`);
    assert.equal(l.confidence, (RULES as any)[l.rule].confidence, `${l.rule} confidence`);
    assert.equal(l.detail, `${l.rule} detail`);
    assert.deepEqual(l.items, [`${l.rule} item`]);
    assert.equal(l.pointsText, formatPoints(l.points));
  }
  const den = b.sections[0].lines;
  assert.deepEqual(den.map((l: any) => [l.rule, l.points, l.pointsText]),
    [['base', 1057, '+1,057'], ['feng-shui', 500, '+500'], ['facing-wall', -300, '−300']]);
});

test('toggles appear on disputed rules only', () => {
  assert.deepEqual(TOGGLES, [CATEGORY_TOGGLE, FENG_TOGGLE]);
  const b = buildBreakdown(result() as any);
  for (const l of b.sections.flatMap((s: any) => s.lines)) {
    const expected = l.rule === 'category' ? CATEGORY_TOGGLE : l.rule === 'feng-shui' ? FENG_TOGGLE : null;
    assert.deepEqual(l.toggle, expected, `${l.rule} toggle`);
  }
});

test('formatPoints and formatTotal', () => {
  assert.equal(formatPoints(1057), '+1,057');
  assert.equal(formatPoints(1234567), '+1,234,567');
  assert.equal(formatPoints(-500), '−500');
  assert.equal(formatPoints(-12345), '−12,345');
  assert.equal(formatPoints(0), '0');
  assert.equal(formatTotal(12345), '12,345');
  assert.equal(formatTotal(-500), '−500');
  assert.equal(formatTotal(0), '0');
});

test('formatting does not depend on the machine locale', () => {
  const mod = fileURLToPath(new URL('../../../src/app/breakdown.ts', import.meta.url));
  const script = `import(${JSON.stringify(mod)}).then((m) => console.log(JSON.stringify([m.formatPoints(1057), m.formatPoints(1234567), m.formatTotal(12345), m.formatPoints(-12345)])))`;
  const env: Record<string, string | undefined> = { ...process.env, LANG: 'de_DE.UTF-8', LC_ALL: 'de_DE.UTF-8' };
  delete env.NODE_TEST_CONTEXT;
  delete env.NODE_OPTIONS;
  const r = spawnSync(process.execPath, ['--input-type=module', '-e', script], { env, encoding: 'utf8', timeout: 60000 });
  assert.equal(r.status, 0, r.stderr);
  const out = r.stdout.trim().split('\n').pop() as string;
  assert.deepEqual(JSON.parse(out), ['+1,057', '+1,234,567', '12,345', '\u221212,345']);
});

test('the result passed in is not mutated', () => {
  const r = deepFreeze(result());
  const snapshot = JSON.stringify(r);
  assert.doesNotThrow(() => buildBreakdown(r as any));
  assert.equal(JSON.stringify(r), snapshot);
});
