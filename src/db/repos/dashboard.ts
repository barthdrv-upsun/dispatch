import { and, eq, gte, isNull } from 'drizzle-orm';
import type { Database } from '../client.js';
import { athletes, injuries, sessions, stravaLinks } from '../schema.js';
import type { DashboardRepo } from '../../ports/index.js';

export function drizzleDashboardRepo(db: Database): DashboardRepo {
  return {
    /** Athletes plus their strava link and whatever injury is still open. */
    async athletesForDashboard(squadId) {
      const rows = await db
        .select({
          athlete: athletes,
          link: stravaLinks,
          injury: injuries,
        })
        .from(athletes)
        .leftJoin(stravaLinks, eq(stravaLinks.athleteId, athletes.id))
        .leftJoin(
          injuries,
          and(eq(injuries.athleteId, athletes.id), isNull(injuries.resolvedOn)),
        )
        .orderBy(athletes.id);

      return rows.map((row) => ({
        athlete: row.athlete,
        link: row.link,
        openInjury: row.injury
          ? {
              id: row.injury.id,
              region: row.injury.region,
              onsetOn: row.injury.onsetOn,
              severity: row.injury.severity,
              notes: row.injury.notes,
            }
          : null,
      }));
    },

    async recentSessions(athleteId, since) {
      return db
        .select({
          completedAt: sessions.completedAt,
          load: sessions.load,
          distanceM: sessions.distanceM,
        })
        .from(sessions)
        .where(and(eq(sessions.athleteId, athleteId), gte(sessions.completedAt, since)))
        .orderBy(sessions.completedAt);
    },
  };
}
