import type { IngestService } from './ingest_service.js';
import type { IngestStore } from './store.js';
import type { StravaClient } from './strava_client.js';
import type { Callback, IngestOutcome, StravaWebhookEvent } from './types.js';

export interface WebhookProcessorOptions {
  client: StravaClient;
  store: IngestStore;
  ingest: IngestService;
}

/**
 * Handles one webhook delivery.
 *
 * Strava re-delivers. It re-delivers on its own timers, it re-delivers when
 * our 200 is slow, and during the July outage it re-delivered a whole day of
 * events twice. Nothing in here may double-write: every path ends at
 * IngestService.ingestActivity, which is guarded by the unique index on
 * strava_activity_id.
 */
export class WebhookProcessor {
  private readonly client: StravaClient;
  private readonly store: IngestStore;
  private readonly ingest: IngestService;

  constructor(options: WebhookProcessorOptions) {
    if (!options || !options.client || !options.store || !options.ingest) {
      throw new Error('WebhookProcessor needs a client, a store and an ingest service');
    }
    this.client = options.client;
    this.store = options.store;
    this.ingest = options.ingest;
  }

  handle(event: StravaWebhookEvent | null | undefined, cb: Callback<IngestOutcome>): void {
    const self = this;
    if (!event) {
      cb(null, { stravaActivityId: -1, status: 'skipped', reason: 'empty delivery' });
      return;
    }
    if (event.object_type !== 'activity') {
      cb(null, {
        stravaActivityId: -1,
        status: 'skipped',
        reason: 'object_type ' + String(event.object_type),
      });
      return;
    }
    if (event.aspect_type !== 'create' && event.aspect_type !== 'update') {
      cb(null, {
        stravaActivityId: event.object_id === undefined ? -1 : event.object_id,
        status: 'skipped',
        reason: 'aspect_type ' + String(event.aspect_type),
      });
      return;
    }
    if (event.object_id === null || event.object_id === undefined) {
      cb(null, { stravaActivityId: -1, status: 'skipped', reason: 'no object_id' });
      return;
    }
    if (event.owner_id === null || event.owner_id === undefined) {
      cb(null, { stravaActivityId: event.object_id, status: 'skipped', reason: 'no owner_id' });
      return;
    }

    const activityId = event.object_id;
    this.store.findLinkByStravaAthleteId(event.owner_id, function (err, link) {
      if (err) {
        cb(err);
        return;
      }
      if (!link) {
        // Somebody else's athlete, or one who has since disconnected.
        cb(null, { stravaActivityId: activityId, status: 'skipped', reason: 'no link for owner' });
        return;
      }
      self.client.getActivity(link.accessToken, activityId, function (getErr, activity) {
        if (getErr) {
          cb(getErr);
          return;
        }
        if (!activity) {
          cb(null, {
            stravaActivityId: activityId,
            status: 'skipped',
            reason: 'activity not found on strava',
          });
          return;
        }
        self.ingest.ingestActivity(link, activity, cb);
      });
    });
  }

  /** Convenience for replaying a stored delivery list in order. */
  handleAll(events: StravaWebhookEvent[], cb: Callback<IngestOutcome[]>): void {
    const self = this;
    const outcomes: IngestOutcome[] = [];
    const step = function (index: number): void {
      if (index >= events.length) {
        cb(null, outcomes);
        return;
      }
      self.handle(events[index], function (err, outcome) {
        if (err) {
          cb(err);
          return;
        }
        if (outcome) {
          outcomes.push(outcome);
        }
        step(index + 1);
      });
    };
    step(0);
  }
}
