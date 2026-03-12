import type { LocalDate } from '../../lib/time.js';
import type { AthleteState } from '../clearances/types.js';

export type Squad = {
  id: string;
  name: string;
  timezone: string;
  active: boolean;
};

export type Athlete = {
  id: string;
  squadId: string;
  userId: string;
  dateOfBirth: LocalDate;
  timezone: string;
  restingHr: number | null;
  maxHr: number | null;
  state: AthleteState;
};

export type { AthleteState };
