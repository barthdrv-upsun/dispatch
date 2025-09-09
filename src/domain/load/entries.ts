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
