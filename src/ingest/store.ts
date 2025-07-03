import type { AthleteLink, Callback, MappedSession } from './types.js';

export interface LinkPatch {
  accessToken?: string;
  refreshToken?: string;
  expiresAt?: Date;
}

/**
 * Everything this package needs from the database, in callback form. The
 * Postgres implementation lives in pg_store.ts; the tests hand in an
 * in-memory one.
 */
export interface IngestStore {
  findLink(athleteId: string, cb: Callback<AthleteLink>): void;
  findLinkByStravaAthleteId(stravaAthleteId: number, cb: Callback<AthleteLink>): void;
  updateLink(athleteId: string, patch: LinkPatch, cb: Callback<void>): void;
  lastIngestedAt(athleteId: string, cb: Callback<Date | null>): void;
  /**
   * Writes the session and the strava_activities row together. Returns the new
   * session id, or undefined when strava_activity_id was already present -
   * that unique index is what makes a replayed webhook harmless.
   */
  insertSession(
    session: MappedSession,
    stravaActivityId: number,
    cb: Callback<string | undefined>,
  ): void;
}
