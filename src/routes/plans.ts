import type { FastifyInstance } from 'fastify';
import { NotFoundError, ValidationError } from '../lib/errors.js';
import { requireRoleInSquad } from '../domain/authz.js';
import { assertCanReadAthlete } from '../domain/athletes/roster.js';
import { assessReturnToRun } from '../domain/clearances/gate.js';
import { ASSIGN_PLAN_ACTION, assignPlan } from '../domain/plans/assignment.js';
import { expandPlan } from '../domain/plans/expansion.js';
import type { Plan, TrainingBlock } from '../domain/plans/types.js';
import type { Repositories, TrainingBlockRow } from '../ports/index.js';
import { actorFor, requiredParam, type RouteDeps } from './context.js';
import { toTemplate } from './templates.js';

function toBlock(row: TrainingBlockRow): TrainingBlock {
  return {
    id: row.id,
    squadId: row.squadId,
    name: row.name,
    version: row.version,
    weeks: row.weeks,
    state: row.state,
    publishedBy: row.publishedBy,
    publishedAt: row.publishedAt,
  };
}

async function gateFor(repos: Repositories, athleteId: string, squadId: string, state: string, asOf: string) {
  const [injuries, clearances, physios] = await Promise.all([
    repos.injuries.forAthlete(athleteId),
    repos.injuries.clearancesForAthlete(athleteId),
    repos.users.physioUserIds(squadId),
  ]);
  const physioIds = new Set(physios);
  return assessReturnToRun({
    state: state as 'active' | 'injured' | 'returning',
    injuries,
    clearances,
    asOf,
    isPhysio: (userId) => physioIds.has(userId),
  });
}

/**
 * Assignment. R5 pins the block version here and R4 decides whether this
 * athlete may be given running at all.
 */
export function planRoutes(app: FastifyInstance, deps: RouteDeps): void {
  const { repos } = deps;

  app.post('/athletes/:athleteId/plans', async (request, reply) => {
    const actor = await actorFor(request, repos);
    const athleteId = requiredParam(request.params, 'athleteId');
    const athlete = await repos.athletes.byId(athleteId);
    if (!athlete) {
      throw new NotFoundError(`no athlete ${athleteId}`);
    }
    requireRoleInSquad(actor, athlete.squadId, 'head_coach', ASSIGN_PLAN_ACTION);

    const body = (request.body ?? {}) as {
      blockId?: string;
      goalId?: string | null;
      startsOn?: string;
    };
    if (!body.blockId) {
      throw new ValidationError('block_id is required');
    }
    const blockRow = await repos.blocks.byId(body.blockId);
    if (!blockRow) {
      throw new NotFoundError(`no block ${body.blockId}`);
    }
    if (body.goalId) {
      const goal = await repos.goals.byId(body.goalId);
      if (!goal || goal.athleteId !== athlete.id) {
        throw new ValidationError('that goal does not belong to this athlete', { goalId: body.goalId });
      }
    }

    const startsOn = body.startsOn ?? '';
    const [slots, templates] = await Promise.all([
      repos.blocks.slotsFor(blockRow.id),
      repos.templates.bySquad(blockRow.squadId),
    ]);
    const returnToRun = await gateFor(repos, athlete.id, athlete.squadId, athlete.state, startsOn);

    const plan = assignPlan({
      athlete: { id: athlete.id, squadId: athlete.squadId },
      goalId: body.goalId ?? null,
      block: toBlock(blockRow),
      slots,
      templates: templates.map(toTemplate),
      startsOn,
      actor,
      returnToRun,
    });
    const id = await repos.plans.insert(plan);
    return reply.code(201).send({ plan: { id, ...plan } });
  });

  app.get('/athletes/:athleteId/plans', async (request, reply) => {
    const actor = await actorFor(request, repos);
    const athleteId = requiredParam(request.params, 'athleteId');
    const athlete = await repos.athletes.byId(athleteId);
    if (!athlete) {
      throw new NotFoundError(`no athlete ${athleteId}`);
    }
    assertCanReadAthlete(actor, athlete, 'read a training plan');
    const plans = await repos.plans.forAthlete(athlete.id);
    return reply.code(200).send({ athleteId: athlete.id, plans });
  });

  /** The plan laid out on the calendar, at the version it was pinned to. */
  app.get('/plans/:planId/sessions', async (request, reply) => {
    const actor = await actorFor(request, repos);
    const planId = requiredParam(request.params, 'planId');
    const plan = await repos.plans.byId(planId);
    if (!plan) {
      throw new NotFoundError(`no plan ${planId}`);
    }
    const athlete = await repos.athletes.byId(plan.athleteId);
    if (!athlete) {
      throw new NotFoundError(`no athlete ${plan.athleteId}`);
    }
    assertCanReadAthlete(actor, athlete, 'read a training plan');

    const [slots, templates] = await Promise.all([
      repos.blocks.slotsFor(plan.blockId),
      repos.templates.bySquad(athlete.squadId),
    ]);
    const sessions = expandPlan(plan as Plan, slots, templates.map(toTemplate));
    return reply.code(200).send({ planId: plan.id, blockVersion: plan.blockVersion, sessions });
  });
}
