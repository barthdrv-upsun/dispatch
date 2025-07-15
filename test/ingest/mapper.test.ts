import { describe, expect, it } from 'vitest';
import { ActivityMapper, looksLikeTreadmill } from '../../src/ingest/activity_mapper.js';
import { recordedActivities } from '../../src/fakes/strava/fixtures.js';
import type { StravaActivity } from '../../src/ingest/types.js';

const mapper = new ActivityMapper('UTC');

function fixture(id: number): StravaActivity {
  const found = recordedActivities().find((activity) => activity.id === id);
  if (!found) {
    throw new Error('no recorded activity ' + String(id));
  }
  return found;
}
