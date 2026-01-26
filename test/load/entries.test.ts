import { describe, expect, it } from 'vitest';
import {
  isHardRunningKind,
  isRunningKind,
  toRunningLoadEntries,
  toRunningVolumeEntries,
  type SessionForLoad,
} from '../../src/domain/load/entries.js';
import { assessRest } from '../../src/domain/load/rest.js';
import { computeChronicLoad } from '../../src/domain/load/windows.js';

function session(overrides: Partial<SessionForLoad>): SessionForLoad {
  return {
    completedAt: new Date('2026-05-04T06:00:00Z'),
    load: 60,
    distanceM: 10_000,
    templateKind: 'easy',
    ...overrides,
  };
}

describe('running kinds', () => {
  it('knows which kinds put a runner on their feet', () => {
    expect(isRunningKind('easy')).toBe(true);
    expect(isRunningKind('long')).toBe(true);
    expect(isRunningKind(null)).toBe(false);
    expect(isRunningKind('nonsense')).toBe(false);
  });

  it('knows which of those are hard', () => {
    expect(isHardRunningKind('interval')).toBe(true);
    expect(isHardRunningKind('easy')).toBe(false);
  });
});

describe('toRunningLoadEntries', () => {
  it('adds up two sessions that fall on the same local day', () => {
    const entries = toRunningLoadEntries(
      [
        session({ completedAt: new Date('2026-05-04T05:30:00Z'), load: 40 }),
        session({ completedAt: new Date('2026-05-04T16:30:00Z'), load: 25 }),
      ],
      'Europe/Berlin',
    );
    expect(entries).toEqual([{ localDate: '2026-05-04', load: 65 }]);
  });

  it('skips sessions that were never completed', () => {
    const entries = toRunningLoadEntries([session({ completedAt: null })], 'Europe/Berlin');
    expect(entries).toEqual([]);
  });

  it('takes a session with no template behind it as a run', () => {
    const entries = toRunningLoadEntries([session({ templateKind: null, load: 30 })], 'Europe/Berlin');
    expect(entries).toEqual([{ localDate: '2026-05-04', load: 30 }]);
  });

  it('reads numeric load that arrives as a string', () => {
    const entries = toRunningLoadEntries([session({ load: '42.50' })], 'Europe/Berlin');
    expect(entries[0]?.load).toBe(42.5);
  });

  it('returns the days in order', () => {
    const entries = toRunningLoadEntries(
      [
        session({ completedAt: new Date('2026-05-06T06:00:00Z'), load: 10 }),
        session({ completedAt: new Date('2026-05-04T06:00:00Z'), load: 20 }),
        session({ completedAt: new Date('2026-05-05T06:00:00Z'), load: 30 }),
      ],
      'Europe/Berlin',
    );
    expect(entries.map((entry) => entry.localDate)).toEqual(['2026-05-04', '2026-05-05', '2026-05-06']);
  });
});

describe('toRunningVolumeEntries', () => {
  it('buckets distance the same way load is bucketed', () => {
    const entries = toRunningVolumeEntries(
      [
        session({ completedAt: new Date('2026-05-04T05:30:00Z'), distanceM: 8000 }),
        session({ completedAt: new Date('2026-05-04T16:30:00Z'), distanceM: 6000 }),
      ],
      'Europe/Berlin',
    );
    expect(entries).toEqual([{ localDate: '2026-05-04', distanceM: 14_000 }]);
  });

  it('treats a missing distance as nothing run', () => {
    const entries = toRunningVolumeEntries([session({ distanceM: null })], 'Europe/Berlin');
    expect(entries).toEqual([{ localDate: '2026-05-04', distanceM: 0 }]);
  });
});

/**
 * The travelling-athlete case. Same sessions, same instants; the only thing
 * that changes is the zone the athlete is living in, and that is enough to
 * move a run into another day and to move the windows that touch it.
 */
describe('an athlete who changes timezone mid-block', () => {
  const sessions = [
    session({ completedAt: new Date('2026-05-04T20:40:00Z'), load: 55, distanceM: 12_000 }),
    session({ completedAt: new Date('2026-05-05T05:10:00Z'), load: 45, distanceM: 9000 }),
    session({ completedAt: new Date('2026-05-07T05:15:00Z'), load: 70, distanceM: 15_000 }),
  ];

  it('moves a late-evening run into a different local day', () => {
    const berlin = toRunningLoadEntries(sessions, 'Europe/Berlin');
    const auckland = toRunningLoadEntries(sessions, 'Pacific/Auckland');

    // 20:40Z is 22:40 in Berlin - still the 4th - but 08:40 on the 5th in
    // Auckland, where it lands on the same day as the next morning's run.
    expect(berlin).toEqual([
      { localDate: '2026-05-04', load: 55 },
      { localDate: '2026-05-05', load: 45 },
      { localDate: '2026-05-07', load: 70 },
    ]);
    expect(auckland).toEqual([
      { localDate: '2026-05-05', load: 100 },
      { localDate: '2026-05-07', load: 70 },
    ]);
  });

  it('shifts every rolling window that touches the moved day', () => {
    const berlin = toRunningLoadEntries(sessions, 'Europe/Berlin');
    const auckland = toRunningLoadEntries(sessions, 'Pacific/Auckland');

    // A four-week window ending on the 4th sees the evening run in Berlin and
    // does not see it at all in Auckland, where it happened on the 5th.
    expect(computeChronicLoad(berlin, '2026-05-04')).toBe(13.75);
    expect(computeChronicLoad(auckland, '2026-05-04')).toBe(0);
  });

  it('moves which days count as rest', () => {
    const berlin = toRunningLoadEntries(sessions, 'Europe/Berlin');
    const auckland = toRunningLoadEntries(sessions, 'Pacific/Auckland');

    expect(assessRest(berlin, '2026-05-07').restDays).not.toContain('2026-05-04');
    expect(assessRest(auckland, '2026-05-07').restDays).toContain('2026-05-04');
  });

  it('re-buckets the volume as well as the load', () => {
    expect(toRunningVolumeEntries(sessions, 'Europe/Berlin')).toEqual([
      { localDate: '2026-05-04', distanceM: 12_000 },
      { localDate: '2026-05-05', distanceM: 9000 },
      { localDate: '2026-05-07', distanceM: 15_000 },
    ]);
    expect(toRunningVolumeEntries(sessions, 'Pacific/Auckland')).toEqual([
      { localDate: '2026-05-05', distanceM: 21_000 },
      { localDate: '2026-05-07', distanceM: 15_000 },
    ]);
  });
});
