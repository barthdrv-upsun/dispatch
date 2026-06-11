import { ConflictError, ValidationError } from '../../lib/errors.js';
import { isLocalDate, localWeekday, type LocalDate } from '../../lib/time.js';
import { requireRoleInSquad, type Actor } from '../authz.js';
import type { ReturnToRunDecision } from '../clearances/gate.js';
import { isRunningKind } from '../load/entries.js';
import type { BlockSlot, Plan, TrainingBlock, WorkoutTemplate } from './types.js';

export const ASSIGN_PLAN_ACTION = 'assign a training plan';

export type AssignInput = {
  athlete: { id: string; squadId: string };
  goalId: string | null;
  block: TrainingBlock;
  slots: readonly BlockSlot[];
  templates: readonly WorkoutTemplate[];
  startsOn: LocalDate;
  actor: Actor;
  returnToRun: ReturnToRunDecision;
};

/** True when any slot in the block puts the athlete on their feet. */
export function blockPrescribesRunning(
  slots: readonly BlockSlot[],
  templates: readonly WorkoutTemplate[],
): boolean {
  const kindById = new Map(templates.map((template) => [template.id, template.kind]));
  return slots.some((slot) => isRunningKind(kindById.get(slot.templateId) ?? null));
}

/**
 * R5. The plan copies the block's version in and keeps it. Later edits to the
 * block produce new versions and this plan never hears about them.
 *
 * R4 is checked here too, because assigning a running block to an athlete who
 * has not been cleared is prescribing running to them.
 */
export function assignPlan(input: AssignInput): Omit<Plan, 'id'> {
  requireRoleInSquad(input.actor, input.athlete.squadId, 'head_coach', ASSIGN_PLAN_ACTION);

  if (input.block.squadId !== input.athlete.squadId) {
    throw new ValidationError('that block belongs to another squad', {
      blockSquadId: input.block.squadId,
      athleteSquadId: input.athlete.squadId,
    });
  }
  if (input.block.state !== 'published') {
    throw new ConflictError(
      `block ${input.block.name} v${input.block.version} is still a draft and cannot be assigned`,
    );
  }
  if (!isLocalDate(input.startsOn)) {
    throw new ValidationError('starts_on must be a YYYY-MM-DD date', { startsOn: input.startsOn });
  }
  if (localWeekday(input.startsOn) !== 1) {
    throw new ValidationError('a plan starts on a Monday', { startsOn: input.startsOn });
  }
  if (input.slots.length === 0) {
    throw new ValidationError('that block has no sessions in it');
  }

  if (!input.returnToRun.allowed && blockPrescribesRunning(input.slots, input.templates)) {
    throw new ConflictError(
      `athlete ${input.athlete.id} cannot be prescribed running: ${input.returnToRun.reason}`,
    );
  }

  return {
    athleteId: input.athlete.id,
    goalId: input.goalId,
    blockId: input.block.id,
    blockVersion: input.block.version,
    startsOn: input.startsOn,
  };
}
