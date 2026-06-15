import type { LocalDate } from '../lib/time.js';
import type { ClearancePacket } from '../domain/clearances/types.js';

export type InjuryRow = {
  id: string;
  athleteId: string;
  region: string;
  onsetOn: LocalDate;
  severity: number;
  notes: string | null;
  resolvedOn: LocalDate | null;
};

export type ClearanceRow = {
  id: string;
  injuryId: string;
  signedBy: string;
  signedAt: Date;
  revokedAt: Date | null;
  notes: string | null;
  loadSnapshot: ClearancePacket | null;
};

export interface InjuryRepo {
  byId(injuryId: string): Promise<InjuryRow | null>;
  forAthlete(athleteId: string): Promise<InjuryRow[]>;
  clearancesForAthlete(athleteId: string): Promise<ClearanceRow[]>;
  clearanceById(clearanceId: string): Promise<ClearanceRow | null>;
  insertClearance(clearance: Omit<ClearanceRow, 'id'>): Promise<string>;
  saveClearance(clearance: ClearanceRow): Promise<void>;
}
