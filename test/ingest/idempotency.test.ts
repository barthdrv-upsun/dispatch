import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { AddressInfo } from 'node:net';
import type { FastifyInstance } from 'fastify';
import { buildFakeStrava } from '../../src/fakes/strava/server.js';
import { recordedDeliveries } from '../../src/fakes/strava/fixtures.js';
import { IngestService } from '../../src/ingest/ingest_service.js';
import { StravaClient } from '../../src/ingest/strava_client.js';
import { WebhookProcessor } from '../../src/ingest/webhook.js';
import type { AthleteLink, IngestOutcome } from '../../src/ingest/types.js';
import { MemoryIngestStore } from '../helpers/memory_ingest_store.js';

let fake: FastifyInstance;
let baseUrl: string;

beforeAll(async () => {
  fake = buildFakeStrava();
  await fake.listen({ port: 0, host: '127.0.0.1' });
  const address = fake.server.address() as AddressInfo;
  baseUrl = `http://127.0.0.1:${String(address.port)}`;
});

afterAll(async () => {
  await fake.close();
});

function link(athleteId: string, stravaAthleteId: number, timezone: string): AthleteLink {
  return {
    athleteId,
    stravaAthleteId,
    accessToken: `local-access-${String(stravaAthleteId)}`,
    refreshToken: `local-refresh-${String(stravaAthleteId)}`,
    expiresAt: new Date('2030-01-01T00:00:00Z'),
    scope: 'read,activity:read_all',
    timezone,
  };
}

function harness() {
  const store = new MemoryIngestStore();
  store.addLink(link('athlete-a', 7311001, 'Europe/Berlin'));
  store.addLink(link('athlete-b', 7311002, 'Pacific/Auckland'));
  const client = new StravaClient({
    baseUrl,
    clientId: 'pacenote-local',
    clientSecret: 'not-a-real-secret',
  });
  const ingest = new IngestService({ client, store });
  const webhook = new WebhookProcessor({ client, store, ingest });
  return { store, webhook };
}

function replay(webhook: WebhookProcessor, events: ReturnType<typeof recordedDeliveries>) {
  return new Promise<IngestOutcome[]>((resolve, reject) => {
    webhook.handleAll(events, (err, outcomes) => {
      if (err || !outcomes) {
        reject(err ?? new Error('no outcomes'));
        return;
      }
      resolve(outcomes);
    });
  });
}

/** R6. */
describe('replaying the recorded delivery log', () => {
  it('writes each activity exactly once', async () => {
    const { store, webhook } = harness();
    const outcomes = await replay(webhook, recordedDeliveries());

    const ingested = outcomes.filter((outcome) => outcome.status === 'ingested');
    const duplicates = outcomes.filter((outcome) => outcome.status === 'duplicate');

    expect(ingested.map((outcome) => outcome.stravaActivityId).sort()).toEqual([
      14880011, 14880014, 14880020,
    ]);
    expect(duplicates.map((outcome) => outcome.stravaActivityId).sort()).toEqual([14880011, 14880014]);
    expect(store.sessions).toHaveLength(3);
  });

  it('is a no-op the second time the whole log arrives', async () => {
    const { store, webhook } = harness();
    await replay(webhook, recordedDeliveries());
    const second = await replay(webhook, recordedDeliveries());

    expect(second.some((outcome) => outcome.status === 'ingested')).toBe(false);
    expect(store.sessions).toHaveLength(3);
  });

  it('does not double-count the load when the same activity arrives twice', async () => {
    const { store, webhook } = harness();
    await replay(webhook, recordedDeliveries());

    const forActivity = store.sessions.filter((session) => session.stravaActivityId === 14880011);
    expect(forActivity).toHaveLength(1);
  });

  it('turns down the deliveries it should turn down', async () => {
    const { webhook } = harness();
    const outcomes = await replay(webhook, recordedDeliveries());
    const skipped = outcomes.filter((outcome) => outcome.status === 'skipped');
    const reasons = skipped.map((outcome) => outcome.reason);

    expect(reasons).toContain('not a run');
    expect(reasons).toContain('aspect_type delete');
    expect(reasons).toContain('object_type athlete');
    expect(reasons).toContain('activity not found on strava');
  });
});
