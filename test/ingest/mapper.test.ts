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

describe('isRun', () => {
  it('takes every shape of run', () => {
    expect(mapper.isRun({ sport_type: 'Run' })).toBe(true);
    expect(mapper.isRun({ sport_type: 'TrailRun' })).toBe(true);
    expect(mapper.isRun({ sport_type: 'VirtualRun' })).toBe(true);
  });

  it('leaves everything else on Strava\'s side', () => {
    expect(mapper.isRun({ sport_type: 'Ride' })).toBe(false);
    expect(mapper.isRun({ sport_type: 'Swim' })).toBe(false);
    expect(mapper.isRun({ sport_type: 'WeightTraining' })).toBe(false);
  });

  it('falls back to the older type field', () => {
    expect(mapper.isRun({ type: 'Run' })).toBe(true);
  });

  it('says no to nothing at all', () => {
    expect(mapper.isRun(null)).toBe(false);
    expect(mapper.isRun({})).toBe(false);
  });
});
