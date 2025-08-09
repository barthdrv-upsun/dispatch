import { describe, expect, it } from 'vitest';
import {
  addLocalDays,
  athleteLocalDay,
  endOfIsoWeek,
  instantFromWallClock,
  isLocalDate,
  localDateRange,
  localDaysBetween,
  localWeekday,
  startOfIsoWeek,
} from '../../src/lib/time.js';

describe('athleteLocalDay', () => {
  it('puts a late-evening run on the athlete\'s own date, not the UTC one', () => {
    const instant = new Date('2026-03-10T10:40:00Z');
    expect(athleteLocalDay(instant, 'Pacific/Auckland')).toBe('2026-03-10');
    expect(athleteLocalDay(new Date('2026-03-10T11:40:00Z'), 'Pacific/Auckland')).toBe('2026-03-11');
  });

  it('reads the same instant as two different days for two athletes', () => {
    const instant = new Date('2026-01-01T00:30:00Z');
    expect(athleteLocalDay(instant, 'Europe/Berlin')).toBe('2026-01-01');
    expect(athleteLocalDay(instant, 'America/Denver')).toBe('2025-12-31');
  });

  it('survives the night the clocks go forward in Berlin', () => {
    // 02:00 local does not exist on 2026-03-29 in Europe/Berlin.
    expect(athleteLocalDay(new Date('2026-03-28T23:30:00Z'), 'Europe/Berlin')).toBe('2026-03-29');
    expect(athleteLocalDay(new Date('2026-03-29T01:30:00Z'), 'Europe/Berlin')).toBe('2026-03-29');
    expect(athleteLocalDay(new Date('2026-03-29T22:30:00Z'), 'Europe/Berlin')).toBe('2026-03-30');
  });

  it('survives the night the clocks go back in Berlin', () => {
    expect(athleteLocalDay(new Date('2026-10-24T22:30:00Z'), 'Europe/Berlin')).toBe('2026-10-25');
    expect(athleteLocalDay(new Date('2026-10-25T23:30:00Z'), 'Europe/Berlin')).toBe('2026-10-26');
  });

  it('refuses an invalid instant', () => {
    expect(() => athleteLocalDay(new Date('nonsense'), 'Europe/Berlin')).toThrow(RangeError);
  });
});

describe('day arithmetic', () => {
  it('adds days across a DST boundary without losing one', () => {
    expect(addLocalDays('2026-03-28', 1)).toBe('2026-03-29');
    expect(addLocalDays('2026-03-29', 1)).toBe('2026-03-30');
    expect(addLocalDays('2026-10-24', 2)).toBe('2026-10-26');
  });

  it('adds days across a year end', () => {
    expect(addLocalDays('2025-12-30', 3)).toBe('2026-01-02');
    expect(addLocalDays('2026-01-02', -3)).toBe('2025-12-30');
  });

  it('counts whole days between two local dates', () => {
    expect(localDaysBetween('2026-03-01', '2026-03-08')).toBe(7);
    expect(localDaysBetween('2026-03-08', '2026-03-01')).toBe(-7);
    expect(localDaysBetween('2026-03-08', '2026-03-08')).toBe(0);
  });

  it('lists an inclusive range', () => {
    expect(localDateRange('2026-03-01', '2026-03-04')).toEqual([
      '2026-03-01',
      '2026-03-02',
      '2026-03-03',
      '2026-03-04',
    ]);
    expect(localDateRange('2026-03-04', '2026-03-01')).toEqual([]);
  });

  it('rejects anything that is not a local date', () => {
    expect(isLocalDate('2026-03-01')).toBe(true);
    expect(isLocalDate('2026-3-1')).toBe(false);
    expect(() => addLocalDays('yesterday', 1)).toThrow(RangeError);
  });
});

describe('iso weeks', () => {
  it('numbers Monday as 1 and Sunday as 7', () => {
    expect(localWeekday('2025-11-10')).toBe(1);
    expect(localWeekday('2025-11-16')).toBe(7);
  });

  it('cuts the week from Monday to Sunday', () => {
    expect(startOfIsoWeek('2025-11-13')).toBe('2025-11-10');
    expect(endOfIsoWeek('2025-11-13')).toBe('2025-11-16');
    expect(startOfIsoWeek('2025-11-10')).toBe('2025-11-10');
    expect(endOfIsoWeek('2025-11-16')).toBe('2025-11-16');
  });
});
