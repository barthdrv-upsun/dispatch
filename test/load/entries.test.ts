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
