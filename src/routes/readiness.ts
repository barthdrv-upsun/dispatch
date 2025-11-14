import type { FastifyInstance } from 'fastify';
import { ForbiddenError, NotFoundError } from '../lib/errors.js';
import { addLocalDays, athleteLocalDay } from '../lib/time.js';
import { hasRoleInSquad, isSelf } from '../domain/authz.js';
import { toRunningLoadEntries, toRunningVolumeEntries } from '../domain/load/entries.js';
import { assessReadiness, brokenRules } from '../domain/load/readiness.js';
import { CHRONIC_DAYS } from '../domain/load/windows.js';
import type { AthleteRow } from '../athletes/athlete_service.js';
import type { SessionRow } from '../sessions/session_service.js';
import { actorFor, fromCallback, requiredParam, type RouteDeps } from './context.js';

const LOOKBACK_DAYS = CHRONIC_DAYS + 14;

// @P:m09.A

export function readinessRoutes(app: FastifyInstance, deps: RouteDeps): void {
  app.get('/athletes/:athleteId/readiness', async function (request, reply) {
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
      hasRoleInSquad(actor, athlete.squadId, 'assistant_coach') ||
      hasRoleInSquad(actor, athlete.squadId, 'physio');
    if (!allowed) {
      throw new ForbiddenError("read an athlete's readiness", 'head_coach');
    }

    const query = request.query as { asOf?: string };
    const asOf = query.asOf || athleteLocalDay(new Date(), athlete.timezone);
    const from = new Date(addLocalDays(asOf, -LOOKBACK_DAYS) + 'T00:00:00Z');
    const to = new Date(addLocalDays(asOf, 1) + 'T00:00:00Z');

    const rows = await fromCallback<SessionRow[]>(function (cb) {
      deps.sessions.forAthleteBetween(athleteId, from, to, cb);
    });
    const sessions = (rows || []).map(function (row) {
      return {
        completedAt: row.completedAt,
        load: null,
        distanceM: row.distanceM,
        templateKind: null,
      };
    });

    const readiness = assessReadiness({
      asOf: asOf,
      loadEntries: toRunningLoadEntries(sessions, athlete.timezone),
      volumeEntries: toRunningVolumeEntries(sessions, athlete.timezone),
      raceDate: null,
    });

    return reply.code(200).send({
      athleteId: athlete.id,
      asOf: asOf,
      readiness: readiness,
      broken: brokenRules(readiness),
    });
  });
}
