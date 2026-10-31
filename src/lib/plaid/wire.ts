/**
 * REBUILD-01 PR-2 — the wire, exact bytes.
 *
 * The Plaid SDK dispatches every call through the axios instance handed to its
 * constructor (node_modules/plaid/dist/base.d.ts:43 `constructor(configuration?,
 * basePath?, axios?)`; base.js:42 `this.axios = axios`; api.js:10088 →
 * common.js:146-150 `axios.request(...)`). With `responseType: 'arraybuffer'`
 * axios 0.21.4's http adapter hands back the response body as the untouched
 * `Buffer.concat` of the socket chunks (node_modules/axios/lib/adapters/
 * http.js:260-263 — only a non-arraybuffer responseType is decoded to a
 * string), and its default transformResponse leaves a Buffer alone
 * (lib/defaults.js:81-87 parses strings only).
 *
 * These three pure interceptor functions turn that into ONE response object
 * that carries both: `res.data` parsed for the SDK's types, and `res.wire`
 * — the exact bytes, when the question was asked and when the answer arrived.
 * A non-2xx answer gets the same treatment on `err.response`, so the SEC-02b
 * summarizer still reads Plaid's error_type / error_code from parsed JSON.
 * No env, no network: node:test covers it byte for byte.
 */
export interface WireStamp {
  /** The exact response bytes, as received. */
  body: Buffer;
  /** When the request left (request interceptor) and when the answer arrived (response interceptor). */
  asked: Date;
  arrived: Date;
}

/** The stamp the request interceptor leaves on the request config (any object axios hands it). */
interface WireConfig {
  wireAsked?: Date;
}

/** The subset of an axios response / error the interceptors touch. */
export interface WireResponseLike {
  data: unknown;
  status: number;
  config?: object;
  wire?: WireStamp;
}

function askedOf(config: object | undefined): Date | undefined {
  return (config as WireConfig | undefined)?.wireAsked;
}

export class WireBytesMissingError extends Error {
  constructor(what: string) {
    super(`${what}: no wire bytes on the response — the Plaid client was not built with the wire axios instance (src/lib/plaid.ts)`);
    this.name = 'WireBytesMissingError';
  }
}

export function onWireRequest<T extends object>(config: T): T {
  (config as T & WireConfig).wireAsked = new Date();
  return config;
}

/** Keep the bytes, hand the SDK parsed JSON. A body that is not JSON stays a fault: the SDK would have thrown on it too. */
export function onWireResponse<T extends WireResponseLike>(res: T, now: () => Date = () => new Date()): T {
  const raw = res.data;
  const body = Buffer.isBuffer(raw) ? raw : raw instanceof ArrayBuffer ? Buffer.from(raw) : null;
  if (body === null) {
    throw new WireBytesMissingError('onWireResponse');
  }
  const asked = askedOf(res.config) ?? now();
  res.wire = { body, asked, arrived: now() };
  res.data = body.length === 0 ? null : JSON.parse(body.toString('utf8'));
  return res;
}

/** Same for a rejected answer: parse the error body for the summarizer, keep the bytes; never swallow the rejection. */
export function onWireError<E extends { response?: WireResponseLike }>(err: E, now: () => Date = () => new Date()): Promise<never> {
  const response = err.response;
  if (response && (Buffer.isBuffer(response.data) || response.data instanceof ArrayBuffer)) {
    const body = Buffer.isBuffer(response.data) ? response.data : Buffer.from(response.data as ArrayBuffer);
    response.wire = { body, asked: askedOf(response.config) ?? now(), arrived: now() };
    try {
      response.data = body.length === 0 ? null : JSON.parse(body.toString('utf8'));
    } catch {
      // Not JSON (a gateway page): the summarizer reads nothing from it; the bytes are still on the wire stamp.
      response.data = null;
    }
  }
  return Promise.reject(err);
}

/** The stamp a landed answer needs. Throws (fail loud) when the client was not built through the wire instance. */
export function wireOf(res: WireResponseLike, what = 'wireOf'): WireStamp {
  if (!res.wire) throw new WireBytesMissingError(what);
  return res.wire;
}
