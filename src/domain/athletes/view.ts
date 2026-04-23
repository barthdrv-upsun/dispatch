import type { Athlete } from './types.js';

/**
 * What an athlete looks like once it has left the server.
 *
 * Athlete rows carry a date of birth, and the row next to them in
 * strava_links carries tokens. Neither has any business in a browser, so
 * every response that mentions an athlete goes through here rather than
 * serialising the record.
 */
export type AthleteSummary = {
  id: string;
  squadId: string;
  timezone: string;
  state: string;
  restingHr: number | null;
  maxHr: number | null;
};

export function athleteSummary(athlete: Athlete): AthleteSummary {
  return {
    id: athlete.id,
    squadId: athlete.squadId,
    timezone: athlete.timezone,
    state: athlete.state,
    restingHr: athlete.restingHr,
    maxHr: athlete.maxHr,
  };
}

export function athleteSummaries(athletes: readonly Athlete[]): AthleteSummary[] {
  return athletes.map(athleteSummary);
}
