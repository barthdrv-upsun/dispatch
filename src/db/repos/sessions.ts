import { and, eq, gte } from 'drizzle-orm';
import type { Database } from '../client.js';
import { sessions, workoutTemplates } from '../schema.js';
import type { SessionRepo } from '../../ports/index.js';
import { toNumber } from '../../lib/numbers.js';

export function drizzleSessionRepo(db: Database): SessionRepo {
  return {
    async insert(session) {
      const rows = await db
        .insert(sessions)
        .values({
          athleteId: session.athleteId,
          planId: session.planId,
          templateId: session.templateId,
          scheduledFor: session.scheduledFor,
          completedAt: session.completedAt,
          distanceM: session.distanceM,
          durationS: session.durationS,
          avgHr: session.avgHr,
          perceivedEffort: session.perceivedEffort,
          load: session.load === null ? null : session.load.toFixed(2),
          source: session.source,
        })
        .returning({ id: sessions.id });
      const row = rows[0];
      if (!row) {
        throw new Error('session insert returned no row');
      }
      return row.id;
    },

    /**
     * One query, one join. The load rules need the template's kind for every
     * session in the window, so it comes back with the session rather than
     * being fetched per row.
     */
    async forAthleteFrom(athleteId, from) {
      const rows = await db
        .select({
          completedAt: sessions.completedAt,
          load: sessions.load,
          distanceM: sessions.distanceM,
          templateKind: workoutTemplates.kind,
        })
        .from(sessions)
        .leftJoin(workoutTemplates, eq(workoutTemplates.id, sessions.templateId))
        .where(and(eq(sessions.athleteId, athleteId), gte(sessions.completedAt, from)));
      return rows.map((row) => ({
        completedAt: row.completedAt,
        load: row.load === null ? null : toNumber(row.load),
        distanceM: row.distanceM,
        templateKind: row.templateKind ?? null,
      }));
    },
  };
}
