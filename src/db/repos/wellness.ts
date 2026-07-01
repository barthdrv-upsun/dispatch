import { and, eq, gte } from 'drizzle-orm';
import type { Database } from '../client.js';
import { hydrationLogs, sleepLogs } from '../schema.js';
import type { WellnessRepo } from '../../ports/index.js';

export function drizzleWellnessRepo(db: Database): WellnessRepo {
  return {
    async sleepFrom(athleteId, from) {
      return db
        .select()
        .from(sleepLogs)
        .where(and(eq(sleepLogs.athleteId, athleteId), gte(sleepLogs.localDate, from)))
        .orderBy(sleepLogs.localDate);
    },

    async putSleep(log) {
      await db
        .insert(sleepLogs)
        .values({
          athleteId: log.athleteId,
          localDate: log.localDate,
          hours: String(log.hours),
          quality: log.quality,
        })
        .onConflictDoUpdate({
          target: [sleepLogs.athleteId, sleepLogs.localDate],
          set: { hours: String(log.hours), quality: log.quality },
        });
    },

    async putHydration(log) {
      await db
        .insert(hydrationLogs)
        .values({
          athleteId: log.athleteId,
          localDate: log.localDate,
          litres: String(log.litres),
        })
        .onConflictDoUpdate({
          target: [hydrationLogs.athleteId, hydrationLogs.localDate],
          set: { litres: String(log.litres) },
        });
    },
  };
}
