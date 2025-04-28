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

describe('AthleteService', () => {
  it('reads one athlete', async () => {
    const service = new AthleteService(repo([row()]));
    const { err, result } = await once<AthleteRow>(function (cb) {
      service.get('athlete-a', cb);
    });
    expect(err).toBeNull();
    expect(result && result.id).toBe('athlete-a');
  });

  it('errors on an athlete nobody has', async () => {
    const service = new AthleteService(repo([]));
    const { err } = await once<AthleteRow>(function (cb) {
      service.get('nobody', cb);
    });
    expect(err && err.message).toContain('no athlete nobody');
  });

  it('errors when asked for nothing', async () => {
    const service = new AthleteService(repo([]));
    const { err } = await once<AthleteRow>(function (cb) {
      service.get('', cb);
    });
    expect(err && err.message).toContain('without an id');
  });

  it('returns a squad roster in id order', async () => {
    const service = new AthleteService(repo([row({ id: 'athlete-b' }), row()]));
    const { result } = await once<AthleteRow[]>(function (cb) {
      service.roster('squad-a', cb);
    });
    expect(result && result.length).toBe(2);
    expect(result && result[0] && result[0].id).toBe('athlete-a');
  });

  it('does not return another squad', async () => {
    const service = new AthleteService(repo([row({ id: 'athlete-b', squadId: 'squad-b' }), row()]));
    const { result } = await once<AthleteRow[]>(function (cb) {
      service.roster('squad-a', cb);
    });
    expect(result && result.length).toBe(1);
  });

  it('works out an age on a given day', () => {
    const service = new AthleteService(repo([]));
    expect(service.ageOn(row(), '2026-06-20')).toBe(32);
    expect(service.ageOn(row(), '2026-06-19')).toBe(31);
    expect(service.ageOn(row({ dateOfBirth: 'nope' }), '2026-06-20')).toBeNull();
  });

  it('refuses a state it does not know', async () => {
    const service = new AthleteService(repo([row()]));
    const { err } = await once<void>(function (cb) {
      service.setState('athlete-a', 'tired', cb);
    });
    expect(err && err.message).toContain('not an athlete state');
  });

  it('sets a state it does know', async () => {
    const repository = repo([row()]);
    const service = new AthleteService(repository);
    await once<void>(function (cb) {
      service.setState('athlete-a', 'injured', cb);
    });
    expect(repository.states).toEqual(['injured']);
  });

  it('refuses a timezone that is not an IANA name', async () => {
    const service = new AthleteService(repo([row()]));
    const { err } = await once<void>(function (cb) {
      service.moveToTimezone('athlete-a', 'CEST', cb);
    });
    expect(err && err.message).toContain('IANA');
  });

  it('moves an athlete who has travelled', async () => {
    const repository = repo([row()]);
    const service = new AthleteService(repository);
    const { err } = await once<void>(function (cb) {
      service.moveToTimezone('athlete-a', 'Pacific/Auckland', cb);
    });
    expect(err).toBeNull();
    expect(repository.zones).toEqual(['Pacific/Auckland']);
  });
});
