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
