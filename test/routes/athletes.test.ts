import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import {
  ASSISTANT_A,
  ATHLETE_A,
  ATHLETE_A_USER,
  ATHLETE_B,
  ATHLETE_B_USER,
  HEAD_COACH_A,
  HEAD_COACH_B,
  PHYSIO,
  SQUAD_A,
  SQUAD_B,
  athlete,
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
  world.athletes.push(
    athlete({ id: 'athlete-a2', squadId: SQUAD_A, userId: 'user-athlete-a2', dateOfBirth: '1999-02-02' }),
  );
});

afterEach(async () => {
  await app.close();
});

describe('GET /athletes/:athleteId', () => {
  it('lets a coach read their own athlete', async () => {
    const response = await inject(app, 'GET', `/athletes/${ATHLETE_A}`, { as: HEAD_COACH_A });
    expect(response.statusCode).toBe(200);
    expect((response.json() as { today: string }).today).toBe('2026-06-15');
  });

  it('lets an athlete read themselves', async () => {
    const response = await inject(app, 'GET', `/athletes/${ATHLETE_A}`, { as: ATHLETE_A_USER });
    expect(response.statusCode).toBe(200);
  });

  it('refuses a coach from another squad', async () => {
    const response = await inject(app, 'GET', `/athletes/${ATHLETE_A}`, { as: HEAD_COACH_B });
    expect(response.statusCode).toBe(403);
  });

  it('refuses one athlete reading another', async () => {
    const response = await inject(app, 'GET', `/athletes/${ATHLETE_A}`, { as: ATHLETE_B_USER });
    expect(response.statusCode).toBe(403);
  });

  it('never sends the date of birth to the client', async () => {
    const response = await inject(app, 'GET', `/athletes/${ATHLETE_A}`, { as: HEAD_COACH_A });
    expect(response.body).not.toContain('dateOfBirth');
    expect(response.body).not.toContain('1994');
  });

  it('404s an athlete who does not exist', async () => {
    const response = await inject(app, 'GET', '/athletes/nobody', { as: HEAD_COACH_A });
    expect(response.statusCode).toBe(404);
  });
});
