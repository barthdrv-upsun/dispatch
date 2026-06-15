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

export type BlockState = 'draft' | 'published';

export type TrainingBlock = {
  id: string;
  squadId: string;
  name: string;
  version: number;
  weeks: number;
  state: BlockState;
  publishedBy: string | null;
  publishedAt: Date | null;
};

export type BlockSlot = {
  blockId: string;
  week: number;
  day: number;
  templateId: string;
  templateVersion: number;
};

export type BlockWithSlots = {
  block: TrainingBlock;
  slots: BlockSlot[];
};

export type Plan = {
  id: string;
  athleteId: string;
  goalId: string | null;
  blockId: string;
  blockVersion: number;
  startsOn: string;
};

export type ScheduledSession = {
  planId: string;
  athleteId: string;
  templateId: string;
  templateVersion: number;
  scheduledFor: string;
  kind: TemplateKind;
  prescribedLoad: number;
};
