// Rank and rewards (DESIGN.md §7, §5.1 `Result.rank`).
//
// Both tables are read-only data and the computation is a pure function of the total and
// the house's stage — no line, no room and no catalog is consulted, so the rank can never
// disagree with the total it describes (§2.2).
import type { Rank, RankLetter, Stage } from './types.ts';

/**
 * The lowest total earning each letter, per stage (§7). The chibisnorlax values: below
 * `a` the rank is B, from `a` it is A, from `s` it is S. Nookipedia's copy of this table
 * has typos (59,000 and 63,000 for the ends of the B bands), which is why `right` and
 * `second-floor` are pinned here rather than derived.
 */
const CUTOFFS = {
  'house': { a: 10000, s: 15000 },
  'main-upgrade': { a: 17000, s: 23000 },
  'back': { a: 25000, s: 35000 },
  'left': { a: 38000, s: 47000 },
  'right': { a: 50000, s: 60000 },
  'second-floor': { a: 64000, s: 75000 },
  'basement': { a: 80000, s: 90000 },
} as const satisfies Record<Stage, { a: number; s: number }>;

/** Every reward threshold in ascending order, named with the catalog's spelling (§7). */
const REWARDS = [
  { points: 10000, reward: 'HHA pennant' },
  { points: 20000, reward: 'bronze HHA plaque' },
  { points: 30000, reward: 'silver HHA plaque' },
  { points: 50000, reward: 'gold HHA plaque' },
  { points: 70000, reward: 'bronze HHA trophy' },
  { points: 100000, reward: 'silver HHA trophy' },
  { points: 150000, reward: 'gold HHA trophy' },
] as const satisfies readonly { points: number; reward: string }[];

/**
 * The letter, the highest reward reached and the next one still to come. A negative total
 * is just a total below every threshold: letter B, no reward, and a `needed` larger than
 * the threshold itself.
 */
export function computeRank(total: number, stage: Stage): Rank {
  const cutoff = CUTOFFS[stage];
  const letter: RankLetter = total >= cutoff.s ? 'S' : total >= cutoff.a ? 'A' : 'B';

  let reward: string | null = null;
  let next: Rank['next'] = null;
  for (const threshold of REWARDS) {
    if (total >= threshold.points) {
      reward = threshold.reward;
      continue;
    }
    next = { reward: threshold.reward, points: threshold.points, needed: threshold.points - total };
    break;
  }

  return { stage, letter, reward, next };
}
