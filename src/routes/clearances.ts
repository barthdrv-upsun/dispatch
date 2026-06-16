import { NotFoundError } from '../lib/errors.js';
import { addLocalDays, athleteLocalDay } from '../lib/time.js';
import {
  requireRoleInSquad,
  requireRoleSomewhere,
  hasRoleInSquad,
  type Actor,
} from '../domain/authz.js';
import { assertCanReadAthlete } from '../domain/athletes/roster.js';
import { assessReturnToRun } from '../domain/clearances/gate.js';
import { buildClearancePacket, PACKET_DAYS } from '../domain/clearances/packet.js';
import {
  REVOKE_CLEARANCE_ACTION,
  SIGN_CLEARANCE_ACTION,
  revokeClearance,
  signClearance,
} from '../domain/clearances/sign.js';
import type { Clearance, ClearancePacket, Injury } from '../domain/clearances/types.js';
import { toRunningLoadEntries } from '../domain/load/entries.js';
import type { Athlete } from '../domain/athletes/types.js';
import type { ClearanceRow, InjuryRow, Repositories } from '../ports/index.js';
import { actorFor, requiredParam, type RouteDeps } from './context.js';
import type { FastifyInstance } from 'fastify';

function toInjury(row: InjuryRow): Injury {
  return {
    id: row.id,
    athleteId: row.athleteId,
    region: row.region,
    onsetOn: row.onsetOn,
    severity: row.severity,
    notes: row.notes,
    resolvedOn: row.resolvedOn,
  };
}

function toClearance(row: ClearanceRow): Clearance {
  return {
    id: row.id,
    injuryId: row.injuryId,
    signedBy: row.signedBy,
    signedAt: row.signedAt,
    revokedAt: row.revokedAt,
    notes: row.notes,
    loadSnapshot: row.loadSnapshot,
  };
}

async function packetFor(
  repos: Repositories,
  athlete: Athlete,
  asOf: string,
): Promise<ClearancePacket> {
  const from = addLocalDays(asOf, -(PACKET_DAYS - 1));
  const [sessions, sleep, injuries] = await Promise.all([
    repos.sessions.forAthleteFrom(athlete.id, new Date(`${from}T00:00:00Z`)),
    repos.wellness.sleepFrom(athlete.id, from),
    repos.injuries.forAthlete(athlete.id),
  ]);
  return buildClearancePacket({
    athleteId: athlete.id,
    asOf,
    loadEntries: toRunningLoadEntries(sessions, athlete.timezone),
    sleepLogs: sleep,
    injuries: injuries.map(toInjury),
  });
}

async function loadInjuryAndAthlete(
  repos: Repositories,
  injuryId: string,
): Promise<{ injury: Injury; athlete: Athlete }> {
  const injuryRow = await repos.injuries.byId(injuryId);
  if (!injuryRow) {
    throw new NotFoundError(`no injury ${injuryId}`);
  }
  const athlete = await repos.athletes.byId(injuryRow.athleteId);
  if (!athlete) {
    throw new NotFoundError(`no athlete ${injuryRow.athleteId}`);
  }
  return { injury: toInjury(injuryRow), athlete };
}

/**
 * R4's endpoints.
 *
 * Signing is a physio's job and nobody else's - not the head coach who runs
 * the squad, and not the assistant coach who wrote the block. The role check
 * is the first thing each handler does, before the injury is even read,
 * because a refusal should not depend on what the record says.
 */
export function clearanceRoutes(app: FastifyInstance, deps: RouteDeps): void {
  const { repos, clock } = deps;

  app.post('/injuries/:injuryId/clearances', async (request, reply) => {
    const actor = await actorFor(request, repos);
    // Authorisation first: a caller holding no physio grant anywhere cannot
    // sign anything, so there is nothing to look up.
    requireRoleSomewhere(actor, 'physio', SIGN_CLEARANCE_ACTION);

    const injuryId = requiredParam(request.params, 'injuryId');
    const { injury, athlete } = await loadInjuryAndAthlete(repos, injuryId);
    requireRoleInSquad(actor, athlete.squadId, 'physio', SIGN_CLEARANCE_ACTION);

    const body = (request.body ?? {}) as { notes?: string | null; asOf?: string };
    const asOf = body.asOf ?? athleteLocalDay(clock.now(), athlete.timezone);
    const existing = (await repos.injuries.clearancesForAthlete(athlete.id)).map(toClearance);
    const packet = await packetFor(repos, athlete, asOf);

    const clearance = signClearance(
      {
        injury,
        athleteSquadId: athlete.squadId,
        actor,
        existing,
        packet,
        notes: body.notes ?? null,
      },
      clock,
    );
    const id = await repos.injuries.insertClearance(clearance);

    return reply.code(201).send({
      clearance: { id, injuryId: clearance.injuryId, signedBy: clearance.signedBy, signedAt: clearance.signedAt },
      decision: 'cleared',
      packet,
    });
  });

  app.post('/clearances/:clearanceId/revoke', async (request, reply) => {
    const actor = await actorFor(request, repos);
    requireRoleSomewhere(actor, 'physio', REVOKE_CLEARANCE_ACTION);

    const clearanceId = requiredParam(request.params, 'clearanceId');
    const row = await repos.injuries.clearanceById(clearanceId);
    if (!row) {
      throw new NotFoundError(`no clearance ${clearanceId}`);
    }
    const { athlete } = await loadInjuryAndAthlete(repos, row.injuryId);
    requireRoleInSquad(actor, athlete.squadId, 'physio', REVOKE_CLEARANCE_ACTION);

    const body = (request.body ?? {}) as { reason?: string | null };
    const revoked = revokeClearance(
      { clearance: toClearance(row), athleteSquadId: athlete.squadId, actor, reason: body.reason ?? null },
      clock,
    );
    await repos.injuries.saveClearance({ ...row, revokedAt: revoked.revokedAt, notes: revoked.notes });

    return reply.code(200).send({ clearance: { id: row.id, revokedAt: revoked.revokedAt }, decision: 'revoked' });
  });

  /**
   * The packet on its own, for a physio deciding whether to sign and for a
   * coach who wants to know why their athlete is still on the bike.
   */
  app.get('/athletes/:athleteId/clearance-packet', async (request, reply) => {
    const actor = await actorFor(request, repos);
    const athleteId = requiredParam(request.params, 'athleteId');
    const athlete = await repos.athletes.byId(athleteId);
    if (!athlete) {
      throw new NotFoundError(`no athlete ${athleteId}`);
    }
    assertCanReadAthlete(actor, athlete, 'read a clearance packet');

    const query = request.query as { asOf?: string };
    const asOf = query.asOf ?? athleteLocalDay(clock.now(), athlete.timezone);
    const [packet, injuryRows, clearanceRows, physios] = await Promise.all([
      packetFor(repos, athlete, asOf),
      repos.injuries.forAthlete(athlete.id),
      repos.injuries.clearancesForAthlete(athlete.id),
      repos.users.physioUserIds(athlete.squadId),
    ]);
    const physioIds = new Set(physios);
    const decision = assessReturnToRun({
      state: athlete.state,
      injuries: injuryRows.map(toInjury),
      clearances: clearanceRows.map(toClearance),
      asOf,
      isPhysio: (userId) => physioIds.has(userId),
    });

    return reply.code(200).send({
      athleteId: athlete.id,
      asOf,
      state: athlete.state,
      decision,
      packet,
      canSign: canSign(actor, athlete),
    });
  });
}

function canSign(actor: Actor, athlete: Athlete): boolean {
  return hasRoleInSquad(actor, athlete.squadId, 'physio');
}
