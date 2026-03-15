import type { RoleGrant } from '../domain/authz.js';
import type { Athlete, Squad } from '../domain/athletes/types.js';

/**
 * The database as the handlers see it. Every method is scoped to something -
 * an athlete, a squad - because a handler that can ask for "all athletes" is
 * a handler that will eventually be asked for somebody else's.
 */
export interface UserRepo {
  grantsFor(userId: string): Promise<RoleGrant[]>;
  athleteIdFor(userId: string): Promise<string | null>;
  physioUserIds(squadId: string): Promise<string[]>;
}

export interface SquadRepo {
  byId(squadId: string): Promise<Squad | null>;
}

export interface AthleteRepo {
  byId(athleteId: string): Promise<Athlete | null>;
  bySquad(squadId: string): Promise<Athlete[]>;
  save(athlete: Athlete): Promise<void>;
}
