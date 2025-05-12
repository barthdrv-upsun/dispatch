import type { FastifyInstance } from 'fastify';
import { athleteRoutes } from './athletes.js';
import { sessionRoutes } from './sessions.js';
import { registerErrorHandler, type RouteDeps } from './context.js';

/**
 * Every route the server answers on. Each module takes the same deps and
 * does its own authorisation - there is no ambient "logged in" state.
 */
export function registerRoutes(app: FastifyInstance, deps: RouteDeps): void {
  registerErrorHandler(app);
  athleteRoutes(app, deps);
  sessionRoutes(app, deps);
}
