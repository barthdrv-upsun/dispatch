import { round2 } from '../../lib/numbers.js';
import { addLocalDays, type LocalDate } from '../../lib/time.js';
import type { VolumeEntry } from './entries.js';
import { ACUTE_DAYS, rollingWindow, windowContains, type DayWindow } from './windows.js';

/** R2. Ten per cent a week and not a metre more. */
export const RAMP_CAP = 1.1;

export type RampVerdict = {
  currentM: number;
  previousM: number;
  ratio: number;
  withinCap: boolean;
};

export function rollingVolumeM(entries: readonly VolumeEntry[], window: DayWindow): number {
  let total = 0;
  for (const entry of entries) {
    if (windowContains(window, entry.localDate)) {
      total += entry.distanceM;
    }
  }
  return total;
}

/**
 * Compares the rolling seven days ending on `asOf` against the seven before
 * it. An athlete coming back from nothing has no previous figure to exceed,
 * so the cap does not bite until there is a week on the board.
 */
export function assessRamp(entries: readonly VolumeEntry[], asOf: LocalDate): RampVerdict {
  const currentM = rollingVolumeM(entries, rollingWindow(asOf, ACUTE_DAYS));
  const previousM = rollingVolumeM(entries, rollingWindow(addLocalDays(asOf, -ACUTE_DAYS), ACUTE_DAYS));
  if (previousM <= 0) {
    return { currentM, previousM, ratio: 0, withinCap: true };
  }
  const ratio = round2(currentM / previousM);
  return { currentM, previousM, ratio, withinCap: ratio <= RAMP_CAP };
}

/** The most an athlete may run over the next rolling week. */
export function rampCeilingM(previousM: number): number {
  return round2(previousM * RAMP_CAP);
}

/** How much further the athlete may go this week before R2 bites. */
export function rampHeadroomM(entries: readonly VolumeEntry[], asOf: LocalDate): number {
  const verdict = assessRamp(entries, asOf);
  if (verdict.previousM <= 0) {
    return Number.POSITIVE_INFINITY;
  }
  return round2(Math.max(0, rampCeilingM(verdict.previousM) - verdict.currentM));
}
