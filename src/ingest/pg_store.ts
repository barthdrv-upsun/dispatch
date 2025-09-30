import { and, desc, eq } from 'drizzle-orm';
import type { Database } from '../db/client.js';
import { athletes, sessions, stravaActivities, stravaLinks } from '../db/schema.js';
import type { IngestStore, LinkPatch } from './store.js';
import type { AthleteLink, Callback, MappedSessionWithLoad } from './types.js';

function toError(err: unknown): Error {
  return err instanceof Error ? err : new Error(String(err));
}

/**
 * Postgres-backed store. Promises are wrapped back into callbacks here rather
 * than making the rest of this package async, because the rest of this
 * package is not async.
 */
export class PgIngestStore implements IngestStore {
  private readonly db: Database;

  constructor(db: Database) {
    if (!db) {
      throw new Error('PgIngestStore needs a database');
    }
    this.db = db;
  }

  findLink(athleteId: string, cb: Callback<AthleteLink>): void {
    this.db
      .select({ link: stravaLinks, timezone: athletes.timezone })
      .from(stravaLinks)
      .innerJoin(athletes, eq(athletes.id, stravaLinks.athleteId))
      .where(eq(stravaLinks.athleteId, athleteId))
      .limit(1)
      .then(function (rows) {
        const row = rows[0];
        if (!row) {
          cb(null, undefined);
          return;
        }
        cb(null, {
          athleteId: row.link.athleteId,
          stravaAthleteId: row.link.stravaAthleteId,
          accessToken: row.link.accessToken,
          refreshToken: row.link.refreshToken,
          expiresAt: row.link.expiresAt,
          scope: row.link.scope,
          timezone: row.timezone,
        });
      })
      .catch(function (err: unknown) {
        cb(toError(err));
      });
  }

  findLinkByStravaAthleteId(stravaAthleteId: number, cb: Callback<AthleteLink>): void {
    this.db
      .select({ link: stravaLinks, timezone: athletes.timezone })
      .from(stravaLinks)
      .innerJoin(athletes, eq(athletes.id, stravaLinks.athleteId))
      .where(eq(stravaLinks.stravaAthleteId, stravaAthleteId))
      .limit(1)
      .then(function (rows) {
        const row = rows[0];
        if (!row) {
          cb(null, undefined);
          return;
        }
        cb(null, {
          athleteId: row.link.athleteId,
          stravaAthleteId: row.link.stravaAthleteId,
          accessToken: row.link.accessToken,
          refreshToken: row.link.refreshToken,
          expiresAt: row.link.expiresAt,
          scope: row.link.scope,
          timezone: row.timezone,
        });
      })
      .catch(function (err: unknown) {
        cb(toError(err));
      });
  }

  updateLink(athleteId: string, patch: LinkPatch, cb: Callback<void>): void {
    if (!patch || (!patch.accessToken && !patch.refreshToken && !patch.expiresAt)) {
      cb(null);
      return;
    }
    this.db
      .update(stravaLinks)
      .set(patch)
      .where(eq(stravaLinks.athleteId, athleteId))
      .then(function () {
        cb(null);
      })
      .catch(function (err: unknown) {
        cb(toError(err));
      });
  }

  lastIngestedAt(athleteId: string, cb: Callback<Date | null>): void {
    this.db
      .select({ ingestedAt: stravaActivities.ingestedAt })
      .from(stravaActivities)
      .where(eq(stravaActivities.athleteId, athleteId))
      .orderBy(desc(stravaActivities.ingestedAt))
      .limit(1)
      .then(function (rows) {
        const row = rows[0];
        cb(null, row ? row.ingestedAt : null);
      })
      .catch(function (err: unknown) {
        cb(toError(err));
      });
  }

  /**
   * The strava_activities row goes in first. If the unique index rejects it we
   * are looking at a replay, so there is nothing to write and no session to
   * report.
   */
  insertSession(
    session: MappedSessionWithLoad,
    stravaActivityId: number,
    cb: Callback<string | undefined>,
  ): void {
    const db = this.db;
    db.transaction(async function (tx) {
      const claimed = await tx
        .insert(stravaActivities)
        .values({
          athleteId: session.athleteId,
          stravaActivityId: stravaActivityId,
          sessionId: null,
        })
        .onConflictDoNothing({ target: stravaActivities.stravaActivityId })
        .returning({ id: stravaActivities.id });

      const claim = claimed[0];
      if (!claim) {
        return undefined;
      }

      const inserted = await tx
        .insert(sessions)
        .values({
          athleteId: session.athleteId,
          completedAt: session.completedAt,
          distanceM: session.distanceM,
          durationS: session.durationS,
          avgHr: session.avgHr,
          perceivedEffort: session.perceivedEffort,
          load: session.load === null ? null : session.load.toFixed(2),
          source: 'strava',
        })
        .returning({ id: sessions.id });

      const row = inserted[0];
      if (!row) {
        throw new Error('session insert returned no row');
      }
      await tx
        .update(stravaActivities)
        .set({ sessionId: row.id })
        .where(and(eq(stravaActivities.id, claim.id), eq(stravaActivities.athleteId, session.athleteId)));
      return row.id;
    })
      .then(function (sessionId) {
        cb(null, sessionId);
      })
      .catch(function (err: unknown) {
        cb(toError(err));
      });
  }
}
