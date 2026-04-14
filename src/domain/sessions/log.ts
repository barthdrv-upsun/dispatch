import { ConflictError, ValidationError } from '../../lib/errors.js';
import { athleteLocalDay, type LocalDate } from '../../lib/time.js';
import type { Athlete } from '../athletes/types.js';
import type { ReturnToRunDecision } from '../clearances/gate.js';
import { isRunningKind } from '../load/entries.js';
import { sessionLoad } from '../load/session_load.js';
import type { WorkoutTemplate } from '../plans/types.js';

const MAX_DISTANCE_M = 300_000;
const MAX_DURATION_S = 86_400;
/** Watches sync with a few seconds of drift; a day of it is somebody's typo. */
const FUTURE_TOLERANCE_MS = 5 * 60 * 1000;

export type NewSession = {
  athleteId: string;
  planId: string | null;
  templateId: string | null;
  scheduledFor: Date | null;
  completedAt: Date;
  distanceM: number | null;
  durationS: number | null;
  avgHr: number | null;
  perceivedEffort: number | null;
  load: number | null;
  source: 'manual' | 'strava';
  localDate: LocalDate;
};

export type LogSessionInput = {
  athlete: Athlete;
  template: WorkoutTemplate | null;
  planId: string | null;
  scheduledFor?: Date | null;
  completedAt: Date;
  distanceM?: number | null;
  durationS?: number | null;
  avgHr?: number | null;
  perceivedEffort?: number | null;
  source?: 'manual' | 'strava';
  returnToRun: ReturnToRunDecision;
};

/** A session counts as running unless a template says otherwise. */
export function countsAsRunning(template: WorkoutTemplate | null): boolean {
  return template === null || isRunningKind(template.kind);
}

/**
 * Turns what somebody typed into a session row.
 *
 * R4 is enforced here as well as at prescription time: crediting an injured
 * athlete with a run they have not been cleared for is the same problem
 * arriving from the other end.
 *
 * Reads the wall clock directly to reject sessions from the future.
 */
export function buildSession(input: LogSessionInput): NewSession {
  const now = new Date();
  if (Number.isNaN(input.completedAt.getTime())) {
    throw new ValidationError('completed_at is not a time');
  }
  if (input.completedAt.getTime() > now.getTime() + FUTURE_TOLERANCE_MS) {
    throw new ValidationError('a session cannot be logged in the future', {
      completedAt: input.completedAt.toISOString(),
    });
  }

  const distanceM = normalise(input.distanceM, 'distance_m', MAX_DISTANCE_M);
  const durationS = normalise(input.durationS, 'duration_s', MAX_DURATION_S);
  const avgHr = normalise(input.avgHr, 'avg_hr', 240);
  const perceivedEffort = input.perceivedEffort ?? null;
  if (perceivedEffort !== null && (perceivedEffort < 1 || perceivedEffort > 10)) {
    throw new ValidationError('perceived effort runs from 1 to 10', { perceivedEffort });
  }

  if (countsAsRunning(input.template) && !input.returnToRun.allowed) {
    throw new ConflictError(
      `athlete ${input.athlete.id} cannot be credited a running session: ${input.returnToRun.reason}`,
    );
  }

  return {
    athleteId: input.athlete.id,
    planId: input.planId,
    templateId: input.template === null ? null : input.template.id,
    scheduledFor: input.scheduledFor ?? null,
    completedAt: input.completedAt,
    distanceM,
    durationS,
    avgHr,
    perceivedEffort,
    load: sessionLoad({
      durationS,
      distanceM,
      avgHr,
      perceivedEffort,
      restingHr: input.athlete.restingHr,
      maxHr: input.athlete.maxHr,
    }),
    source: input.source ?? 'manual',
    localDate: athleteLocalDay(input.completedAt, input.athlete.timezone),
  };
}

function normalise(value: number | null | undefined, field: string, max: number): number | null {
  if (value === null || value === undefined) {
    return null;
  }
  if (!Number.isFinite(value) || value < 0 || value > max) {
    throw new ValidationError(`${field} is out of range`, { [field]: value });
  }
  return Math.round(value);
}
