import type { LocalDate } from '../../lib/time.js';

export type AthleteState = 'active' | 'injured' | 'returning';

export type Injury = {
  id: string;
  athleteId: string;
  region: string;
  onsetOn: LocalDate;
  severity: number;
  notes: string | null;
  resolvedOn: LocalDate | null;
};

export type ClearanceDay = {
  localDate: LocalDate;
  load: number;
  sleepHours: number | null;
  pain: number | null;
};

export type ClearancePacket = {
  athleteId: string;
  asOf: LocalDate;
  days: ClearanceDay[];
  totals: {
    runningLoad: number;
    daysWithSleep: number;
    meanSleepHours: number | null;
    peakPain: number | null;
  };
};

export type Clearance = {
  id: string;
  injuryId: string;
  signedBy: string;
  signedAt: Date;
  revokedAt: Date | null;
  notes: string | null;
  loadSnapshot: ClearancePacket | null;
};
