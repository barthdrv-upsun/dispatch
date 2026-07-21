import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import {
  ASSISTANT_A,
  ATHLETE_A,
  ATHLETE_A_USER,
  ATHLETE_B_USER,
  HEAD_COACH_A,
  PHYSIO,
  SQUAD_A,
  addTemplate,
  buildTestWorld,
  inject,
} from '../helpers/world.js';
import type { MemoryWorld } from '../helpers/memory_repos.js';

/** Recent enough that the "not in the future" check is happy whenever this
 * suite is run. */
function yesterday(): string {
  return new Date(Date.now() - 26 * 60 * 60 * 1000).toISOString();
}

let app: FastifyInstance;
let world: MemoryWorld;

beforeEach(() => {
  const built = buildTestWorld();
  app = built.app;
  world = built.world;
  addTemplate(world, { id: 'template-easy', squadId: SQUAD_A, code: 'EASY-45', kind: 'easy' });
  addTemplate(world, { id: 'template-bike', squadId: SQUAD_A, code: 'BIKE-60', kind: 'cycling' });
  world.shoes.push({
    id: 'shoe-fresh',
    athleteId: ATHLETE_A,
    model: 'Meridian Glide 4',
    purchasedOn: '2026-01-05',
    retireAtKm: '800.00',
    currentKm: '620.00',
    retiredAt: null,
  });
  world.shoes.push({
    id: 'shoe-worn',
    athleteId: ATHLETE_A,
    model: 'Fenwick Tempo 2',
    purchasedOn: '2025-03-05',
    retireAtKm: '800.00',
    currentKm: '842.40',
    retiredAt: null,
  });
});

afterEach(async () => {
  await app.close();
});

function body(overrides: Record<string, unknown> = {}) {
  return {
    completedAt: yesterday(),
    templateId: 'template-easy',
    distanceM: 10_000,
    durationS: 3000,
    avgHr: 145,
    perceivedEffort: 4,
    ...overrides,
  };
}
