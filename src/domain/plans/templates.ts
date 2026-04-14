import { ValidationError } from '../../lib/errors.js';
import { round2 } from '../../lib/numbers.js';
import { isTemplateKind, type Prescription, type TemplateKind, type WorkoutTemplate } from './types.js';

export type TemplateDraft = {
  squadId: string;
  code: string;
  kind: string;
  prescription: Prescription;
  loadFactor: number;
};

const CODE_PATTERN = /^[A-Z][A-Z0-9-]{1,23}$/;

export function validateTemplateDraft(draft: TemplateDraft): void {
  if (!draft.squadId) {
    throw new ValidationError('a template belongs to a squad');
  }
  if (!CODE_PATTERN.test(draft.code)) {
    throw new ValidationError(
      'template code must be upper case letters, digits and dashes, 2-24 characters',
      { code: draft.code },
    );
  }
  if (!isTemplateKind(draft.kind)) {
    throw new ValidationError(`${draft.kind} is not a workout kind`, { kind: draft.kind });
  }
  if (!Number.isFinite(draft.loadFactor) || draft.loadFactor <= 0 || draft.loadFactor > 5) {
    throw new ValidationError('load factor must sit between 0 and 5', {
      loadFactor: draft.loadFactor,
    });
  }
  if (!draft.prescription || typeof draft.prescription.summary !== 'string' || draft.prescription.summary.length === 0) {
    throw new ValidationError('a template needs a one-line summary');
  }
}

/** Templates are versioned per code, per squad. */
export function nextTemplateVersion(existing: readonly WorkoutTemplate[], code: string): number {
  const versions = existing.filter((template) => template.code === code).map((t) => t.version);
  if (versions.length === 0) {
    return 1;
  }
  return Math.max(...versions) + 1;
}

export function currentTemplate(
  existing: readonly WorkoutTemplate[],
  code: string,
): WorkoutTemplate | null {
  const live = existing
    .filter((template) => template.code === code && template.supersededAt === null)
    .sort((a, b) => b.version - a.version);
  return live[0] ?? null;
}
