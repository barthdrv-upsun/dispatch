import type { SessionForLoad } from '../domain/load/entries.js';

export type NewSessionRow = {
  athleteId: string;
  planId: string | null;
  templateId: string | null;
  scheduledFor: Date | null;
  completedAt: Date;
  distanceM: number | null;
  durationS: number | null;
  avgHr: number | null;
  perceivedEffort: number | null;
  load: number | null;
  source: 'manual' | 'strava';
};

export interface SessionRepo {
  insert(session: NewSessionRow): Promise<string>;
  /** Everything from `from` onward, with the template's kind joined on. */
  forAthleteFrom(athleteId: string, from: Date): Promise<SessionForLoad[]>;
}
