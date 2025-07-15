import type { IngestStore, LinkPatch } from '../../src/ingest/store.js';
import type { AthleteLink, Callback, MappedSessionWithLoad } from '../../src/ingest/types.js';

export type StoredSession = MappedSessionWithLoad & { id: string; stravaActivityId: number };
