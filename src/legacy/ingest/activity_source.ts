import { StravaClient } from './strava_client.js';
import type { ActivitySourceResult, AthleteLink, Callback, StravaActivity } from './types.js';

/**
 * A place activities can come from.
 *
 * Garmin is next: their FIT export arrives as a file drop rather than a list
 * endpoint, so `pull` will grow a cursor argument when that lands. A CSV
 * importer for squads coming off spreadsheets is pencilled in behind it,
 * which is the other reason this is an interface and not just the client.
 */
export interface ActivitySource {
  readonly id: string;
  pull(link: AthleteLink, sinceEpochS: number, cb: Callback<ActivitySourceResult>): void;
}

export class StravaSource implements ActivitySource {
  readonly id = 'strava';

  private readonly client: StravaClient;

  constructor(client: StravaClient) {
    if (!client) {
      throw new Error('StravaSource needs a client');
    }
    this.client = client;
  }

  pull(link: AthleteLink, sinceEpochS: number, cb: Callback<ActivitySourceResult>): void {
    if (!link || !link.accessToken) {
      cb(new Error('StravaSource.pull called without a usable link'));
      return;
    }
    this.client.listActivities(link.accessToken, sinceEpochS, function (err, activities) {
      if (err) {
        cb(err);
        return;
      }
      const batch: StravaActivity[] = activities || [];
      cb(null, { sourceId: 'strava', activities: batch });
    });
  }
}
