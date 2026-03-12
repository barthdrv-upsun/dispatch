import { ConflictError, ValidationError } from '../../lib/errors.js';
import { athleteLocalDay, localDaysBetween, type LocalDate } from '../../lib/time.js';
import type { AthleteState, Athlete } from './types.js';

const TRANSITIONS: Record<AthleteState, readonly AthleteState[]> = {
  active: ['injured'],
  injured: ['returning', 'active'],
  returning: ['active', 'injured'],
};

export function canTransition(from: AthleteState, to: AthleteState): boolean {
  if (from === to) {
    return false;
  }
  return TRANSITIONS[from].includes(to);
}

/**
 * State only moves along the edges above. `injured -> active` is allowed
 * because an injury that turns out to be nothing gets withdrawn rather than
 * cleared.
 */
export function transitionState(athlete: Athlete, to: AthleteState): Athlete {
  if (!canTransition(athlete.state, to)) {
    throw new ConflictError(`an athlete cannot go from ${athlete.state} to ${to}`);
  }
  return { ...athlete, state: to };
}

export function ageOn(athlete: Athlete, on: LocalDate): number {
  const [bornYear, bornMonth, bornDay] = athlete.dateOfBirth.split('-').map(Number);
  const [year, month, day] = on.split('-').map(Number);
  if (
    bornYear === undefined ||
    bornMonth === undefined ||
    bornDay === undefined ||
    year === undefined ||
    month === undefined ||
    day === undefined
  ) {
    throw new ValidationError('date of birth and the reference day must both be YYYY-MM-DD');
  }
  const beforeBirthday = month < bornMonth || (month === bornMonth && day < bornDay);
  return year - bornYear - (beforeBirthday ? 1 : 0);
}

/**
 * Moving an athlete's timezone moves every day boundary they have. Sessions
 * are re-bucketed from their timestamps, so nothing is rewritten - but the
 * windows they fall in do change, and a coach should know that before they
 * hit save.
 */
export function moveTimezone(athlete: Athlete, timeZone: string): Athlete {
  if (!timeZone.includes('/')) {
    throw new ValidationError('timezone must be an IANA name such as Europe/Berlin', { timeZone });
  }
  try {
    athleteLocalDay(new Date(0), timeZone);
  } catch {
    throw new ValidationError(`${timeZone} is not a timezone this platform knows`, { timeZone });
  }
  return { ...athlete, timezone: timeZone };
}
