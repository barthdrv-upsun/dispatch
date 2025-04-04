export type Callback<T> = (err: Error | null, result?: T) => void;

export interface AthleteRow {
  id: string;
  squadId: string;
  userId: string;
  dateOfBirth: string;
  timezone: string;
  restingHr: number | null;
  maxHr: number | null;
  state: string;
}

export interface AthleteRepository {
  byId(id: string, cb: Callback<AthleteRow>): void;
  bySquad(squadId: string, cb: Callback<AthleteRow[]>): void;
  updateState(id: string, state: string, cb: Callback<void>): void;
  updateTimezone(id: string, timezone: string, cb: Callback<void>): void;
}

export const ATHLETE_STATES = ['active', 'injured', 'returning'];

/**
 * Reads and writes athletes. Every method takes a callback because the whole
 * app does.
 */
export class AthleteService {
  private readonly repo: AthleteRepository;

  constructor(repo: AthleteRepository) {
    if (!repo) {
      throw new Error('AthleteService needs a repository');
    }
    this.repo = repo;
  }

  get(id: string, cb: Callback<AthleteRow>): void {
    if (!id) {
      cb(new Error('get called without an id'));
      return;
    }
    this.repo.byId(id, function (err, athlete) {
      if (err) {
        cb(err);
        return;
      }
      if (!athlete) {
        cb(new Error('no athlete ' + id));
        return;
      }
      cb(null, athlete);
    });
  }

  roster(squadId: string, cb: Callback<AthleteRow[]>): void {
    if (!squadId) {
      cb(new Error('roster called without a squad id'));
      return;
    }
    this.repo.bySquad(squadId, function (err, rows) {
      if (err) {
        cb(err);
        return;
      }
      const athletes = rows || [];
      athletes.sort(function (a, b) {
        return a.id < b.id ? -1 : 1;
      });
      cb(null, athletes);
    });
  }

  ageOn(athlete: AthleteRow, on: string): number | null {
    if (!athlete || !athlete.dateOfBirth || !on) {
      return null;
    }
    const born = athlete.dateOfBirth.split('-');
    const asked = on.split('-');
    if (born.length !== 3 || asked.length !== 3) {
      return null;
    }
    let years = Number(asked[0]) - Number(born[0]);
    const monthDiff = Number(asked[1]) - Number(born[1]);
    if (monthDiff < 0 || (monthDiff === 0 && Number(asked[2]) < Number(born[2]))) {
      years = years - 1;
    }
    return years;
  }

  setState(id: string, state: string, cb: Callback<void>): void {
    if (ATHLETE_STATES.indexOf(state) === -1) {
      cb(new Error(state + ' is not an athlete state'));
      return;
    }
    this.repo.updateState(id, state, cb);
  }

  /**
   * Athletes travel. When they do their day boundary moves with them, so this
   * has to be updated before anything is computed for them.
   */
  moveToTimezone(id: string, timezone: string, cb: Callback<void>): void {
    if (!timezone || timezone.indexOf('/') === -1) {
      cb(new Error('timezone must be an IANA name like Europe/Berlin'));
      return;
    }
    this.repo.updateTimezone(id, timezone, cb);
  }
}
