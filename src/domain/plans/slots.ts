import { ValidationError } from '../../lib/errors.js';
import type { BlockSlot, TrainingBlock, WorkoutTemplate } from './types.js';

/** Day 1 is Monday, day 7 is Sunday, same as the ISO weekday. */
export const DAYS_PER_WEEK = 7;

export function validateSlot(
  block: TrainingBlock,
  slot: Pick<BlockSlot, 'week' | 'day'>,
  template: WorkoutTemplate,
): void {
  if (!Number.isInteger(slot.week) || slot.week < 1 || slot.week > block.weeks) {
    throw new ValidationError(`week must be between 1 and ${block.weeks}`, { week: slot.week });
  }
  if (!Number.isInteger(slot.day) || slot.day < 1 || slot.day > DAYS_PER_WEEK) {
    throw new ValidationError('day must be between 1 (Monday) and 7 (Sunday)', { day: slot.day });
  }
  if (template.squadId !== block.squadId) {
    throw new ValidationError('a block can only use its own squad\'s templates', {
      blockSquadId: block.squadId,
      templateSquadId: template.squadId,
    });
  }
}
