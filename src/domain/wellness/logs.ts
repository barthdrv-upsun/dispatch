import { round1, round2, toNumber } from '../../lib/numbers.js';
import { ValidationError } from '../../lib/errors.js';
import { athleteLocalDay, isLocalDate, localDaysBetween, type LocalDate } from '../../lib/time.js';

export type SleepLog = {
  athleteId: string;
  localDate: LocalDate;
  hours: number;
  quality: number | null;
};

export type HydrationLog = {
  athleteId: string;
  localDate: LocalDate;
  litres: number;
};

/** Nobody is logging a night's sleep from three months ago. */
const BACKFILL_LIMIT_DAYS = 30;

export type SleepLogInput = {
  athleteId: string;
  timeZone: string;
  localDate: string;
  hours: number | string;
  quality?: number | null;
};

/**
 * Wellness logs are stamped with the athlete's own calendar day, and the day
 * they may not go past is today in that same calendar - which is not today in
 * the squad's calendar for the athletes on the other side of the world.
 *
 * Reads the wall clock directly.
 */
export function buildSleepLog(input: SleepLogInput): SleepLog {
  const today = athleteLocalDay(new Date(), input.timeZone);
  assertLoggableDay(input.localDate, today);

  const hours = toNumber(input.hours, Number.NaN);
  if (!Number.isFinite(hours) || hours < 0 || hours > 24) {
    throw new ValidationError('sleep hours must sit between 0 and 24', { hours: input.hours });
  }
  const quality = input.quality === undefined || input.quality === null ? null : Math.round(input.quality);
  if (quality !== null && (quality < 1 || quality > 5)) {
    throw new ValidationError('sleep quality runs from 1 to 5', { quality: input.quality });
  }
  return {
    athleteId: input.athleteId,
    localDate: input.localDate,
    hours: round2(hours),
    quality,
  };
}

export type HydrationLogInput = {
  athleteId: string;
  timeZone: string;
  localDate: string;
  litres: number | string;
};
