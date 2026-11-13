// hha-6wy, criterion 1: the RULES registry carries every §6 rule with its section,
// scope, confidence and source.
import test from 'node:test';
import assert from 'node:assert/strict';
import { RULES } from '../../../src/engine/rules.ts';

const EXPECTED: [string, string, 'room' | 'house', 'supported' | 'disputed'][] = [
  ['base', '6.1', 'room', 'supported'],
  ['count', '6.2', 'room', 'supported'],
  ['wall-hung', '6.3', 'room', 'supported'],
  ['series', '6.4', 'room', 'supported'],
  ['set', '6.5', 'room', 'supported'],
  ['concept', '6.6', 'room', 'supported'],
  ['category', '6.7', 'room', 'disputed'],
  ['color', '6.8', 'room', 'supported'],
  ['feng-shui', '6.9', 'room', 'disputed'],
  ['lucky', '6.10', 'house', 'supported'],
  ['seasonal', '6.11', 'house', 'supported'],
  ['type', '6.12', 'house', 'supported'],
  ['trash', '6.13', 'room', 'supported'],
  ['facing-wall', '6.14', 'room', 'supported'],
  ['dropped', '6.15', 'room', 'supported'],
  ['cockroach', '6.16', 'room', 'supported'],
];

test('RULES has exactly the 16 §6 ids', () => {
  assert.deepEqual(Object.keys(RULES).sort(), EXPECTED.map(([id]) => id).sort());
});

for (const [id, section, scope, confidence] of EXPECTED) {
  test(`RULES[${id}]`, () => {
    const r = (RULES as any)[id];
    assert.equal(r.section, section, 'section');
    assert.equal(r.scope, scope, 'scope');
    assert.equal(r.confidence, confidence, 'confidence');
    assert.equal(typeof r.source, 'string', 'source is a string');
    assert.ok(r.source.includes('chibisnorlax'), `source names the chibisnorlax FAQ: ${r.source}`);
  });
}
