import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import {
  ASSISTANT_A,
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

const TEMPLATE = 'template-easy';

let app: FastifyInstance;
let world: MemoryWorld;

beforeEach(() => {
  const built = buildTestWorld();
  app = built.app;
  world = built.world;
  addTemplate(world, { id: TEMPLATE, squadId: SQUAD_A, code: 'EASY-45', kind: 'easy' });
});

afterEach(async () => {
  await app.close();
});

async function draft(as: string = HEAD_COACH_A, weeks = 2): Promise<string> {
  const response = await inject(app, 'POST', `/squads/${SQUAD_A}/blocks`, {
    as,
    body: { name: 'Autumn base', weeks },
  });
  return (response.json() as { block: { id: string } }).block.id;
}

async function fill(blockId: string, weeks = 2): Promise<void> {
  for (let week = 1; week <= weeks; week += 1) {
    await inject(app, 'PUT', `/blocks/${blockId}/slots`, {
      as: HEAD_COACH_A,
      body: { week, day: 1, templateId: TEMPLATE },
    });
  }
}

describe('drafting', () => {
  it('lets an assistant coach draft a block', async () => {
    const response = await inject(app, 'POST', `/squads/${SQUAD_A}/blocks`, {
      as: ASSISTANT_A,
      body: { name: 'Autumn base', weeks: 4 },
    });
    expect(response.statusCode).toBe(201);
    expect((response.json() as { block: { state: string } }).block.state).toBe('draft');
  });

  it('refuses an athlete', async () => {
    const response = await inject(app, 'POST', `/squads/${SQUAD_A}/blocks`, {
      as: ATHLETE_A_USER,
      body: { name: 'Autumn base', weeks: 4 },
    });
    expect(response.statusCode).toBe(403);
  });

  it('refuses a coach from another squad', async () => {
    const response = await inject(app, 'POST', `/squads/${SQUAD_A}/blocks`, {
      as: HEAD_COACH_B,
      body: { name: 'Autumn base', weeks: 4 },
    });
    expect(response.statusCode).toBe(403);
  });

  it('turns down a block that is not a block', async () => {
    const response = await inject(app, 'POST', `/squads/${SQUAD_A}/blocks`, {
      as: HEAD_COACH_A,
      body: { name: 'x', weeks: 4 },
    });
    expect(response.statusCode).toBe(400);
  });
});

describe('putting sessions on a block', () => {
  it('replaces whatever was on that day', async () => {
    const blockId = await draft();
    addTemplate(world, { id: 'template-tempo', squadId: SQUAD_A, code: 'TEMPO-4X8', kind: 'tempo' });
    await inject(app, 'PUT', `/blocks/${blockId}/slots`, {
      as: ASSISTANT_A,
      body: { week: 1, day: 1, templateId: TEMPLATE },
    });
    const second = await inject(app, 'PUT', `/blocks/${blockId}/slots`, {
      as: ASSISTANT_A,
      body: { week: 1, day: 1, templateId: 'template-tempo' },
    });
    expect(second.statusCode).toBe(200);
    expect((second.json() as { slots: unknown[] }).slots).toHaveLength(1);
  });

  it('refuses a week past the end of the block', async () => {
    const blockId = await draft();
    const response = await inject(app, 'PUT', `/blocks/${blockId}/slots`, {
      as: HEAD_COACH_A,
      body: { week: 9, day: 1, templateId: TEMPLATE },
    });
    expect(response.statusCode).toBe(400);
  });

  it('refuses another squad\'s template', async () => {
    const blockId = await draft();
    addTemplate(world, { id: 'template-b', squadId: 'squad-b', code: 'EASY-45', kind: 'easy' });
    const response = await inject(app, 'PUT', `/blocks/${blockId}/slots`, {
      as: HEAD_COACH_A,
      body: { week: 1, day: 1, templateId: 'template-b' },
    });
    expect(response.statusCode).toBe(400);
  });

  it('refuses to edit a block that has been published', async () => {
    const blockId = await draft();
    await fill(blockId);
    await inject(app, 'POST', `/blocks/${blockId}/publish`, { as: HEAD_COACH_A });
    const response = await inject(app, 'PUT', `/blocks/${blockId}/slots`, {
      as: HEAD_COACH_A,
      body: { week: 1, day: 2, templateId: TEMPLATE },
    });
    expect(response.statusCode).toBe(400);
  });
});

/** R5: publishing is the head coach's gate. */
describe('POST /blocks/:blockId/publish', () => {
  it('refuses an assistant coach and names the role', async () => {
    const blockId = await draft(ASSISTANT_A);
    await fill(blockId);
    const response = await inject(app, 'POST', `/blocks/${blockId}/publish`, { as: ASSISTANT_A });

    expect(response.statusCode).toBe(403);
    expect(response.json()).toEqual({
      error: 'forbidden',
      message: 'publish a training block requires the head_coach role',
      requiredRole: 'head_coach',
    });
    expect(world.blocks[0]?.state).toBe('draft');
  });

  it('refuses a physio', async () => {
    const blockId = await draft();
    await fill(blockId);
    const response = await inject(app, 'POST', `/blocks/${blockId}/publish`, { as: PHYSIO });
    expect(response.statusCode).toBe(403);
  });

  it('lets the head coach publish and records who and when', async () => {
    const blockId = await draft();
    await fill(blockId);
    const response = await inject(app, 'POST', `/blocks/${blockId}/publish`, { as: HEAD_COACH_A });

    expect(response.statusCode).toBe(200);
    const block = (response.json() as { block: { state: string; publishedBy: string; publishedAt: string } }).block;
    expect(block.state).toBe('published');
    expect(block.publishedBy).toBe(HEAD_COACH_A);
    expect(block.publishedAt).toBe('2026-06-15T08:00:00.000Z');
  });

  it('refuses a block with an empty week', async () => {
    const blockId = await draft(HEAD_COACH_A, 3);
    await fill(blockId, 2);
    const response = await inject(app, 'POST', `/blocks/${blockId}/publish`, { as: HEAD_COACH_A });
    expect(response.statusCode).toBe(400);
    expect((response.json() as { details: { emptyWeeks: number[] } }).details.emptyWeeks).toEqual([3]);
  });

  it('refuses to publish twice', async () => {
    const blockId = await draft();
    await fill(blockId);
    await inject(app, 'POST', `/blocks/${blockId}/publish`, { as: HEAD_COACH_A });
    const again = await inject(app, 'POST', `/blocks/${blockId}/publish`, { as: HEAD_COACH_A });
    expect(again.statusCode).toBe(409);
  });
});
