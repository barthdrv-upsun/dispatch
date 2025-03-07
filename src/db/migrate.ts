import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import postgres from 'postgres';
import { databaseUrl } from './client.js';

const here = path.dirname(fileURLToPath(import.meta.url));

export async function runMigrations(): Promise<void> {
  const sql = postgres(databaseUrl(), { max: 1 });
  try {
    await migrate(drizzle(sql), { migrationsFolder: path.join(here, 'migrations') });
  } finally {
    await sql.end({ timeout: 5 });
  }
}

const invokedDirectly = process.argv[1] !== undefined && import.meta.url.endsWith(path.basename(process.argv[1]));

if (invokedDirectly) {
  runMigrations().then(
    () => {
      console.log('migrations applied');
    },
    (err: unknown) => {
      console.error(err);
      process.exit(1);
    },
  );
}
