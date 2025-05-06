import type { FastifyInstance } from 'fastify';
import { ForbiddenError, NotFoundError, ValidationError } from '../lib/errors.js';
import { hasRoleInSquad, isSelf } from '../domain/authz.js';
import type { AthleteRow } from '../athletes/athlete_service.js';
import { actorFor, fromCallback, requiredParam, type RouteDeps } from './context.js';

function canRead(actor: Parameters<typeof isSelf>[0], athlete: AthleteRow): boolean {
  if (isSelf(actor, athlete.id)) {
    return true;
  }
  return (
    hasRoleInSquad(actor, athlete.squadId, 'head_coach') ||
    hasRoleInSquad(actor, athlete.squadId, 'assistant_coach') ||
    hasRoleInSquad(actor, athlete.squadId, 'physio')
  );
}

export function athleteRoutes(app: FastifyInstance, deps: RouteDeps): void {
  app.get('/athletes/:athleteId', async function (request, reply) {
    const actor = await actorFor(request, deps);
    const athleteId = requiredParam(request.params, 'athleteId');
    const athlete = await fromCallback<AthleteRow>(function (cb) {
      deps.athletes.get(athleteId, cb);
    });
    if (!athlete) {
      throw new NotFoundError('no athlete ' + athleteId);
    }
    if (!canRead(actor, athlete)) {
      throw new ForbiddenError('read an athlete', 'head_coach');
    }
    return reply.code(200).send({ athlete: athlete });
  });

  app.get('/squads/:squadId/athletes', async function (request, reply) {
    const actor = await actorFor(request, deps);
    const squadId = requiredParam(request.params, 'squadId');
    if (
      !hasRoleInSquad(actor, squadId, 'head_coach') &&
      !hasRoleInSquad(actor, squadId, 'assistant_coach') &&
      !hasRoleInSquad(actor, squadId, 'physio')
    ) {
      throw new ForbiddenError('read a squad roster', 'assistant_coach');
    }
    const athletes = await fromCallback<AthleteRow[]>(function (cb) {
      deps.athletes.roster(squadId, cb);
    });
    return reply.code(200).send({ squadId: squadId, athletes: athletes || [] });
  });

  app.patch('/athletes/:athleteId/state', async function (request, reply) {
    const actor = await actorFor(request, deps);
    const athleteId = requiredParam(request.params, 'athleteId');
    const athlete = await fromCallback<AthleteRow>(function (cb) {
      deps.athletes.get(athleteId, cb);
    });
    if (!athlete) {
      throw new NotFoundError('no athlete ' + athleteId);
    }
    if (!hasRoleInSquad(actor, athlete.squadId, 'head_coach')) {
      throw new ForbiddenError("change an athlete's state", 'head_coach');
    }
    const body = (request.body || {}) as { state?: string };
    if (!body.state) {
      throw new ValidationError('state is required');
    }
    await fromCallback<void>(function (cb) {
      deps.athletes.setState(athleteId, body.state as string, cb);
    });
    return reply.code(200).send({ athleteId: athleteId, state: body.state });
  });

  app.patch('/athletes/:athleteId/timezone', async function (request, reply) {
    const actor = await actorFor(request, deps);
    const athleteId = requiredParam(request.params, 'athleteId');
    const athlete = await fromCallback<AthleteRow>(function (cb) {
      deps.athletes.get(athleteId, cb);
    });
    if (!athlete) {
      throw new NotFoundError('no athlete ' + athleteId);
    }
    if (!canRead(actor, athlete)) {
      throw new ForbiddenError("change an athlete's timezone", 'head_coach');
    }
    const body = (request.body || {}) as { timezone?: string };
    if (!body.timezone) {
      throw new ValidationError('timezone is required');
    }
    await fromCallback<void>(function (cb) {
      deps.athletes.moveToTimezone(athleteId, body.timezone as string, cb);
    });
    return reply.code(200).send({ athleteId: athleteId, timezone: body.timezone });
  });
}
