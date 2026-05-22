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

describe('upsertSlot', () => {
  it('adds a slot', () => {
    expect(upsertSlot([], slot(1, 1))).toEqual([slot(1, 1)]);
  });

  it('replaces the slot already on that day', () => {
    const slots = upsertSlot([slot(1, 1)], slot(1, 1, 'template-2'));
    expect(slots).toHaveLength(1);
    expect(slots[0]?.templateId).toBe('template-2');
  });

  it('keeps the slots sorted by week and day', () => {
    const slots = [slot(2, 3), slot(1, 5), slot(1, 2)].reduce(upsertSlot, [] as BlockSlot[]);
    expect(slots.map((s) => [s.week, s.day])).toEqual([
      [1, 2],
      [1, 5],
      [2, 3],
    ]);
  });

  it('does not touch the same day in another week', () => {
    const slots = upsertSlot([slot(1, 1)], slot(2, 1));
    expect(slots).toHaveLength(2);
  });
});

describe('removeSlot', () => {
  it('takes a day out', () => {
    expect(removeSlot([slot(1, 1), slot(1, 2)], 1, 1)).toEqual([slot(1, 2)]);
  });

  it('leaves the rest alone when there is nothing on that day', () => {
    expect(removeSlot([slot(1, 2)], 1, 1)).toEqual([slot(1, 2)]);
  });
});

describe('slotsForWeek', () => {
  it('returns one week in day order', () => {
    const slots = [slot(1, 5), slot(1, 1), slot(2, 2)];
    expect(slotsForWeek(slots, 1).map((s) => s.day)).toEqual([1, 5]);
  });
});

describe('emptyWeeks', () => {
  it('lists the weeks with nothing in them', () => {
    expect(emptyWeeks(block, [slot(1, 1), slot(3, 2)])).toEqual([2, 4]);
  });

  it('is empty when every week has something', () => {
    const slots = [slot(1, 1), slot(2, 1), slot(3, 1), slot(4, 1)];
    expect(emptyWeeks(block, slots)).toEqual([]);
  });

  it('lists every week of an empty block', () => {
    expect(emptyWeeks(block, [])).toEqual([1, 2, 3, 4]);
  });
});
