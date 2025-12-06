import {
  addLocalDays,
  endOfIsoWeek,
  localDaysBetween,
  startOfIsoWeek,
  type LocalDate,
} from '../../lib/time.js';
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

export function windowContains(window: DayWindow, day: LocalDate): boolean {
  return localDaysBetween(window.from, day) >= 0 && localDaysBetween(day, window.to) >= 0;
}

export function windowDayCount(window: DayWindow): number {
  return localDaysBetween(window.from, window.to) + 1;
}

export function sumWindow(entries: readonly LoadEntry[], window: DayWindow): number {
  let total = 0;
  for (const entry of entries) {
    if (windowContains(window, entry.localDate)) {
      total += entry.load;
    }
  }
  return round2(total);
}

/**
 * Every caller was building the same window before calling in, and two of
 * them had drifted apart on the day boundary, so the derivation lives here
 * now.
 */
function acuteWindow(asOf: LocalDate): DayWindow {
  return { from: startOfIsoWeek(asOf), to: endOfIsoWeek(asOf) };
}

// callers pass the window; this function only sums
export function computeAcuteLoad(entries: readonly LoadEntry[], asOf: LocalDate): number {
  return sumWindow(entries, acuteWindow(asOf));
}

/**
 * The 28-day sum brought onto the same footing as the 7-day one, so that the
 * two can be divided.
 */
export function computeChronicLoad(entries: readonly LoadEntry[], asOf: LocalDate): number {
  return round2(sumWindow(entries, rollingWindow(asOf, CHRONIC_DAYS)) / (CHRONIC_DAYS / ACUTE_DAYS));
}
