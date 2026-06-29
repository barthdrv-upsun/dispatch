import { describe, expect, it } from 'vitest';
import { ValidationError } from '../../src/lib/errors.js';
import { dayFor, expandPlan } from '../../src/domain/plans/expansion.js';
import type { BlockSlot, Plan, WorkoutTemplate } from '../../src/domain/plans/types.js';

const plan: Plan = {
  id: 'plan-1',
  athleteId: 'athlete-a',
  goalId: 'goal-1',
  blockId: 'block-1',
  blockVersion: 2,
  startsOn: '2026-05-04',
};

const easy: WorkoutTemplate = {
  id: 'template-easy',
  squadId: 'squad-a',
  code: 'EASY-45',
  version: 1,
  kind: 'easy',
  prescription: { summary: '45 minutes easy', durationS: 2700, targetEffort: 3 },
  loadFactor: 1,
  supersededAt: null,
};
const tempo: WorkoutTemplate = {
  ...easy,
  id: 'template-tempo',
  code: 'TEMPO-4X8',
  kind: 'tempo',
  version: 2,
  loadFactor: 1.35,
  prescription: { summary: '4x8 at threshold', durationS: 3600, targetEffort: 7 },
};

function slot(week: number, day: number, template: WorkoutTemplate): BlockSlot {
  return {
    blockId: 'block-1',
    week,
    day,
    templateId: template.id,
    templateVersion: template.version,
  };
}

describe('dayFor', () => {
  it('puts week 1 day 1 on the start date', () => {
    expect(dayFor('2026-05-04', 1, 1)).toBe('2026-05-04');
  });

  it('walks a week at a time', () => {
    expect(dayFor('2026-05-04', 2, 1)).toBe('2026-05-11');
    expect(dayFor('2026-05-04', 1, 7)).toBe('2026-05-10');
    expect(dayFor('2026-05-04', 3, 4)).toBe('2026-05-21');
  });
});
