import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { UnauthenticatedError, isAppError } from '../lib/errors.js';
import type { Actor } from '../domain/authz.js';
import type { AthleteService } from '../athletes/athlete_service.js';
import type { SessionService } from '../sessions/session_service.js';

export type Callback<T> = (err: Error | null, result?: T) => void;

export interface GrantLookup {
  grantsFor(userId: string, cb: Callback<Actor>): void;
}

export type RouteDeps = {
  athletes: AthleteService;
  sessions: SessionService;
  grants: GrantLookup;
};

export type RouteRegistrar = (app: FastifyInstance, deps: RouteDeps) => Promise<void> | void;

// @P:m03.A

/** Bridges one of the callback services into something a handler can await. */
export function fromCallback<T>(run: (cb: Callback<T>) => void): Promise<T | undefined> {
  return new Promise(function (resolve, reject) {
    run(function (err, result) {
      if (err) {
        reject(err);
        return;
      }
      resolve(result);
    });
  });
}

export async function actorFor(request: FastifyRequest, deps: RouteDeps): Promise<Actor> {
  const header = request.headers['x-user-id'];
  const userId = Array.isArray(header) ? header[0] : header;
  if (!userId) {
    throw new UnauthenticatedError('x-user-id is required');
  }
  const actor = await fromCallback<Actor>(function (cb) {
    deps.grants.grantsFor(userId, cb);
  });
  if (!actor || actor.grants.length === 0) {
    throw new UnauthenticatedError(`user ${userId} holds no roles`);
  }
  return actor;
}

// @P:m03.A

export function registerErrorHandler(app: FastifyInstance): void {
  app.setErrorHandler(function (err, _request, reply: FastifyReply) {
    if (isAppError(err)) {
      return reply.code(err.status).send(err.toBody());
    }
    app.log.error(err);
    return reply.code(500).send({ error: 'internal_error', message: 'something went wrong' });
  });
}

// @P:m03.A

export function requiredParam(params: unknown, name: string): string {
  const value = (params as Record<string, string | undefined>)[name];
  if (!value) {
    throw new UnauthenticatedError(`${name} is missing from the path`);
  }
  return value;
}
