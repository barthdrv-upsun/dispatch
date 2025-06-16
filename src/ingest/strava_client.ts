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
