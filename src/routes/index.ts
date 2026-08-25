import type { FastifyInstance } from 'fastify';
import { athleteRoutes } from './athletes.js';
import { sessionRoutes } from './sessions.js';
import { readinessRoutes } from './readiness.js';
import { templateRoutes } from './templates.js';
import { blockRoutes } from './blocks.js';
import { planRoutes } from './plans.js';
import { clearanceRoutes } from './clearances.js';
import { wellnessRoutes } from './wellness.js';
import { shoeRoutes } from './shoes.js';
import { dashboardRoutes } from './dashboard.js';
import { stravaRoutes, type IngestBundle } from './strava.js';
import { registerErrorHandler, type RouteDeps } from './context.js';

export type RouteOptions = {
  ingest?: IngestBundle;
};

/**
 * Every route the server answers on. Each module takes the same deps and
 * does its own authorisation - there is no ambient "logged in" state.
 */
export function registerRoutes(app: FastifyInstance, deps: RouteDeps, options: RouteOptions = {}): void {
  registerErrorHandler(app);
  athleteRoutes(app, deps);
  sessionRoutes(app, deps);
  readinessRoutes(app, deps);
  templateRoutes(app, deps);
  blockRoutes(app, deps);
  planRoutes(app, deps);
  clearanceRoutes(app, deps);
  wellnessRoutes(app, deps);
  shoeRoutes(app, deps);
  dashboardRoutes(app, deps);
  if (options.ingest) {
    stravaRoutes(app, deps, options.ingest);
  }
}
