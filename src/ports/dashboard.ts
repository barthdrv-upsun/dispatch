import type { LocalDate } from '../lib/time.js';

export type DashboardAthleteRow = {
  athlete: {
    id: string;
    squadId: string;
    userId: string;
    dateOfBirth: LocalDate;
    timezone: string;
    restingHr: number | null;
    maxHr: number | null;
    state: string;
  };
  link: {
    athleteId: string;
    stravaAthleteId: number;
    accessToken: string;
    refreshToken: string;
    expiresAt: Date;
    scope: string;
  } | null;
  openInjury: {
    id: string;
    region: string;
    onsetOn: LocalDate;
    severity: number;
    notes: string | null;
  } | null;
};

export type DashboardSessionRow = {
  completedAt: Date | null;
  load: string | number | null;
  distanceM: number | null;
};

export interface DashboardRepo {
  athletesForDashboard(squadId: string): Promise<DashboardAthleteRow[]>;
  recentSessions(athleteId: string, since: Date): Promise<DashboardSessionRow[]>;
}
