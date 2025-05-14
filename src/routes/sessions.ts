import type { FastifyInstance } from 'fastify';
import { ForbiddenError, NotFoundError, ValidationError } from '../lib/errors.js';
import { hasRoleInSquad, isSelf } from '../domain/authz.js';
import type { AthleteRow } from '../athletes/athlete_service.js';
import { actorFor, fromCallback, requiredParam, type RouteDeps } from './context.js';

export function sessionRoutes(app: FastifyInstance, deps: RouteDeps): void {
  app.post('/athletes/:athleteId/sessions', async function (request, reply) {
    const actor = await actorFor(request, deps);
    const athleteId = requiredParam(request.params, 'athleteId');
    const athlete = await fromCallback<AthleteRow>(function (cb) {
      deps.athletes.get(athleteId, cb);
    });
    if (!athlete) {
      throw new NotFoundError('no athlete ' + athleteId);
    }
    const allowed =
      isSelf(actor, athlete.id) ||
      hasRoleInSquad(actor, athlete.squadId, 'head_coach') ||
      hasRoleInSquad(actor, athlete.squadId, 'assistant_coach');
    if (!allowed) {
      throw new ForbiddenError('log a session', 'athlete');
    }

    const body = (request.body || {}) as {
      completedAt?: string;
      distanceM?: number;
      durationS?: number;
      avgHr?: number;
      perceivedEffort?: number;
    };
    if (!body.completedAt) {
      throw new ValidationError('completed_at is required');
    }
    const completedAt = new Date(body.completedAt);
    if (Number.isNaN(completedAt.getTime())) {
      throw new ValidationError('completed_at is not a time');
    }

    const id = await fromCallback<string>(function (cb) {
      deps.sessions.log(
        {
          athleteId: athleteId,
          completedAt: completedAt,
          distanceM: body.distanceM === undefined ? null : body.distanceM,
          durationS: body.durationS === undefined ? null : body.durationS,
          avgHr: body.avgHr === undefined ? null : body.avgHr,
          perceivedEffort: body.perceivedEffort === undefined ? null : body.perceivedEffort,
        },
        cb,
      );
    });
    return reply.code(201).send({ session: { id: id } });
  });
}
