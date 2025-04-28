import { describe, expect, it } from 'vitest';
import {
  AthleteService,
  type AthleteRepository,
  type AthleteRow,
  type Callback,
} from '../../src/athletes/athlete_service.js';

/** Turns one of the callback methods into something a test can await. */
function once<T>(run: (cb: Callback<T>) => void): Promise<{ err: Error | null; result?: T }> {
  return new Promise(function (resolve) {
    run(function (err, result) {
      resolve({ err: err, result: result });
    });
  });
}

function row(overrides: Partial<AthleteRow> = {}): AthleteRow {
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

function repo(rows: AthleteRow[]): AthleteRepository & { states: string[]; zones: string[] } {
  const states: string[] = [];
  const zones: string[] = [];
  return {
    states: states,
    zones: zones,
    byId: function (id, cb) {
      cb(
        null,
        rows.filter(function (candidate) {
          return candidate.id === id;
        })[0],
      );
    },
    bySquad: function (squadId, cb) {
      cb(
        null,
        rows.filter(function (candidate) {
          return candidate.squadId === squadId;
        }),
      );
    },
    updateState: function (_id, state, cb) {
      states.push(state);
      cb(null);
    },
    updateTimezone: function (_id, timezone, cb) {
      zones.push(timezone);
      cb(null);
    },
  };
}
