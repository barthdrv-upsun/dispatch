import { integer, pgEnum, pgTable, timestamp, uuid } from 'drizzle-orm/pg-core';
import { athletes } from './athletes.js';

export const sessionSource = pgEnum('session_source', ['manual', 'strava']);

export const sessions = pgTable('sessions', {
  id: uuid('id').primaryKey().defaultRandom(),
  athleteId: uuid('athlete_id')
    .notNull()
    .references(() => athletes.id, { onDelete: 'cascade' }),
  scheduledFor: timestamp('scheduled_for', { withTimezone: true }),
  completedAt: timestamp('completed_at', { withTimezone: true }),
  distanceM: integer('distance_m'),
  durationS: integer('duration_s'),
  avgHr: integer('avg_hr'),
  perceivedEffort: integer('perceived_effort'),
  source: sessionSource('source').notNull().default('manual'),
});
