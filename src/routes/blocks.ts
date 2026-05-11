import type { FastifyInstance } from 'fastify';
import { NotFoundError, ValidationError } from '../lib/errors.js';
import { requireCoachInSquad, requireRoleInSquad, requireSquadAccess } from '../domain/authz.js';
import { draftBlock, publishBlock, reviseBlock } from '../domain/plans/blocks.js';
import { emptyWeeks, upsertSlot, validateSlot } from '../domain/plans/slots.js';
import type { BlockSlot, TrainingBlock } from '../domain/plans/types.js';
import type { TrainingBlockRow } from '../ports/index.js';
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

/**
 * R5's endpoints. An assistant coach can build a block all day; only a head
 * coach can turn it into something assignable.
 */
export function blockRoutes(app: FastifyInstance, deps: RouteDeps): void {
  const { repos, clock } = deps;

  app.post('/squads/:squadId/blocks', async (request, reply) => {
    const actor = await actorFor(request, repos);
    const squadId = requiredParam(request.params, 'squadId');
    const body = (request.body ?? {}) as { name?: string; weeks?: number };
    const draft = draftBlock(
      { squadId, name: body.name ?? '', weeks: body.weeks ?? Number.NaN },
      actor,
    );
    const id = await repos.blocks.insert(draft);
    return reply.code(201).send({ block: { id, ...draft } });
  });

  app.get('/blocks/:blockId', async (request, reply) => {
    const actor = await actorFor(request, repos);
    const blockId = requiredParam(request.params, 'blockId');
    const row = await repos.blocks.byId(blockId);
    if (!row) {
      throw new NotFoundError(`no block ${blockId}`);
    }
    requireSquadAccess(actor, row.squadId, 'read a training block');
    const slots = await repos.blocks.slotsFor(blockId);
    return reply.code(200).send({
      block: toBlock(row),
      slots,
      emptyWeeks: emptyWeeks(toBlock(row), slots),
    });
  });

  app.put('/blocks/:blockId/slots', async (request, reply) => {
    const actor = await actorFor(request, repos);
    const blockId = requiredParam(request.params, 'blockId');
    const row = await repos.blocks.byId(blockId);
    if (!row) {
      throw new NotFoundError(`no block ${blockId}`);
    }
    requireCoachInSquad(actor, row.squadId, 'put a session on a block');
    if (row.state === 'published') {
      throw new ValidationError('a published block cannot be edited - revise it instead', {
        blockId,
        version: row.version,
      });
    }

    const body = (request.body ?? {}) as { week?: number; day?: number; templateId?: string };
    if (!body.templateId) {
      throw new ValidationError('template_id is required');
    }
    const templateRow = await repos.templates.byId(body.templateId);
    if (!templateRow) {
      throw new NotFoundError(`no template ${body.templateId}`);
    }
    const block = toBlock(row);
    const template = toTemplate(templateRow);
    validateSlot(block, { week: body.week ?? Number.NaN, day: body.day ?? Number.NaN }, template);

    const slot: BlockSlot = {
      blockId,
      week: body.week as number,
      day: body.day as number,
      templateId: template.id,
      templateVersion: template.version,
    };
    await repos.blocks.putSlot(slot);
    const slots = upsertSlot(await repos.blocks.slotsFor(blockId), slot);
    return reply.code(200).send({ slot, slots, emptyWeeks: emptyWeeks(block, slots) });
  });

  /** Head coach only. R5. */
  app.post('/blocks/:blockId/publish', async (request, reply) => {
    const actor = await actorFor(request, repos);
    const blockId = requiredParam(request.params, 'blockId');
    const row = await repos.blocks.byId(blockId);
    if (!row) {
      throw new NotFoundError(`no block ${blockId}`);
    }
    requireRoleInSquad(actor, row.squadId, 'head_coach', 'publish a training block');

    const slots = await repos.blocks.slotsFor(blockId);
    const published = publishBlock(toBlock(row), slots, actor, clock);
    await repos.blocks.save({ ...row, ...published });
    return reply.code(200).send({ block: published });
  });

  /**
   * An edit to a published block lands as the next version, in draft, with
   * the slots copied across. Plans that pinned the old version are untouched.
   */
  app.post('/blocks/:blockId/revisions', async (request, reply) => {
    const actor = await actorFor(request, repos);
    const blockId = requiredParam(request.params, 'blockId');
    const row = await repos.blocks.byId(blockId);
    if (!row) {
      throw new NotFoundError(`no block ${blockId}`);
    }
    requireRoleInSquad(actor, row.squadId, 'head_coach', 'revise a training block');

    const body = (request.body ?? {}) as { name?: string; weeks?: number };
    const slots = await repos.blocks.slotsFor(blockId);
    const { revision, slots: carried } = reviseBlock(toBlock(row), slots, {
      name: body.name,
      weeks: body.weeks,
    });
    const id = await repos.blocks.insert(revision);
    await repos.blocks.putSlots(carried.map((slot) => ({ ...slot, blockId: id })));
    return reply.code(201).send({
      block: { id, ...revision },
      carriedSlots: carried.length,
      previousVersion: row.version,
    });
  });
}
