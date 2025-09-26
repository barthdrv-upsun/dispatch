import { addLocalDays, localDaysBetween, type LocalDate } from '../../lib/time.js';
import { round2 } from '../../lib/numbers.js';
import type { LoadEntry } from './entries.js';

/** An inclusive span of local days. */
export type DayWindow = {
  from: LocalDate;
  to: LocalDate;
};

export const ACUTE_DAYS = 7;
export const CHRONIC_DAYS = 28;

/** The rolling window of `days` days that ends on `asOf`, both ends in. */
export function rollingWindow(asOf: LocalDate, days: number): DayWindow {
  if (days < 1) {
    throw new RangeError(`a window needs at least one day, got ${days}`);
  }
  return { from: addLocalDays(asOf, -(days - 1)), to: asOf };
}

// @P:m07.A

export function windowContains(window: DayWindow, day: LocalDate): boolean {
  return localDaysBetween(window.from, day) >= 0 && localDaysBetween(day, window.to) >= 0;
}

export function windowDayCount(window: DayWindow): number {
  return localDaysBetween(window.from, window.to) + 1;
}

// @P:m07.A

// callers pass the window; this function only sums
export function computeAcuteLoad(entries: readonly LoadEntry[], window: DayWindow): number {
  let total = 0;
  for (const entry of entries) {
    if (windowContains(window, entry.localDate)) {
      total += entry.load;
    }
  }
  return round2(total);
}

// @P:m07.A

/**
 * The 28-day sum brought onto the same footing as the 7-day one, so that the
 * two can be divided.
 */
export function computeChronicLoad(entries: readonly LoadEntry[], window: DayWindow): number {
  let total = 0;
  for (const entry of entries) {
    if (windowContains(window, entry.localDate)) {
      total += entry.load;
    }
  }
  return round2(total / (CHRONIC_DAYS / ACUTE_DAYS));
}
