import { athleteLocalDay } from '../lib/time.js';
import type { AthleteRow, Callback } from '../athletes/athlete_service.js';

export interface SessionRow {
  id: string;
  athleteId: string;
  completedAt: Date | null;
  distanceM: number | null;
  durationS: number | null;
  avgHr: number | null;
  perceivedEffort: number | null;
  source: string;
}

export interface SessionRepository {
  insert(session: Omit<SessionRow, 'id'>, cb: Callback<string>): void;
  forAthleteBetween(athleteId: string, from: Date, to: Date, cb: Callback<SessionRow[]>): void;
}

export interface ManualSessionInput {
  athleteId: string;
  completedAt: Date;
  distanceM?: number | null;
  durationS?: number | null;
  avgHr?: number | null;
  perceivedEffort?: number | null;
}

/**
 * Manual session logging. Athletes fill this in from the app; coaches fill it
 * in for the athletes who never do.
 */
export class SessionService {
  private readonly repo: SessionRepository;

  constructor(repo: SessionRepository) {
    if (!repo) {
      throw new Error('SessionService needs a repository');
    }
    this.repo = repo;
  }

  log(input: ManualSessionInput, cb: Callback<string>): void {
    if (!input) {
      cb(new Error('log called without a session'));
      return;
    }
    if (!input.athleteId) {
      cb(new Error('a session needs an athlete'));
      return;
    }
    if (!input.completedAt || Number.isNaN(input.completedAt.getTime())) {
      cb(new Error('a session needs a completion time'));
      return;
    }
    if (input.completedAt.getTime() > Date.now() + 60000) {
      cb(new Error('a session cannot be logged in the future'));
      return;
    }
    const distance = input.distanceM === undefined ? null : input.distanceM;
    const duration = input.durationS === undefined ? null : input.durationS;
    if (distance !== null && (distance < 0 || distance > 300000)) {
      cb(new Error('distance is out of range'));
      return;
    }
    if (duration !== null && (duration < 0 || duration > 86400)) {
      cb(new Error('duration is out of range'));
      return;
    }
    const effort = input.perceivedEffort === undefined ? null : input.perceivedEffort;
    if (effort !== null && (effort < 1 || effort > 10)) {
      cb(new Error('perceived effort runs from 1 to 10'));
      return;
    }
    this.repo.insert(
      {
        athleteId: input.athleteId,
        completedAt: input.completedAt,
        distanceM: distance,
        durationS: duration,
        avgHr: input.avgHr === undefined ? null : input.avgHr,
        perceivedEffort: effort,
        source: 'manual',
      },
      cb,
    );
  }

  /**
   * Groups an athlete's sessions by the day they happened on, in the
   * athlete's own timezone.
   */
  byLocalDay(athlete: AthleteRow, sessions: SessionRow[]): Record<string, SessionRow[]> {
    const out: Record<string, SessionRow[]> = {};
    if (!athlete || !sessions) {
      return out;
    }
    for (let i = 0; i < sessions.length; i = i + 1) {
      const session = sessions[i];
      if (!session || !session.completedAt) {
        continue;
      }
      const day = athleteLocalDay(session.completedAt, athlete.timezone);
      if (!out[day]) {
        out[day] = [];
      }
      const bucket = out[day];
      if (bucket) {
        bucket.push(session);
      }
    }
    return out;
  }

  weeklyDistanceM(sessions: SessionRow[]): number {
    let total = 0;
    if (!sessions) {
      return total;
    }
    for (let i = 0; i < sessions.length; i = i + 1) {
      const session = sessions[i];
      if (session && session.distanceM) {
        total = total + session.distanceM;
      }
    }
    return total;
  }
}
