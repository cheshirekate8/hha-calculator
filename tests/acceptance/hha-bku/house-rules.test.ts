// hha-bku: lucky (§6.10), seasonal (§6.11) and type (§6.12), all house rules. Only these
// three rules' lines in result.house.lines are inspected. The curated lists are read from
// their frozen JSON files directly, never through mutable engine code.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { score } from '../../../src/engine/score.ts';

const ROOT = fileURLToPath(new URL('../../../', import.meta.url));
const readJson = (p: string) => JSON.parse(fs.readFileSync(path.join(ROOT, p), 'utf8'));
const LUCKY: string[] = readJson('src/data/curated/lucky.json').items;
const SEASONAL = readJson('src/data/curated/seasonal.json');
const SEASONS = ['spring', 'summer', 'autumn', 'winter'];

const v = (o: any = {}) => ({ variation: null, pattern: null, colors: [], concepts: [], category: null, ...o });
const item = (name: string, o: any = {}) =>
  ({ name, sheet: 'Housewares', basePoints: 0, series: null, set: null, tag: null, interact: false, variants: [v()], ...o });
const catalog = (items: any[]) => {
  const byName = new Map(items.map((i) => [i.name, i]));
  return {
    source: { repo: 'test', commit: '0'.repeat(40) },
    items: [...byName.values()].sort((a: any, b: any) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0)),
    sets: {},
  };
};
const place = (name: string, o: any = {}) => ({ name, surface: 'floor', ...o });
const house = (rooms: any[][], season = 'spring') =>
  ({ stage: 'right', season, rooms: rooms.map((items, i) => ({ name: `Room ${'ABCDEFGH'[i]}`, items })) });
function one(lines: any[], rule: string, points: number, items?: string[]) {
  const ls = lines.filter((l) => l.rule === rule);
  assert.equal(ls.length, 1, `exactly one ${rule} line`);
  assert.equal(ls[0].points, points, `${rule} points`);
  assert.ok(typeof ls[0].detail === 'string' && ls[0].detail.length > 0, 'non-empty detail');
  if (items) assert.deepEqual([...ls[0].items].sort(), [...items].sort(), `${rule} items`);
}
const none = (lines: any[], rule: string) =>
  assert.equal(lines.filter((l) => l.rule === rule).length, 0, `no ${rule} line`);

const allSeasonal: string[] = SEASONS.flatMap((s) => SEASONAL[s]);
const cat = catalog([...LUCKY, ...allSeasonal, 'plain box'].map((n) => item(n)));

test('lucky: every name in the frozen list scores 777 once', () => {
  assert.equal(LUCKY.length, 72, 'frozen lucky list');
  const r = score(house([LUCKY.map((n) => place(n))]) as any, cat as any);
  one(r.house.lines, 'lucky', 777 * 72, LUCKY);
});

test('lucky: duplicates across rooms score once; no lucky item, no line', () => {
  const r = score(house([[place('katana', { quantity: 2 })], [place('katana')], [place('lucky gold cat')]]) as any, cat as any);
  one(r.house.lines, 'lucky', 1554, ['katana', 'lucky gold cat']);
  none(score(house([[place('plain box')]]) as any, cat as any).house.lines, 'lucky');
});

test('seasonal: each season scores its own frozen list', () => {
  for (const season of SEASONS) {
    const r = score(house([allSeasonal.map((n) => place(n))], season) as any, cat as any);
    one(r.house.lines, 'seasonal', 777 * SEASONAL[season].length, SEASONAL[season]);
  }
});

test('seasonal: two rooms score once; out of season scores nothing', () => {
  one(score(house([[place('bamboo shelf')], [place('bamboo shelf')]], 'spring') as any, cat as any).house.lines, 'seasonal', 777, ['bamboo shelf']);
  none(score(house([[place('frozen tree')]], 'summer') as any, cat as any).house.lines, 'seasonal');
});

const typeCat = catalog([
  item('chair', { tag: 'Chair' }), item('table', { tag: 'Table' }), item('bed', { tag: 'Bed' }),
  item('dresser', { variants: [v({ category: 'Dresser' })] }),
  item('chair two', { tag: 'Chair' }), item('table two', { tag: 'Table' }), item('bed two', { tag: 'Bed' }),
  item('dresser two', { variants: [v({ category: 'Dresser' })] }),
  item('seat', { interact: 'Chair' }), item('futon', { interact: 'Bed' }), item('closet', { interact: 'Wardrobe' }),
  item('table clock', { tag: 'TableClock' }), item('vanity tag only', { tag: 'Dresser' }),
]);
const typeScore = (rooms: string[][]) =>
  score(house(rooms.map((r) => r.map((n) => place(n)))) as any, typeCat as any).house.lines;

test('type: all four slots anywhere in the house pay 2,500 once', () => {
  one(typeScore([['chair'], ['table'], ['bed'], ['dresser']]), 'type', 2500, ['chair', 'table', 'bed', 'dresser']);
  one(typeScore([['chair', 'chair two'], ['table', 'table two'], ['bed', 'bed two'], ['dresser', 'dresser two']]), 'type', 2500,
    ['chair', 'chair two', 'table', 'table two', 'bed', 'bed two', 'dresser', 'dresser two']);
});

test('type: dropping any one slot gives no line', () => {
  const full = ['chair', 'table', 'bed', 'dresser'];
  for (const drop of full) none(typeScore([full.filter((n) => n !== drop)]), 'type');
});

test('type: interact-only chair, bed and wardrobe fill their slots', () => {
  one(typeScore([['seat', 'table', 'futon', 'closet']]), 'type', 2500, ['seat', 'table', 'futon', 'closet']);
});

test('type: a TableClock is not a table, and a Dresser tag alone is not a dresser', () => {
  none(typeScore([['chair', 'table clock', 'bed', 'dresser']]), 'type');
  none(typeScore([['chair', 'table', 'bed', 'vanity tag only']]), 'type');
});
