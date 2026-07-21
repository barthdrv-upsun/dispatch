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

describe('POST /athletes/:athleteId/sessions', () => {
  it('lets an athlete log their own session', async () => {
    const response = await inject(app, 'POST', `/athletes/${ATHLETE_A}/sessions`, {
      as: ATHLETE_A_USER,
      body: body(),
    });
    expect(response.statusCode).toBe(201);
    expect((response.json() as { session: { load: number } }).session.load).toBe(200);
    expect(world.sessions).toHaveLength(1);
  });

  it('lets a coach log it for them', async () => {
    const response = await inject(app, 'POST', `/athletes/${ATHLETE_A}/sessions`, {
      as: ASSISTANT_A,
      body: body(),
    });
    expect(response.statusCode).toBe(201);
  });

  it('refuses another athlete', async () => {
    const response = await inject(app, 'POST', `/athletes/${ATHLETE_A}/sessions`, {
      as: ATHLETE_B_USER,
      body: body(),
    });
    expect(response.statusCode).toBe(403);
    expect(world.sessions).toHaveLength(0);
  });

  it('refuses a physio', async () => {
    const response = await inject(app, 'POST', `/athletes/${ATHLETE_A}/sessions`, {
      as: PHYSIO,
      body: body(),
    });
    expect(response.statusCode).toBe(403);
  });

  it('refuses a session from the future', async () => {
    const response = await inject(app, 'POST', `/athletes/${ATHLETE_A}/sessions`, {
      as: ATHLETE_A_USER,
      body: body({ completedAt: new Date(Date.now() + 86_400_000).toISOString() }),
    });
    expect(response.statusCode).toBe(400);
  });

  it('refuses a template nobody has', async () => {
    const response = await inject(app, 'POST', `/athletes/${ATHLETE_A}/sessions`, {
      as: ATHLETE_A_USER,
      body: body({ templateId: 'template-nope' }),
    });
    expect(response.statusCode).toBe(404);
  });

  /** R4, over HTTP. */
  describe('an injured athlete with nothing signed', () => {
    beforeEach(() => {
      const athlete = world.athletes.find((candidate) => candidate.id === ATHLETE_A);
      if (athlete) {
        athlete.state = 'injured';
      }
      world.injuries.push({
        id: 'injury-1',
        athleteId: ATHLETE_A,
        region: 'left achilles',
        onsetOn: '2026-06-01',
        severity: 6,
        notes: null,
        resolvedOn: null,
      });
    });

    it('cannot be credited a run', async () => {
      const response = await inject(app, 'POST', `/athletes/${ATHLETE_A}/sessions`, {
        as: ATHLETE_A_USER,
        body: body(),
      });
      expect(response.statusCode).toBe(409);
      expect((response.json() as { message: string }).message).toContain('cannot be credited');
      expect(world.sessions).toHaveLength(0);
    });

    it('can still be credited a bike ride', async () => {
      const response = await inject(app, 'POST', `/athletes/${ATHLETE_A}/sessions`, {
        as: ATHLETE_A_USER,
        body: body({ templateId: 'template-bike' }),
      });
      expect(response.statusCode).toBe(201);
    });

    it('can be credited a run once the physio signs', async () => {
      await inject(app, 'POST', '/injuries/injury-1/clearances', { as: PHYSIO, body: {} });
      const response = await inject(app, 'POST', `/athletes/${ATHLETE_A}/sessions`, {
        as: ATHLETE_A_USER,
        body: body(),
      });
      expect(response.statusCode).toBe(201);
    });
  });

  /** R7, over HTTP. */
  describe('shoes', () => {
    it('puts the mileage on the pair that ran', async () => {
      const response = await inject(app, 'POST', `/athletes/${ATHLETE_A}/sessions`, {
        as: ATHLETE_A_USER,
        body: body({ shoeId: 'shoe-fresh' }),
      });
      expect(response.statusCode).toBe(201);
      expect(world.shoes.find((shoe) => shoe.id === 'shoe-fresh')?.currentKm).toBe('630.00');
    });

    it('refuses a pair that is past its retirement threshold', async () => {
      const response = await inject(app, 'POST', `/athletes/${ATHLETE_A}/sessions`, {
        as: ATHLETE_A_USER,
        body: body({ shoeId: 'shoe-worn' }),
      });
      expect(response.statusCode).toBe(409);
      expect((response.json() as { message: string }).message).toContain('retirement threshold');
      expect(world.sessions).toHaveLength(0);
    });

    it('retires a pair that crosses the threshold on this run', async () => {
      const shoe = world.shoes.find((candidate) => candidate.id === 'shoe-fresh');
      if (shoe) {
        shoe.currentKm = '795.00';
      }
      await inject(app, 'POST', `/athletes/${ATHLETE_A}/sessions`, {
        as: ATHLETE_A_USER,
        body: body({ shoeId: 'shoe-fresh' }),
      });
      const after = world.shoes.find((candidate) => candidate.id === 'shoe-fresh');
      expect(after?.currentKm).toBe('805.00');
      expect(after?.retiredAt).toEqual(new Date('2026-06-15T08:00:00.000Z'));
    });

    it('refuses a pair belonging to somebody else', async () => {
      world.shoes.push({
        id: 'shoe-theirs',
        athleteId: 'athlete-b',
        model: 'Kestrel Trail 7',
        purchasedOn: '2026-01-05',
        retireAtKm: '800.00',
        currentKm: '10.00',
        retiredAt: null,
      });
      const response = await inject(app, 'POST', `/athletes/${ATHLETE_A}/sessions`, {
        as: HEAD_COACH_A,
        body: body({ shoeId: 'shoe-theirs' }),
      });
      expect(response.statusCode).toBe(400);
    });
  });
});
