import { ConflictError, ValidationError } from '../../lib/errors.js';
import { round2, toNumber } from '../../lib/numbers.js';
import type { LocalDate } from '../../lib/time.js';

export type Shoe = {
  id: string;
  athleteId: string;
  model: string;
  purchasedOn: LocalDate;
  retireAtKm: number;
  currentKm: number;
  retiredAt: Date | null;
};

export type ShoeRow = {
  id: string;
  athleteId: string;
  model: string;
  purchasedOn: string;
  retireAtKm: string | number;
  currentKm: string | number;
  retiredAt: Date | null;
};

export function toShoe(row: ShoeRow): Shoe {
  return {
    id: row.id,
    athleteId: row.athleteId,
    model: row.model,
    purchasedOn: row.purchasedOn,
    retireAtKm: toNumber(row.retireAtKm),
    currentKm: toNumber(row.currentKm),
    retiredAt: row.retiredAt,
  };
}

/** R7. At the threshold counts as past it. */
export function isRetired(shoe: Shoe): boolean {
  return shoe.retiredAt !== null || shoe.currentKm >= shoe.retireAtKm;
}

export function remainingKm(shoe: Shoe): number {
  return round2(Math.max(0, shoe.retireAtKm - shoe.currentKm));
}

/**
 * R7. A worn-out pair cannot be put on a new session, whether or not anybody
 * has got round to stamping retired_at.
 */
export function assertShoeUsable(shoe: Shoe, athleteId: string): void {
  if (shoe.athleteId !== athleteId) {
    throw new ValidationError('that pair belongs to another athlete', { shoeId: shoe.id });
  }
  if (shoe.retiredAt !== null) {
    throw new ConflictError(`${shoe.model} was retired and cannot take new sessions`);
  }
  if (shoe.currentKm >= shoe.retireAtKm) {
    throw new ConflictError(
      `${shoe.model} is at ${shoe.currentKm}km against a ${shoe.retireAtKm}km retirement threshold`,
    );
  }
}

/**
 * Adds a run's distance to a pair and retires them the moment they cross the
 * threshold, so the next session cannot pick them up.
 */
export function addMileage(shoe: Shoe, distanceM: number, at: Date): Shoe {
  if (distanceM < 0) {
    throw new ValidationError('a session cannot take mileage off a shoe', { distanceM });
  }
  const currentKm = round2(shoe.currentKm + distanceM / 1000);
  const crossed = currentKm >= shoe.retireAtKm;
  return {
    ...shoe,
    currentKm,
    retiredAt: shoe.retiredAt ?? (crossed ? at : null),
  };
}
