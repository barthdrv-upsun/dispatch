export * from './athletes.js';

import type { UserRepo, SquadRepo, AthleteRepo } from './athletes.js';

/**
 * The whole surface the handlers are allowed to touch. A route gets this and
 * nothing else, which is what keeps every query in one place and every query
 * scoped.
 */
export type Repositories = {
  users: UserRepo;
  squads: SquadRepo;
  athletes: AthleteRepo;
};
