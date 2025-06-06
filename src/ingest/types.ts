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
