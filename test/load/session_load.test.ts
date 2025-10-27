import { describe, expect, it } from 'vitest';
import { heartRateReserveFraction, sessionLoad } from '../../src/domain/load/session_load.js';

describe('sessionLoad', () => {
  it('uses session RPE when the athlete gave us an effort', () => {
    expect(
      sessionLoad({ durationS: 3600, distanceM: 12_000, avgHr: 150, perceivedEffort: 6 }),
    ).toBe(360);
  });

  it('falls back to heart rate when there is no effort', () => {
    const load = sessionLoad({
      durationS: 3600,
      distanceM: 12_000,
      avgHr: 150,
      perceivedEffort: null,
      restingHr: 50,
      maxHr: 190,
    });
    // (150-50)/(190-50) = 0.7143 reserve, so 1 + 0.7143*9 = 7.4286 on the
    // effort axis, across 60 minutes.
    expect(load).toBeCloseTo(445.71, 2);
  });

  it('falls back to distance when that is all there is', () => {
    expect(sessionLoad({ durationS: null, distanceM: 10_000, avgHr: null, perceivedEffort: null })).toBe(70);
  });

  it('returns nothing when the session says nothing', () => {
    expect(sessionLoad({ durationS: null, distanceM: null, avgHr: null, perceivedEffort: null })).toBeNull();
  });

  it('ignores heart rate without a reserve to put it against', () => {
    expect(
      sessionLoad({ durationS: 3600, distanceM: 5000, avgHr: 150, perceivedEffort: null }),
    ).toBe(35);
  });
});
