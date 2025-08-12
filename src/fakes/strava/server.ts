import Fastify, { type FastifyInstance } from 'fastify';
import type { StravaActivity } from '../../legacy/ingest/types.js';
import { activityOwner, recordedActivities, recordedDeliveries, recordedTokens } from './fixtures.js';

const ACCESS_TOKEN_PREFIX = 'local-access-';

function athleteFromBearer(header: string | undefined): number | null {
  if (!header) {
    return null;
  }
  const match = /^Bearer\s+(.+)$/i.exec(header.trim());
  if (!match || !match[1]) {
    return null;
  }
  const token = match[1];
  if (!token.startsWith(ACCESS_TOKEN_PREFIX)) {
    return null;
  }
  const id = Number.parseInt(token.slice(ACCESS_TOKEN_PREFIX.length), 10);
  return Number.isFinite(id) ? id : null;
}

function summarise(activity: StravaActivity): StravaActivity {
  const summary: Record<string, unknown> = { ...activity };
  delete summary['perceived_exertion'];
  summary['resource_state'] = 2;
  return summary as StravaActivity;
}

function startedAtEpochS(activity: StravaActivity): number {
  if (!activity.start_date) {
    return 0;
  }
  const parsed = Date.parse(activity.start_date);
  return Number.isNaN(parsed) ? 0 : Math.floor(parsed / 1000);
}

/**
 * A local stand-in for the Strava REST API.
 *
 * It answers from recorded fixtures, mints its own opaque tokens and has no
 * network egress, which is why the repository can be cloned and run without
 * anybody holding Strava credentials. The shapes are the shapes we recorded;
 * the values are invented.
 */
export function buildFakeStrava(): FastifyInstance {
  const app = Fastify({ logger: false });
  const tokens = recordedTokens();
  const activities = recordedActivities();

  app.post('/oauth/token', async (request, reply) => {
    const body = (request.body ?? {}) as Record<string, unknown>;
    const grantType = String(body['grant_type'] ?? '');
    if (grantType !== 'refresh_token' && grantType !== 'authorization_code') {
      return reply.code(400).send({ message: 'unsupported grant_type', errors: [] });
    }
    const presented = String(body['refresh_token'] ?? body['code'] ?? '');
    const athlete = tokens.athletes.find(
      (candidate) => candidate.refresh_token === presented || candidate.access_token === presented,
    );
    if (!athlete) {
      return reply.code(400).send({ message: 'Bad Request', errors: [{ field: 'refresh_token' }] });
    }
    const expiresIn = 6 * 60 * 60;
    return reply.code(200).send({
      token_type: 'Bearer',
      access_token: ACCESS_TOKEN_PREFIX + String(athlete.strava_athlete_id),
      refresh_token: athlete.refresh_token,
      expires_in: expiresIn,
      expires_at: Math.floor(Date.now() / 1000) + expiresIn,
      scope: athlete.scope,
      athlete: { id: athlete.strava_athlete_id },
    });
  });

  app.get('/api/v3/athlete/activities', async (request, reply) => {
    const athleteId = athleteFromBearer(request.headers.authorization);
    if (athleteId === null) {
      return reply.code(401).send({ message: 'Authorization Error', errors: [] });
    }
    const query = request.query as Record<string, string | undefined>;
    const after = Number.parseInt(query['after'] ?? '0', 10);
    const perPage = Number.parseInt(query['per_page'] ?? '30', 10);
    const mine = activities
      .filter((activity) => activityOwner(activity) === athleteId)
      .filter((activity) => (Number.isFinite(after) ? startedAtEpochS(activity) > after : true))
      .sort((a, b) => startedAtEpochS(b) - startedAtEpochS(a))
      .slice(0, Number.isFinite(perPage) && perPage > 0 ? perPage : 30)
      .map(summarise);
    return reply.code(200).send(mine);
  });

  app.get('/api/v3/activities/:id', async (request, reply) => {
    const athleteId = athleteFromBearer(request.headers.authorization);
    if (athleteId === null) {
      return reply.code(401).send({ message: 'Authorization Error', errors: [] });
    }
    const params = request.params as { id?: string };
    const wanted = Number.parseInt(params.id ?? '', 10);
    const found = activities.find((activity) => activity.id === wanted);
    if (!found) {
      return reply.code(404).send({ message: 'Record Not Found', errors: [{ resource: 'Activity' }] });
    }
    if (activityOwner(found) !== athleteId) {
      return reply.code(403).send({ message: 'Forbidden', errors: [] });
    }
    return reply.code(200).send(found);
  });

  /**
   * Not part of the Strava API. Lets a test or a demo script pull the recorded
   * delivery log - duplicates included - and post it back at us.
   */
  app.get('/_fake/webhook-deliveries', async (_request, reply) => {
    return reply.code(200).send(recordedDeliveries());
  });

  return app;
}

export async function startFakeStrava(port = 4010): Promise<FastifyInstance> {
  const app = buildFakeStrava();
  await app.listen({ port, host: '127.0.0.1' });
  return app;
}

const invokedDirectly = process.argv[1] !== undefined && process.argv[1].endsWith('server.ts');

if (invokedDirectly) {
  startFakeStrava(Number.parseInt(process.env.PORT ?? '4010', 10)).then(
    (app) => {
      app.log.info('fake strava listening');
      console.log('fake strava listening on ' + String(app.server.address()));
    },
    (err: unknown) => {
      console.error(err);
      process.exit(1);
    },
  );
}
