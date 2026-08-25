import type { FastifyInstance } from 'fastify';
import { addLocalDays, athleteLocalDay } from '../lib/time.js';
import { toNumber } from '../lib/numbers.js';
import { requireSquadAccess } from '../domain/authz.js';
import { actorFor, requiredParam, type RouteDeps } from './context.js';

const SPARKLINE_DAYS = 28;

/**
 * The squad load dashboard: one card per athlete with a 28-day load
 * sparkline, their state, and whether their watch is still connected.
 */
export function dashboardRoutes(app: FastifyInstance, deps: RouteDeps): void {
  const { repos, clock } = deps;

  app.get('/squads/:squadId/dashboard', async (request, reply) => {
    const actor = await actorFor(request, repos);
    const squadId = requiredParam(request.params, 'squadId');
    requireSquadAccess(actor, squadId, 'read the squad dashboard');

    const rows = await repos.dashboard.athletesForDashboard(squadId);

    const cards = [];
    for (const row of rows) {
      const asOf = athleteLocalDay(clock.now(), row.athlete.timezone);
      const from = addLocalDays(asOf, -(SPARKLINE_DAYS - 1));
      const sessions = await repos.dashboard.recentSessions(
        row.athlete.id,
        new Date(`${from}T00:00:00Z`),
      );

      const byDay = new Map<string, number>();
      for (const session of sessions) {
        if (session.completedAt === null) {
          continue;
        }
        const day = athleteLocalDay(session.completedAt, row.athlete.timezone);
        byDay.set(day, (byDay.get(day) ?? 0) + toNumber(session.load));
      }
      const sparkline: number[] = [];
      for (let offset = SPARKLINE_DAYS - 1; offset >= 0; offset -= 1) {
        sparkline.push(byDay.get(addLocalDays(asOf, -offset)) ?? 0);
      }

      cards.push({
        athlete: row.athlete,
        strava: row.link,
        openInjury: row.openInjury,
        asOf,
        sparkline,
        totalLoad: sparkline.reduce((total, value) => total + value, 0),
      });
    }

    return reply.code(200).send({ squadId, athletes: cards.length, cards });
  });
}
