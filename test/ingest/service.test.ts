import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { StravaClient, type JsonTransport } from '../../src/legacy/ingest/strava_client.js';
import { IngestService } from '../../src/legacy/ingest/ingest_service.js';
import { MemoryIngestStore } from '../helpers/memory_ingest_store.js';
import type { AthleteLink, IngestSummary, StravaActivity } from '../../src/legacy/ingest/types.js';
import { sessionLoad } from '../../src/domain/load/session_load.js';

const NOW = '2025-07-15T09:00:00Z';

function link(overrides: Partial<AthleteLink> = {}): AthleteLink {
  return {
    athleteId: 'athlete-a',
    stravaAthleteId: 7311001,
    accessToken: 'local-access-7311001',
    refreshToken: 'local-refresh-7311001',
    expiresAt: new Date('2025-07-15T15:00:00Z'),
    scope: 'read,activity:read_all',
    timezone: 'Europe/Berlin',
    ...overrides,
  };
}

function run(id: number, startDate: string): StravaActivity {
  return {
    id,
    sport_type: 'Run',
    start_date: startDate,
    distance: 10_000,
    moving_time: 3000,
    average_heartrate: 142,
    perceived_exertion: 4,
  };
}

/** A transport that answers from a script rather than a socket. */
function scriptedTransport(handlers: {
  activities?: StravaActivity[];
  token?: Record<string, unknown>;
  calls?: string[];
}): JsonTransport {
  return (method, url, _headers, _body, cb) => {
    handlers.calls?.push(`${method} ${url.replace(/^https?:\/\/[^/]+/, '')}`);
    if (url.includes('/oauth/token')) {
      cb(null, {
        status: 200,
        body: handlers.token ?? {
          access_token: 'local-access-7311001-rotated',
          refresh_token: 'local-refresh-7311001',
          expires_at: Math.floor(new Date('2025-07-15T21:00:00Z').getTime() / 1000),
        },
      });
      return;
    }
    if (url.includes('/athlete/activities')) {
      cb(null, { status: 200, body: handlers.activities ?? [] });
      return;
    }
    cb(new Error('unexpected request ' + url));
  };
}

function sync(service: IngestService, athleteId: string): Promise<IngestSummary> {
  return new Promise((resolve, reject) => {
    service.syncAthlete(athleteId, (err, summary) => {
      if (err || !summary) {
        reject(err ?? new Error('no summary'));
        return;
      }
      resolve(summary);
    });
  });
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date(NOW));
});

afterEach(() => {
  vi.useRealTimers();
});

describe('syncAthlete', () => {
  it('ingests the runs and skips everything else', async () => {
    const store = new MemoryIngestStore();
    store.addLink(link());
    const transport = scriptedTransport({
      activities: [
        run(1, '2025-07-14T05:00:00Z'),
        { id: 2, sport_type: 'Ride', start_date: '2025-07-14T16:00:00Z', distance: 20_000, moving_time: 3000 },
        run(3, '2025-07-13T05:00:00Z'),
      ],
    });
    const service = new IngestService({
      client: new StravaClient({ baseUrl: 'http://strava.test', clientId: 'x', clientSecret: 'y', transport }),
      store,
    });

    const summary = await sync(service, 'athlete-a');
    expect(summary.considered).toBe(3);
    expect(summary.ingested).toBe(2);
    expect(summary.skipped).toBe(1);
    expect(summary.duplicates).toBe(0);
    expect(store.sessions).toHaveLength(2);
    expect(summary.outcomes.find((outcome) => outcome.stravaActivityId === 2)?.reason).toBe('not a run');
  });

  it('reports a replayed activity as a duplicate rather than writing it twice', async () => {
    const store = new MemoryIngestStore();
    store.addLink(link());
    const transport = scriptedTransport({ activities: [run(1, '2025-07-14T05:00:00Z')] });
    const service = new IngestService({
      client: new StravaClient({ baseUrl: 'http://strava.test', clientId: 'x', clientSecret: 'y', transport }),
      store,
    });

    const first = await sync(service, 'athlete-a');
    const second = await sync(service, 'athlete-a');
    expect(first.ingested).toBe(1);
    expect(second.ingested).toBe(0);
    expect(second.duplicates).toBe(1);
    expect(store.sessions).toHaveLength(1);
  });

  it('works out the load for each session it writes', async () => {
    const store = new MemoryIngestStore();
    store.addLink(link());
    const transport = scriptedTransport({ activities: [run(1, '2025-07-14T05:00:00Z')] });
    const service = new IngestService({
      client: new StravaClient({ baseUrl: 'http://strava.test', clientId: 'x', clientSecret: 'y', transport }),
      store,
      loadFor: (session) =>
        sessionLoad({
          durationS: session.durationS,
          distanceM: session.distanceM,
          avgHr: session.avgHr,
          perceivedEffort: session.perceivedEffort,
        }),
    });

    await sync(service, 'athlete-a');
    expect(store.sessions[0]?.load).toBe(200);
  });

  it('buckets the session on the athlete\'s own day', async () => {
    const store = new MemoryIngestStore();
    store.addLink(link({ timezone: 'Pacific/Auckland' }));
    const transport = scriptedTransport({ activities: [run(1, '2025-07-14T20:40:00Z')] });
    const service = new IngestService({
      client: new StravaClient({ baseUrl: 'http://strava.test', clientId: 'x', clientSecret: 'y', transport }),
      store,
    });

    await sync(service, 'athlete-a');
    expect(store.sessions[0]?.localDate).toBe('2025-07-15');
  });

  /** The token path reads the wall clock directly, hence the fake timers. */
  it('leaves a token alone while it has life in it', async () => {
    const store = new MemoryIngestStore();
    store.addLink(link({ expiresAt: new Date('2025-07-15T15:00:00Z') }));
    const calls: string[] = [];
    const transport = scriptedTransport({ activities: [], calls });
    const service = new IngestService({
      client: new StravaClient({ baseUrl: 'http://strava.test', clientId: 'x', clientSecret: 'y', transport }),
      store,
    });

    await sync(service, 'athlete-a');
    expect(calls.some((call) => call.includes('/oauth/token'))).toBe(false);
    expect(store.updates).toHaveLength(0);
  });

  it('refreshes a token that is about to expire, and keeps the new one', async () => {
    const store = new MemoryIngestStore();
    store.addLink(link({ expiresAt: new Date('2025-07-15T09:01:00Z') }));
    const calls: string[] = [];
    const transport = scriptedTransport({ activities: [], calls });
    const service = new IngestService({
      client: new StravaClient({ baseUrl: 'http://strava.test', clientId: 'x', clientSecret: 'y', transport }),
      store,
    });

    await sync(service, 'athlete-a');
    expect(calls[0]).toBe('POST /oauth/token');
    expect(store.updates).toHaveLength(1);
    expect(store.links.get('athlete-a')?.accessToken).toBe('local-access-7311001-rotated');
  });

  it('gives up on an athlete with no strava link', async () => {
    const store = new MemoryIngestStore();
    const service = new IngestService({
      client: new StravaClient({
        baseUrl: 'http://strava.test',
        clientId: 'x',
        clientSecret: 'y',
        transport: scriptedTransport({}),
      }),
      store,
    });
    await expect(sync(service, 'athlete-none')).rejects.toThrow('no strava link');
  });

  it('gives up when the refresh comes back without a token', async () => {
    const store = new MemoryIngestStore();
    store.addLink(link({ expiresAt: new Date('2025-07-15T09:01:00Z') }));
    const service = new IngestService({
      client: new StravaClient({
        baseUrl: 'http://strava.test',
        clientId: 'x',
        clientSecret: 'y',
        transport: scriptedTransport({ token: {} }),
      }),
      store,
    });
    await expect(sync(service, 'athlete-a')).rejects.toThrow('without an access token');
  });
});

describe('a batch with nothing usable in it', () => {
  it('reports what it considered and writes nothing', async () => {
    const store = new MemoryIngestStore();
    store.addLink(link());
    const transport = scriptedTransport({
      activities: [
        { id: 10, sport_type: 'Ride', start_date: '2025-07-14T05:00:00Z' },
        { id: 11, sport_type: 'Run' },
        { sport_type: 'Run', start_date: '2025-07-14T05:00:00Z' },
      ],
    });
    const service = new IngestService({
      client: new StravaClient({ baseUrl: 'http://strava.test', clientId: 'x', clientSecret: 'y', transport }),
      store,
    });

    const summary = await sync(service, 'athlete-a');
    expect(summary.considered).toBe(3);
    expect(summary.skipped).toBe(3);
    expect(store.sessions).toHaveLength(0);
  });
});
