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
