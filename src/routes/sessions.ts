import type { FastifyInstance } from 'fastify';
import { NotFoundError, ValidationError } from '../lib/errors.js';
import { athleteLocalDay } from '../lib/time.js';
import { toNumber } from '../lib/numbers.js';
import { requireSelfOrCoach } from '../domain/authz.js';
import { assessReturnToRun } from '../domain/clearances/gate.js';
import { buildSession } from '../domain/sessions/log.js';
import type { WorkoutTemplate } from '../domain/plans/types.js';
import type { Repositories, WorkoutTemplateRow } from '../ports/index.js';
import { actorFor, requiredParam, type RouteDeps } from './context.js';

function toTemplate(row: WorkoutTemplateRow): WorkoutTemplate {
  return {
    id: row.id,
    squadId: row.squadId,
    code: row.code,
    version: row.version,
    kind: row.kind,
    prescription: row.prescription,
    loadFactor: toNumber(row.loadFactor),
    supersededAt: row.supersededAt,
  };
}

async function returnToRunFor(repos: Repositories, athleteId: string, asOf: string) {
  const [injuries, clearances, athlete] = await Promise.all([
    repos.injuries.forAthlete(athleteId),
    repos.injuries.clearancesForAthlete(athleteId),
    repos.athletes.byId(athleteId),
  ]);
  if (!athlete) {
    throw new NotFoundError(`no athlete ${athleteId}`);
  }
  const physios = new Set(await repos.users.physioUserIds(athlete.squadId));
  return assessReturnToRun({
    state: athlete.state,
    injuries: injuries.map((row) => ({
      id: row.id,
      athleteId: row.athleteId,
      region: row.region,
      onsetOn: row.onsetOn,
      severity: row.severity,
      notes: row.notes,
      resolvedOn: row.resolvedOn,
    })),
    clearances: clearances.map((row) => ({
      id: row.id,
      injuryId: row.injuryId,
      signedBy: row.signedBy,
      signedAt: row.signedAt,
      revokedAt: row.revokedAt,
      notes: row.notes,
      loadSnapshot: row.loadSnapshot,
    })),
    asOf,
    isPhysio: (userId) => physios.has(userId),
  });
}

/**
 * Logging a completed session.
 *
 * An athlete may log their own; their coaches may log it for them. R4 is
 * enforced on the way in, because crediting a run to an athlete who has not
 * been cleared is the same thing as prescribing it.
 */
export function sessionRoutes(app: FastifyInstance, deps: RouteDeps): void {
  const { repos } = deps;

  app.post('/athletes/:athleteId/sessions', async (request, reply) => {
    const actor = await actorFor(request, repos);
    const athleteId = requiredParam(request.params, 'athleteId');
    const athlete = await repos.athletes.byId(athleteId);
    if (!athlete) {
      throw new NotFoundError(`no athlete ${athleteId}`);
    }
    requireSelfOrCoach(actor, athlete.id, athlete.squadId, 'log a session');

    const body = (request.body ?? {}) as {
      completedAt?: string;
      templateId?: string | null;
      planId?: string | null;
      distanceM?: number | null;
      durationS?: number | null;
      avgHr?: number | null;
      perceivedEffort?: number | null;
    };
    if (!body.completedAt) {
      throw new ValidationError('completed_at is required');
    }
    const completedAt = new Date(body.completedAt);
    if (Number.isNaN(completedAt.getTime())) {
      throw new ValidationError('completed_at is not a time', { completedAt: body.completedAt });
    }

    const templateRow = body.templateId ? await repos.templates.byId(body.templateId) : null;
    if (body.templateId && !templateRow) {
      throw new NotFoundError(`no template ${body.templateId}`);
    }
    const asOf = athleteLocalDay(completedAt, athlete.timezone);
    const returnToRun = await returnToRunFor(repos, athlete.id, asOf);

    const session = buildSession({
      athlete,
      template: templateRow === null ? null : toTemplate(templateRow),
      planId: body.planId ?? null,
      completedAt,
      distanceM: body.distanceM ?? null,
      durationS: body.durationS ?? null,
      avgHr: body.avgHr ?? null,
      perceivedEffort: body.perceivedEffort ?? null,
      returnToRun,
    });

    const id = await repos.sessions.insert({
      athleteId: session.athleteId,
      planId: session.planId,
      templateId: session.templateId,
      scheduledFor: session.scheduledFor,
      completedAt: session.completedAt,
      distanceM: session.distanceM,
      durationS: session.durationS,
      avgHr: session.avgHr,
      perceivedEffort: session.perceivedEffort,
      load: session.load,
      source: session.source,
    });

    return reply.code(201).send({
      session: { id, localDate: session.localDate, load: session.load },
    });
  });
}
