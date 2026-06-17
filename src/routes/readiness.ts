import type { FastifyInstance } from 'fastify';
import { NotFoundError } from '../lib/errors.js';
import { addLocalDays, athleteLocalDay } from '../lib/time.js';
import { assertCanReadAthlete } from '../domain/athletes/roster.js';
import { toRunningLoadEntries, toRunningVolumeEntries } from '../domain/load/entries.js';
import { assessReadiness, brokenRules } from '../domain/load/readiness.js';
import { recentWeeks } from '../domain/load/summary.js';
import { CHRONIC_DAYS } from '../domain/load/windows.js';
import { actorFor, requiredParam, type RouteDeps } from './context.js';

/** A little more than the chronic window, so the ramp comparison has a week
 * behind it to look at. */
const LOOKBACK_DAYS = CHRONIC_DAYS + 14;

/**
 * What the load rules say about an athlete today.
 *
 * Every bucket in here is cut on the athlete's own calendar, so the same
 * sessions read differently for an athlete who has moved zone.
 */
export function readinessRoutes(app: FastifyInstance, deps: RouteDeps): void {
  const { repos, clock } = deps;

  app.get('/athletes/:athleteId/readiness', async (request, reply) => {
    const actor = await actorFor(request, repos);
    const athleteId = requiredParam(request.params, 'athleteId');
    const athlete = await repos.athletes.byId(athleteId);
    if (!athlete) {
      throw new NotFoundError(`no athlete ${athleteId}`);
    }
    assertCanReadAthlete(actor, athlete, "read an athlete's readiness");

    const query = request.query as { asOf?: string };
    const asOf = query.asOf ?? athleteLocalDay(clock.now(), athlete.timezone);
    const from = addLocalDays(asOf, -LOOKBACK_DAYS);

    const [sessions, goals] = await Promise.all([
      repos.sessions.forAthleteFrom(athlete.id, new Date(`${from}T00:00:00Z`)),
      repos.goals.forAthlete(athlete.id),
    ]);
    const nextRace = goals
      .filter((goal) => goal.state === 'active' || goal.state === 'planned')
      .filter((goal) => goal.raceDate >= asOf)
      .sort((a, b) => (a.raceDate < b.raceDate ? -1 : 1))[0];

    const loadEntries = toRunningLoadEntries(sessions, athlete.timezone);
    const volumeEntries = toRunningVolumeEntries(sessions, athlete.timezone);
    const readiness = assessReadiness({
      asOf,
      loadEntries,
      volumeEntries,
      raceDate: nextRace?.raceDate ?? null,
    });

    return reply.code(200).send({
      athleteId: athlete.id,
      timezone: athlete.timezone,
      asOf,
      goal: nextRace ? { id: nextRace.id, raceName: nextRace.raceName, raceDate: nextRace.raceDate } : null,
      readiness,
      weeks: recentWeeks(loadEntries, volumeEntries, asOf),
      broken: brokenRules(readiness),
    });
  });
}
