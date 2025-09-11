import { round2 } from '../../lib/numbers.js';
import { isHardRunningKind, type RunningKind } from './entries.js';

/** R1. Below this an athlete is detraining, above it they are digging a hole. */
export const RATIO_MIN = 0.8;
export const RATIO_MAX = 1.3;

export type RatioPosition = 'below' | 'within' | 'above' | 'unknown';

export type RatioVerdict = {
  acuteLoad: number;
  chronicLoad: number;
  ratio: number;
  position: RatioPosition;
  withinBounds: boolean;
};

/**
 * Acute over chronic. Both figures are expected to be on the same footing
 * already - see computeChronicLoad, which divides the 28-day sum by four.
 *
 * Returns 0 when there is no chronic load to divide by; callers should read
 * `position` rather than the bare number in that case.
 */
export function computeLoadRatio(acuteLoad: number, chronicLoad: number): number {
  if (!Number.isFinite(acuteLoad) || !Number.isFinite(chronicLoad)) {
    throw new RangeError('computeLoadRatio needs two finite loads');
  }
  if (chronicLoad <= 0) {
    return 0;
  }
  return round2(acuteLoad / chronicLoad);
}

export function assessRatio(acuteLoad: number, chronicLoad: number): RatioVerdict {
  const ratio = computeLoadRatio(acuteLoad, chronicLoad);
  if (chronicLoad <= 0) {
    // A brand-new athlete has no chronic base to compare against. Refusing
    // every hard session for their first four weeks is not the answer.
    return { acuteLoad, chronicLoad, ratio, position: 'unknown', withinBounds: true };
  }
  if (ratio < RATIO_MIN) {
    return { acuteLoad, chronicLoad, ratio, position: 'below', withinBounds: false };
  }
  if (ratio > RATIO_MAX) {
    return { acuteLoad, chronicLoad, ratio, position: 'above', withinBounds: false };
  }
  return { acuteLoad, chronicLoad, ratio, position: 'within', withinBounds: true };
}

export type KindDecision = {
  kind: RunningKind;
  downgradedFrom: RunningKind | null;
  reason: string | null;
};
