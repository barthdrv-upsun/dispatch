import type { FastifyInstance } from 'fastify';
import { NotFoundError, ValidationError } from '../lib/errors.js';
import { isLocalDate } from '../lib/time.js';
import { requireSelfOrCoach } from '../domain/authz.js';
import { assertCanReadAthlete } from '../domain/athletes/roster.js';
import { isRetired, remainingKm, toShoe } from '../domain/shoes/retirement.js';
import { actorFor, requiredParam, type RouteDeps } from './context.js';

const DEFAULT_RETIRE_AT_KM = 800;

/** R7's endpoints. */
export function shoeRoutes(app: FastifyInstance, deps: RouteDeps): void {
  const { repos } = deps;

  app.get('/athletes/:athleteId/shoes', async (request, reply) => {
    const actor = await actorFor(request, repos);
    const athleteId = requiredParam(request.params, 'athleteId');
    const athlete = await repos.athletes.byId(athleteId);
    if (!athlete) {
      throw new NotFoundError(`no athlete ${athleteId}`);
    }
    assertCanReadAthlete(actor, athlete, "read an athlete's shoes");

    const shoes = (await repos.shoes.forAthlete(athlete.id)).map(toShoe);
    return reply.code(200).send({
      athleteId: athlete.id,
      shoes: shoes.map((shoe) => ({
        ...shoe,
        retired: isRetired(shoe),
        remainingKm: remainingKm(shoe),
      })),
    });
  });

  app.post('/athletes/:athleteId/shoes', async (request, reply) => {
    const actor = await actorFor(request, repos);
    const athleteId = requiredParam(request.params, 'athleteId');
    const athlete = await repos.athletes.byId(athleteId);
    if (!athlete) {
      throw new NotFoundError(`no athlete ${athleteId}`);
    }
    requireSelfOrCoach(actor, athlete.id, athlete.squadId, 'add a pair of shoes');

    const body = (request.body ?? {}) as {
      model?: string;
      purchasedOn?: string;
      retireAtKm?: number;
      currentKm?: number;
    };
    if (!body.model || body.model.trim().length === 0) {
      throw new ValidationError('model is required');
    }
    if (!body.purchasedOn || !isLocalDate(body.purchasedOn)) {
      throw new ValidationError('purchased_on must be a YYYY-MM-DD day');
    }
    const retireAtKm = body.retireAtKm ?? DEFAULT_RETIRE_AT_KM;
    if (retireAtKm <= 0 || retireAtKm > 3000) {
      throw new ValidationError('retire_at_km must sit between 0 and 3000', { retireAtKm });
    }
    const currentKm = body.currentKm ?? 0;
    if (currentKm < 0) {
      throw new ValidationError('current_km cannot be negative', { currentKm });
    }

    const id = await repos.shoes.insert({
      athleteId: athlete.id,
      model: body.model.trim(),
      purchasedOn: body.purchasedOn,
      retireAtKm: retireAtKm.toFixed(2),
      currentKm: currentKm.toFixed(2),
      retiredAt: null,
    });
    return reply.code(201).send({ shoe: { id, model: body.model.trim(), retireAtKm, currentKm } });
  });
}
