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

describe('expandPlan', () => {
  it('lays the slots out on the calendar in order', () => {
    const sessions = expandPlan(plan, [slot(2, 1, easy), slot(1, 3, tempo)], [easy, tempo]);
    expect(sessions.map((session) => session.scheduledFor)).toEqual(['2026-05-06', '2026-05-11']);
    expect(sessions.map((session) => session.kind)).toEqual(['tempo', 'easy']);
  });

  it('carries the plan and athlete onto every session', () => {
    const sessions = expandPlan(plan, [slot(1, 1, easy)], [easy]);
    expect(sessions[0]?.planId).toBe('plan-1');
    expect(sessions[0]?.athleteId).toBe('athlete-a');
  });

  it('records the prescribed load for each session', () => {
    const sessions = expandPlan(plan, [slot(1, 1, tempo)], [tempo]);
    expect(sessions[0]?.prescribedLoad).toBe(567);
  });

  it('keeps the pinned template version on the session', () => {
    const sessions = expandPlan(plan, [slot(1, 1, tempo)], [tempo]);
    expect(sessions[0]?.templateVersion).toBe(2);
  });

  it('refuses a slot pointing at a template it was not given', () => {
    expect(() => expandPlan(plan, [slot(1, 1, easy)], [tempo])).toThrow(ValidationError);
  });

  it('refuses a template handed over at the wrong version', () => {
    const drifted = { ...tempo, version: 3 };
    expect(() => expandPlan(plan, [slot(1, 1, tempo)], [drifted])).toThrow(ValidationError);
  });

  it('expands an empty block to nothing', () => {
    expect(expandPlan(plan, [], [easy])).toEqual([]);
  });
});
