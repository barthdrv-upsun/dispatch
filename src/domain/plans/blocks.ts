import { requireRoleInSquad, type Actor } from '../authz.js';
import type { Clock } from '../../lib/clock.js';
import { ConflictError, ValidationError } from '../../lib/errors.js';
import { emptyWeeks } from './slots.js';
import type { BlockSlot, TrainingBlock } from './types.js';

export type BlockDraft = {
  squadId: string;
  name: string;
  weeks: number;
};

const MAX_BLOCK_WEEKS = 30;

/**
 * Drafting is open to both coaching roles. Publishing is not - see
 * publishBlock.
 */
export function draftBlock(draft: BlockDraft, actor: Actor): Omit<TrainingBlock, 'id'> {
  if (!hasEitherCoachRole(actor, draft.squadId)) {
    requireRoleInSquad(actor, draft.squadId, 'assistant_coach', 'draft a training block');
  }
  if (!draft.name || draft.name.trim().length < 3) {
    throw new ValidationError('a block needs a name of at least three characters');
  }
  if (!Number.isInteger(draft.weeks) || draft.weeks < 1 || draft.weeks > MAX_BLOCK_WEEKS) {
    throw new ValidationError(`a block runs for 1 to ${MAX_BLOCK_WEEKS} weeks`, {
      weeks: draft.weeks,
    });
  }
  return {
    squadId: draft.squadId,
    name: draft.name.trim(),
    version: 1,
    weeks: draft.weeks,
    state: 'draft',
    publishedBy: null,
    publishedAt: null,
  };
}

function hasEitherCoachRole(actor: Actor, squadId: string): boolean {
  return actor.grants.some(
    (grant) =>
      grant.squadId === squadId && (grant.role === 'head_coach' || grant.role === 'assistant_coach'),
  );
}

/**
 * R5. Only a head coach publishes, and only a block with something in every
 * week of it.
 *
 * Takes a Clock so the published_at stamp is testable.
 */
export function publishBlock(
  block: TrainingBlock,
  slots: readonly BlockSlot[],
  actor: Actor,
  clock: Clock,
): TrainingBlock {
  requireRoleInSquad(actor, block.squadId, 'head_coach', 'publish a training block');
  if (block.state === 'published') {
    throw new ConflictError(`block ${block.name} v${block.version} is already published`);
  }
  const gaps = emptyWeeks(block, slots);
  if (gaps.length > 0) {
    throw new ValidationError('every week of a block needs at least one session before it can be published', {
      emptyWeeks: gaps,
    });
  }
  return {
    ...block,
    state: 'published',
    publishedBy: actor.userId,
    publishedAt: clock.now(),
  };
}

export type BlockRevision = {
  revision: Omit<TrainingBlock, 'id'>;
  slots: Array<Omit<BlockSlot, 'blockId'>>;
};

/**
 * R5. Editing a published block does not touch it. It produces the next
 * version, in draft, carrying a copy of the slots - which is why a plan that
 * pinned version 2 keeps seeing version 2 for ever.
 */
export function reviseBlock(
  block: TrainingBlock,
  slots: readonly BlockSlot[],
  changes: Partial<Pick<BlockDraft, 'name' | 'weeks'>>,
): BlockRevision {
  const weeks = changes.weeks ?? block.weeks;
  if (!Number.isInteger(weeks) || weeks < 1 || weeks > MAX_BLOCK_WEEKS) {
    throw new ValidationError(`a block runs for 1 to ${MAX_BLOCK_WEEKS} weeks`, { weeks });
  }
  const name = (changes.name ?? block.name).trim();
  if (name.length < 3) {
    throw new ValidationError('a block needs a name of at least three characters');
  }
  return {
    revision: {
      squadId: block.squadId,
      name,
      version: block.version + 1,
      weeks,
      state: 'draft',
      publishedBy: null,
      publishedAt: null,
    },
    slots: slots
      .filter((slot) => slot.week <= weeks)
      .map((slot) => ({
        week: slot.week,
        day: slot.day,
        templateId: slot.templateId,
        templateVersion: slot.templateVersion,
      })),
  };
}
