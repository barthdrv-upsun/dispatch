import { date, numeric, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { athletes } from './athletes.js';

export const shoes = pgTable('shoes', {
  id: uuid('id').primaryKey().defaultRandom(),
  athleteId: uuid('athlete_id')
    .notNull()
    .references(() => athletes.id, { onDelete: 'cascade' }),
  model: text('model').notNull(),
  purchasedOn: date('purchased_on').notNull(),
  retireAtKm: numeric('retire_at_km', { precision: 7, scale: 2 }).notNull(),
  currentKm: numeric('current_km', { precision: 7, scale: 2 }).notNull().default('0'),
  retiredAt: timestamp('retired_at', { withTimezone: true }),
});
