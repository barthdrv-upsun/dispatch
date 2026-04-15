import type { Database } from '../client.js';
import { drizzleUserRepo, drizzleSquadRepo, drizzleAthleteRepo } from './athletes.js';
import { drizzleSessionRepo } from './sessions.js';
import { drizzleTemplateRepo } from './templates.js';
import type { Repositories } from '../../ports/index.js';

export * from './athletes.js';

/**
 * Every repository, wired to one connection. This is the only place in the
 * app that knows both the schema and the ports.
 */
export function createRepositories(db: Database): Repositories {
  return {
    users: drizzleUserRepo(db),
    squads: drizzleSquadRepo(db),
    athletes: drizzleAthleteRepo(db),
    sessions: drizzleSessionRepo(db),
    templates: drizzleTemplateRepo(db),
  };
}
