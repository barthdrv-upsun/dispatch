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

describe('map', () => {
  it('maps a recorded run', () => {
    const result = mapper.map('athlete-a', fixture(14880010), 'Europe/Berlin');
    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    expect(result.session.athleteId).toBe('athlete-a');
    expect(result.session.completedAt.toISOString()).toBe('2025-07-01T05:42:11.000Z');
    expect(result.session.distanceM).toBe(10_240);
    expect(result.session.durationS).toBe(3120);
    expect(result.session.avgHr).toBe(138);
    expect(result.session.source).toBe('strava');
    expect(result.session.localDate).toBe('2025-07-01');
  });

  it('puts a late-evening run on the athlete\'s own day', () => {
    const result = mapper.map('athlete-a', fixture(14880018), 'Europe/Berlin');
    expect(result.ok && result.session.localDate).toBe('2025-07-10');
    const auckland = mapper.map('athlete-a', fixture(14880018), 'Pacific/Auckland');
    expect(auckland.ok && auckland.session.localDate).toBe('2025-07-11');
  });

  it('turns down a ride', () => {
    const result = mapper.map('athlete-a', fixture(14880013), 'Europe/Berlin');
    expect(result.ok).toBe(false);
    expect(!result.ok && result.failure.reason).toBe('not a run');
  });

  it('turns down a payload with no id', () => {
    const result = mapper.map('athlete-a', { sport_type: 'Run', start_date: '2025-07-01T05:00:00Z' });
    expect(!result.ok && result.failure.reason).toBe('activity has no id');
  });

  it('turns down an empty payload and a missing athlete', () => {
    expect(mapper.map('athlete-a', null).ok).toBe(false);
    expect(mapper.map('', fixture(14880010)).ok).toBe(false);
  });

  it('turns down a run with no usable start time', () => {
    const result = mapper.map('athlete-a', { id: 1, sport_type: 'Run' });
    expect(!result.ok && result.failure.reason).toBe('activity has no usable start time');
  });

  it('survives the record with holes in it', () => {
    const result = mapper.map('athlete-a', fixture(14880026), 'Europe/Berlin');
    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    expect(result.session.distanceM).toBeNull();
    // The watch reported 4bpm, which is not a heart rate.
    expect(result.session.avgHr).toBeNull();
    // moving_time was missing, so elapsed_time stood in.
    expect(result.session.durationS).toBe(2880);
  });

  it('pulls the IANA name out of Strava\'s timezone string', () => {
    expect(mapper.stravaZone({ timezone: '(GMT+01:00) Europe/Berlin' })).toBe('Europe/Berlin');
    expect(mapper.stravaZone({ timezone: 'nonsense' })).toBeNull();
    expect(mapper.stravaZone({})).toBeNull();
  });

  it('discards a perceived exertion outside the scale', () => {
    expect(mapper.readEffort(11)).toBeNull();
    expect(mapper.readEffort(0)).toBeNull();
    expect(mapper.readEffort(7)).toBe(7);
    expect(mapper.readEffort(undefined)).toBeNull();
  });

  it('discards a heart rate no chest strap ever meant', () => {
    expect(mapper.readHeartRate(4)).toBeNull();
    expect(mapper.readHeartRate(250)).toBeNull();
    expect(mapper.readHeartRate(142.4)).toBe(142);
  });

  it('falls back to the wall-clock start when there is no UTC one', () => {
    const result = mapper.map(
      'athlete-a',
      { id: 99, sport_type: 'Run', start_date_local: '2025-07-01T07:42:11Z', moving_time: 1800 },
      'Europe/Berlin',
    );
    expect(result.ok && result.session.completedAt.toISOString()).toBe('2025-07-01T05:42:11.000Z');
  });
});

describe('looksLikeTreadmill', () => {
  it('spots the trainer flag', () => {
    expect(looksLikeTreadmill({ id: 1, sport_type: 'Run', trainer: true })).toBe(true);
  });

  it('spots the virtual sport types', () => {
    expect(looksLikeTreadmill({ id: 1, sport_type: 'VirtualRun' })).toBe(true);
    expect(looksLikeTreadmill(fixture(14880019))).toBe(true);
  });

  it('leaves an outdoor run alone', () => {
    expect(looksLikeTreadmill(fixture(14880010))).toBe(false);
    expect(looksLikeTreadmill(null)).toBe(false);
  });
});
