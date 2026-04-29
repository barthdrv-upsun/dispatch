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

describe('buildSession', () => {
  it('builds a session and works out what it cost', () => {
    const session = buildSession(input());
    expect(session.athleteId).toBe('athlete-a');
    expect(session.templateId).toBe('template-easy');
    expect(session.load).toBe(200);
    expect(session.source).toBe('manual');
  });

  it('stamps the local day in the athlete\'s own zone', () => {
    expect(buildSession(input()).localDate).toBe('2026-05-19');
    expect(buildSession(input({ athlete: { ...athlete, timezone: 'Pacific/Auckland' } })).localDate).toBe(
      '2026-05-20',
    );
  });

  it('refuses a session from the future', () => {
    expect(() => buildSession(input({ completedAt: new Date('2026-05-20T10:00:00Z') }))).toThrow(
      ValidationError,
    );
  });

  it('forgives a few minutes of watch drift', () => {
    expect(() => buildSession(input({ completedAt: new Date('2026-05-20T09:02:00Z') }))).not.toThrow();
  });

  it('refuses a completion time that is not a time', () => {
    expect(() => buildSession(input({ completedAt: new Date('nonsense') }))).toThrow(ValidationError);
  });

  it('refuses figures out of range', () => {
    expect(() => buildSession(input({ distanceM: 400_000 }))).toThrow(ValidationError);
    expect(() => buildSession(input({ durationS: 90_000 }))).toThrow(ValidationError);
    expect(() => buildSession(input({ avgHr: 400 }))).toThrow(ValidationError);
    expect(() => buildSession(input({ perceivedEffort: 11 }))).toThrow(ValidationError);
  });

  it('accepts a session with almost nothing in it', () => {
    const session = buildSession(
      input({ distanceM: null, durationS: null, avgHr: null, perceivedEffort: null }),
    );
    expect(session.load).toBeNull();
  });

  /** R4, from the crediting end. */
  it('refuses to credit a run to an athlete who has not been cleared', () => {
    try {
      buildSession(input({ returnToRun: notCleared, athlete: { ...athlete, state: 'injured' } }));
      expect.unreachable('an uncleared athlete must not be credited a run');
    } catch (err) {
      expect(err).toBeInstanceOf(ConflictError);
      expect((err as ConflictError).message).toContain('cannot be credited a running session');
    }
  });

  it('refuses an untemplated session for an athlete who has not been cleared', () => {
    expect(() => buildSession(input({ template: null, returnToRun: notCleared }))).toThrow(ConflictError);
  });

  it('still credits a bike ride to an athlete who has not been cleared', () => {
    const session = buildSession(input({ template: bike, returnToRun: notCleared }));
    expect(session.templateId).toBe('template-bike');
  });

  /** R7. */
  it('puts the shoes on the session', () => {
    expect(buildSession(input({ shoe })).shoeId).toBe('shoe-1');
  });

  it('refuses a pair that is past its retirement threshold', () => {
    expect(() => buildSession(input({ shoe: { ...shoe, currentKm: 812 } }))).toThrow(ConflictError);
  });

  it('refuses a pair belonging to somebody else', () => {
    expect(() => buildSession(input({ shoe: { ...shoe, athleteId: 'athlete-b' } }))).toThrow(
      ValidationError,
    );
  });
});
