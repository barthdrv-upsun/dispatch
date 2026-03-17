import type { FastifyInstance } from 'fastify';
import { ForbiddenError, NotFoundError, ValidationError } from '../lib/errors.js';
import { hasRoleInSquad, isSelf } from '../domain/authz.js';
import type { IngestService } from '../legacy/ingest/ingest_service.js';
import type { WebhookProcessor } from '../legacy/ingest/webhook.js';
import type { IngestOutcome, IngestSummary } from '../legacy/ingest/types.js';
import type { StravaWebhookEvent } from '../legacy/ingest/types.js';
import { actorFor, requiredParam, type RouteDeps } from './context.js';

export type IngestBundle = {
  service: IngestService;
  webhook: WebhookProcessor;
};

type Callback<T> = (err: Error | null, result?: T) => void;

/** Bridges the callback-style ingest package into an async handler. */
function fromCallback<T>(run: (cb: Callback<T>) => void): Promise<T | undefined> {
  return new Promise((resolve, reject) => {
    run((err, result) => {
      if (err) {
        reject(err);
        return;
      }
      resolve(result);
    });
  });
}

/**
 * The two ways activities arrive. Both end up in src/legacy/ingest, and both
 * are safe to call twice.
 */
export function stravaRoutes(app: FastifyInstance, deps: RouteDeps, ingest: IngestBundle): void {
  const { repos } = deps;

  app.post('/athletes/:athleteId/strava/sync', async (request, reply) => {
    const actor = await actorFor(request, repos);
    const athleteId = requiredParam(request.params, 'athleteId');
    const athlete = await repos.athletes.byId(athleteId);
    if (!athlete) {
      throw new NotFoundError(`no athlete ${athleteId}`);
    }
    const allowed =
      isSelf(actor, athlete.id) ||
      hasRoleInSquad(actor, athlete.squadId, 'head_coach') ||
      hasRoleInSquad(actor, athlete.squadId, 'assistant_coach');
    if (!allowed) {
      throw new ForbiddenError('sync an athlete from strava', 'athlete');
    }

    const summary = await fromCallback<IngestSummary>((cb) => {
      ingest.service.syncAthlete(athleteId, cb);
    });
    return reply.code(200).send({ sync: summary });
  });

  /**
   * Strava's webhook. Unauthenticated by design - the delivery carries no
   * secret - so it does nothing but hand the event to the ingest path, which
   * is idempotent on strava_activity_id. A replay is a no-op, not a
   * double-count.
   */
  app.post('/webhooks/strava', async (request, reply) => {
    const event = (request.body ?? null) as StravaWebhookEvent | null;
    if (!event) {
      throw new ValidationError('empty webhook delivery');
    }
    const outcome = await fromCallback<IngestOutcome>((cb) => {
      ingest.webhook.handle(event, cb);
    });
    return reply.code(200).send({ outcome });
  });

  /** Strava's subscription handshake. */
  app.get('/webhooks/strava', async (request, reply) => {
    const query = request.query as Record<string, string | undefined>;
    if (query['hub.mode'] !== 'subscribe') {
      return reply.code(400).send({ message: 'unexpected hub.mode' });
    }
    return reply.code(200).send({ 'hub.challenge': query['hub.challenge'] ?? '' });
  });
}
