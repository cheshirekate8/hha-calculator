import { describe, expect, it } from 'vitest';
import {
  RULE_LABELS,
  TOGGLES,
  WHOLE_HOUSE_TITLE,
  buildBreakdown,
  formatPoints,
  formatTotal,
} from '../../src/app/breakdown.ts';
import { RULES } from '../../src/engine/rules.ts';
import type { Line, Rank, Result, RuleId } from '../../src/engine/types.ts';

// The project's suite for the breakdown view model (DESIGN.md §10.3, §10.5). `Result`
// objects are built by hand: this module reads nothing but the result and `RULES`, so
// going through `score()` would only couple these tests to the rules' numbers.

const line = (rule: RuleId, points: number): Line => ({
  rule,
  points,
  detail: `${rule} detail`,
  items: ['Thing'],
});

const rank: Rank = { stage: 'house', letter: 'B', reward: null, next: null };

const result = (over: Partial<Result> = {}): Result => ({
  total: 1500,
  rooms: [{ name: 'Den', total: 1500, lines: [line('base', 1500)] }],
  house: { total: 0, lines: [] },
  rank,
  ...over,
});

describe('formatTotal and formatPoints', () => {
  it('groups thousands at every boundary', () => {
    expect([999, 1000, 10000, 999999, 1000000].map(formatTotal))
      .toEqual(['999', '1,000', '10,000', '999,999', '1,000,000']);
  });

  it('signs points but not totals', () => {
    expect(formatPoints(400)).toBe('+400');
    expect(formatTotal(400)).toBe('400');
    expect(formatPoints(0)).toBe('0');
    expect(formatTotal(0)).toBe('0');
  });

  it('uses a minus sign, not a hyphen, for negatives', () => {
    expect(formatPoints(-2500)).toBe('−2,500');
    expect(formatTotal(-150000)).toBe('−150,000');
    expect(formatPoints(-1)).not.toContain('-');
  });
});

describe('RULE_LABELS and TOGGLES', () => {
  it('labels every rule in the registry and nothing else', () => {
    expect(Object.keys(RULE_LABELS).sort()).toEqual(Object.keys(RULES).sort());
    for (const label of Object.values(RULE_LABELS)) expect(label).not.toBe('');
  });

  it('offers a toggle for exactly the disputed rules', () => {
    const disputed = (Object.keys(RULES) as RuleId[]).filter((id) => RULES[id].confidence === 'disputed');
    expect(TOGGLES.map((t) => t.rule)).toEqual(disputed);
  });

  it('names an option on each toggle and at least two values', () => {
    for (const toggle of TOGGLES) {
      expect(toggle.values.length).toBeGreaterThanOrEqual(2);
      expect(new Set(toggle.values.map((v) => v.value)).size).toBe(toggle.values.length);
    }
  });
});

describe('buildBreakdown', () => {
  it('ends with the whole-house section even when the house scored nothing', () => {
    const b = buildBreakdown(result());
    expect(b.sections.map((s) => s.title)).toEqual(['Den', WHOLE_HOUSE_TITLE]);
    expect(b.sections[1]).toEqual({ title: WHOLE_HOUSE_TITLE, total: 0, totalText: '0', lines: [] });
  });

  it('is a single whole-house section for a house with no rooms', () => {
    const b = buildBreakdown(result({ total: 0, rooms: [] }));
    expect(b.sections).toHaveLength(1);
    expect(b.sections[0]?.title).toBe(WHOLE_HOUSE_TITLE);
  });

  it('decorates a line from the registry and leaves the engine fields alone', () => {
    const b = buildBreakdown(result({
      rooms: [{ name: 'Den', total: 500, lines: [line('category', 500)] }],
    }));
    expect(b.sections[0]?.lines[0]).toEqual({
      rule: 'category',
      points: 500,
      detail: 'category detail',
      items: ['Thing'],
      label: 'Category',
      section: RULES.category.section,
      confidence: 'disputed',
      pointsText: '+500',
      toggle: TOGGLES[0],
    });
  });

  it('passes the rank through unchanged', () => {
    const r = result();
    expect(buildBreakdown(r).rank).toEqual(r.rank);
  });

  it('shows a negative total as a total, not as a change', () => {
    const b = buildBreakdown(result({
      total: -2500,
      rooms: [{ name: 'Den', total: -2500, lines: [line('cockroach', -2500)] }],
    }));
    expect(b.totalText).toBe('−2,500');
    expect(b.sections[0]?.totalText).toBe('−2,500');
    expect(b.sections[0]?.lines[0]?.pointsText).toBe('−2,500');
  });

  it('copies rather than aliases the result, so a frozen result is safe', () => {
    const r = result();
    const frozen = JSON.parse(JSON.stringify(r)) as Result;
    const b = buildBreakdown(r);
    expect(b.sections[0]?.lines[0]?.items).not.toBe(r.rooms[0]?.lines[0]?.items);
    expect(r).toEqual(frozen);
  });
});
