/**
 * Shapes we get back from Strava, plus the shapes this package hands on to
 * the rest of the app. Only the fields we actually read are declared; the
 * real payload is much wider.
 */

export type Callback<T> = (err: Error | null, result?: T) => void;

export interface StravaTokenResponse {
  token_type?: string;
  access_token?: string;
  refresh_token?: string;
  expires_at?: number;
  athlete?: { id?: number };
}

export interface StravaActivity {
  id?: number;
  name?: string;
  type?: string;
  sport_type?: string;
  distance?: number;
  moving_time?: number;
  elapsed_time?: number;
  start_date?: string;
  start_date_local?: string;
  timezone?: string;
  average_heartrate?: number;
  max_heartrate?: number;
  perceived_exertion?: number;
  manual?: boolean;
  trainer?: boolean;
}

export interface StravaWebhookEvent {
  object_type?: string;
  object_id?: number;
  aspect_type?: string;
  owner_id?: number;
  event_time?: number;
  subscription_id?: number;
  updates?: Record<string, string>;
}

export interface AthleteLink {
  athleteId: string;
  stravaAthleteId: number;
  accessToken: string;
  refreshToken: string;
  expiresAt: Date;
  scope: string;
  timezone: string;
}

/** A session as this package writes it. Deliberately loose - the domain layer
 * owns the real session type. */
export interface MappedSession {
  athleteId: string;
  completedAt: Date;
  distanceM: number | null;
  durationS: number | null;
  avgHr: number | null;
  perceivedEffort: number | null;
  source: 'strava';
  localDate: string;
}

export interface IngestOutcome {
  stravaActivityId: number;
  status: 'ingested' | 'duplicate' | 'skipped';
  sessionId?: string;
  reason?: string;
}

export interface IngestSummary {
  athleteId: string;
  considered: number;
  ingested: number;
  duplicates: number;
  skipped: number;
  outcomes: IngestOutcome[];
}

export interface MappedSessionWithLoad extends MappedSession {
  load: number | null;
}

export interface ActivitySourceResult {
  sourceId: string;
  activities: StravaActivity[];
}
