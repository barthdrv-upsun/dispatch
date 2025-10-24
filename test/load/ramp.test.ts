import { describe, expect, it } from 'vitest';
import {
  assessRamp,
  rampCeilingM,
  rampHeadroomM,
  RAMP_CAP,
  rollingVolumeM,
} from '../../src/domain/load/ramp.js';
import { rollingWindow } from '../../src/domain/load/windows.js';

/** Two weeks of volume, Monday 2026-05-04 through Sunday 2026-05-17. */
const twoWeeks = [
  { localDate: '2026-05-04', distanceM: 10_000 },
  { localDate: '2026-05-06', distanceM: 12_000 },
  { localDate: '2026-05-09', distanceM: 18_000 },
  { localDate: '2026-05-11', distanceM: 10_000 },
  { localDate: '2026-05-13', distanceM: 12_000 },
  { localDate: '2026-05-16', distanceM: 18_000 },
];

describe('rollingVolumeM', () => {
  it('adds up the days inside the window', () => {
    expect(rollingVolumeM(twoWeeks, rollingWindow('2026-05-10', 7))).toBe(40_000);
  });

  it('counts nothing outside it', () => {
    expect(rollingVolumeM(twoWeeks, rollingWindow('2026-05-03', 7))).toBe(0);
  });
});

describe('assessRamp', () => {
  it('accepts a week that matches the one before it', () => {
    const verdict = assessRamp(twoWeeks, '2026-05-17');
    expect(verdict.currentM).toBe(40_000);
    expect(verdict.previousM).toBe(40_000);
    expect(verdict.ratio).toBe(1);
    expect(verdict.withinCap).toBe(true);
  });

  it('accepts exactly ten per cent more', () => {
    const entries = [
      { localDate: '2026-05-04', distanceM: 40_000 },
      { localDate: '2026-05-11', distanceM: 44_000 },
    ];
    const verdict = assessRamp(entries, '2026-05-17');
    expect(verdict.ratio).toBe(RAMP_CAP);
    expect(verdict.withinCap).toBe(true);
  });

  it('refuses more than ten per cent', () => {
    const entries = [
      { localDate: '2026-05-04', distanceM: 40_000 },
      { localDate: '2026-05-11', distanceM: 48_000 },
    ];
    const verdict = assessRamp(entries, '2026-05-17');
    expect(verdict.ratio).toBe(1.2);
    expect(verdict.withinCap).toBe(false);
  });

  it('does not bite when there is no previous week to exceed', () => {
    const verdict = assessRamp([{ localDate: '2026-05-11', distanceM: 60_000 }], '2026-05-17');
    expect(verdict.previousM).toBe(0);
    expect(verdict.withinCap).toBe(true);
  });
});

describe('rampCeilingM', () => {
  it('is ten per cent over last week', () => {
    expect(rampCeilingM(40_000)).toBe(44_000);
  });
});
