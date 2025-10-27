import { describe, expect, it } from 'vitest';
import { assessRest, restDayCount, wouldBreakRest } from '../../src/domain/load/rest.js';

/** Monday 2026-05-04 to Sunday 2026-05-10. */
function week(loads: Record<string, number>) {
  return Object.entries(loads).map(([localDate, load]) => ({ localDate, load }));
}

describe('assessRest', () => {
  it('finds the day with no running on it', () => {
    const entries = week({
      '2026-05-04': 40,
      '2026-05-05': 50,
      '2026-05-06': 60,
      '2026-05-07': 0,
      '2026-05-08': 40,
      '2026-05-09': 80,
      '2026-05-10': 30,
    });
    const verdict = assessRest(entries, '2026-05-10');
    expect(verdict.restDays).toEqual(['2026-05-07']);
    expect(verdict.compliant).toBe(true);
  });

  it('counts a day with no entry at all as rest', () => {
    const entries = week({ '2026-05-04': 40, '2026-05-09': 80 });
    const verdict = assessRest(entries, '2026-05-10');
    expect(verdict.restDays).toEqual([
      '2026-05-05',
      '2026-05-06',
      '2026-05-07',
      '2026-05-08',
      '2026-05-10',
    ]);
  });

  it('refuses a week with running every single day', () => {
    const entries = week({
      '2026-05-04': 40,
      '2026-05-05': 50,
      '2026-05-06': 60,
      '2026-05-07': 20,
      '2026-05-08': 40,
      '2026-05-09': 80,
      '2026-05-10': 30,
    });
    const verdict = assessRest(entries, '2026-05-10');
    expect(verdict.restDays).toEqual([]);
    expect(verdict.compliant).toBe(false);
  });

  it('looks only at the seven days ending on the day asked about', () => {
    const entries = week({ '2026-04-20': 0, '2026-05-04': 40 });
    expect(assessRest(entries, '2026-05-10').restDays).not.toContain('2026-04-20');
  });
});

describe('wouldBreakRest', () => {
  const entries = week({
    '2026-05-04': 40,
    '2026-05-05': 50,
    '2026-05-06': 60,
    '2026-05-08': 40,
    '2026-05-09': 80,
    '2026-05-10': 30,
  });

  it('says yes when the only rest day left is the one being filled', () => {
    expect(wouldBreakRest(entries, '2026-05-07', '2026-05-10')).toBe(true);
  });

  it('says no when there is another rest day in the week', () => {
    const roomier = week({ '2026-05-04': 40, '2026-05-09': 80 });
    expect(wouldBreakRest(roomier, '2026-05-07', '2026-05-10')).toBe(false);
  });
});
