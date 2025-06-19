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
