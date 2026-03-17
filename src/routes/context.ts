import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import type { Clock } from '../lib/clock.js';
import { UnauthenticatedError, isAppError } from '../lib/errors.js';
import type { Actor } from '../domain/authz.js';
import type { Repositories } from '../ports/index.js';

export type RouteDeps = {
  repos: Repositories;
  clock: Clock;
};

export type RouteRegistrar = (app: FastifyInstance, deps: RouteDeps) => Promise<void> | void;

/**
 * Who is calling.
 *
 * The identity comes from the gateway header and everything else - which
 * squads, which roles, whether they are an athlete themselves - is read from
 * user_roles on the server. Nothing a client sends can widen it.
 */
export async function actorFor(request: FastifyRequest, repos: Repositories): Promise<Actor> {
  const header = request.headers['x-user-id'];
  const userId = Array.isArray(header) ? header[0] : header;
  if (!userId) {
    throw new UnauthenticatedError('x-user-id is required');
  }
  const [grants, athleteId] = await Promise.all([
    repos.users.grantsFor(userId),
    repos.users.athleteIdFor(userId),
  ]);
  if (grants.length === 0) {
    throw new UnauthenticatedError(`user ${userId} holds no roles`);
  }
  return { userId, grants, athleteId };
}

export function registerErrorHandler(app: FastifyInstance): void {
  app.setErrorHandler((err, _request, reply: FastifyReply) => {
    if (isAppError(err)) {
      return reply.code(err.status).send(err.toBody());
    }
    if ((err as { validation?: unknown }).validation) {
      const message = err instanceof Error ? err.message : 'invalid request';
      return reply.code(400).send({ error: 'invalid_request', message });
    }
    app.log.error(err);
    return reply.code(500).send({ error: 'internal_error', message: 'something went wrong' });
  });
}

export function requiredParam(params: unknown, name: string): string {
  const value = (params as Record<string, string | undefined>)[name];
  if (!value) {
    throw new UnauthenticatedError(`${name} is missing from the path`);
  }
  return value;
}
