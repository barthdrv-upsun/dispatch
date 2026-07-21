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

describe('isRetired', () => {
  it('is false for a pair with life left', () => {
    expect(isRetired(shoe())).toBe(false);
  });

  it('is true once the threshold is reached', () => {
    expect(isRetired(shoe({ currentKm: 800 }))).toBe(true);
    expect(isRetired(shoe({ currentKm: 842.4 }))).toBe(true);
  });

  it('is true for a pair somebody has stamped, whatever the mileage says', () => {
    expect(isRetired(shoe({ currentKm: 10, retiredAt: new Date('2026-05-01T00:00:00Z') }))).toBe(true);
  });
});

describe('remainingKm', () => {
  it('counts what is left', () => {
    expect(remainingKm(shoe())).toBe(180);
  });

  it('never goes below zero', () => {
    expect(remainingKm(shoe({ currentKm: 900 }))).toBe(0);
  });
});
