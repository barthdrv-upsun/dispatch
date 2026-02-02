import { round1, round2 } from '../../lib/numbers.js';
import { addLocalDays, localDateRange, type LocalDate } from '../../lib/time.js';
import type { LoadEntry, VolumeEntry } from './entries.js';
import { ACUTE_DAYS, rollingWindow, windowContains } from './windows.js';

export type WeekSummary = {
  from: LocalDate;
  to: LocalDate;
  load: number;
  volumeKm: number;
  daysRun: number;
  restDays: number;
};

/** The rolling week ending on `asOf`, as a coach would read it out. */
export function weekSummary(
  loadEntries: readonly LoadEntry[],
  volumeEntries: readonly VolumeEntry[],
  asOf: LocalDate,
): WeekSummary {
  const window = rollingWindow(asOf, ACUTE_DAYS);
  const loaded = new Set<LocalDate>();
  let load = 0;
  for (const entry of loadEntries) {
    if (windowContains(window, entry.localDate)) {
      load += entry.load;
      if (entry.load > 0) {
        loaded.add(entry.localDate);
      }
    }
  }
  let distanceM = 0;
  for (const entry of volumeEntries) {
    if (windowContains(window, entry.localDate)) {
      distanceM += entry.distanceM;
    }
  }
  const days = localDateRange(window.from, window.to);
  return {
    from: window.from,
    to: window.to,
    load: round2(load),
    volumeKm: round1(distanceM / 1000),
    daysRun: loaded.size,
    restDays: days.filter((day) => !loaded.has(day)).length,
  };
}

/**
 * The last `weeks` rolling weeks, most recent first. Useful for the "what has
 * this athlete actually been doing" panel.
 */
export function recentWeeks(
  loadEntries: readonly LoadEntry[],
  volumeEntries: readonly VolumeEntry[],
  asOf: LocalDate,
  weeks = 4,
): WeekSummary[] {
  const out: WeekSummary[] = [];
  for (let back = 0; back < weeks; back += 1) {
    out.push(weekSummary(loadEntries, volumeEntries, addLocalDays(asOf, -back * ACUTE_DAYS)));
  }
  return out;
}

export function biggestWeek(summaries: readonly WeekSummary[]): WeekSummary | null {
  return summaries.reduce<WeekSummary | null>(
    (best, week) => (best === null || week.volumeKm > best.volumeKm ? week : best),
    null,
  );
}
