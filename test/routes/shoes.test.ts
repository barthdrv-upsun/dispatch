import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import {
  ATHLETE_A,
  ATHLETE_A_USER,
  ATHLETE_B_USER,
  HEAD_COACH_A,
  buildTestWorld,
  inject,
} from '../helpers/world.js';
import type { MemoryWorld } from '../helpers/memory_repos.js';

let app: FastifyInstance;
let world: MemoryWorld;

beforeEach(() => {
  const built = buildTestWorld();
  app = built.app;
  world = built.world;
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

describe('GET /athletes/:athleteId/shoes', () => {
  it('says which pairs are done', async () => {
    const response = await inject(app, 'GET', `/athletes/${ATHLETE_A}/shoes`, { as: ATHLETE_A_USER });
    expect(response.statusCode).toBe(200);
    const body = response.json() as { shoes: Array<{ id: string; retired: boolean; remainingKm: number }> };
    expect(body.shoes[0]?.retired).toBe(true);
    expect(body.shoes[0]?.remainingKm).toBe(0);
  });

  it('refuses another athlete', async () => {
    const response = await inject(app, 'GET', `/athletes/${ATHLETE_A}/shoes`, { as: ATHLETE_B_USER });
    expect(response.statusCode).toBe(403);
  });
});
