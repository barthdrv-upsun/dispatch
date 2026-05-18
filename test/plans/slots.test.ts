import { describe, expect, it } from 'vitest';
import { ValidationError } from '../../src/lib/errors.js';
import { emptyWeeks, removeSlot, slotsForWeek, upsertSlot, validateSlot } from '../../src/domain/plans/slots.js';
import type { BlockSlot, TrainingBlock, WorkoutTemplate } from '../../src/domain/plans/types.js';

const block: TrainingBlock = {
  id: 'block-1',
  squadId: 'squad-a',
  name: 'Autumn base',
  version: 1,
  weeks: 4,
  state: 'draft',
  publishedBy: null,
  publishedAt: null,
};

const template: WorkoutTemplate = {
  id: 'template-1',
  squadId: 'squad-a',
  code: 'EASY-45',
  version: 1,
  kind: 'easy',
  prescription: { summary: '45 minutes easy' },
  loadFactor: 1,
  supersededAt: null,
};

function slot(week: number, day: number, templateId = 'template-1'): BlockSlot {
  return { blockId: 'block-1', week, day, templateId, templateVersion: 1 };
}

describe('validateSlot', () => {
  it('accepts a slot inside the block', () => {
    expect(() => validateSlot(block, { week: 1, day: 1 }, template)).not.toThrow();
    expect(() => validateSlot(block, { week: 4, day: 7 }, template)).not.toThrow();
  });

  it('refuses a week past the end of the block', () => {
    expect(() => validateSlot(block, { week: 5, day: 1 }, template)).toThrow(ValidationError);
    expect(() => validateSlot(block, { week: 0, day: 1 }, template)).toThrow(ValidationError);
  });

  it('refuses a day outside Monday to Sunday', () => {
    expect(() => validateSlot(block, { week: 1, day: 0 }, template)).toThrow(ValidationError);
    expect(() => validateSlot(block, { week: 1, day: 8 }, template)).toThrow(ValidationError);
  });

  it('refuses a fractional week or day', () => {
    expect(() => validateSlot(block, { week: 1.5, day: 1 }, template)).toThrow(ValidationError);
    expect(() => validateSlot(block, { week: 1, day: 2.5 }, template)).toThrow(ValidationError);
  });

  it('refuses another squad\'s template', () => {
    const theirs = { ...template, squadId: 'squad-b' };
    expect(() => validateSlot(block, { week: 1, day: 1 }, theirs)).toThrow(ValidationError);
  });
});
