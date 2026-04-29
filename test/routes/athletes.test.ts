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

describe('GET /squads/:squadId/athletes', () => {
  it('returns only that squad\'s athletes', async () => {
    const response = await inject(app, 'GET', `/squads/${SQUAD_A}/athletes`, { as: HEAD_COACH_A });
    expect(response.statusCode).toBe(200);
    const body = response.json() as { athletes: Array<{ id: string; squadId: string }> };
    expect(body.athletes.map((entry) => entry.id)).toEqual([ATHLETE_A, 'athlete-a2']);
    expect(body.athletes.every((entry) => entry.squadId === SQUAD_A)).toBe(true);
  });

  it('does not leak another squad\'s roster to a coach who asks for it', async () => {
    const response = await inject(app, 'GET', `/squads/${SQUAD_B}/athletes`, { as: HEAD_COACH_A });
    expect(response.statusCode).toBe(403);
    expect(response.body).not.toContain(ATHLETE_B);
  });

  it('lets the physio read either squad', async () => {
    expect((await inject(app, 'GET', `/squads/${SQUAD_A}/athletes`, { as: PHYSIO })).statusCode).toBe(200);
    expect((await inject(app, 'GET', `/squads/${SQUAD_B}/athletes`, { as: PHYSIO })).statusCode).toBe(200);
  });

  it('refuses an athlete asking for the whole roster', async () => {
    const response = await inject(app, 'GET', `/squads/${SQUAD_A}/athletes`, { as: ATHLETE_A_USER });
    expect(response.statusCode).toBe(403);
  });

  it('sends no dates of birth', async () => {
    const response = await inject(app, 'GET', `/squads/${SQUAD_A}/athletes`, { as: ASSISTANT_A });
    expect(response.body).not.toContain('1994');
    expect(response.body).not.toContain('1999');
  });
});

describe('PATCH /athletes/:athleteId/state', () => {
  it('lets the head coach mark an athlete injured', async () => {
    const response = await inject(app, 'PATCH', `/athletes/${ATHLETE_A}/state`, {
      as: HEAD_COACH_A,
      body: { state: 'injured' },
    });
    expect(response.statusCode).toBe(200);
    expect(world.athletes.find((entry) => entry.id === ATHLETE_A)?.state).toBe('injured');
  });

  it('refuses an assistant coach', async () => {
    const response = await inject(app, 'PATCH', `/athletes/${ATHLETE_A}/state`, {
      as: ASSISTANT_A,
      body: { state: 'injured' },
    });
    expect(response.statusCode).toBe(403);
    expect(world.athletes.find((entry) => entry.id === ATHLETE_A)?.state).toBe('active');
  });

  it('refuses a state that is not one of the three', async () => {
    const response = await inject(app, 'PATCH', `/athletes/${ATHLETE_A}/state`, {
      as: HEAD_COACH_A,
      body: { state: 'tired' },
    });
    expect(response.statusCode).toBe(400);
  });

  it('refuses a transition the athlete cannot make', async () => {
    const response = await inject(app, 'PATCH', `/athletes/${ATHLETE_A}/state`, {
      as: HEAD_COACH_A,
      body: { state: 'returning' },
    });
    expect(response.statusCode).toBe(409);
  });
});
