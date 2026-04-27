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
