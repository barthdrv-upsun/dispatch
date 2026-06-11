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
