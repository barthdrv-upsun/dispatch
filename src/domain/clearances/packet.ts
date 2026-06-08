import { round1, round2 } from '../../lib/numbers.js';
import { addLocalDays, localDateRange, type LocalDate } from '../../lib/time.js';
import type { LoadEntry } from '../load/entries.js';
import type { ClearanceDay, ClearancePacket, Injury } from './types.js';

/** R4 says a physio sees four weeks before they sign anything. */
export const PACKET_DAYS = 28;

export type SleepLogRow = {
  localDate: LocalDate;
  hours: number | string;
  quality?: number | null;
};

export type PacketInput = {
  athleteId: string;
  asOf: LocalDate;
  loadEntries: readonly LoadEntry[];
  sleepLogs: readonly SleepLogRow[];
  injuries: readonly Injury[];
};

function painOn(injuries: readonly Injury[], day: LocalDate): number | null {
  let worst: number | null = null;
  for (const injury of injuries) {
    const started = injury.onsetOn <= day;
    const ended = injury.resolvedOn !== null && injury.resolvedOn < day;
    if (started && !ended) {
      worst = worst === null ? injury.severity : Math.max(worst, injury.severity);
    }
  }
  return worst;
}

/**
 * The 28 days a physio is shown alongside the decision: what the athlete ran,
 * how they slept and how much the injury hurt, one row per day in their own
 * calendar. Days with nothing recorded are still rows - a gap is a finding.
 */
export function buildClearancePacket(input: PacketInput): ClearancePacket {
  const from = addLocalDays(input.asOf, -(PACKET_DAYS - 1));
  const loadByDay = new Map<LocalDate, number>();
  for (const entry of input.loadEntries) {
    loadByDay.set(entry.localDate, (loadByDay.get(entry.localDate) ?? 0) + entry.load);
  }
  const sleepByDay = new Map<LocalDate, number>();
  for (const log of input.sleepLogs) {
    const hours = typeof log.hours === 'number' ? log.hours : Number.parseFloat(log.hours);
    if (Number.isFinite(hours)) {
      sleepByDay.set(log.localDate, hours);
    }
  }

  const days: ClearanceDay[] = localDateRange(from, input.asOf).map((localDate) => ({
    localDate,
    load: round2(loadByDay.get(localDate) ?? 0),
    sleepHours: sleepByDay.has(localDate) ? round2(sleepByDay.get(localDate) as number) : null,
    pain: painOn(input.injuries, localDate),
  }));

  const sleeps = days.map((day) => day.sleepHours).filter((hours): hours is number => hours !== null);
  const pains = days.map((day) => day.pain).filter((pain): pain is number => pain !== null);

  return {
    athleteId: input.athleteId,
    asOf: input.asOf,
    days,
    totals: {
      runningLoad: round2(days.reduce((total, day) => total + day.load, 0)),
      daysWithSleep: sleeps.length,
      meanSleepHours: sleeps.length === 0 ? null : round1(sleeps.reduce((a, b) => a + b, 0) / sleeps.length),
      peakPain: pains.length === 0 ? null : Math.max(...pains),
    },
  };
}
