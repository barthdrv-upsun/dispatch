import type { FastifyInstance } from 'fastify';
import { fixedClock, type Clock } from '../../src/lib/clock.js';
import type { Athlete } from '../../src/domain/athletes/types.js';
import type { Prescription, TemplateKind } from '../../src/domain/plans/types.js';
import type { Repositories } from '../../src/ports/index.js';
import { buildApp } from '../../src/server.js';
import { emptyWorld, memoryRepositories, type MemoryWorld } from './memory_repos.js';

/**
 * A squad, its staff and one athlete each side of the fence, wired to the
 * in-memory ports. Everything here is fake, including the ids.
 */
export const SQUAD_A = 'squad-a';
export const SQUAD_B = 'squad-b';

export const HEAD_COACH_A = 'user-head-a';
export const ASSISTANT_A = 'user-assistant-a';
export const PHYSIO = 'user-physio';
export const HEAD_COACH_B = 'user-head-b';
export const ATHLETE_A_USER = 'user-athlete-a';
export const ATHLETE_B_USER = 'user-athlete-b';

export const ATHLETE_A = 'athlete-a';
export const ATHLETE_B = 'athlete-b';

/** Fixed so that anything derived from "now" is assertable. */
export const NOW = '2026-06-15T08:00:00.000Z';

export type TestWorld = {
  world: MemoryWorld;
  repos: Repositories;
  clock: Clock;
  app: FastifyInstance;
};

export function buildTestWorld(options: { now?: string } = {}): TestWorld {
  const world = emptyWorld();

  world.squads.push(
    { id: SQUAD_A, name: 'Riverside Track Club', timezone: 'Europe/Berlin', active: true },
    { id: SQUAD_B, name: 'Northgate Harriers', timezone: 'Europe/London', active: true },
  );

  world.users.push(
    { id: HEAD_COACH_A, name: 'Rowan Casteel' },
    { id: ASSISTANT_A, name: 'Sunniva Berg' },
    { id: PHYSIO, name: 'Yasmin Okoro' },
    { id: HEAD_COACH_B, name: 'Tomasz Wieczorek' },
    { id: ATHLETE_A_USER, name: 'Ama Boateng' },
    { id: ATHLETE_B_USER, name: 'Bela Kovacs' },
  );

  world.grants.push(
    { userId: HEAD_COACH_A, squadId: SQUAD_A, role: 'head_coach' },
    { userId: ASSISTANT_A, squadId: SQUAD_A, role: 'assistant_coach' },
    { userId: HEAD_COACH_B, squadId: SQUAD_B, role: 'head_coach' },
    { userId: ATHLETE_A_USER, squadId: SQUAD_A, role: 'athlete' },
    { userId: ATHLETE_B_USER, squadId: SQUAD_B, role: 'athlete' },
    // The physio covers both squads, which is what "across squads" means.
    { userId: PHYSIO, squadId: SQUAD_A, role: 'physio' },
    { userId: PHYSIO, squadId: SQUAD_B, role: 'physio' },
  );

  world.athletes.push(
    athlete({ id: ATHLETE_A, squadId: SQUAD_A, userId: ATHLETE_A_USER, timezone: 'Europe/Berlin' }),
    athlete({ id: ATHLETE_B, squadId: SQUAD_B, userId: ATHLETE_B_USER, timezone: 'Europe/London' }),
  );

  const repos = memoryRepositories(world);
  const clock = fixedClock(options.now ?? NOW);
  const app = buildApp({ repos, clock });
  return { world, repos, clock, app };
}

export function athlete(overrides: Partial<Athlete> & Pick<Athlete, 'id' | 'squadId' | 'userId'>): Athlete {
  return {
    dateOfBirth: '1994-04-11',
    timezone: 'Europe/Berlin',
    restingHr: 48,
    maxHr: 192,
    state: 'active',
    ...overrides,
  };
}
