import { boolean, pgEnum, pgTable, primaryKey, text, timestamp, uuid } from 'drizzle-orm/pg-core';

export const squadRole = pgEnum('squad_role', ['head_coach', 'assistant_coach', 'physio', 'athlete']);

export const squads = pgTable('squads', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  timezone: text('timezone').notNull(),
  active: boolean('active').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  email: text('email').notNull().unique(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

/**
 * A user holds one role per squad. A physio is granted a row per squad they
 * cover, which is how a single physio ends up working across squads.
 */
export const userRoles = pgTable(
  'user_roles',
  {
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    squadId: uuid('squad_id')
      .notNull()
      .references(() => squads.id, { onDelete: 'cascade' }),
    role: squadRole('role').notNull(),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.userId, t.squadId, t.role] }),
  }),
);
