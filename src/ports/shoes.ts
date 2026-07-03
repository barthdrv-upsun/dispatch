import type { LocalDate } from '../lib/time.js';

export type ShoeRow = {
  id: string;
  athleteId: string;
  model: string;
  purchasedOn: LocalDate;
  retireAtKm: string | number;
  currentKm: string | number;
  retiredAt: Date | null;
};

export interface ShoeRepo {
  byId(shoeId: string): Promise<ShoeRow | null>;
  forAthlete(athleteId: string): Promise<ShoeRow[]>;
  insert(shoe: Omit<ShoeRow, 'id'>): Promise<string>;
  save(shoe: ShoeRow): Promise<void>;
}
