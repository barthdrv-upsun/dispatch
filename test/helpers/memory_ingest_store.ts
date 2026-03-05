import type { IngestStore, LinkPatch } from '../../src/legacy/ingest/store.js';
import type { AthleteLink, Callback, MappedSessionWithLoad } from '../../src/legacy/ingest/types.js';

export type StoredSession = MappedSessionWithLoad & { id: string; stravaActivityId: number };

/**
 * Stands in for Postgres, including the bit that matters: the unique index on
 * strava_activity_id. insertSession returns undefined for an id it has
 * already seen, exactly as the ON CONFLICT DO NOTHING path does.
 */
export class MemoryIngestStore implements IngestStore {
  readonly sessions: StoredSession[] = [];
  readonly links = new Map<string, AthleteLink>();
  readonly updates: Array<{ athleteId: string; patch: LinkPatch }> = [];

  private readonly seenActivityIds = new Set<number>();
  private counter = 0;

  addLink(link: AthleteLink): void {
    this.links.set(link.athleteId, link);
  }

  findLink(athleteId: string, cb: Callback<AthleteLink>): void {
    cb(null, this.links.get(athleteId));
  }

  findLinkByStravaAthleteId(stravaAthleteId: number, cb: Callback<AthleteLink>): void {
    for (const link of this.links.values()) {
      if (link.stravaAthleteId === stravaAthleteId) {
        cb(null, link);
        return;
      }
    }
    cb(null, undefined);
  }

  updateLink(athleteId: string, patch: LinkPatch, cb: Callback<void>): void {
    const existing = this.links.get(athleteId);
    if (existing) {
      this.links.set(athleteId, {
        ...existing,
        accessToken: patch.accessToken ?? existing.accessToken,
        refreshToken: patch.refreshToken ?? existing.refreshToken,
        expiresAt: patch.expiresAt ?? existing.expiresAt,
      });
    }
    this.updates.push({ athleteId, patch });
    cb(null);
  }

  lastIngestedAt(_athleteId: string, cb: Callback<Date | null>): void {
    cb(null, null);
  }

  insertSession(
    session: MappedSessionWithLoad,
    stravaActivityId: number,
    cb: Callback<string | undefined>,
  ): void {
    if (this.seenActivityIds.has(stravaActivityId)) {
      cb(null, undefined);
      return;
    }
    this.seenActivityIds.add(stravaActivityId);
    this.counter += 1;
    const id = `session-${String(this.counter).padStart(3, '0')}`;
    this.sessions.push({ ...session, id, stravaActivityId });
    cb(null, id);
  }
}
