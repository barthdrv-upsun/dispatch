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

export const blockState = pgEnum('block_state', ['draft', 'published']);

export const trainingBlocks = pgTable(
  'training_blocks',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    squadId: uuid('squad_id')
      .notNull()
      .references(() => squads.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    version: integer('version').notNull().default(1),
    weeks: integer('weeks').notNull(),
    state: blockState('state').notNull().default('draft'),
    publishedBy: uuid('published_by').references(() => users.id, { onDelete: 'set null' }),
    publishedAt: timestamp('published_at', { withTimezone: true }),
  },
  (t) => ({
    nameVersion: unique('training_blocks_squad_name_version').on(t.squadId, t.name, t.version),
  }),
);

export const blockSlots = pgTable(
  'block_slots',
  {
    blockId: uuid('block_id')
      .notNull()
      .references(() => trainingBlocks.id, { onDelete: 'cascade' }),
    week: integer('week').notNull(),
    day: integer('day').notNull(),
    templateId: uuid('template_id')
      .notNull()
      .references(() => workoutTemplates.id),
    templateVersion: integer('template_version').notNull(),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.blockId, t.week, t.day] }),
  }),
);

/**
 * block_version is copied in at assignment time and never follows the block
 * afterwards.
 */
export const plans = pgTable('plans', {
  id: uuid('id').primaryKey().defaultRandom(),
  athleteId: uuid('athlete_id')
    .notNull()
    .references(() => athletes.id, { onDelete: 'cascade' }),
  goalId: uuid('goal_id').references(() => goals.id, { onDelete: 'set null' }),
  blockId: uuid('block_id')
    .notNull()
    .references(() => trainingBlocks.id),
  blockVersion: integer('block_version').notNull(),
  startsOn: date('starts_on').notNull(),
});
