import Fastify, { type FastifyInstance } from 'fastify';
import { registerRoutes, type RouteOptions } from './routes/index.js';
import type { RouteDeps } from './routes/context.js';

export type AppOptions = RouteOptions & {
  logger?: boolean;
};

/**
 * The app, with its dependencies handed in. Tests build one of these against
 * in-memory repositories; src/main.ts builds one against Postgres.
 */
export function buildApp(deps: RouteDeps, options: AppOptions = {}): FastifyInstance {
  const app = Fastify({ logger: options.logger ?? false });
  registerRoutes(app, deps, { ingest: options.ingest });
  return app;
}
