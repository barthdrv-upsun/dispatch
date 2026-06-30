import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import {
  ASSISTANT_A,
  ATHLETE_A,
  ATHLETE_A_USER,
  HEAD_COACH_A,
  HEAD_COACH_B,
  PHYSIO,
  SQUAD_A,
  addTemplate,
  buildTestWorld,
  inject,
} from '../helpers/world.js';
import type { MemoryWorld } from '../helpers/memory_repos.js';

/** A Monday. */
const STARTS_ON = '2026-06-22';
const GOAL = 'goal-1';

let app: FastifyInstance;
let world: MemoryWorld;

beforeEach(() => {
  const built = buildTestWorld();
  app = built.app;
  world = built.world;
  addTemplate(world, { id: 'template-easy', squadId: SQUAD_A, code: 'EASY-45', kind: 'easy' });
  addTemplate(world, { id: 'template-bike', squadId: SQUAD_A, code: 'BIKE-60', kind: 'cycling' });
  world.goals.push({
    id: GOAL,
    athleteId: ATHLETE_A,
    raceName: 'Harbour Half',
    raceDate: '2026-09-13',
    distanceM: 21_097,
    targetTimeS: 5400,
    state: 'active',
  });
});

afterEach(async () => {
  await app.close();
});

async function publishedBlock(templateId = 'template-easy'): Promise<string> {
  const created = await inject(app, 'POST', `/squads/${SQUAD_A}/blocks`, {
    as: HEAD_COACH_A,
    body: { name: 'Autumn base', weeks: 2 },
  });
  const blockId = (created.json() as { block: { id: string } }).block.id;
  for (let week = 1; week <= 2; week += 1) {
    await inject(app, 'PUT', `/blocks/${blockId}/slots`, {
      as: HEAD_COACH_A,
      body: { week, day: 1, templateId },
    });
  }
  await inject(app, 'POST', `/blocks/${blockId}/publish`, { as: HEAD_COACH_A });
  return blockId;
}

describe('POST /athletes/:athleteId/plans', () => {
  it('assigns a plan and pins the block version', async () => {
    const blockId = await publishedBlock();
    const response = await inject(app, 'POST', `/athletes/${ATHLETE_A}/plans`, {
      as: HEAD_COACH_A,
      body: { blockId, goalId: GOAL, startsOn: STARTS_ON },
    });
    expect(response.statusCode).toBe(201);
    const plan = (response.json() as { plan: { blockVersion: number; startsOn: string } }).plan;
    expect(plan.blockVersion).toBe(1);
    expect(plan.startsOn).toBe(STARTS_ON);
  });

  /** R5: the plan does not follow the block forward. */
  it('keeps the pinned version after the block is revised', async () => {
    const blockId = await publishedBlock();
    await inject(app, 'POST', `/athletes/${ATHLETE_A}/plans`, {
      as: HEAD_COACH_A,
      body: { blockId, goalId: GOAL, startsOn: STARTS_ON },
    });
    await inject(app, 'POST', `/blocks/${blockId}/revisions`, {
      as: HEAD_COACH_A,
      body: { name: 'Autumn base plus' },
    });

    const response = await inject(app, 'GET', `/athletes/${ATHLETE_A}/plans`, { as: HEAD_COACH_A });
    const plans = (response.json() as { plans: Array<{ blockVersion: number }> }).plans;
    expect(plans).toHaveLength(1);
    expect(plans[0]?.blockVersion).toBe(1);
    expect(world.blocks.map((block) => block.version).sort()).toEqual([1, 2]);
  });

  it('refuses an assistant coach', async () => {
    const blockId = await publishedBlock();
    const response = await inject(app, 'POST', `/athletes/${ATHLETE_A}/plans`, {
      as: ASSISTANT_A,
      body: { blockId, startsOn: STARTS_ON },
    });
    expect(response.statusCode).toBe(403);
    expect((response.json() as { requiredRole: string }).requiredRole).toBe('head_coach');
    expect(world.plans).toHaveLength(0);
  });

  it('refuses a coach from another squad', async () => {
    const blockId = await publishedBlock();
    const response = await inject(app, 'POST', `/athletes/${ATHLETE_A}/plans`, {
      as: HEAD_COACH_B,
      body: { blockId, startsOn: STARTS_ON },
    });
    expect(response.statusCode).toBe(403);
  });

  it('refuses a draft block', async () => {
    const created = await inject(app, 'POST', `/squads/${SQUAD_A}/blocks`, {
      as: HEAD_COACH_A,
      body: { name: 'Winter base', weeks: 2 },
    });
    const blockId = (created.json() as { block: { id: string } }).block.id;
    await inject(app, 'PUT', `/blocks/${blockId}/slots`, {
      as: HEAD_COACH_A,
      body: { week: 1, day: 1, templateId: 'template-easy' },
    });
    const response = await inject(app, 'POST', `/athletes/${ATHLETE_A}/plans`, {
      as: HEAD_COACH_A,
      body: { blockId, startsOn: STARTS_ON },
    });
    expect(response.statusCode).toBe(409);
  });

  it('refuses a start date that is not a Monday', async () => {
    const blockId = await publishedBlock();
    const response = await inject(app, 'POST', `/athletes/${ATHLETE_A}/plans`, {
      as: HEAD_COACH_A,
      body: { blockId, startsOn: '2026-06-23' },
    });
    expect(response.statusCode).toBe(400);
  });

  it('refuses a goal belonging to somebody else', async () => {
    const blockId = await publishedBlock();
    world.goals.push({ ...world.goals[0]!, id: 'goal-b', athleteId: 'athlete-b' });
    const response = await inject(app, 'POST', `/athletes/${ATHLETE_A}/plans`, {
      as: HEAD_COACH_A,
      body: { blockId, goalId: 'goal-b', startsOn: STARTS_ON },
    });
    expect(response.statusCode).toBe(400);
  });

  /** R4, from the prescribing end. */
  describe('an injured athlete with nothing signed', () => {
    beforeEach(() => {
      const target = world.athletes.find((candidate) => candidate.id === ATHLETE_A);
      if (target) {
        target.state = 'injured';
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

    it('cannot be prescribed a running block', async () => {
      const blockId = await publishedBlock();
      const response = await inject(app, 'POST', `/athletes/${ATHLETE_A}/plans`, {
        as: HEAD_COACH_A,
        body: { blockId, startsOn: STARTS_ON },
      });
      expect(response.statusCode).toBe(409);
      expect((response.json() as { message: string }).message).toContain('cannot be prescribed running');
      expect(world.plans).toHaveLength(0);
    });

    it('can still be prescribed a block of turbo sessions', async () => {
      const blockId = await publishedBlock('template-bike');
      const response = await inject(app, 'POST', `/athletes/${ATHLETE_A}/plans`, {
        as: HEAD_COACH_A,
        body: { blockId, startsOn: STARTS_ON },
      });
      expect(response.statusCode).toBe(201);
    });

    it('can be prescribed running once the physio signs', async () => {
      const blockId = await publishedBlock();
      await inject(app, 'POST', '/injuries/injury-1/clearances', { as: PHYSIO, body: {} });
      const response = await inject(app, 'POST', `/athletes/${ATHLETE_A}/plans`, {
        as: HEAD_COACH_A,
        body: { blockId, startsOn: STARTS_ON },
      });
      expect(response.statusCode).toBe(201);
    });
  });
});

describe('GET /plans/:planId/sessions', () => {
  it('lays the pinned block out on the calendar', async () => {
    const blockId = await publishedBlock();
    const created = await inject(app, 'POST', `/athletes/${ATHLETE_A}/plans`, {
      as: HEAD_COACH_A,
      body: { blockId, goalId: GOAL, startsOn: STARTS_ON },
    });
    const planId = (created.json() as { plan: { id: string } }).plan.id;

    const response = await inject(app, 'GET', `/plans/${planId}/sessions`, { as: ATHLETE_A_USER });
    expect(response.statusCode).toBe(200);
    const body = response.json() as {
      blockVersion: number;
      sessions: Array<{ scheduledFor: string; kind: string; prescribedLoad: number }>;
    };
    expect(body.blockVersion).toBe(1);
    expect(body.sessions.map((session) => session.scheduledFor)).toEqual(['2026-06-22', '2026-06-29']);
    expect(body.sessions[0]?.kind).toBe('easy');
  });

  it('refuses another squad\'s coach', async () => {
    const blockId = await publishedBlock();
    const created = await inject(app, 'POST', `/athletes/${ATHLETE_A}/plans`, {
      as: HEAD_COACH_A,
      body: { blockId, startsOn: STARTS_ON },
    });
    const planId = (created.json() as { plan: { id: string } }).plan.id;
    const response = await inject(app, 'GET', `/plans/${planId}/sessions`, { as: HEAD_COACH_B });
    expect(response.statusCode).toBe(403);
  });
});
