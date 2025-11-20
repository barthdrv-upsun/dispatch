import { round2 } from '../../lib/numbers.js';
import { addLocalDays, localDaysBetween, type LocalDate } from '../../lib/time.js';
import type { LoadEntry } from './entries.js';
import { ACUTE_DAYS, CHRONIC_DAYS } from './windows.js';

/**
 * Exponentially weighted chronic load, as an alternative to the flat 28-day
 * mean. The literature likes it because a session three days ago counts for
 * more than one three weeks ago, which is how legs actually work.
 *
 * Not wired into anything yet - the ratio still uses the flat windows.
 */
export function decayFactor(days: number): number {
  return 2 / (days + 1);
}

export function ewmaLoad(
  entries: readonly LoadEntry[],
  asOf: LocalDate,
  days = CHRONIC_DAYS,
): number {
  const byDay = new Map<LocalDate, number>();
  for (const entry of entries) {
    byDay.set(entry.localDate, (byDay.get(entry.localDate) ?? 0) + entry.load);
  }
  const lambda = decayFactor(days);
  let value = 0;
  for (let offset = days - 1; offset >= 0; offset -= 1) {
    const day = addLocalDays(asOf, -offset);
    const today = byDay.get(day) ?? 0;
    value = today * lambda + value * (1 - lambda);
  }
  return round2(value);
}

export function ewmaRatio(entries: readonly LoadEntry[], asOf: LocalDate): number {
  const acute = ewmaLoad(entries, asOf, ACUTE_DAYS);
  const chronic = ewmaLoad(entries, asOf, CHRONIC_DAYS);
  if (chronic <= 0) {
    return 0;
  }
  return round2(acute / chronic);
}

export function daysCovered(entries: readonly LoadEntry[], asOf: LocalDate): number {
  const first = entries[0];
  if (!first) {
    return 0;
  }
  return localDaysBetween(first.localDate, asOf) + 1;
}
