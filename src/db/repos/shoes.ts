import { asc, eq } from 'drizzle-orm';
import type { Database } from '../client.js';
import { shoes } from '../schema.js';
import type { ShoeRepo } from '../../ports/index.js';

export function drizzleShoeRepo(db: Database): ShoeRepo {
  return {
    async byId(shoeId) {
      const rows = await db.select().from(shoes).where(eq(shoes.id, shoeId)).limit(1);
      return rows[0] ?? null;
    },

    async forAthlete(athleteId) {
      return db.select().from(shoes).where(eq(shoes.athleteId, athleteId)).orderBy(asc(shoes.purchasedOn));
    },

    async insert(shoe) {
      const rows = await db
        .insert(shoes)
        .values({
          athleteId: shoe.athleteId,
          model: shoe.model,
          purchasedOn: shoe.purchasedOn,
          retireAtKm: String(shoe.retireAtKm),
          currentKm: String(shoe.currentKm),
          retiredAt: shoe.retiredAt,
        })
        .returning({ id: shoes.id });
      const row = rows[0];
      if (!row) {
        throw new Error('shoe insert returned no row');
      }
      return row.id;
    },

    async save(shoe) {
      await db
        .update(shoes)
        .set({ currentKm: String(shoe.currentKm), retiredAt: shoe.retiredAt })
        .where(eq(shoes.id, shoe.id));
    },
  };
}
