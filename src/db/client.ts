import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema.js';

export type Database = ReturnType<typeof drizzle<typeof schema>>;

let sql: ReturnType<typeof postgres> | undefined;
let db: Database | undefined;

export function databaseUrl(): string {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error('DATABASE_URL is not set (see .env.example)');
  }
  return url;
}
