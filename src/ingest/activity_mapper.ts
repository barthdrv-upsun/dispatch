import { athleteLocalDay, instantFromWallClock } from '../lib/time.js';
import type { MappedSession, StravaActivity } from './types.js';

/**
 * Sport types we treat as a run. Anything else is left on Strava's side of
 * the fence - this package has never imported them.
 */
const RUN_SPORT_TYPES = ['Run', 'TrailRun', 'VirtualRun', 'TreadmillRun'];

export interface MapFailure {
  reason: string;
}

export type MapResult =
  | { ok: true; session: MappedSession }
  | { ok: false; failure: MapFailure };

/**
 * Turns one Strava activity into something we can store. Everything in the
 * payload is optional as far as we are concerned, because it has all been
 * missing at least once in production.
 */
export class ActivityMapper {
  private readonly fallbackTimezone: string;

  constructor(fallbackTimezone: string) {
    this.fallbackTimezone = fallbackTimezone || 'UTC';
  }

  isRun(activity: StravaActivity | null | undefined): boolean {
    if (!activity) {
      return false;
    }
    const sport = activity.sport_type || activity.type;
    if (!sport) {
      return false;
    }
    return RUN_SPORT_TYPES.indexOf(sport) !== -1;
  }

  map(athleteId: string, activity: StravaActivity | null | undefined, timezone?: string): MapResult {
    if (!athleteId) {
      return { ok: false, failure: { reason: 'missing athlete id' } };
    }
    if (!activity) {
      return { ok: false, failure: { reason: 'missing activity payload' } };
    }
    if (activity.id === null || activity.id === undefined) {
      return { ok: false, failure: { reason: 'activity has no id' } };
    }
    if (!this.isRun(activity)) {
      return { ok: false, failure: { reason: 'not a run' } };
    }

    const zone = timezone || this.stravaZone(activity) || this.fallbackTimezone;
    const completedAt = this.readCompletedAt(activity, zone);
    if (completedAt === null) {
      return { ok: false, failure: { reason: 'activity has no usable start time' } };
    }

    const distance = this.readNumber(activity.distance);
    const duration = this.readNumber(activity.moving_time);
    const elapsed = this.readNumber(activity.elapsed_time);

    const session: MappedSession = {
      athleteId: athleteId,
      completedAt: completedAt,
      distanceM: distance === null ? null : Math.round(distance),
      durationS: duration === null ? (elapsed === null ? null : Math.round(elapsed)) : Math.round(duration),
      avgHr: this.readHeartRate(activity.average_heartrate),
      perceivedEffort: this.readEffort(activity.perceived_exertion),
      source: 'strava',
      localDate: athleteLocalDay(completedAt, zone),
    };
    return { ok: true, session: session };
  }

  /**
   * Strava sends the zone as "(GMT+01:00) Europe/Berlin" often enough that it
   * is worth pulling the IANA name out of it.
   */
  stravaZone(activity: StravaActivity): string | null {
    if (!activity || !activity.timezone) {
      return null;
    }
    const parts = activity.timezone.split(' ');
    const last = parts[parts.length - 1];
    if (!last || last.indexOf('/') === -1) {
      return null;
    }
    return last;
  }

  readCompletedAt(activity: StravaActivity, zone: string): Date | null {
    if (activity.start_date) {
      const utc = new Date(activity.start_date);
      if (!Number.isNaN(utc.getTime())) {
        return utc;
      }
    }
    if (activity.start_date_local) {
      try {
        return instantFromWallClock(activity.start_date_local, zone);
      } catch (e) {
        return null;
      }
    }
    return null;
  }

  readNumber(value: number | undefined): number | null {
    if (value === null || value === undefined) {
      return null;
    }
    if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) {
      return null;
    }
    return value;
  }

  readHeartRate(value: number | undefined): number | null {
    const hr = this.readNumber(value);
    if (hr === null) {
      return null;
    }
    // Chest straps drop out and report 5bpm or 250bpm for a sample or two.
    if (hr < 25 || hr > 240) {
      return null;
    }
    return Math.round(hr);
  }

  readEffort(value: number | undefined): number | null {
    const effort = this.readNumber(value);
    if (effort === null) {
      return null;
    }
    if (effort < 1 || effort > 10) {
      return null;
    }
    return Math.round(effort);
  }
}

/**
 * Treadmill runs come through with the trainer flag set and, more often than
 * not, no distance at all - the belt does not know how far you went. Worth
 * knowing about because the distance-based load fallback is useless for them.
 */
export function looksLikeTreadmill(activity: StravaActivity | null | undefined): boolean {
  if (!activity) {
    return false;
  }
  if (activity.trainer === true) {
    return true;
  }
  const sport = activity.sport_type || activity.type;
  return sport === 'VirtualRun' || sport === 'TreadmillRun';
}
