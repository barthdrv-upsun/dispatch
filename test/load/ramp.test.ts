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
