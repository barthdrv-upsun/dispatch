import { round2 } from '../../lib/numbers.js';

/**
 * What a completed session cost the athlete.
 *
 * Session RPE - minutes times perceived effort - is the number the squads
 * actually trust, so it wins whenever the athlete gave us one. Heart rate is
 * the fallback, and distance is the last resort for the athletes who log a
 * run and nothing else.
 */
export type SessionLoadInput = {
  durationS: number | null;
  distanceM: number | null;
  avgHr: number | null;
  perceivedEffort: number | null;
  restingHr?: number | null;
  maxHr?: number | null;
};

/** Effort-equivalent per km when all we know is how far they went. */
const DISTANCE_ONLY_EFFORT_PER_KM = 7;

export function heartRateReserveFraction(
  avgHr: number,
  restingHr: number,
  maxHr: number,
): number | null {
  if (maxHr <= restingHr) {
    return null;
  }
  const fraction = (avgHr - restingHr) / (maxHr - restingHr);
  if (!Number.isFinite(fraction)) {
    return null;
  }
  return Math.min(1, Math.max(0, fraction));
}

export function sessionLoad(input: SessionLoadInput): number | null {
  const minutes = input.durationS !== null && input.durationS > 0 ? input.durationS / 60 : null;

  if (minutes !== null && input.perceivedEffort !== null && input.perceivedEffort > 0) {
    return round2(minutes * input.perceivedEffort);
  }

  if (
    minutes !== null &&
    input.avgHr !== null &&
    input.restingHr !== null &&
    input.restingHr !== undefined &&
    input.maxHr !== null &&
    input.maxHr !== undefined
  ) {
    const reserve = heartRateReserveFraction(input.avgHr, input.restingHr, input.maxHr);
    if (reserve !== null) {
      // Scaled onto the same 1-10 axis the athletes report on.
      return round2(minutes * (1 + reserve * 9));
    }
  }

  if (input.distanceM !== null && input.distanceM > 0) {
    return round2((input.distanceM / 1000) * DISTANCE_ONLY_EFFORT_PER_KM);
  }

  return null;
}
