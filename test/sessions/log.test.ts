import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ConflictError, ValidationError } from '../../src/lib/errors.js';
import type { Athlete } from '../../src/domain/athletes/types.js';
import type { ReturnToRunDecision } from '../../src/domain/clearances/gate.js';
import { buildSession, countsAsRunning } from '../../src/domain/sessions/log.js';
import type { WorkoutTemplate } from '../../src/domain/plans/types.js';
import type { Shoe } from '../../src/domain/shoes/retirement.js';

const NOW = '2026-05-20T09:00:00Z';

const athlete: Athlete = {
  id: 'athlete-a',
  squadId: 'squad-a',
  userId: 'user-athlete-a',
  dateOfBirth: '1994-06-20',
  timezone: 'Europe/Berlin',
  restingHr: 48,
  maxHr: 192,
  state: 'active',
};

const easy: WorkoutTemplate = {
  id: 'template-easy',
  squadId: 'squad-a',
  code: 'EASY-45',
  version: 1,
  kind: 'easy',
  prescription: { summary: '45 minutes easy' },
  loadFactor: 1,
  supersededAt: null,
};
const bike: WorkoutTemplate = { ...easy, id: 'template-bike', code: 'BIKE-60', kind: 'cycling' };

const cleared: ReturnToRunDecision = { allowed: true, reason: 'athlete is active', blockingInjuryIds: [] };
const notCleared: ReturnToRunDecision = {
  allowed: false,
  reason: 'no standing return-to-run clearance signed by a physio',
  blockingInjuryIds: ['injury-1'],
};

const shoe: Shoe = {
  id: 'shoe-1',
  athleteId: 'athlete-a',
  model: 'Meridian Glide 4',
  purchasedOn: '2026-01-05',
  retireAtKm: 800,
  currentKm: 620,
  retiredAt: null,
};

function input(overrides: Record<string, unknown> = {}) {
  return {
    athlete,
    template: easy,
    planId: null,
    completedAt: new Date('2026-05-19T17:40:00Z'),
    distanceM: 10_000,
    durationS: 3000,
    avgHr: 145,
    perceivedEffort: 4,
    returnToRun: cleared,
    ...overrides,
  } as Parameters<typeof buildSession>[0];
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date(NOW));
});

afterEach(() => {
  vi.useRealTimers();
});

describe('countsAsRunning', () => {
  it('counts a run', () => {
    expect(countsAsRunning(easy)).toBe(true);
  });

  it('counts a session with no template behind it', () => {
    expect(countsAsRunning(null)).toBe(true);
  });

  it('does not count a bike ride', () => {
    expect(countsAsRunning(bike)).toBe(false);
  });
});
