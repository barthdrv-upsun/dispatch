import type { Callback, StravaActivity, StravaTokenResponse } from './types.js';

export interface HttpResponseLike {
  status: number;
  body: unknown;
}

/** Anything that can do a JSON request. Kept as a plain function so tests can
 * hand in a stub without a server. */
export type JsonTransport = (
  method: string,
  url: string,
  headers: Record<string, string>,
  body: string | null,
  cb: Callback<HttpResponseLike>,
) => void;

export const fetchTransport: JsonTransport = function (method, url, headers, body, cb) {
  let settled = false;
  const done = function (err: Error | null, result?: HttpResponseLike) {
    if (settled) {
      return;
    }
    settled = true;
    cb(err, result);
  };

  fetch(url, { method: method, headers: headers, body: body === null ? undefined : body }).then(
    function (res) {
      res
        .text()
        .then(function (text) {
          let parsed: unknown = null;
          if (text && text.length > 0) {
            try {
              parsed = JSON.parse(text);
            } catch (e) {
              done(new Error('strava returned a body that is not JSON: ' + text.slice(0, 120)));
              return;
            }
          }
          done(null, { status: res.status, body: parsed });
        })
        .catch(function (err: unknown) {
          done(err instanceof Error ? err : new Error(String(err)));
        });
    },
    function (err: unknown) {
      done(err instanceof Error ? err : new Error(String(err)));
    },
  );
};

export interface StravaClientOptions {
  baseUrl: string;
  clientId: string;
  clientSecret: string;
  transport?: JsonTransport;
}

/**
 * Thin wrapper over the Strava REST endpoints we use. Everything is
 * callback-style; this predates the rest of the codebase.
 *
 * baseUrl always points at the local double - see src/fakes/strava. There is
 * no code path in this repository that talks to strava.com.
 */
export class StravaClient {
  private readonly baseUrl: string;
  private readonly clientId: string;
  private readonly clientSecret: string;
  private readonly transport: JsonTransport;

  constructor(options: StravaClientOptions) {
    if (!options || !options.baseUrl) {
      throw new Error('StravaClient needs a baseUrl');
    }
    this.baseUrl = options.baseUrl.replace(/\/+$/, '');
    this.clientId = options.clientId || 'pacenote-local';
    this.clientSecret = options.clientSecret || 'not-a-real-secret';
    this.transport = options.transport || fetchTransport;
  }

  refreshToken(refreshToken: string, cb: Callback<StravaTokenResponse>): void {
    if (!refreshToken) {
      cb(new Error('refreshToken called without a token'));
      return;
    }
    const payload = JSON.stringify({
      client_id: this.clientId,
      client_secret: this.clientSecret,
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
    });
    this.transport(
      'POST',
      this.baseUrl + '/oauth/token',
      { 'content-type': 'application/json' },
      payload,
      function (err, res) {
        if (err) {
          cb(err);
          return;
        }
        if (!res || res.status !== 200) {
          cb(new Error('token refresh failed with status ' + (res ? res.status : 'none')));
          return;
        }
        cb(null, (res.body || {}) as StravaTokenResponse);
      },
    );
  }

  listActivities(accessToken: string, afterEpochS: number, cb: Callback<StravaActivity[]>): void {
    if (!accessToken) {
      cb(new Error('listActivities called without an access token'));
      return;
    }
    const after = afterEpochS && afterEpochS > 0 ? afterEpochS : 0;
    const url = this.baseUrl + '/api/v3/athlete/activities?after=' + String(after) + '&per_page=100';
    this.transport('GET', url, { authorization: 'Bearer ' + accessToken }, null, function (err, res) {
      if (err) {
        cb(err);
        return;
      }
      if (!res) {
        cb(new Error('listActivities got no response'));
        return;
      }
      if (res.status === 401) {
        cb(new Error('strava rejected the access token'));
        return;
      }
      if (res.status !== 200) {
        cb(new Error('listActivities failed with status ' + res.status));
        return;
      }
      if (!Array.isArray(res.body)) {
        // Strava has been known to answer 200 with an object on error.
        cb(null, []);
        return;
      }
      cb(null, res.body as StravaActivity[]);
    });
  }

  getActivity(accessToken: string, activityId: number, cb: Callback<StravaActivity>): void {
    if (!accessToken) {
      cb(new Error('getActivity called without an access token'));
      return;
    }
    if (activityId === null || activityId === undefined) {
      cb(new Error('getActivity called without an activity id'));
      return;
    }
    const url = this.baseUrl + '/api/v3/activities/' + String(activityId);
    this.transport('GET', url, { authorization: 'Bearer ' + accessToken }, null, function (err, res) {
      if (err) {
        cb(err);
        return;
      }
      if (!res) {
        cb(new Error('getActivity got no response'));
        return;
      }
      if (res.status === 404) {
        cb(null, undefined);
        return;
      }
      if (res.status !== 200) {
        cb(new Error('getActivity failed with status ' + res.status));
        return;
      }
      cb(null, (res.body || {}) as StravaActivity);
    });
  }
}
