import { athleteLocalDay, type LocalDate } from '../../lib/time.js';
import { round2, toNumber } from '../../lib/numbers.js';

/** The kinds that put a runner's legs under load. */
export type RunningKind = 'easy' | 'tempo' | 'interval' | 'long';

export const RUNNING_KINDS: readonly RunningKind[] = ['easy', 'tempo', 'interval', 'long'];

/** Sessions a coach would call hard, and which the ratio can downgrade. */
export const HARD_RUNNING_KINDS: readonly RunningKind[] = ['tempo', 'interval', 'long'];

export function isRunningKind(kind: string | null | undefined): kind is RunningKind {
  return kind !== null && kind !== undefined && (RUNNING_KINDS as readonly string[]).includes(kind);
}

export function isHardRunningKind(kind: string | null | undefined): boolean {
  return kind !== null && kind !== undefined && (HARD_RUNNING_KINDS as readonly string[]).includes(kind);
}

/**
 * The slice of a session the load rules read. `templateKind` is null for
 * anything logged without a template behind it, which is every session that
 * arrived from a watch.
 */
export type SessionForLoad = {
  completedAt: Date | null;
  load: string | number | null;
  distanceM: number | null;
  templateKind: string | null;
};

/** One day's worth of something, in the athlete's own calendar. */
export type LoadEntry = {
  localDate: LocalDate;
  load: number;
};

export type VolumeEntry = {
  localDate: LocalDate;
  distanceM: number;
};

function countsAsRunning(session: SessionForLoad): boolean {
  if (session.templateKind === null) {
    return true;
  }
  return isRunningKind(session.templateKind);
}

function completed(session: SessionForLoad): session is SessionForLoad & { completedAt: Date } {
  return session.completedAt !== null && !Number.isNaN(session.completedAt.getTime());
}
