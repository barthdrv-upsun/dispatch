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
