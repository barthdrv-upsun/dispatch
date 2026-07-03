import { integer, numeric, pgEnum, pgTable, timestamp, uuid } from 'drizzle-orm/pg-core';
import { athletes } from './athletes.js';
import { plans, workoutTemplates } from './plans.js';
import { shoes } from './shoes.js';

export const sessionSource = pgEnum('session_source', ['manual', 'strava']);

export const sessions = pgTable('sessions', {
  id: uuid('id').primaryKey().defaultRandom(),
  athleteId: uuid('athlete_id')
    .notNull()
    .references(() => athletes.id, { onDelete: 'cascade' }),
  planId: uuid('plan_id').references(() => plans.id, { onDelete: 'set null' }),
  templateId: uuid('template_id').references(() => workoutTemplates.id, { onDelete: 'set null' }),
  scheduledFor: timestamp('scheduled_for', { withTimezone: true }),
  completedAt: timestamp('completed_at', { withTimezone: true }),
  distanceM: integer('distance_m'),
  durationS: integer('duration_s'),
  avgHr: integer('avg_hr'),
  perceivedEffort: integer('perceived_effort'),
  load: numeric('load', { precision: 8, scale: 2 }),
  shoeId: uuid('shoe_id').references(() => shoes.id, { onDelete: 'set null' }),
  source: sessionSource('source').notNull().default('manual'),
});
