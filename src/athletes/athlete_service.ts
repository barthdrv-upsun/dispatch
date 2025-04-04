export type Callback<T> = (err: Error | null, result?: T) => void;

export interface AthleteRow {
  id: string;
  squadId: string;
  userId: string;
  dateOfBirth: string;
  timezone: string;
  restingHr: number | null;
  maxHr: number | null;
  state: string;
}

export interface AthleteRepository {
  byId(id: string, cb: Callback<AthleteRow>): void;
  bySquad(squadId: string, cb: Callback<AthleteRow[]>): void;
  updateState(id: string, state: string, cb: Callback<void>): void;
  updateTimezone(id: string, timezone: string, cb: Callback<void>): void;
}

export const ATHLETE_STATES = ['active', 'injured', 'returning'];
