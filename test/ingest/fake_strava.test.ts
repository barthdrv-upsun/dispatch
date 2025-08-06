import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildFakeStrava } from '../../src/fakes/strava/server.js';
import { recordedActivities, recordedDeliveries } from '../../src/fakes/strava/fixtures.js';

let app: FastifyInstance;

beforeAll(async () => {
  app = buildFakeStrava();
  await app.ready();
});

afterAll(async () => {
  await app.close();
});

describe('the local strava double', () => {
  it('mints a token for a known refresh token', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/oauth/token',
      payload: {
        client_id: 'pacenote-local',
        client_secret: 'not-a-real-secret',
        grant_type: 'refresh_token',
        refresh_token: 'local-refresh-7311001',
      },
    });
    expect(response.statusCode).toBe(200);
    const body = response.json() as { access_token: string; athlete: { id: number } };
    expect(body.access_token).toBe('local-access-7311001');
    expect(body.athlete.id).toBe(7311001);
  });

  it('turns down a refresh token it does not know', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/oauth/token',
      payload: { grant_type: 'refresh_token', refresh_token: 'nope' },
    });
    expect(response.statusCode).toBe(400);
  });

  it('turns down a grant type it does not support', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/oauth/token',
      payload: { grant_type: 'client_credentials' },
    });
    expect(response.statusCode).toBe(400);
  });

  it('lists only the calling athlete\'s activities', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/v3/athlete/activities?after=0&per_page=100',
      headers: { authorization: 'Bearer local-access-7311001' },
    });
    expect(response.statusCode).toBe(200);
    const activities = response.json() as Array<{ id: number; athlete: { id: number } }>;
    expect(activities.length).toBeGreaterThan(5);
    expect(activities.every((activity) => activity.athlete.id === 7311001)).toBe(true);
  });

  it('honours the after cursor', async () => {
    const all = await app.inject({
      method: 'GET',
      url: '/api/v3/athlete/activities?after=0',
      headers: { authorization: 'Bearer local-access-7311001' },
    });
    const later = await app.inject({
      method: 'GET',
      // 2025-07-08T00:00:00Z
      url: '/api/v3/athlete/activities?after=1751932800',
      headers: { authorization: 'Bearer local-access-7311001' },
    });
    expect((later.json() as unknown[]).length).toBeLessThan((all.json() as unknown[]).length);
  });

  it('refuses an unauthenticated list', async () => {
    const response = await app.inject({ method: 'GET', url: '/api/v3/athlete/activities' });
    expect(response.statusCode).toBe(401);
  });

  it('returns one activity in full', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/v3/activities/14880011',
      headers: { authorization: 'Bearer local-access-7311001' },
    });
    expect(response.statusCode).toBe(200);
    expect((response.json() as { perceived_exertion?: number }).perceived_exertion).toBe(7);
  });

  it('404s an activity nobody recorded', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/v3/activities/14889999',
      headers: { authorization: 'Bearer local-access-7311001' },
    });
    expect(response.statusCode).toBe(404);
  });

  it('403s somebody else\'s activity', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/v3/activities/14880020',
      headers: { authorization: 'Bearer local-access-7311001' },
    });
    expect(response.statusCode).toBe(403);
  });

  it('hands back the recorded delivery log', async () => {
    const response = await app.inject({ method: 'GET', url: '/_fake/webhook-deliveries' });
    expect(response.statusCode).toBe(200);
    expect((response.json() as unknown[]).length).toBe(recordedDeliveries().length);
  });

  it('does not serve the app\'s own webhook route', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/webhooks/strava?hub.mode=subscribe&hub.challenge=abc',
    });
    expect(response.statusCode).toBe(404);
  });
});
