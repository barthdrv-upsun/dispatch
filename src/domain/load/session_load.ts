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
