import {
  date,
  integer,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  unique,
  uuid,
} from 'drizzle-orm/pg-core';
import { athletes } from './athletes.js';
import { goals } from './goals.js';
import { squads, users } from './squads.js';

export const templateKind = pgEnum('template_kind', [
  'easy',
  'tempo',
  'interval',
  'long',
  'strength',
  'cycling',
  'swimming',
]);

export type Prescription = {
  summary: string;
  distanceM?: number;
  durationS?: number;
  reps?: number;
  repDistanceM?: number;
  recoveryS?: number;
  targetEffort?: number;
};

/**
 * Templates are immutable once referenced by a block slot. An edit inserts a
 * new row with the next version for the same code and stamps superseded_at on
 * the row it replaces.
 */
export const workoutTemplates = pgTable(
  'workout_templates',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    squadId: uuid('squad_id')
      .notNull()
      .references(() => squads.id, { onDelete: 'cascade' }),
    code: text('code').notNull(),
    version: integer('version').notNull().default(1),
    kind: templateKind('kind').notNull(),
    prescription: jsonb('prescription').$type<Prescription>().notNull(),
    loadFactor: numeric('load_factor', { precision: 5, scale: 2 }).notNull(),
    supersededAt: timestamp('superseded_at', { withTimezone: true }),
  },
  (t) => ({
    codeVersion: unique('workout_templates_squad_code_version').on(t.squadId, t.code, t.version),
  }),
);
