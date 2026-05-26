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
