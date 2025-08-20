import type { IngestService } from './ingest_service.js';
import type { IngestStore } from './store.js';
import type { StravaClient } from './strava_client.js';
import type { Callback, IngestOutcome, StravaWebhookEvent } from './types.js';

export interface WebhookProcessorOptions {
  client: StravaClient;
  store: IngestStore;
  ingest: IngestService;
}
