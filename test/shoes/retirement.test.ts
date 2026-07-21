import { describe, expect, it } from 'vitest';
import { ConflictError, ValidationError } from '../../src/lib/errors.js';
import {
  addMileage,
  assertShoeUsable,
  isRetired,
  remainingKm,
  toShoe,
  usableShoes,
  type Shoe,
} from '../../src/domain/shoes/retirement.js';

function shoe(overrides: Partial<Shoe> = {}): Shoe {
  return {
    id: 'shoe-1',
    athleteId: 'athlete-a',
    model: 'Meridian Glide 4',
    purchasedOn: '2026-01-05',
    retireAtKm: 800,
    currentKm: 620,
    retiredAt: null,
    ...overrides,
  };
}

describe('toShoe', () => {
  it('reads the numerics that arrive as strings', () => {
    const converted = toShoe({
      id: 'shoe-1',
      athleteId: 'athlete-a',
      model: 'Meridian Glide 4',
      purchasedOn: '2026-01-05',
      retireAtKm: '800.00',
      currentKm: '620.40',
      retiredAt: null,
    });
    expect(converted.retireAtKm).toBe(800);
    expect(converted.currentKm).toBe(620.4);
  });
});
