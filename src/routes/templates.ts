import type { FastifyInstance } from 'fastify';
import { NotFoundError, ValidationError } from '../lib/errors.js';
import { toNumber } from '../lib/numbers.js';
import { requireCoachInSquad, requireRoleInSquad } from '../domain/authz.js';
import {
  nextTemplateVersion,
  prescribedLoad,
  reviseTemplate,
  validateTemplateDraft,
} from '../domain/plans/templates.js';
import type { TemplateKind, WorkoutTemplate } from '../domain/plans/types.js';
import type { WorkoutTemplateRow } from '../ports/index.js';
import { actorFor, requiredParam, type RouteDeps } from './context.js';

export function toTemplate(row: WorkoutTemplateRow): WorkoutTemplate {
  return {
    id: row.id,
    squadId: row.squadId,
    code: row.code,
    version: row.version,
    kind: row.kind,
    prescription: row.prescription,
    loadFactor: toNumber(row.loadFactor),
    supersededAt: row.supersededAt,
  };
}

/**
 * Templates. Both coaching roles may write them - the gate that matters is on
 * publishing a block, not on drafting the pieces.
 */
export function templateRoutes(app: FastifyInstance, deps: RouteDeps): void {
  const { repos, clock } = deps;

  app.get('/squads/:squadId/templates', async (request, reply) => {
    const actor = await actorFor(request, repos);
    const squadId = requiredParam(request.params, 'squadId');
    requireCoachInSquad(actor, squadId, 'read squad templates');
    const rows = await repos.templates.bySquad(squadId);
    return reply.code(200).send({
      squadId,
      templates: rows.map((row) => {
        const template = toTemplate(row);
        return { ...template, prescribedLoad: prescribedLoad(template) };
      }),
    });
  });

  app.post('/squads/:squadId/templates', async (request, reply) => {
    const actor = await actorFor(request, repos);
    const squadId = requiredParam(request.params, 'squadId');
    requireCoachInSquad(actor, squadId, 'create a workout template');

    const body = (request.body ?? {}) as {
      code?: string;
      kind?: string;
      loadFactor?: number;
      prescription?: { summary?: string };
    };
    const draft = {
      squadId,
      code: (body.code ?? '').toUpperCase(),
      kind: body.kind ?? '',
      loadFactor: body.loadFactor ?? Number.NaN,
      prescription: (body.prescription ?? { summary: '' }) as WorkoutTemplate['prescription'],
    };
    validateTemplateDraft(draft);

    const existing = (await repos.templates.bySquad(squadId)).map(toTemplate);
    const version = nextTemplateVersion(existing, draft.code);
    const id = await repos.templates.insert({
      squadId,
      code: draft.code,
      version,
      kind: draft.kind as TemplateKind,
      prescription: draft.prescription,
      loadFactor: draft.loadFactor.toFixed(2),
      supersededAt: null,
    });
    return reply.code(201).send({ template: { id, code: draft.code, version } });
  });

  /**
   * An edit is a new version. The row that was there keeps its id, keeps its
   * version and gets a superseded_at stamp, so a block slot pinned to it does
   * not move.
   */
  app.post('/templates/:templateId/revisions', async (request, reply) => {
    const actor = await actorFor(request, repos);
    const templateId = requiredParam(request.params, 'templateId');
    const row = await repos.templates.byId(templateId);
    if (!row) {
      throw new NotFoundError(`no template ${templateId}`);
    }
    requireRoleInSquad(actor, row.squadId, 'head_coach', 'revise a workout template');

    const body = (request.body ?? {}) as {
      kind?: string;
      loadFactor?: number;
      prescription?: WorkoutTemplate['prescription'];
    };
    if (body.kind === undefined && body.loadFactor === undefined && body.prescription === undefined) {
      throw new ValidationError('a revision has to change something');
    }
    const { revision } = reviseTemplate(
      toTemplate(row),
      {
        kind: body.kind,
        loadFactor: body.loadFactor,
        prescription: body.prescription,
      },
      clock.now(),
    );
    const id = await repos.templates.insert({
      squadId: revision.squadId,
      code: revision.code,
      version: revision.version,
      kind: revision.kind,
      prescription: revision.prescription,
      loadFactor: revision.loadFactor.toFixed(2),
      supersededAt: null,
    });
    await repos.templates.markSuperseded(row.id, clock.now());
    return reply.code(201).send({
      template: { id, code: revision.code, version: revision.version },
      supersededTemplateId: row.id,
    });
  });
}
