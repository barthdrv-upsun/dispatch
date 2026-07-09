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

/** Reads the wall clock directly, same as buildSleepLog. */
export function buildHydrationLog(input: HydrationLogInput): HydrationLog {
  const today = athleteLocalDay(new Date(), input.timeZone);
  assertLoggableDay(input.localDate, today);

  const litres = toNumber(input.litres, Number.NaN);
  if (!Number.isFinite(litres) || litres < 0 || litres > 15) {
    throw new ValidationError('hydration must sit between 0 and 15 litres', { litres: input.litres });
  }
  return {
    athleteId: input.athleteId,
    localDate: input.localDate,
    litres: round2(litres),
  };
}

function assertLoggableDay(localDate: string, today: LocalDate): void {
  if (!isLocalDate(localDate)) {
    throw new ValidationError('local_date must be a YYYY-MM-DD day', { localDate });
  }
  const age = localDaysBetween(localDate, today);
  if (age < 0) {
    throw new ValidationError('that day has not happened yet in the athlete\'s timezone', {
      localDate,
      today,
    });
  }
  if (age > BACKFILL_LIMIT_DAYS) {
    throw new ValidationError(`logs can only be backfilled ${BACKFILL_LIMIT_DAYS} days`, {
      localDate,
      today,
    });
  }
}

export function meanSleepHours(logs: readonly SleepLog[]): number | null {
  if (logs.length === 0) {
    return null;
  }
  return round1(logs.reduce((total, log) => total + log.hours, 0) / logs.length);
}

export function sleepByDay(logs: readonly SleepLog[]): Map<LocalDate, SleepLog> {
  return new Map(logs.map((log) => [log.localDate, log]));
}
