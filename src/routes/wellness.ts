import type { FastifyInstance } from 'fastify';
import { NotFoundError, ValidationError } from '../lib/errors.js';
import { addLocalDays, athleteLocalDay } from '../lib/time.js';
import { requireSelfOrCoach } from '../domain/authz.js';
import { assertCanReadAthlete } from '../domain/athletes/roster.js';
import { buildHydrationLog, buildSleepLog, meanSleepHours } from '../domain/wellness/logs.js';
import { toNumber } from '../lib/numbers.js';
import { actorFor, requiredParam, type RouteDeps } from './context.js';

const SLEEP_HISTORY_DAYS = 28;

export function wellnessRoutes(app: FastifyInstance, deps: RouteDeps): void {
  const { repos, clock } = deps;

  app.put('/athletes/:athleteId/sleep', async (request, reply) => {
    const actor = await actorFor(request, repos);
    const athleteId = requiredParam(request.params, 'athleteId');
    const athlete = await repos.athletes.byId(athleteId);
    if (!athlete) {
      throw new NotFoundError(`no athlete ${athleteId}`);
    }
    requireSelfOrCoach(actor, athlete.id, athlete.squadId, 'log sleep');

    const body = (request.body ?? {}) as { localDate?: string; hours?: number; quality?: number | null };
    if (!body.localDate) {
      throw new ValidationError('local_date is required');
    }
    const log = buildSleepLog({
      athleteId: athlete.id,
      timeZone: athlete.timezone,
      localDate: body.localDate,
      hours: body.hours ?? Number.NaN,
      quality: body.quality ?? null,
    });
    await repos.wellness.putSleep({
      athleteId: log.athleteId,
      localDate: log.localDate,
      hours: log.hours.toFixed(2),
      quality: log.quality,
    });
    return reply.code(200).send({ sleep: log });
  });

  app.put('/athletes/:athleteId/hydration', async (request, reply) => {
    const actor = await actorFor(request, repos);
    const athleteId = requiredParam(request.params, 'athleteId');
    const athlete = await repos.athletes.byId(athleteId);
    if (!athlete) {
      throw new NotFoundError(`no athlete ${athleteId}`);
    }
    requireSelfOrCoach(actor, athlete.id, athlete.squadId, 'log hydration');

    const body = (request.body ?? {}) as { localDate?: string; litres?: number };
    if (!body.localDate) {
      throw new ValidationError('local_date is required');
    }
    const log = buildHydrationLog({
      athleteId: athlete.id,
      timeZone: athlete.timezone,
      localDate: body.localDate,
      litres: body.litres ?? Number.NaN,
    });
    await repos.wellness.putHydration({
      athleteId: log.athleteId,
      localDate: log.localDate,
      litres: log.litres.toFixed(2),
    });
    return reply.code(200).send({ hydration: log });
  });

  app.get('/athletes/:athleteId/sleep', async (request, reply) => {
    const actor = await actorFor(request, repos);
    const athleteId = requiredParam(request.params, 'athleteId');
    const athlete = await repos.athletes.byId(athleteId);
    if (!athlete) {
      throw new NotFoundError(`no athlete ${athleteId}`);
    }
    assertCanReadAthlete(actor, athlete, "read an athlete's sleep");

    const asOf = athleteLocalDay(clock.now(), athlete.timezone);
    const rows = await repos.wellness.sleepFrom(athlete.id, addLocalDays(asOf, -(SLEEP_HISTORY_DAYS - 1)));
    const logs = rows.map((row) => ({
      athleteId: row.athleteId,
      localDate: row.localDate,
      hours: toNumber(row.hours),
      quality: row.quality,
    }));
    return reply.code(200).send({ athleteId: athlete.id, asOf, logs, meanHours: meanSleepHours(logs) });
  });
}
