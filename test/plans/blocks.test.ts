import { describe, expect, it } from 'vitest';
import { fixedClock } from '../../src/lib/clock.js';
import { ConflictError, ForbiddenError, ValidationError } from '../../src/lib/errors.js';
import type { Actor } from '../../src/domain/authz.js';
import { draftBlock, publishBlock, reviseBlock } from '../../src/domain/plans/blocks.js';
import type { BlockSlot, TrainingBlock } from '../../src/domain/plans/types.js';

const SQUAD = 'squad-a';
const OTHER_SQUAD = 'squad-b';

const headCoach: Actor = { userId: 'user-head', grants: [{ squadId: SQUAD, role: 'head_coach' }] };
const assistant: Actor = {
  userId: 'user-assistant',
  grants: [{ squadId: SQUAD, role: 'assistant_coach' }],
};
const physio: Actor = { userId: 'user-physio', grants: [{ squadId: SQUAD, role: 'physio' }] };
const otherHeadCoach: Actor = {
  userId: 'user-head-b',
  grants: [{ squadId: OTHER_SQUAD, role: 'head_coach' }],
};

const clock = fixedClock('2026-05-04T09:30:00Z');

function block(overrides: Partial<TrainingBlock> = {}): TrainingBlock {
  return {
    id: 'block-1',
    squadId: SQUAD,
    name: 'Autumn base',
    version: 1,
    weeks: 2,
    state: 'draft',
    publishedBy: null,
    publishedAt: null,
    ...overrides,
  };
}

function slot(week: number, day: number): BlockSlot {
  return { blockId: 'block-1', week, day, templateId: 'template-1', templateVersion: 1 };
}

const fullSlots = [slot(1, 1), slot(2, 1)];

describe('draftBlock', () => {
  it('lets a head coach draft', () => {
    const draft = draftBlock({ squadId: SQUAD, name: 'Autumn base', weeks: 12 }, headCoach);
    expect(draft.state).toBe('draft');
    expect(draft.version).toBe(1);
    expect(draft.weeks).toBe(12);
    expect(draft.publishedAt).toBeNull();
  });

  it('lets an assistant coach draft too', () => {
    expect(() => draftBlock({ squadId: SQUAD, name: 'Autumn base', weeks: 12 }, assistant)).not.toThrow();
  });

  it('refuses a physio', () => {
    expect(() => draftBlock({ squadId: SQUAD, name: 'Autumn base', weeks: 12 }, physio)).toThrow(
      ForbiddenError,
    );
  });

  it('refuses a coach from another squad', () => {
    expect(() =>
      draftBlock({ squadId: SQUAD, name: 'Autumn base', weeks: 12 }, otherHeadCoach),
    ).toThrow(ForbiddenError);
  });

  it('trims the name and insists on a real one', () => {
    expect(draftBlock({ squadId: SQUAD, name: '  Autumn base  ', weeks: 4 }, headCoach).name).toBe(
      'Autumn base',
    );
    expect(() => draftBlock({ squadId: SQUAD, name: 'ab', weeks: 4 }, headCoach)).toThrow(ValidationError);
  });

  it('refuses a length nobody would train for', () => {
    expect(() => draftBlock({ squadId: SQUAD, name: 'Autumn base', weeks: 0 }, headCoach)).toThrow(
      ValidationError,
    );
    expect(() => draftBlock({ squadId: SQUAD, name: 'Autumn base', weeks: 31 }, headCoach)).toThrow(
      ValidationError,
    );
    expect(() => draftBlock({ squadId: SQUAD, name: 'Autumn base', weeks: 2.5 }, headCoach)).toThrow(
      ValidationError,
    );
  });
});

describe('publishBlock', () => {
  it('publishes for a head coach and records who and when', () => {
    const published = publishBlock(block(), fullSlots, headCoach, clock);
    expect(published.state).toBe('published');
    expect(published.publishedBy).toBe('user-head');
    expect(published.publishedAt).toEqual(new Date('2026-05-04T09:30:00Z'));
  });

  it('refuses an assistant coach and says which role was needed', () => {
    try {
      publishBlock(block(), fullSlots, assistant, clock);
      expect.unreachable('an assistant coach must not be able to publish');
    } catch (err) {
      expect(err).toBeInstanceOf(ForbiddenError);
      expect((err as ForbiddenError).requiredRole).toBe('head_coach');
      expect((err as ForbiddenError).status).toBe(403);
    }
  });

  it('refuses a physio', () => {
    expect(() => publishBlock(block(), fullSlots, physio, clock)).toThrow(ForbiddenError);
  });

  it('refuses a head coach of another squad', () => {
    expect(() => publishBlock(block(), fullSlots, otherHeadCoach, clock)).toThrow(ForbiddenError);
  });

  it('refuses a block that is already published', () => {
    expect(() => publishBlock(block({ state: 'published' }), fullSlots, headCoach, clock)).toThrow(
      ConflictError,
    );
  });

  it('refuses a block with an empty week', () => {
    try {
      publishBlock(block(), [slot(1, 1)], headCoach, clock);
      expect.unreachable('a block with a hole in it must not publish');
    } catch (err) {
      expect(err).toBeInstanceOf(ValidationError);
      expect((err as ValidationError).details).toEqual({ emptyWeeks: [2] });
    }
  });

  it('does not mutate the block it was given', () => {
    const original = block();
    publishBlock(original, fullSlots, headCoach, clock);
    expect(original.state).toBe('draft');
    expect(original.publishedAt).toBeNull();
  });
});

describe('reviseBlock', () => {
  it('produces the next version, back in draft', () => {
    const published = block({ state: 'published', version: 2, publishedBy: 'user-head' });
    const { revision } = reviseBlock(published, fullSlots, { name: 'Autumn base v2' });
    expect(revision.version).toBe(3);
    expect(revision.state).toBe('draft');
    expect(revision.publishedBy).toBeNull();
    expect(revision.publishedAt).toBeNull();
    expect(revision.name).toBe('Autumn base v2');
  });

  it('leaves the version it was given exactly as it was', () => {
    const published = block({ state: 'published', version: 2, publishedAt: new Date('2026-01-01T00:00:00Z') });
    reviseBlock(published, fullSlots, { weeks: 3 });
    expect(published.version).toBe(2);
    expect(published.state).toBe('published');
  });

  it('carries the slots across', () => {
    const { slots } = reviseBlock(block(), fullSlots, {});
    expect(slots).toEqual([
      { week: 1, day: 1, templateId: 'template-1', templateVersion: 1 },
      { week: 2, day: 1, templateId: 'template-1', templateVersion: 1 },
    ]);
  });

  it('drops slots that fall off the end of a shorter block', () => {
    const { revision, slots } = reviseBlock(block({ weeks: 3 }), [slot(1, 1), slot(3, 2)], { weeks: 2 });
    expect(revision.weeks).toBe(2);
    expect(slots.map((s) => s.week)).toEqual([1]);
  });

  it('refuses a revision that is not a block any more', () => {
    expect(() => reviseBlock(block(), fullSlots, { weeks: 0 })).toThrow(ValidationError);
    expect(() => reviseBlock(block(), fullSlots, { name: 'no' })).toThrow(ValidationError);
  });
});
