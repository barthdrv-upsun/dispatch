import { describe, expect, it } from 'vitest';
import {
  assessTaper,
  isInTaper,
  TAPER_WINDOW_DAYS,
  taperTargetM,
} from '../../src/domain/load/taper.js';

const RACE = '2026-05-24';

/** Week ending 2026-05-17 at 60km, week ending 2026-05-24 at whatever is passed. */
function twoWeeks(lastWeekM: number, thisWeekM: number) {
  return [
    { localDate: '2026-05-13', distanceM: lastWeekM },
    { localDate: '2026-05-20', distanceM: thisWeekM },
  ];
}

describe('isInTaper', () => {
  it('is true inside the fortnight before the race', () => {
    expect(isInTaper('2026-05-11', RACE)).toBe(true);
    expect(isInTaper(RACE, RACE)).toBe(true);
  });

  it('is false before the fortnight opens', () => {
    expect(isInTaper('2026-05-09', RACE)).toBe(false);
  });

  it('is false after the race and with no race at all', () => {
    expect(isInTaper('2026-05-25', RACE)).toBe(false);
    expect(isInTaper('2026-05-11', null)).toBe(false);
  });

  it('opens exactly fourteen days out', () => {
    expect(TAPER_WINDOW_DAYS).toBe(14);
    expect(isInTaper('2026-05-10', RACE)).toBe(true);
  });
});

describe('assessTaper', () => {
  it('accepts a week that goes down', () => {
    const verdict = assessTaper(twoWeeks(60_000, 45_000), '2026-05-22', RACE);
    expect(verdict.inTaper).toBe(true);
    expect(verdict.daysToRace).toBe(2);
    expect(verdict.compliant).toBe(true);
  });

  it('accepts a week that holds level', () => {
    expect(assessTaper(twoWeeks(60_000, 60_000), '2026-05-22', RACE).compliant).toBe(true);
  });

  it('refuses a week that goes up inside the taper', () => {
    const verdict = assessTaper(twoWeeks(60_000, 70_000), '2026-05-22', RACE);
    expect(verdict.compliant).toBe(false);
    expect(verdict.currentM).toBe(70_000);
    expect(verdict.previousM).toBe(60_000);
  });

  it('says nothing about a week outside the taper', () => {
    const verdict = assessTaper(twoWeeks(60_000, 70_000), '2026-05-08', RACE);
    expect(verdict.inTaper).toBe(false);
    expect(verdict.compliant).toBe(true);
  });

  it('has nothing to say without a goal race', () => {
    const verdict = assessTaper(twoWeeks(60_000, 70_000), '2026-05-22', null);
    expect(verdict.inTaper).toBe(false);
    expect(verdict.daysToRace).toBeNull();
    expect(verdict.compliant).toBe(true);
  });
});

describe('taperTargetM', () => {
  it('caps the week at last week inside the taper', () => {
    expect(taperTargetM(twoWeeks(60_000, 45_000), '2026-05-22', RACE)).toBe(60_000);
  });

  it('has no ceiling outside the taper', () => {
    expect(taperTargetM(twoWeeks(60_000, 45_000), '2026-05-08', RACE)).toBe(
      Number.POSITIVE_INFINITY,
    );
  });
});
