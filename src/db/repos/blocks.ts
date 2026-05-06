import { eq } from 'drizzle-orm';
import type { Database } from '../client.js';
import { blockSlots, trainingBlocks } from '../schema.js';
import type { BlockRepo } from '../../ports/index.js';

export function drizzleBlockRepo(db: Database): BlockRepo {
  return {
    async byId(blockId) {
      const rows = await db
        .select()
        .from(trainingBlocks)
        .where(eq(trainingBlocks.id, blockId))
        .limit(1);
      return rows[0] ?? null;
    },

    async bySquad(squadId) {
      return db.select().from(trainingBlocks).where(eq(trainingBlocks.squadId, squadId));
    },

    async slotsFor(blockId) {
      return db
        .select()
        .from(blockSlots)
        .where(eq(blockSlots.blockId, blockId))
        .orderBy(blockSlots.week, blockSlots.day);
    },

    async insert(block) {
      const rows = await db
        .insert(trainingBlocks)
        .values({
          squadId: block.squadId,
          name: block.name,
          version: block.version,
          weeks: block.weeks,
          state: block.state,
          publishedBy: block.publishedBy,
          publishedAt: block.publishedAt,
        })
        .returning({ id: trainingBlocks.id });
      const row = rows[0];
      if (!row) {
        throw new Error('block insert returned no row');
      }
      return row.id;
    },

    async save(block) {
      await db
        .update(trainingBlocks)
        .set({
          name: block.name,
          weeks: block.weeks,
          state: block.state,
          publishedBy: block.publishedBy,
          publishedAt: block.publishedAt,
        })
        .where(eq(trainingBlocks.id, block.id));
    },

    async putSlot(slot) {
      await db
        .insert(blockSlots)
        .values(slot)
        .onConflictDoUpdate({
          target: [blockSlots.blockId, blockSlots.week, blockSlots.day],
          set: { templateId: slot.templateId, templateVersion: slot.templateVersion },
        });
    },

    async putSlots(slots) {
      if (slots.length === 0) {
        return;
      }
      await db
        .insert(blockSlots)
        .values(slots.map((slot) => ({ ...slot })))
        .onConflictDoNothing();
    },
  };
}
