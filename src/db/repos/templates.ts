import { and, eq, isNull } from 'drizzle-orm';
import type { Database } from '../client.js';
import { workoutTemplates } from '../schema.js';
import type { TemplateRepo } from '../../ports/index.js';

export function drizzleTemplateRepo(db: Database): TemplateRepo {
  return {
    async byId(templateId) {
      const rows = await db
        .select()
        .from(workoutTemplates)
        .where(eq(workoutTemplates.id, templateId))
        .limit(1);
      return rows[0] ?? null;
    },

    async bySquad(squadId) {
      return db.select().from(workoutTemplates).where(eq(workoutTemplates.squadId, squadId));
    },

    async insert(template) {
      const rows = await db
        .insert(workoutTemplates)
        .values({
          squadId: template.squadId,
          code: template.code,
          version: template.version,
          kind: template.kind,
          prescription: template.prescription,
          loadFactor: String(template.loadFactor),
          supersededAt: template.supersededAt,
        })
        .returning({ id: workoutTemplates.id });
      const row = rows[0];
      if (!row) {
        throw new Error('template insert returned no row');
      }
      return row.id;
    },

    async markSuperseded(templateId, at) {
      await db
        .update(workoutTemplates)
        .set({ supersededAt: at })
        .where(and(eq(workoutTemplates.id, templateId), isNull(workoutTemplates.supersededAt)));
    },
  };
}
