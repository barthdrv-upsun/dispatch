import { bigint, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { athletes } from './athletes.js';
import { sessions } from './sessions.js';

/**
 * Tokens for the local Strava double. Nothing in this table ever reaches
 * strava.com; the fake mints its own opaque strings.
 */
export const stravaLinks = pgTable('strava_links', {
  athleteId: uuid('athlete_id')
    .primaryKey()
    .references(() => athletes.id, { onDelete: 'cascade' }),
  stravaAthleteId: bigint('strava_athlete_id', { mode: 'number' }).notNull(),
  accessToken: text('access_token').notNull(),
  refreshToken: text('refresh_token').notNull(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  scope: text('scope').notNull(),
});

export const stravaActivities = pgTable('strava_activities', {
  id: uuid('id').primaryKey().defaultRandom(),
  athleteId: uuid('athlete_id')
    .notNull()
    .references(() => athletes.id, { onDelete: 'cascade' }),
  stravaActivityId: bigint('strava_activity_id', { mode: 'number' }).notNull().unique(),
  ingestedAt: timestamp('ingested_at', { withTimezone: true }).notNull().defaultNow(),
  sessionId: uuid('session_id').references(() => sessions.id, { onDelete: 'set null' }),
});
