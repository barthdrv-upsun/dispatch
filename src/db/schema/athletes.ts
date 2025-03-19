import { date, integer, pgEnum, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { squads, users } from './squads.js';

export const athleteState = pgEnum('athlete_state', ['active', 'injured', 'returning']);

export const athletes = pgTable('athletes', {
  id: uuid('id').primaryKey().defaultRandom(),
  squadId: uuid('squad_id')
    .notNull()
    .references(() => squads.id, { onDelete: 'cascade' }),
  userId: uuid('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  dateOfBirth: date('date_of_birth').notNull(),
  timezone: text('timezone').notNull(),
  restingHr: integer('resting_hr'),
  maxHr: integer('max_hr'),
  state: athleteState('state').notNull().default('active'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});
