import { describe, expect, it } from 'vitest';
import { computeRank } from '../../src/engine/rank.ts';
import { score } from '../../src/engine/score.ts';
import type { Catalog, House, Stage } from '../../src/engine/types.ts';

// The project's suite for rank and rewards (DESIGN.md §7). `computeRank` is tested
// directly, because it is a pure function of a total and a stage; `score()` is checked
// once to prove it passes its own total through.

const inertCatalog = (basePoints: number): Catalog => ({
  source: { repo: 'test', commit: '0'.repeat(40) },
  items: [
    {
      name: 'R',
      sheet: 'Housewares',
      basePoints,
      series: null,
      set: null,
      tag: null,
      interact: false,
      variants: [{ variation: null, pattern: null, colors: [], concepts: [], category: null }],
    },
  ],
  sets: {},
});

const inertHouse = (stage: Stage): House => ({
  stage,
  season: 'spring',
  rooms: [{ name: 'Den', items: [{ name: 'R', surface: 'floor' }] }],
});

// Stage, then the lowest A total and the lowest S total (§7).
const CUTOFFS: [Stage, number, number][] = [
  ['house', 10000, 15000],
  ['main-upgrade', 17000, 23000],
  ['back', 25000, 35000],
  ['left', 38000, 47000],
  ['right', 50000, 60000],
  ['second-floor', 64000, 75000],
  ['basement', 80000, 90000],
];

describe('the letter', () => {
  it.each(CUTOFFS)('%s: B below %i, A below %i, then S', (stage, a, s) => {
    expect(computeRank(a - 1, stage).letter).toBe('B');
    expect(computeRank(a, stage).letter).toBe('A');
    expect(computeRank(s - 1, stage).letter).toBe('A');
    expect(computeRank(s, stage).letter).toBe('S');
  });

  it('keeps the stage the cutoffs came from', () => {
    expect(computeRank(0, 'basement').stage).toBe('basement');
  });

  it('gives a negative total the lowest letter, not an error', () => {
    expect(computeRank(-500, 'house').letter).toBe('B');
  });

  it('reads 63,999 as B, the value Nookipedia mistypes as 63,000', () => {
    expect(computeRank(63999, 'second-floor').letter).toBe('B');
    expect(computeRank(59999, 'right').letter).toBe('A');
  });
});

describe('the rewards', () => {
  it('names no reward and the pennant as next below 10,000', () => {
    expect(computeRank(9999, 'house').reward).toBeNull();
    expect(computeRank(9999, 'house').next).toEqual({
      reward: 'HHA pennant',
      points: 10000,
      needed: 1,
    });
  });

  it('counts a negative total as further from the first reward', () => {
    expect(computeRank(-500, 'house').next).toEqual({
      reward: 'HHA pennant',
      points: 10000,
      needed: 10500,
    });
  });

  it('names the highest threshold reached and the one after it', () => {
    expect(computeRank(30000, 'house').reward).toBe('silver HHA plaque');
    // 40,000 is past the silver plaque but short of the gold one: the reward does not
    // advance between thresholds, only `needed` shrinks.
    expect(computeRank(40000, 'house').reward).toBe('silver HHA plaque');
    expect(computeRank(40000, 'house').next).toEqual({
      reward: 'gold HHA plaque',
      points: 50000,
      needed: 10000,
    });
  });

  it('runs out of rewards at the gold trophy', () => {
    expect(computeRank(150000, 'basement').reward).toBe('gold HHA trophy');
    expect(computeRank(150000, 'basement').next).toBeNull();
    expect(computeRank(999999, 'basement').next).toBeNull();
  });
});

describe('score()', () => {
  it('ranks the total it reports, and adds nothing else to the result', () => {
    const result = score(inertHouse('left'), inertCatalog(42000));
    expect(result.total).toBe(42000);
    expect(result.rank).toEqual({
      stage: 'left',
      letter: 'A',
      reward: 'silver HHA plaque',
      next: { reward: 'gold HHA plaque', points: 50000, needed: 8000 },
    });
    expect(Object.keys(result).sort()).toEqual(['house', 'rank', 'rooms', 'total']);
  });

  it('takes the stage from the house it scored', () => {
    expect(score(inertHouse('house'), inertCatalog(42000)).rank).toEqual({
      stage: 'house',
      letter: 'S',
      reward: 'silver HHA plaque',
      next: { reward: 'gold HHA plaque', points: 50000, needed: 8000 },
    });
  });
});
