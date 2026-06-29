import { describe, expect, it } from 'vitest';
import { ConflictError, ForbiddenError, ValidationError } from '../../src/lib/errors.js';
import type { Actor } from '../../src/domain/authz.js';
import type { ReturnToRunDecision } from '../../src/domain/clearances/gate.js';
import { assignPlan, blockPrescribesRunning } from '../../src/domain/plans/assignment.js';
import type { BlockSlot, TrainingBlock, WorkoutTemplate } from '../../src/domain/plans/types.js';

const SQUAD = 'squad-a';

const headCoach: Actor = { userId: 'user-head', grants: [{ squadId: SQUAD, role: 'head_coach' }] };
const assistant: Actor = {
  userId: 'user-assistant',
  grants: [{ squadId: SQUAD, role: 'assistant_coach' }],
};

const cleared: ReturnToRunDecision = {
  allowed: true,
  reason: 'athlete is active',
  blockingInjuryIds: [],
};
const notCleared: ReturnToRunDecision = {
  allowed: false,
  reason: 'no standing return-to-run clearance signed by a physio',
  blockingInjuryIds: ['injury-1'],
};

const easyTemplate: WorkoutTemplate = {
  id: 'template-easy',
  squadId: SQUAD,
  code: 'EASY-45',
  version: 1,
  kind: 'easy',
  prescription: { summary: '45 minutes easy' },
  loadFactor: 1,
  supersededAt: null,
};
const bikeTemplate: WorkoutTemplate = { ...easyTemplate, id: 'template-bike', code: 'BIKE-60', kind: 'cycling' };

const publishedBlock: TrainingBlock = {
  id: 'block-1',
  squadId: SQUAD,
  name: 'Autumn base',
  version: 3,
  weeks: 2,
  state: 'published',
  publishedBy: 'user-head',
  publishedAt: new Date('2026-04-27T09:00:00Z'),
};

const runningSlots: BlockSlot[] = [
  { blockId: 'block-1', week: 1, day: 1, templateId: 'template-easy', templateVersion: 1 },
  { blockId: 'block-1', week: 2, day: 1, templateId: 'template-easy', templateVersion: 1 },
];
const bikeOnlySlots: BlockSlot[] = [
  { blockId: 'block-1', week: 1, day: 1, templateId: 'template-bike', templateVersion: 1 },
];

/** Monday. */
const STARTS_ON = '2026-05-04';

function input(overrides: Record<string, unknown> = {}) {
  return {
    athlete: { id: 'athlete-a', squadId: SQUAD },
    goalId: 'goal-1',
    block: publishedBlock,
    slots: runningSlots,
    templates: [easyTemplate, bikeTemplate],
    startsOn: STARTS_ON,
    actor: headCoach,
    returnToRun: cleared,
    ...overrides,
  } as Parameters<typeof assignPlan>[0];
}

describe('blockPrescribesRunning', () => {
  it('is true when any slot is a run', () => {
    expect(blockPrescribesRunning(runningSlots, [easyTemplate, bikeTemplate])).toBe(true);
  });

  it('is false for a block of gym and bike sessions', () => {
    expect(blockPrescribesRunning(bikeOnlySlots, [easyTemplate, bikeTemplate])).toBe(false);
  });

  it('is false for a block with no slots', () => {
    expect(blockPrescribesRunning([], [easyTemplate])).toBe(false);
  });
});

describe('assignPlan', () => {
  it('pins the block version at assignment', () => {
    const plan = assignPlan(input());
    expect(plan.blockId).toBe('block-1');
    expect(plan.blockVersion).toBe(3);
    expect(plan.athleteId).toBe('athlete-a');
    expect(plan.goalId).toBe('goal-1');
    expect(plan.startsOn).toBe(STARTS_ON);
  });

  it('keeps the pinned version when the block moves on afterwards', () => {
    const plan = assignPlan(input());
    const laterVersion = { ...publishedBlock, version: 4 };
    expect(plan.blockVersion).toBe(3);
    expect(laterVersion.version).toBe(4);
  });

  it('accepts a plan with no goal behind it', () => {
    expect(assignPlan(input({ goalId: null })).goalId).toBeNull();
  });

  it('refuses an assistant coach', () => {
    try {
      assignPlan(input({ actor: assistant }));
      expect.unreachable('an assistant coach must not be able to assign');
    } catch (err) {
      expect(err).toBeInstanceOf(ForbiddenError);
      expect((err as ForbiddenError).requiredRole).toBe('head_coach');
    }
  });

  it('refuses a draft block', () => {
    expect(() => assignPlan(input({ block: { ...publishedBlock, state: 'draft' } }))).toThrow(
      ConflictError,
    );
  });

  it('refuses a block from another squad', () => {
    expect(() => assignPlan(input({ block: { ...publishedBlock, squadId: 'squad-b' } }))).toThrow(
      ValidationError,
    );
  });

  it('refuses a start date that is not a Monday', () => {
    expect(() => assignPlan(input({ startsOn: '2026-05-05' }))).toThrow(ValidationError);
  });

  it('refuses a start date that is not a date', () => {
    expect(() => assignPlan(input({ startsOn: 'next week' }))).toThrow(ValidationError);
  });

  it('refuses a block with nothing in it', () => {
    expect(() => assignPlan(input({ slots: [] }))).toThrow(ValidationError);
  });

  /** R4, from the prescribing end. */
  it('refuses to prescribe running to an athlete who has not been cleared', () => {
    try {
      assignPlan(input({ returnToRun: notCleared }));
      expect.unreachable('an uncleared athlete must not be prescribed running');
    } catch (err) {
      expect(err).toBeInstanceOf(ConflictError);
      expect((err as ConflictError).message).toContain('no standing return-to-run clearance');
    }
  });

  it('still assigns a block of gym sessions to an athlete who has not been cleared', () => {
    const plan = assignPlan(input({ returnToRun: notCleared, slots: bikeOnlySlots }));
    expect(plan.blockVersion).toBe(3);
  });
});
