import { date, integer, numeric, pgTable, primaryKey, uuid } from 'drizzle-orm/pg-core';
import { athletes } from './athletes.js';

/** local_date is the athlete's own calendar day, not the squad's. */
export const sleepLogs = pgTable(
  'sleep_logs',
  {
    athleteId: uuid('athlete_id')
      .notNull()
      .references(() => athletes.id, { onDelete: 'cascade' }),
    localDate: date('local_date').notNull(),
    hours: numeric('hours', { precision: 4, scale: 2 }).notNull(),
    quality: integer('quality'),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.athleteId, t.localDate] }),
  }),
);

export const hydrationLogs = pgTable(
  'hydration_logs',
  {
    athleteId: uuid('athlete_id')
      .notNull()
      .references(() => athletes.id, { onDelete: 'cascade' }),
    localDate: date('local_date').notNull(),
    litres: numeric('litres', { precision: 4, scale: 2 }).notNull(),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.athleteId, t.localDate] }),
  }),
);
