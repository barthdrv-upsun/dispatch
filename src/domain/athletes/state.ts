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
