import { describe, expect, it } from 'vitest';
import { ValidationError } from '../../src/lib/errors.js';
import {
  currentTemplate,
  nextTemplateVersion,
  prescribedLoad,
  reviseTemplate,
  validateTemplateDraft,
} from '../../src/domain/plans/templates.js';
import type { WorkoutTemplate } from '../../src/domain/plans/types.js';

const SQUAD = 'squad-a';

function template(overrides: Partial<WorkoutTemplate> = {}): WorkoutTemplate {
  return {
    id: 'template-1',
    squadId: SQUAD,
    code: 'TEMPO-4X8',
    version: 1,
    kind: 'tempo',
    prescription: { summary: '4x8 at threshold', durationS: 3600, targetEffort: 7 },
    loadFactor: 1.35,
    supersededAt: null,
    ...overrides,
  };
}

describe('validateTemplateDraft', () => {
  const draft = {
    squadId: SQUAD,
    code: 'EASY-45',
    kind: 'easy',
    loadFactor: 1,
    prescription: { summary: '45 minutes easy' },
  };

  it('accepts a sound draft', () => {
    expect(() => validateTemplateDraft(draft)).not.toThrow();
  });

  it('accepts every kind the enum carries', () => {
    for (const kind of ['easy', 'tempo', 'interval', 'long', 'strength', 'cycling', 'swimming']) {
      expect(() => validateTemplateDraft({ ...draft, kind })).not.toThrow();
    }
  });

  it('refuses a kind that is not one of them', () => {
    expect(() => validateTemplateDraft({ ...draft, kind: 'yoga' })).toThrow(ValidationError);
  });

  it('refuses a code that is not shouty enough', () => {
    expect(() => validateTemplateDraft({ ...draft, code: 'easy-45' })).toThrow(ValidationError);
    expect(() => validateTemplateDraft({ ...draft, code: 'E' })).toThrow(ValidationError);
    expect(() => validateTemplateDraft({ ...draft, code: 'EASY_45' })).toThrow(ValidationError);
  });

  it('refuses a load factor outside 0 to 5', () => {
    expect(() => validateTemplateDraft({ ...draft, loadFactor: 0 })).toThrow(ValidationError);
    expect(() => validateTemplateDraft({ ...draft, loadFactor: 5.1 })).toThrow(ValidationError);
    expect(() => validateTemplateDraft({ ...draft, loadFactor: Number.NaN })).toThrow(ValidationError);
  });

  it('refuses a draft with no summary', () => {
    expect(() => validateTemplateDraft({ ...draft, prescription: { summary: '' } })).toThrow(
      ValidationError,
    );
  });

  it('refuses a draft with no squad', () => {
    expect(() => validateTemplateDraft({ ...draft, squadId: '' })).toThrow(ValidationError);
  });
});

describe('nextTemplateVersion', () => {
  it('starts at one', () => {
    expect(nextTemplateVersion([], 'EASY-45')).toBe(1);
  });

  it('takes the highest version for that code and adds one', () => {
    const existing = [
      template({ id: 'a', code: 'EASY-45', version: 1 }),
      template({ id: 'b', code: 'EASY-45', version: 2 }),
      template({ id: 'c', code: 'TEMPO-4X8', version: 7 }),
    ];
    expect(nextTemplateVersion(existing, 'EASY-45')).toBe(3);
  });

  it('does not let another code interfere', () => {
    const existing = [template({ id: 'c', code: 'TEMPO-4X8', version: 7 })];
    expect(nextTemplateVersion(existing, 'EASY-45')).toBe(1);
  });
});

describe('currentTemplate', () => {
  it('returns the live version', () => {
    const existing = [
      template({ id: 'a', version: 1, supersededAt: new Date('2026-01-01T00:00:00Z') }),
      template({ id: 'b', version: 2 }),
    ];
    expect(currentTemplate(existing, 'TEMPO-4X8')?.id).toBe('b');
  });

  it('returns nothing when every version has been superseded', () => {
    const existing = [template({ id: 'a', supersededAt: new Date('2026-01-01T00:00:00Z') })];
    expect(currentTemplate(existing, 'TEMPO-4X8')).toBeNull();
  });

  it('returns nothing for a code it has never seen', () => {
    expect(currentTemplate([template()], 'NOPE-1')).toBeNull();
  });
});

describe('reviseTemplate', () => {
  const at = new Date('2026-05-04T10:00:00Z');

  it('writes the next version and stamps the old one', () => {
    const { superseded, revision } = reviseTemplate(template(), { loadFactor: 1.5 }, at);
    expect(revision.version).toBe(2);
    expect(revision.loadFactor).toBe(1.5);
    expect(revision.supersededAt).toBeNull();
    expect(superseded.supersededAt).toEqual(at);
    expect(superseded.version).toBe(1);
  });

  it('keeps the code and the squad', () => {
    const { revision } = reviseTemplate(template(), { kind: 'interval' }, at);
    expect(revision.code).toBe('TEMPO-4X8');
    expect(revision.squadId).toBe(SQUAD);
    expect(revision.kind).toBe('interval');
  });

  it('carries forward anything the revision does not mention', () => {
    const { revision } = reviseTemplate(template(), {}, at);
    expect(revision.kind).toBe('tempo');
    expect(revision.loadFactor).toBe(1.35);
    expect(revision.prescription.summary).toBe('4x8 at threshold');
  });

  it('refuses a revision that would make the template invalid', () => {
    expect(() => reviseTemplate(template(), { loadFactor: 9 }, at)).toThrow(ValidationError);
    expect(() => reviseTemplate(template(), { kind: 'pilates' }, at)).toThrow(ValidationError);
  });

  it('does not mutate the template it was given', () => {
    const original = template();
    reviseTemplate(original, { loadFactor: 2 }, at);
    expect(original.supersededAt).toBeNull();
    expect(original.loadFactor).toBe(1.35);
  });
});
