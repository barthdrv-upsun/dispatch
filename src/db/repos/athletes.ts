import { and, eq } from 'drizzle-orm';
import type { Database } from '../client.js';
import { athletes, squads, userRoles } from '../schema.js';
import type { Athlete, Squad } from '../../domain/athletes/types.js';
import type { AthleteRepo, SquadRepo, UserRepo } from '../../ports/index.js';
import { isRole, type RoleGrant } from '../../domain/authz.js';

type AthleteSelect = typeof athletes.$inferSelect;

export function toAthlete(row: AthleteSelect): Athlete {
  return {
    id: row.id,
    squadId: row.squadId,
    userId: row.userId,
    dateOfBirth: row.dateOfBirth,
    timezone: row.timezone,
    restingHr: row.restingHr,
    maxHr: row.maxHr,
    state: row.state,
  };
}

export function drizzleUserRepo(db: Database): UserRepo {
  return {
    async grantsFor(userId) {
      const rows = await db
        .select({ squadId: userRoles.squadId, role: userRoles.role })
        .from(userRoles)
        .where(eq(userRoles.userId, userId));
      const grants: RoleGrant[] = [];
      for (const row of rows) {
        if (isRole(row.role)) {
          grants.push({ squadId: row.squadId, role: row.role });
        }
      }
      return grants;
    },

    async athleteIdFor(userId) {
      const rows = await db
        .select({ id: athletes.id })
        .from(athletes)
        .where(eq(athletes.userId, userId))
        .limit(1);
      return rows[0]?.id ?? null;
    },

    async physioUserIds(squadId) {
      const rows = await db
        .select({ userId: userRoles.userId })
        .from(userRoles)
        .where(and(eq(userRoles.squadId, squadId), eq(userRoles.role, 'physio')));
      return rows.map((row) => row.userId);
    },
  };
}

export function drizzleSquadRepo(db: Database): SquadRepo {
  return {
    async byId(squadId): Promise<Squad | null> {
      const rows = await db.select().from(squads).where(eq(squads.id, squadId)).limit(1);
      const row = rows[0];
      if (!row) {
        return null;
      }
      return { id: row.id, name: row.name, timezone: row.timezone, active: row.active };
    },
  };
}

export function drizzleAthleteRepo(db: Database): AthleteRepo {
  return {
    async byId(athleteId) {
      const rows = await db.select().from(athletes).where(eq(athletes.id, athleteId)).limit(1);
      const row = rows[0];
      return row ? toAthlete(row) : null;
    },

    /** Squad-scoped, and the only way to read more than one athlete. */
    async bySquad(squadId) {
      const rows = await db.select().from(athletes).where(eq(athletes.squadId, squadId));
      return rows.map(toAthlete);
    },

    async save(athlete) {
      await db
        .update(athletes)
        .set({
          timezone: athlete.timezone,
          state: athlete.state,
          restingHr: athlete.restingHr,
          maxHr: athlete.maxHr,
        })
        .where(eq(athletes.id, athlete.id));
    },
  };
}
