import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { StravaClient, type JsonTransport } from '../../src/ingest/strava_client.js';
import { IngestService } from '../../src/ingest/ingest_service.js';
import { MemoryIngestStore } from '../helpers/memory_ingest_store.js';
import type { AthleteLink, IngestSummary, StravaActivity } from '../../src/ingest/types.js';
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
