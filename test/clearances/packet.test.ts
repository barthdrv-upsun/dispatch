import { describe, expect, it } from 'vitest';
import { buildClearancePacket, PACKET_DAYS } from '../../src/domain/clearances/packet.js';
import type { Injury } from '../../src/domain/clearances/types.js';

const ASOF = '2026-05-20';

const injury: Injury = {
  id: 'injury-1',
  athleteId: 'athlete-a',
  region: 'left achilles',
  onsetOn: '2026-05-10',
  severity: 6,
  notes: null,
  resolvedOn: null,
};

function packet(overrides: Partial<Parameters<typeof buildClearancePacket>[0]> = {}) {
  return buildClearancePacket({
    athleteId: 'athlete-a',
    asOf: ASOF,
    loadEntries: [],
    sleepLogs: [],
    injuries: [],
    ...overrides,
  });
}

describe('buildClearancePacket', () => {
  it('covers 28 days ending on the day asked about', () => {
    const built = packet();
    expect(PACKET_DAYS).toBe(28);
    expect(built.days).toHaveLength(28);
    expect(built.days[0]?.localDate).toBe('2026-04-23');
    expect(built.days[27]?.localDate).toBe(ASOF);
  });

  it('gives a day with nothing recorded a row of its own', () => {
    const built = packet();
    expect(built.days[5]).toEqual({ localDate: '2026-04-28', load: 0, sleepHours: null, pain: null });
  });

  it('puts the running load on the right day', () => {
    const built = packet({ loadEntries: [{ localDate: '2026-05-18', load: 62.5 }] });
    expect(built.days.find((day) => day.localDate === '2026-05-18')?.load).toBe(62.5);
    expect(built.totals.runningLoad).toBe(62.5);
  });

  it('ignores load from before the window', () => {
    const built = packet({ loadEntries: [{ localDate: '2026-04-01', load: 500 }] });
    expect(built.totals.runningLoad).toBe(0);
  });

  it('reads sleep hours that arrive as strings', () => {
    const built = packet({
      sleepLogs: [
        { localDate: '2026-05-18', hours: '7.50' },
        { localDate: '2026-05-19', hours: 6.5 },
      ],
    });
    expect(built.days.find((day) => day.localDate === '2026-05-18')?.sleepHours).toBe(7.5);
    expect(built.totals.daysWithSleep).toBe(2);
    expect(built.totals.meanSleepHours).toBe(7);
  });

  it('reports pain for every day the injury was open', () => {
    const built = packet({ injuries: [injury] });
    expect(built.days.find((day) => day.localDate === '2026-05-09')?.pain).toBeNull();
    expect(built.days.find((day) => day.localDate === '2026-05-10')?.pain).toBe(6);
    expect(built.days.find((day) => day.localDate === ASOF)?.pain).toBe(6);
    expect(built.totals.peakPain).toBe(6);
  });

  it('stops reporting pain once the injury was resolved', () => {
    const built = packet({ injuries: [{ ...injury, resolvedOn: '2026-05-15' }] });
    expect(built.days.find((day) => day.localDate === '2026-05-15')?.pain).toBe(6);
    expect(built.days.find((day) => day.localDate === '2026-05-16')?.pain).toBeNull();
  });

  it('takes the worst of two overlapping injuries', () => {
    const built = packet({
      injuries: [injury, { ...injury, id: 'injury-2', severity: 8, onsetOn: '2026-05-12' }],
    });
    expect(built.days.find((day) => day.localDate === '2026-05-11')?.pain).toBe(6);
    expect(built.days.find((day) => day.localDate === '2026-05-13')?.pain).toBe(8);
  });

  it('reports nothing rather than zero when there is no sleep or pain at all', () => {
    const built = packet();
    expect(built.totals.meanSleepHours).toBeNull();
    expect(built.totals.peakPain).toBeNull();
  });
});
