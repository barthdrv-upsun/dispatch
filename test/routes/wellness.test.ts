import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { athleteLocalDay } from '../../src/lib/time.js';
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

/** The logs are checked against the real wall clock, so the day has to be a
 * real one. */
function today(): string {
  return athleteLocalDay(new Date(), 'Europe/Berlin');
}

beforeEach(() => {
  const built = buildTestWorld();
  app = built.app;
  world = built.world;
});

afterEach(async () => {
  await app.close();
});

describe('PUT /athletes/:athleteId/sleep', () => {
  it('records a night', async () => {
    const response = await inject(app, 'PUT', `/athletes/${ATHLETE_A}/sleep`, {
      as: ATHLETE_A_USER,
      body: { localDate: today(), hours: 7.5, quality: 4 },
    });
    expect(response.statusCode).toBe(200);
    expect(world.sleep).toHaveLength(1);
    expect(world.sleep[0]?.hours).toBe('7.50');
  });

  it('overwrites the same night rather than adding another row', async () => {
    const body = { localDate: today(), hours: 7.5, quality: 4 };
    await inject(app, 'PUT', `/athletes/${ATHLETE_A}/sleep`, { as: ATHLETE_A_USER, body });
    await inject(app, 'PUT', `/athletes/${ATHLETE_A}/sleep`, {
      as: ATHLETE_A_USER,
      body: { ...body, hours: 6 },
    });
    expect(world.sleep).toHaveLength(1);
    expect(world.sleep[0]?.hours).toBe('6.00');
  });

  it('refuses another athlete', async () => {
    const response = await inject(app, 'PUT', `/athletes/${ATHLETE_A}/sleep`, {
      as: ATHLETE_B_USER,
      body: { localDate: today(), hours: 7.5 },
    });
    expect(response.statusCode).toBe(403);
  });

  it('refuses hours nobody sleeps', async () => {
    const response = await inject(app, 'PUT', `/athletes/${ATHLETE_A}/sleep`, {
      as: ATHLETE_A_USER,
      body: { localDate: today(), hours: 30 },
    });
    expect(response.statusCode).toBe(400);
  });
});

describe('PUT /athletes/:athleteId/hydration', () => {
  it('records a day', async () => {
    const response = await inject(app, 'PUT', `/athletes/${ATHLETE_A}/hydration`, {
      as: ATHLETE_A_USER,
      body: { localDate: today(), litres: 2.4 },
    });
    expect(response.statusCode).toBe(200);
    expect(world.hydration[0]?.litres).toBe('2.40');
  });

  it('refuses a bathtub', async () => {
    const response = await inject(app, 'PUT', `/athletes/${ATHLETE_A}/hydration`, {
      as: ATHLETE_A_USER,
      body: { localDate: today(), litres: 40 },
    });
    expect(response.statusCode).toBe(400);
  });
});
