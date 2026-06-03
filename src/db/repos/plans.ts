import { eq } from 'drizzle-orm';
import type { Database } from '../client.js';
import { goals, plans } from '../schema.js';
import type { GoalRepo, PlanRepo } from '../../ports/index.js';

export function drizzlePlanRepo(db: Database): PlanRepo {
  return {
    async insert(plan) {
      const rows = await db
        .insert(plans)
        .values({
          athleteId: plan.athleteId,
          goalId: plan.goalId,
          blockId: plan.blockId,
          blockVersion: plan.blockVersion,
          startsOn: plan.startsOn,
        })
        .returning({ id: plans.id });
      const row = rows[0];
      if (!row) {
        throw new Error('plan insert returned no row');
      }
      return row.id;
    },

    async byId(planId) {
      const rows = await db.select().from(plans).where(eq(plans.id, planId)).limit(1);
      return rows[0] ?? null;
    },

    async forAthlete(athleteId) {
      return db.select().from(plans).where(eq(plans.athleteId, athleteId)).orderBy(plans.startsOn);
    },
  };
}

export function drizzleGoalRepo(db: Database): GoalRepo {
  return {
    async byId(goalId) {
      const rows = await db.select().from(goals).where(eq(goals.id, goalId)).limit(1);
      return rows[0] ?? null;
    },

    async forAthlete(athleteId) {
      return db.select().from(goals).where(eq(goals.athleteId, athleteId)).orderBy(goals.raceDate);
    },
  };
}
