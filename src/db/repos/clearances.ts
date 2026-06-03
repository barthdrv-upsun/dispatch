import { desc, eq, inArray } from 'drizzle-orm';
import type { Database } from '../client.js';
import { clearances, injuries } from '../schema.js';
import type { InjuryRepo } from '../../ports/index.js';

export function drizzleInjuryRepo(db: Database): InjuryRepo {
  return {
    async byId(injuryId) {
      const rows = await db.select().from(injuries).where(eq(injuries.id, injuryId)).limit(1);
      return rows[0] ?? null;
    },

    async forAthlete(athleteId) {
      return db
        .select()
        .from(injuries)
        .where(eq(injuries.athleteId, athleteId))
        .orderBy(desc(injuries.onsetOn));
    },

    /**
     * Every clearance the athlete has, across their injuries. R4 needs the
     * revoked ones too - a withdrawn signature is the whole point of the
     * revoked_at column.
     */
    async clearancesForAthlete(athleteId) {
      const theirs = db
        .select({ id: injuries.id })
        .from(injuries)
        .where(eq(injuries.athleteId, athleteId));
      return db
        .select()
        .from(clearances)
        .where(inArray(clearances.injuryId, theirs))
        .orderBy(desc(clearances.signedAt));
    },

    async clearanceById(clearanceId) {
      const rows = await db.select().from(clearances).where(eq(clearances.id, clearanceId)).limit(1);
      return rows[0] ?? null;
    },

    async insertClearance(clearance) {
      const rows = await db
        .insert(clearances)
        .values({
          injuryId: clearance.injuryId,
          signedBy: clearance.signedBy,
          signedAt: clearance.signedAt,
          revokedAt: clearance.revokedAt,
          notes: clearance.notes,
          loadSnapshot: clearance.loadSnapshot,
        })
        .returning({ id: clearances.id });
      const row = rows[0];
      if (!row) {
        throw new Error('clearance insert returned no row');
      }
      return row.id;
    },

    async saveClearance(clearance) {
      await db
        .update(clearances)
        .set({ revokedAt: clearance.revokedAt, notes: clearance.notes })
        .where(eq(clearances.id, clearance.id));
    },
  };
}
