import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { StravaActivity, StravaWebhookEvent } from '../../legacy/ingest/types.js';

const fixtureDir = path.join(path.dirname(fileURLToPath(import.meta.url)), 'fixtures');

export type TokenFixture = {
  clients: Array<{ client_id: string; client_secret: string }>;
  athletes: Array<{
    strava_athlete_id: number;
    refresh_token: string;
    access_token: string;
    scope: string;
  }>;
};

function read<T>(name: string): T {
  const raw = fs.readFileSync(path.join(fixtureDir, name), 'utf8');
  return JSON.parse(raw) as T;
}

/**
 * Recorded off the real API in July 2025 and then frozen. Nothing here is
 * fetched at runtime, so the double answers the same way on every machine.
 */
export function recordedActivities(): StravaActivity[] {
  return read<StravaActivity[]>('athlete_activities.json');
}

export function recordedTokens(): TokenFixture {
  return read<TokenFixture>('tokens.json');
}
