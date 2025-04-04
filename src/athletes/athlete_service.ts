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
