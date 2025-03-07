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

export function getDb(): Database {
  if (!db) {
    sql = postgres(databaseUrl(), { max: 8 });
    db = drizzle(sql, { schema });
  }
  return db;
}

export async function closeDb(): Promise<void> {
  if (sql) {
    await sql.end({ timeout: 5 });
    sql = undefined;
    db = undefined;
  }
}
