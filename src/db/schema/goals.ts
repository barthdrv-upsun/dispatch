import { date, integer, pgEnum, pgTable, text, uuid } from 'drizzle-orm/pg-core';
import { athletes } from './athletes.js';

export const goalState = pgEnum('goal_state', ['planned', 'active', 'completed', 'abandoned']);

export const goals = pgTable('goals', {
  id: uuid('id').primaryKey().defaultRandom(),
  athleteId: uuid('athlete_id')
    .notNull()
    .references(() => athletes.id, { onDelete: 'cascade' }),
  raceName: text('race_name').notNull(),
  raceDate: date('race_date').notNull(),
  distanceM: integer('distance_m').notNull(),
  targetTimeS: integer('target_time_s'),
  state: goalState('state').notNull().default('planned'),
});

export const raceResults = pgTable('race_results', {
  id: uuid('id').primaryKey().defaultRandom(),
  athleteId: uuid('athlete_id')
    .notNull()
    .references(() => athletes.id, { onDelete: 'cascade' }),
  raceName: text('race_name').notNull(),
  raceDate: date('race_date').notNull(),
  distanceM: integer('distance_m').notNull(),
  finishTimeS: integer('finish_time_s').notNull(),
});
