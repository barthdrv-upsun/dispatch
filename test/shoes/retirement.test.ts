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

describe('assertShoeUsable', () => {
  it('accepts a pair with life left', () => {
    expect(() => assertShoeUsable(shoe(), 'athlete-a')).not.toThrow();
  });

  it('refuses a pair at the threshold', () => {
    try {
      assertShoeUsable(shoe({ currentKm: 800 }), 'athlete-a');
      expect.unreachable('a pair at its threshold must not take a new session');
    } catch (err) {
      expect(err).toBeInstanceOf(ConflictError);
      expect((err as ConflictError).message).toContain('800km retirement threshold');
    }
  });

  it('refuses a pair past the threshold', () => {
    expect(() => assertShoeUsable(shoe({ currentKm: 842.4 }), 'athlete-a')).toThrow(ConflictError);
  });

  it('refuses a pair already stamped retired', () => {
    expect(() =>
      assertShoeUsable(shoe({ retiredAt: new Date('2026-05-01T00:00:00Z') }), 'athlete-a'),
    ).toThrow(ConflictError);
  });

  it('refuses somebody else\'s shoes', () => {
    expect(() => assertShoeUsable(shoe(), 'athlete-b')).toThrow(ValidationError);
  });
});

describe('addMileage', () => {
  const at = new Date('2026-05-20T07:00:00Z');

  it('adds the run to the pair', () => {
    expect(addMileage(shoe(), 12_400, at).currentKm).toBe(632.4);
  });

  it('retires the pair the moment it crosses the threshold', () => {
    const worn = addMileage(shoe({ currentKm: 795 }), 6000, at);
    expect(worn.currentKm).toBe(801);
    expect(worn.retiredAt).toEqual(at);
  });

  it('retires the pair when it lands exactly on the threshold', () => {
    expect(addMileage(shoe({ currentKm: 795 }), 5000, at).retiredAt).toEqual(at);
  });

  it('leaves an already-stamped date alone', () => {
    const earlier = new Date('2026-04-01T00:00:00Z');
    expect(addMileage(shoe({ currentKm: 810, retiredAt: earlier }), 5000, at).retiredAt).toEqual(earlier);
  });

  it('refuses to take mileage off', () => {
    expect(() => addMileage(shoe(), -100, at)).toThrow(ValidationError);
  });

  it('does not mutate the pair it was given', () => {
    const original = shoe();
    addMileage(original, 10_000, at);
    expect(original.currentKm).toBe(620);
  });
});

describe('usableShoes', () => {
  it('filters out the worn-out pairs', () => {
    const shoes = [shoe(), shoe({ id: 'shoe-2', currentKm: 900 }), shoe({ id: 'shoe-3', currentKm: 100 })];
    expect(usableShoes(shoes).map((s) => s.id)).toEqual(['shoe-1', 'shoe-3']);
  });
});
