import { closeDb, getDb } from './db/client.js';
import { createRepositories } from './db/repos/index.js';
import { systemClock } from './lib/clock.js';
import { sessionLoad } from './domain/load/session_load.js';
import { IngestService } from './legacy/ingest/ingest_service.js';
import { PgIngestStore } from './legacy/ingest/pg_store.js';
import { StravaClient } from './legacy/ingest/strava_client.js';
import { WebhookProcessor } from './legacy/ingest/webhook.js';
import { buildApp } from './server.js';

/**
 * The real wiring: Postgres behind the ports, the local Strava double behind
 * the ingest path, the system clock behind the two modules that take one.
 *
 * STRAVA_BASE_URL points at src/fakes/strava. There is no configuration in
 * this repository that points anywhere else.
 */
function buildIngest(db: ReturnType<typeof getDb>) {
  const client = new StravaClient({
    baseUrl: process.env.STRAVA_BASE_URL ?? 'http://127.0.0.1:4010',
    clientId: process.env.STRAVA_CLIENT_ID ?? 'pacenote-local',
    clientSecret: process.env.STRAVA_CLIENT_SECRET ?? 'not-a-real-secret',
  });
  const store = new PgIngestStore(db);
  const service = new IngestService({
    client,
    store,
    defaultTimezone: 'Europe/Berlin',
    loadFor: (session) =>
      sessionLoad({
        durationS: session.durationS,
        distanceM: session.distanceM,
        avgHr: session.avgHr,
        perceivedEffort: session.perceivedEffort,
      }),
  });
  return { service, webhook: new WebhookProcessor({ client, store, ingest: service }) };
}

export async function main(): Promise<void> {
  const db = getDb();
  const app = buildApp(
    { repos: createRepositories(db), clock: systemClock },
    { logger: true, ingest: buildIngest(db) },
  );

  const port = Number.parseInt(process.env.PORT ?? '3000', 10);
  await app.listen({ port, host: '0.0.0.0' });

  for (const signal of ['SIGINT', 'SIGTERM'] as const) {
    process.once(signal, () => {
      void app.close().then(closeDb);
    });
  }
}

main().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});
