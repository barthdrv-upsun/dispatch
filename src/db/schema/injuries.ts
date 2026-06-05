import { date, integer, jsonb, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { athletes } from './athletes.js';
import { users } from './squads.js';

export const injuries = pgTable('injuries', {
  id: uuid('id').primaryKey().defaultRandom(),
  athleteId: uuid('athlete_id')
    .notNull()
    .references(() => athletes.id, { onDelete: 'cascade' }),
  region: text('region').notNull(),
  onsetOn: date('onset_on').notNull(),
  severity: integer('severity').notNull(),
  notes: text('notes'),
  resolvedOn: date('resolved_on'),
});

/** The shape src/domain/clearances/packet.ts writes into load_snapshot. */
export type LoadSnapshot = {
  athleteId: string;
  asOf: string;
  days: Array<{ localDate: string; load: number; sleepHours: number | null; pain: number | null }>;
  totals: {
    runningLoad: number;
    daysWithSleep: number;
    meanSleepHours: number | null;
    peakPain: number | null;
  };
};

/**
 * Only a physio may write here, and a revoked row stops counting immediately.
 * load_snapshot keeps the 28-day packet the decision was taken against.
 */
export const clearances = pgTable('clearances', {
  id: uuid('id').primaryKey().defaultRandom(),
  injuryId: uuid('injury_id')
    .notNull()
    .references(() => injuries.id, { onDelete: 'cascade' }),
  signedBy: uuid('signed_by')
    .notNull()
    .references(() => users.id),
  signedAt: timestamp('signed_at', { withTimezone: true }).notNull().defaultNow(),
  revokedAt: timestamp('revoked_at', { withTimezone: true }),
  notes: text('notes'),
  loadSnapshot: jsonb('load_snapshot').$type<LoadSnapshot>(),
});
