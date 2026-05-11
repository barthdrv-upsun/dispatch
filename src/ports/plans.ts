import type { LocalDate } from '../lib/time.js';
import type { Prescription, TemplateKind } from '../domain/plans/types.js';

export type WorkoutTemplateRow = {
  id: string;
  squadId: string;
  code: string;
  version: number;
  kind: TemplateKind;
  prescription: Prescription;
  loadFactor: string | number;
  supersededAt: Date | null;
};

export interface TemplateRepo {
  byId(templateId: string): Promise<WorkoutTemplateRow | null>;
  bySquad(squadId: string): Promise<WorkoutTemplateRow[]>;
  insert(template: Omit<WorkoutTemplateRow, 'id'>): Promise<string>;
  markSuperseded(templateId: string, at: Date): Promise<void>;
}

export type TrainingBlockRow = {
  id: string;
  squadId: string;
  name: string;
  version: number;
  weeks: number;
  state: 'draft' | 'published';
  publishedBy: string | null;
  publishedAt: Date | null;
};

export type BlockSlotRow = {
  blockId: string;
  week: number;
  day: number;
  templateId: string;
  templateVersion: number;
};

export interface BlockRepo {
  byId(blockId: string): Promise<TrainingBlockRow | null>;
  bySquad(squadId: string): Promise<TrainingBlockRow[]>;
  slotsFor(blockId: string): Promise<BlockSlotRow[]>;
  insert(block: Omit<TrainingBlockRow, 'id'>): Promise<string>;
  save(block: TrainingBlockRow): Promise<void>;
  putSlot(slot: BlockSlotRow): Promise<void>;
  putSlots(slots: readonly BlockSlotRow[]): Promise<void>;
}
