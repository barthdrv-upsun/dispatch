import { boolean, pgEnum, pgTable, primaryKey, text, timestamp, uuid } from 'drizzle-orm/pg-core';

export const squadRole = pgEnum('squad_role', ['head_coach', 'assistant_coach', 'physio', 'athlete']);
