import type { LocalDate } from '../lib/time.js';

export type SleepLogRow = {
  athleteId: string;
  localDate: LocalDate;
  hours: string | number;
  quality: number | null;
};

export type HydrationLogRow = {
  athleteId: string;
  localDate: LocalDate;
  litres: string | number;
};

export interface WellnessRepo {
  sleepFrom(athleteId: string, from: LocalDate): Promise<SleepLogRow[]>;
  putSleep(log: SleepLogRow): Promise<void>;
  putHydration(log: HydrationLogRow): Promise<void>;
}
