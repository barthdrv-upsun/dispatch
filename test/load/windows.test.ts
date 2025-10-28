import { expect, it } from 'vitest';
import {
  ACUTE_DAYS,
  CHRONIC_DAYS,
  computeAcuteLoad,
  computeChronicLoad,
  rollingWindow,
  windowContains,
} from '../../src/domain/load/windows.js';

const entries = [
  { localDate: '2025-10-01', load: 999 },
  { localDate: '2025-10-20', load: 50 },
  { localDate: '2025-11-01', load: 40 },
  { localDate: '2025-11-03', load: 60 },
  { localDate: '2025-11-05', load: 80 },
  { localDate: '2025-11-08', load: 100 },
  { localDate: '2025-11-09', load: 30 },
];

it('sums the loads inside the acute window', () => {
  expect(computeAcuteLoad(entries, rollingWindow('2025-11-09', ACUTE_DAYS))).toBe(270);
});

it('divides the 28-day sum by four so the two are comparable', () => {
  expect(computeChronicLoad(entries, rollingWindow('2025-11-09', CHRONIC_DAYS))).toBe(90);
});

// @P:m08.A

it('builds an inclusive rolling window', () => {
  const window = rollingWindow('2025-11-09', 7);
  expect(window).toEqual({ from: '2025-11-03', to: '2025-11-09' });
  expect(windowContains(window, '2025-11-03')).toBe(true);
  expect(windowContains(window, '2025-11-02')).toBe(false);
});
