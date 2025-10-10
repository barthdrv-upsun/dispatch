import { localDateRange, type LocalDate } from '../../lib/time.js';
import type { LoadEntry } from './entries.js';
import { ACUTE_DAYS, rollingWindow } from './windows.js';

export type RestVerdict = {
  restDays: LocalDate[];
  compliant: boolean;
};

/**
 * R3. Every rolling seven days has to contain a day the athlete did no
 * running at all. A day with no entry counts - the absence of a session is
 * the rest.
 */
export function assessRest(entries: readonly LoadEntry[], asOf: LocalDate): RestVerdict {
  const window = rollingWindow(asOf, ACUTE_DAYS);
  const loaded = new Set<LocalDate>();
  for (const entry of entries) {
    if (entry.load > 0) {
      loaded.add(entry.localDate);
    }
  }
  const restDays = localDateRange(window.from, window.to).filter((day) => !loaded.has(day));
  return { restDays, compliant: restDays.length > 0 };
}
