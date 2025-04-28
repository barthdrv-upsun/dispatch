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
