import { addLocalDays, localDaysBetween, type LocalDate } from '../../lib/time.js';
import { rollingVolumeM } from './ramp.js';
import type { VolumeEntry } from './entries.js';
import { ACUTE_DAYS, rollingWindow } from './windows.js';

/** R8. The last fortnight before a goal race only ever goes down. */
export const TAPER_WINDOW_DAYS = 14;

export type TaperVerdict = {
  inTaper: boolean;
  daysToRace: number | null;
  currentM: number;
  previousM: number;
  compliant: boolean;
};

export function isInTaper(asOf: LocalDate, raceDate: LocalDate | null | undefined): boolean {
  if (!raceDate) {
    return false;
  }
  const daysToRace = localDaysBetween(asOf, raceDate);
  return daysToRace >= 0 && daysToRace <= TAPER_WINDOW_DAYS;
}
