import type { FastifyInstance } from 'fastify';
import { NotFoundError, ValidationError } from '../lib/errors.js';
import { athleteLocalDay } from '../lib/time.js';
import { requireRoleInSquad, requireSquadAccess } from '../domain/authz.js';
import { assertCanReadAthlete, rosterFor } from '../domain/athletes/roster.js';
import { moveTimezone, transitionState } from '../domain/athletes/state.js';
import { athleteSummaries, athleteSummary } from '../domain/athletes/view.js';
import type { AthleteState } from '../domain/athletes/types.js';
import { actorFor, requiredParam, type RouteDeps } from './context.js';

const STATES: readonly AthleteState[] = ['active', 'injured', 'returning'];

export function athleteRoutes(app: FastifyInstance, deps: RouteDeps): void {
  const { repos, clock } = deps;

  app.get('/athletes/:athleteId', async (request, reply) => {
    const actor = await actorFor(request, repos);
    const athleteId = requiredParam(request.params, 'athleteId');
    const athlete = await repos.athletes.byId(athleteId);
    if (!athlete) {
      throw new NotFoundError(`no athlete ${athleteId}`);
    }
    assertCanReadAthlete(actor, athlete, 'read an athlete');
    return reply.code(200).send({
      athlete: athleteSummary(athlete),
      today: athleteLocalDay(clock.now(), athlete.timezone),
    });
  });

  /**
   * A roster read is scoped to the squad in the path *and* to a grant the
   * caller holds in that squad. There is no route here that returns athletes
   * across squads.
   */
  app.get('/squads/:squadId/athletes', async (request, reply) => {
    const actor = await actorFor(request, repos);
    const squadId = requiredParam(request.params, 'squadId');
    requireSquadAccess(actor, squadId, 'read a squad roster');
    const athletes = await repos.athletes.bySquad(squadId);
    return reply.code(200).send({ squadId, athletes: athleteSummaries(rosterFor(athletes, squadId)) });
  });

  app.patch('/athletes/:athleteId/state', async (request, reply) => {
    const actor = await actorFor(request, repos);
    const athleteId = requiredParam(request.params, 'athleteId');
    const athlete = await repos.athletes.byId(athleteId);
    if (!athlete) {
      throw new NotFoundError(`no athlete ${athleteId}`);
    }
    requireRoleInSquad(actor, athlete.squadId, 'head_coach', "change an athlete's state");

    const body = (request.body ?? {}) as { state?: string };
    const next = body.state ?? '';
    if (!(STATES as readonly string[]).includes(next)) {
      throw new ValidationError(`state must be one of ${STATES.join(', ')}`, { state: next });
    }
    const updated = transitionState(athlete, next as AthleteState);
    await repos.athletes.save(updated);
    return reply.code(200).send({ athlete: athleteSummary(updated) });
  });

  /**
   * Moving an athlete's zone re-cuts every day boundary they have, so the
   * response says which local day they are on now.
   */
  app.patch('/athletes/:athleteId/timezone', async (request, reply) => {
    const actor = await actorFor(request, repos);
    const athleteId = requiredParam(request.params, 'athleteId');
    const athlete = await repos.athletes.byId(athleteId);
    if (!athlete) {
      throw new NotFoundError(`no athlete ${athleteId}`);
    }
    assertCanReadAthlete(actor, athlete, "change an athlete's timezone");

    const body = (request.body ?? {}) as { timezone?: string };
    if (!body.timezone) {
      throw new ValidationError('timezone is required');
    }
    const updated = moveTimezone(athlete, body.timezone);
    await repos.athletes.save(updated);
    return reply.code(200).send({
      athlete: athleteSummary(updated),
      previousTimezone: athlete.timezone,
      today: athleteLocalDay(clock.now(), updated.timezone),
    });
  });
}
