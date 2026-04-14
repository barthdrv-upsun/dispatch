import type { Prescription } from '../../db/schema/plans.js';

export type TemplateKind =
  | 'easy'
  | 'tempo'
  | 'interval'
  | 'long'
  | 'strength'
  | 'cycling'
  | 'swimming';

export const TEMPLATE_KINDS: readonly TemplateKind[] = [
  'easy',
  'tempo',
  'interval',
  'long',
  'strength',
  'cycling',
  'swimming',
];

export function isTemplateKind(value: string): value is TemplateKind {
  return (TEMPLATE_KINDS as readonly string[]).includes(value);
}

export type WorkoutTemplate = {
  id: string;
  squadId: string;
  code: string;
  version: number;
  kind: TemplateKind;
  prescription: Prescription;
  loadFactor: number;
  supersededAt: Date | null;
};

export type { Prescription };
