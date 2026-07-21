import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import {
  ATHLETE_A,
  ATHLETE_A_USER,
  ATHLETE_B_USER,
  HEAD_COACH_A,
  addSession,
  buildTestWorld,
  inject,
} from '../helpers/world.js';
import type { MemoryWorld } from '../helpers/memory_repos.js';

let app: FastifyInstance;
let world: MemoryWorld;

/** Four weeks of steady running ending Sunday 2026-06-14, Wednesdays off. */
function steadyMonth(): void {
  for (let back = 27; back >= 0; back -= 1) {
    const at = new Date(Date.parse('2026-06-14T06:00:00Z') - back * 86_400_000);
    if (at.getUTCDay() === 3) {
      continue;
    }
    addSession(world, {
      athleteId: ATHLETE_A,
      completedAt: at.toISOString(),
      load: 50,
      distanceM: 10_000,
    });
  }
}

beforeEach(() => {
  const built = buildTestWorld();
  app = built.app;
  world = built.world;
});

afterEach(async () => {
  await app.close();
});

describe('GET /athletes/:athleteId/readiness', () => {
  it('reports every rule for an athlete holding steady', async () => {
    steadyMonth();
    const response = await inject(app, 'GET', `/athletes/${ATHLETE_A}/readiness?asOf=2026-06-14`, {
      as: HEAD_COACH_A,
    });

    expect(response.statusCode).toBe(200);
    const body = response.json() as {
      asOf: string;
      timezone: string;
      readiness: { ok: boolean; findings: Array<{ rule: string; ok: boolean }> };
      broken: string[];
    };
    expect(body.asOf).toBe('2026-06-14');
    expect(body.timezone).toBe('Europe/Berlin');
    expect(body.readiness.findings.map((finding) => finding.rule)).toEqual(['R1', 'R2', 'R3', 'R8']);
    expect(body.broken).toEqual([]);
  });

  it('defaults to today in the athlete\'s own timezone', async () => {
    const response = await inject(app, 'GET', `/athletes/${ATHLETE_A}/readiness`, { as: HEAD_COACH_A });
    expect((response.json() as { asOf: string }).asOf).toBe('2026-06-15');
  });

  it('flags an athlete who has not had a day off', async () => {
    for (let back = 6; back >= 0; back -= 1) {
      const at = new Date(Date.parse('2026-06-14T06:00:00Z') - back * 86_400_000);
      addSession(world, { athleteId: ATHLETE_A, completedAt: at.toISOString(), load: 50 });
    }
    const response = await inject(app, 'GET', `/athletes/${ATHLETE_A}/readiness?asOf=2026-06-14`, {
      as: HEAD_COACH_A,
    });
    expect((response.json() as { broken: string[] }).broken).toContain('R3');
  });

  it('picks up the next goal race for the taper rule', async () => {
    steadyMonth();
    world.goals.push({
      id: 'goal-1',
      athleteId: ATHLETE_A,
      raceName: 'Harbour Half',
      raceDate: '2026-06-21',
      distanceM: 21_097,
      targetTimeS: 5400,
      state: 'active',
    });
    const response = await inject(app, 'GET', `/athletes/${ATHLETE_A}/readiness?asOf=2026-06-14`, {
      as: HEAD_COACH_A,
    });
    const body = response.json() as {
      goal: { raceName: string } | null;
      readiness: { taper: { inTaper: boolean; daysToRace: number } };
    };
    expect(body.goal?.raceName).toBe('Harbour Half');
    expect(body.readiness.taper.inTaper).toBe(true);
    expect(body.readiness.taper.daysToRace).toBe(7);
  });

  it('ignores a race that has already been run', async () => {
    world.goals.push({
      id: 'goal-old',
      athleteId: ATHLETE_A,
      raceName: 'Spring Half',
      raceDate: '2026-04-01',
      distanceM: 21_097,
      targetTimeS: 5400,
      state: 'completed',
    });
    const response = await inject(app, 'GET', `/athletes/${ATHLETE_A}/readiness?asOf=2026-06-14`, {
      as: HEAD_COACH_A,
    });
    expect((response.json() as { goal: unknown }).goal).toBeNull();
  });

  it('lets the athlete read their own', async () => {
    const response = await inject(app, 'GET', `/athletes/${ATHLETE_A}/readiness`, { as: ATHLETE_A_USER });
    expect(response.statusCode).toBe(200);
  });

  it('refuses another squad\'s athlete', async () => {
    const response = await inject(app, 'GET', `/athletes/${ATHLETE_A}/readiness`, { as: ATHLETE_B_USER });
    expect(response.statusCode).toBe(403);
  });
});
