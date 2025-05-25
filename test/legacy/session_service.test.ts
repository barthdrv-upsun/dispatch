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
