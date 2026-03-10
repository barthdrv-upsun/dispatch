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
