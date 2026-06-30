import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import {
  ASSISTANT_A,
  ATHLETE_A,
  ATHLETE_A_USER,
  HEAD_COACH_A,
  PHYSIO,
  SQUAD_B,
  addSession,
  buildTestWorld,
  inject,
} from '../helpers/world.js';
import type { MemoryWorld } from '../helpers/memory_repos.js';

const PHYSIO_B_ONLY = 'user-physio-b';
const INJURY = 'injury-1';
const ASOF = '2026-06-15';

let app: FastifyInstance;
let world: MemoryWorld;

beforeEach(() => {
  const built = buildTestWorld();
  app = built.app;
  world = built.world;

  world.users.push({ id: PHYSIO_B_ONLY, name: 'Zerah Mbeki' });
  world.grants.push({ userId: PHYSIO_B_ONLY, squadId: SQUAD_B, role: 'physio' });

  const athlete = world.athletes.find((candidate) => candidate.id === ATHLETE_A);
  if (athlete) {
    athlete.state = 'injured';
  }
  world.injuries.push({
    id: INJURY,
    athleteId: ATHLETE_A,
    region: 'left achilles',
    onsetOn: '2026-06-01',
    severity: 6,
    notes: 'Invented record for tests.',
    resolvedOn: null,
  });
  world.sleep.push({ athleteId: ATHLETE_A, localDate: '2026-06-14', hours: '7.20', quality: 4 });
  addSession(world, { athleteId: ATHLETE_A, completedAt: '2026-06-10T06:00:00Z', load: 55 });
});

afterEach(async () => {
  await app.close();
});

/**
 * T4's shape: the two gates are held by two different roles, and the refusal
 * happens before the handler touches anything.
 */
describe('POST /injuries/:injuryId/clearances', () => {
  it('refuses an assistant coach and names the role they would have needed', async () => {
    const response = await inject(app, 'POST', `/injuries/${INJURY}/clearances`, {
      as: ASSISTANT_A,
      body: { asOf: ASOF, notes: 'looks fine to me' },
    });

    expect(response.statusCode).toBe(403);
    expect(response.json()).toEqual({
      error: 'forbidden',
      message: 'sign return-to-run clearance requires the physio role',
      requiredRole: 'physio',
    });
  });

  it('writes nothing when it refuses', async () => {
    await inject(app, 'POST', `/injuries/${INJURY}/clearances`, {
      as: ASSISTANT_A,
      body: { asOf: ASOF },
    });
    expect(world.clearances).toHaveLength(0);
  });

  it('refuses before it has even looked the injury up', async () => {
    // There is no such injury. A 404 here would mean the handler went to the
    // database before it decided whether this caller was allowed to.
    const response = await inject(app, 'POST', '/injuries/injury-does-not-exist/clearances', {
      as: ASSISTANT_A,
      body: { asOf: ASOF },
    });
    expect(response.statusCode).toBe(403);
  });

  it('refuses the head coach of the athlete\'s own squad', async () => {
    const response = await inject(app, 'POST', `/injuries/${INJURY}/clearances`, {
      as: HEAD_COACH_A,
      body: { asOf: ASOF },
    });
    expect(response.statusCode).toBe(403);
    expect((response.json() as { requiredRole: string }).requiredRole).toBe('physio');
  });

  it('refuses the athlete themselves', async () => {
    const response = await inject(app, 'POST', `/injuries/${INJURY}/clearances`, {
      as: ATHLETE_A_USER,
      body: { asOf: ASOF },
    });
    expect(response.statusCode).toBe(403);
  });

  it('refuses a physio who covers another squad', async () => {
    const response = await inject(app, 'POST', `/injuries/${INJURY}/clearances`, {
      as: PHYSIO_B_ONLY,
      body: { asOf: ASOF },
    });
    expect(response.statusCode).toBe(403);
  });

  it('refuses a caller with no identity at all', async () => {
    const response = await inject(app, 'POST', `/injuries/${INJURY}/clearances`, { body: { asOf: ASOF } });
    expect(response.statusCode).toBe(401);
  });

  it('lets the physio sign, and hands back the 28-day packet', async () => {
    const response = await inject(app, 'POST', `/injuries/${INJURY}/clearances`, {
      as: PHYSIO,
      body: { asOf: ASOF, notes: 'pain-free hopping, cleared for 20 minutes easy' },
    });

    expect(response.statusCode).toBe(201);
    const body = response.json() as {
      decision: string;
      clearance: { id: string; signedBy: string };
      packet: { days: Array<{ localDate: string; load: number; sleepHours: number | null; pain: number | null }> };
    };
    expect(body.decision).toBe('cleared');
    expect(body.clearance.signedBy).toBe(PHYSIO);
    expect(body.packet.days).toHaveLength(28);
    expect(body.packet.days.at(-1)?.localDate).toBe(ASOF);
    expect(body.packet.days.find((day) => day.localDate === '2026-06-10')?.load).toBe(55);
    expect(body.packet.days.find((day) => day.localDate === '2026-06-14')?.sleepHours).toBe(7.2);
    expect(body.packet.days.find((day) => day.localDate === '2026-06-14')?.pain).toBe(6);
    expect(world.clearances).toHaveLength(1);
  });

  it('refuses a second signature while the first one stands', async () => {
    await inject(app, 'POST', `/injuries/${INJURY}/clearances`, { as: PHYSIO, body: { asOf: ASOF } });
    const again = await inject(app, 'POST', `/injuries/${INJURY}/clearances`, {
      as: PHYSIO,
      body: { asOf: ASOF },
    });
    expect(again.statusCode).toBe(409);
    expect(world.clearances).toHaveLength(1);
  });
});

describe('POST /clearances/:clearanceId/revoke', () => {
  async function signed(): Promise<string> {
    const response = await inject(app, 'POST', `/injuries/${INJURY}/clearances`, {
      as: PHYSIO,
      body: { asOf: ASOF },
    });
    return (response.json() as { clearance: { id: string } }).clearance.id;
  }

  it('lets the physio withdraw a signature', async () => {
    const id = await signed();
    const response = await inject(app, 'POST', `/clearances/${id}/revoke`, {
      as: PHYSIO,
      body: { reason: 'flared up again' },
    });
    expect(response.statusCode).toBe(200);
    expect(world.clearances[0]?.revokedAt).not.toBeNull();
  });

  it('refuses an assistant coach', async () => {
    const id = await signed();
    const response = await inject(app, 'POST', `/clearances/${id}/revoke`, { as: ASSISTANT_A });
    expect(response.statusCode).toBe(403);
    expect((response.json() as { requiredRole: string }).requiredRole).toBe('physio');
    expect(world.clearances[0]?.revokedAt).toBeNull();
  });

  it('refuses to withdraw the same signature twice', async () => {
    const id = await signed();
    await inject(app, 'POST', `/clearances/${id}/revoke`, { as: PHYSIO });
    const again = await inject(app, 'POST', `/clearances/${id}/revoke`, { as: PHYSIO });
    expect(again.statusCode).toBe(409);
  });
});

describe('GET /athletes/:athleteId/clearance-packet', () => {
  it('tells a coach why their athlete is not running', async () => {
    const response = await inject(app, 'GET', `/athletes/${ATHLETE_A}/clearance-packet?asOf=${ASOF}`, {
      as: HEAD_COACH_A,
    });
    expect(response.statusCode).toBe(200);
    const body = response.json() as {
      decision: { allowed: boolean; reason: string; blockingInjuryIds: string[] };
      canSign: boolean;
    };
    expect(body.decision.allowed).toBe(false);
    expect(body.decision.blockingInjuryIds).toEqual([INJURY]);
    expect(body.canSign).toBe(false);
  });

  it('tells the physio they are the one who can sign it', async () => {
    const response = await inject(app, 'GET', `/athletes/${ATHLETE_A}/clearance-packet?asOf=${ASOF}`, {
      as: PHYSIO,
    });
    expect((response.json() as { canSign: boolean }).canSign).toBe(true);
  });

  it('opens the gate once the signature is in', async () => {
    await inject(app, 'POST', `/injuries/${INJURY}/clearances`, { as: PHYSIO, body: { asOf: ASOF } });
    const response = await inject(app, 'GET', `/athletes/${ATHLETE_A}/clearance-packet?asOf=${ASOF}`, {
      as: PHYSIO,
    });
    expect((response.json() as { decision: { allowed: boolean } }).decision.allowed).toBe(true);
  });

  it('refuses a coach from another squad', async () => {
    const response = await inject(app, 'GET', `/athletes/${ATHLETE_A}/clearance-packet?asOf=${ASOF}`, {
      as: 'user-head-b',
    });
    expect(response.statusCode).toBe(403);
  });
});
