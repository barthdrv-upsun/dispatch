import { describe, expect, it } from 'vitest';
import { biggestWeek, recentWeeks, weekSummary } from '../../src/domain/load/summary.js';

/** Monday 2026-01-05 to Sunday 2026-01-18, Wednesdays off. */
const loadEntries = [
  { localDate: '2026-01-05', load: 40 },
  { localDate: '2026-01-06', load: 60 },
  { localDate: '2026-01-08', load: 50 },
  { localDate: '2026-01-11', load: 80 },
  { localDate: '2026-01-12', load: 40 },
  { localDate: '2026-01-13', load: 60 },
  { localDate: '2026-01-15', load: 50 },
  { localDate: '2026-01-18', load: 90 },
];

const volumeEntries = [
  { localDate: '2026-01-05', distanceM: 8000 },
  { localDate: '2026-01-06', distanceM: 12_000 },
  { localDate: '2026-01-08', distanceM: 10_000 },
  { localDate: '2026-01-11', distanceM: 20_000 },
  { localDate: '2026-01-12', distanceM: 8000 },
  { localDate: '2026-01-13', distanceM: 12_000 },
  { localDate: '2026-01-15', distanceM: 10_000 },
  { localDate: '2026-01-18', distanceM: 22_000 },
];

describe('weekSummary', () => {
  it('adds up the rolling week ending on the day asked about', () => {
    const week = weekSummary(loadEntries, volumeEntries, '2026-01-18');
    expect(week.from).toBe('2026-01-12');
    expect(week.to).toBe('2026-01-18');
    expect(week.load).toBe(240);
    expect(week.volumeKm).toBe(52);
  });

  it('counts the days run and the days off', () => {
    const week = weekSummary(loadEntries, volumeEntries, '2026-01-18');
    expect(week.daysRun).toBe(4);
    expect(week.restDays).toBe(3);
  });

  it('reports an empty week rather than nothing', () => {
    const week = weekSummary([], [], '2026-02-01');
    expect(week.load).toBe(0);
    expect(week.daysRun).toBe(0);
    expect(week.restDays).toBe(7);
  });
});

describe('recentWeeks', () => {
  it('walks back a week at a time, most recent first', () => {
    const weeks = recentWeeks(loadEntries, volumeEntries, '2026-01-18', 2);
    expect(weeks.map((week) => week.to)).toEqual(['2026-01-18', '2026-01-11']);
    expect(weeks[1]?.load).toBe(230);
  });

  it('returns as many weeks as it was asked for', () => {
    expect(recentWeeks(loadEntries, volumeEntries, '2026-01-18', 6)).toHaveLength(6);
  });
});

describe('biggestWeek', () => {
  it('picks the week with the most distance in it', () => {
    const weeks = recentWeeks(loadEntries, volumeEntries, '2026-01-18', 3);
    expect(biggestWeek(weeks)?.to).toBe('2026-01-18');
  });

  it('has nothing to pick from an empty list', () => {
    expect(biggestWeek([])).toBeNull();
  });
});
