export * from './athletes.js';
export * from './sessions.js';
export * from './plans.js';

import type { UserRepo, SquadRepo, AthleteRepo } from './athletes.js';
import type { SessionRepo } from './sessions.js';
import type { TemplateRepo } from './plans.js';

/**
 * The whole surface the handlers are allowed to touch. A route gets this and
 * nothing else, which is what keeps every query in one place and every query
 * scoped.
 */
export type Repositories = {
  users: UserRepo;
  squads: SquadRepo;
  athletes: AthleteRepo;
  sessions: SessionRepo;
  templates: TemplateRepo;
};
