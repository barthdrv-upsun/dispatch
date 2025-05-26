import { describe, expect, it } from 'vitest';
import type { AthleteRow, Callback } from '../../src/athletes/athlete_service.js';
import {
  SessionService,
  type SessionRepository,
  type SessionRow,
} from '../../src/sessions/session_service.js';

function once<T>(run: (cb: Callback<T>) => void): Promise<{ err: Error | null; result?: T }> {
  return new Promise(function (resolve) {
    run(function (err, result) {
      resolve({ err: err, result: result });
    });
  });
}

const athlete: AthleteRow = {
  id: 'athlete-a',
  squadId: 'squad-a',
  userId: 'user-athlete-a',
  dateOfBirth: '1994-06-20',
  timezone: 'Europe/Berlin',
  restingHr: 48,
  maxHr: 192,
  state: 'active',
};

function repo(): SessionRepository & { written: Array<Omit<SessionRow, 'id'>> } {
  const written: Array<Omit<SessionRow, 'id'>> = [];
  return {
    written: written,
    insert: function (session, cb) {
      written.push(session);
      cb(null, 'session-' + String(written.length));
    },
    forAthleteBetween: function (_athleteId, _from, _to, cb) {
      cb(null, []);
    },
  };
}

function session(overrides: Partial<SessionRow> = {}): SessionRow {
  return {
    id: 'session-1',
    athleteId: 'athlete-a',
    completedAt: new Date('2025-05-04T16:30:00Z'),
    distanceM: 10_000,
    durationS: 3000,
    avgHr: 145,
    perceivedEffort: 4,
    source: 'manual',
    ...overrides,
  };
}

describe('SessionService.log', () => {
  const yesterday = new Date(Date.now() - 26 * 60 * 60 * 1000);

  it('writes a manual session', async () => {
    const repository = repo();
    const service = new SessionService(repository);
    const { err, result } = await once<string>(function (cb) {
      service.log({ athleteId: 'athlete-a', completedAt: yesterday, distanceM: 10_000, durationS: 3000 }, cb);
    });
    expect(err).toBeNull();
    expect(result).toBe('session-1');
    expect(repository.written[0]?.source).toBe('manual');
  });

  it('refuses a session with no athlete', async () => {
    const service = new SessionService(repo());
    const { err } = await once<string>(function (cb) {
      service.log({ athleteId: '', completedAt: yesterday }, cb);
    });
    expect(err && err.message).toContain('needs an athlete');
  });

  it('refuses a session from the future', async () => {
    const service = new SessionService(repo());
    const { err } = await once<string>(function (cb) {
      service.log({ athleteId: 'athlete-a', completedAt: new Date(Date.now() + 86_400_000) }, cb);
    });
    expect(err && err.message).toContain('cannot be logged in the future');
  });

  it('refuses figures out of range', async () => {
    const service = new SessionService(repo());
    const distance = await once<string>(function (cb) {
      service.log({ athleteId: 'athlete-a', completedAt: yesterday, distanceM: 400_000 }, cb);
    });
    expect(distance.err && distance.err.message).toContain('distance is out of range');

    const duration = await once<string>(function (cb) {
      service.log({ athleteId: 'athlete-a', completedAt: yesterday, durationS: 90_000 }, cb);
    });
    expect(duration.err && duration.err.message).toContain('duration is out of range');

    const effort = await once<string>(function (cb) {
      service.log({ athleteId: 'athlete-a', completedAt: yesterday, perceivedEffort: 11 }, cb);
    });
    expect(effort.err && effort.err.message).toContain('perceived effort');
  });
});

describe('SessionService.byLocalDay', () => {
  it('groups by the athlete\'s own day', () => {
    const service = new SessionService(repo());
    const grouped = service.byLocalDay(athlete, [
      session({ id: 'a', completedAt: new Date('2025-05-04T20:40:00Z') }),
      session({ id: 'b', completedAt: new Date('2025-05-05T05:10:00Z') }),
    ]);
    expect(Object.keys(grouped).sort()).toEqual(['2025-05-04', '2025-05-05']);
  });

  it('puts two sessions on the same day together', () => {
    const service = new SessionService(repo());
    const grouped = service.byLocalDay(athlete, [
      session({ id: 'a', completedAt: new Date('2025-05-04T05:10:00Z') }),
      session({ id: 'b', completedAt: new Date('2025-05-04T16:10:00Z') }),
    ]);
    expect(grouped['2025-05-04']).toHaveLength(2);
  });

  it('skips a session that was never completed', () => {
    const service = new SessionService(repo());
    expect(service.byLocalDay(athlete, [session({ completedAt: null })])).toEqual({});
  });
});
