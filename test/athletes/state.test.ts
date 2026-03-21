import { describe, expect, it } from 'vitest';
import { ConflictError, ValidationError } from '../../src/lib/errors.js';
import { ageOn, canTransition, moveTimezone, transitionState } from '../../src/domain/athletes/state.js';
import type { Athlete } from '../../src/domain/athletes/types.js';

function athlete(overrides: Partial<Athlete> = {}): Athlete {
  return {
    id: 'athlete-a',
    squadId: 'squad-a',
    userId: 'user-athlete-a',
    dateOfBirth: '1994-06-20',
    timezone: 'Europe/Berlin',
    restingHr: 48,
    maxHr: 192,
    state: 'active',
    ...overrides,
  };
}

describe('canTransition', () => {
  it('allows the transitions an injury actually goes through', () => {
    expect(canTransition('active', 'injured')).toBe(true);
    expect(canTransition('injured', 'returning')).toBe(true);
    expect(canTransition('returning', 'active')).toBe(true);
    expect(canTransition('returning', 'injured')).toBe(true);
  });

  it('allows an injury to be withdrawn', () => {
    expect(canTransition('injured', 'active')).toBe(true);
  });

  it('refuses a jump straight past the injury', () => {
    expect(canTransition('active', 'returning')).toBe(false);
  });

  it('refuses staying where you are', () => {
    expect(canTransition('active', 'active')).toBe(false);
  });
});
