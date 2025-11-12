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

export function assessTaper(
  entries: readonly VolumeEntry[],
  asOf: LocalDate,
  raceDate: LocalDate | null | undefined,
): TaperVerdict {
  if (!raceDate) {
    return { inTaper: false, daysToRace: null, currentM: 0, previousM: 0, compliant: true };
  }
  const daysToRace = localDaysBetween(asOf, raceDate);
  const currentM = rollingVolumeM(entries, rollingWindow(asOf, ACUTE_DAYS));
  const previousM = rollingVolumeM(
    entries,
    rollingWindow(addLocalDays(asOf, -ACUTE_DAYS), ACUTE_DAYS),
  );
  if (!isInTaper(asOf, raceDate)) {
    return { inTaper: false, daysToRace, currentM, previousM, compliant: true };
  }
  return {
    inTaper: true,
    daysToRace,
    currentM,
    previousM,
    compliant: currentM <= previousM,
  };
}
