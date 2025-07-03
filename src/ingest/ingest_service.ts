import { ActivityMapper } from './activity_mapper.js';
import type { StravaClient } from './strava_client.js';
import type { IngestStore } from './store.js';
import type {
  AthleteLink,
  Callback,
  IngestOutcome,
  IngestSummary,
  MappedSession,
  StravaActivity,
} from './types.js';

/** Refresh a little before the token actually dies. */
const TOKEN_SKEW_MS = 2 * 60 * 1000;

export interface IngestServiceOptions {
  client: StravaClient;
  store: IngestStore;
  mapper?: ActivityMapper;
  defaultTimezone?: string;
}

/**
 * Pulls activities for one athlete and writes the ones we do not already
 * have. Callback style throughout, one activity at a time - the rate limit on
 * the real API made parallelism pointless and it has never been worth
 * revisiting.
 */
export class IngestService {
  private readonly client: StravaClient;
  private readonly store: IngestStore;
  private readonly mapper: ActivityMapper;

  constructor(options: IngestServiceOptions) {
    if (!options || !options.client || !options.store) {
      throw new Error('IngestService needs a client and a store');
    }
    this.client = options.client;
    this.store = options.store;
    this.mapper = options.mapper || new ActivityMapper(options.defaultTimezone || 'UTC');
  }

  syncAthlete(athleteId: string, cb: Callback<IngestSummary>): void {
    const self = this;
    if (!athleteId) {
      cb(new Error('syncAthlete called without an athlete id'));
      return;
    }
    this.store.findLink(athleteId, function (err, link) {
      if (err) {
        cb(err);
        return;
      }
      if (!link) {
        cb(new Error('athlete ' + athleteId + ' has no strava link'));
        return;
      }
      self.ensureFreshToken(link, function (tokenErr, fresh) {
        if (tokenErr) {
          cb(tokenErr);
          return;
        }
        const usable = fresh || link;
        self.store.lastIngestedAt(athleteId, function (sinceErr, since) {
          if (sinceErr) {
            cb(sinceErr);
            return;
          }
          const after = since ? Math.floor(since.getTime() / 1000) : 0;
          self.client.listActivities(usable.accessToken, after, function (listErr, activities) {
            if (listErr) {
              cb(listErr);
              return;
            }
            const batch = activities || [];
            const summary: IngestSummary = {
              athleteId: athleteId,
              considered: batch.length,
              ingested: 0,
              duplicates: 0,
              skipped: 0,
              outcomes: [],
            };
            self.ingestSequentially(usable, batch, 0, summary, cb);
          });
        });
      });
    });
  }

  /**
   * One activity, one write. Safe to call twice with the same activity: the
   * unique index on strava_activity_id turns the second call into a
   * duplicate outcome rather than a second session.
   */
  ingestActivity(link: AthleteLink, activity: StravaActivity, cb: Callback<IngestOutcome>): void {
    if (!link) {
      cb(new Error('ingestActivity called without a link'));
      return;
    }
    if (!activity || activity.id === null || activity.id === undefined) {
      cb(null, { stravaActivityId: -1, status: 'skipped', reason: 'activity has no id' });
      return;
    }
    const activityId = activity.id;
    const mapped = this.mapper.map(link.athleteId, activity, link.timezone);
    if (!mapped.ok) {
      cb(null, { stravaActivityId: activityId, status: 'skipped', reason: mapped.failure.reason });
      return;
    }
    this.store.insertSession(mapped.session, activityId, function (err, sessionId) {
      if (err) {
        cb(err);
        return;
      }
      if (!sessionId) {
        cb(null, { stravaActivityId: activityId, status: 'duplicate' });
        return;
      }
      cb(null, { stravaActivityId: activityId, status: 'ingested', sessionId: sessionId });
    });
  }

  /**
   * Refresh when we are inside the skew window. Reads the wall clock
   * directly.
   */
  private ensureFreshToken(link: AthleteLink, cb: Callback<AthleteLink>): void {
    const self = this;
    if (!link || !link.expiresAt) {
      cb(null, link);
      return;
    }
    const now = new Date();
    if (link.expiresAt.getTime() - now.getTime() > TOKEN_SKEW_MS) {
      cb(null, link);
      return;
    }
    this.client.refreshToken(link.refreshToken, function (err, token) {
      if (err) {
        cb(err);
        return;
      }
      if (!token || !token.access_token) {
        cb(new Error('token refresh came back without an access token'));
        return;
      }
      const refreshed: AthleteLink = {
        athleteId: link.athleteId,
        stravaAthleteId: link.stravaAthleteId,
        accessToken: token.access_token,
        refreshToken: token.refresh_token || link.refreshToken,
        expiresAt: token.expires_at ? new Date(token.expires_at * 1000) : link.expiresAt,
        scope: link.scope,
        timezone: link.timezone,
      };
      self.store.updateLink(
        link.athleteId,
        {
          accessToken: refreshed.accessToken,
          refreshToken: refreshed.refreshToken,
          expiresAt: refreshed.expiresAt,
        },
        function (updateErr) {
          if (updateErr) {
            cb(updateErr);
            return;
          }
          cb(null, refreshed);
        },
      );
    });
  }

  private ingestSequentially(
    link: AthleteLink,
    activities: StravaActivity[],
    index: number,
    summary: IngestSummary,
    cb: Callback<IngestSummary>,
  ): void {
    const self = this;
    if (index >= activities.length) {
      cb(null, summary);
      return;
    }
    const activity = activities[index];
    if (!activity) {
      self.ingestSequentially(link, activities, index + 1, summary, cb);
      return;
    }
    this.ingestActivity(link, activity, function (err, outcome) {
      if (err) {
        cb(err);
        return;
      }
      if (outcome) {
        summary.outcomes.push(outcome);
        if (outcome.status === 'ingested') {
          summary.ingested += 1;
        } else if (outcome.status === 'duplicate') {
          summary.duplicates += 1;
        } else {
          summary.skipped += 1;
        }
      }
      self.ingestSequentially(link, activities, index + 1, summary, cb);
    });
  }
}
