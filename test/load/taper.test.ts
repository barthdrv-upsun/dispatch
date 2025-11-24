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
