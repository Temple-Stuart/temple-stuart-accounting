/**
 * TRADE-COST-01 — SLOW DATA IS FETCHED ONCE: the per-symbol Finnhub cache.
 *
 * ONE helper every slow-tier Finnhub call goes through (the build asserts a
 * slow-tier URL anywhere else throws — scripts/assert-tool-registry.ts):
 *
 *   hit within TTL  → the stored answer, with its fetched_at (servedFromCache)
 *   miss / stale    → fetch, store (overwrite, fetched_at = now), return
 *   vendor error on refetch → { ok: false, error, stale: { fetchedAt, ageMs } }
 *                     — the caller gets the ERROR and the stale row's AGE, never
 *                     the stale row. There is no path that returns old data as
 *                     data: the caller declares the failure on its error channel
 *                     and the signal is excluded (CLAUDE.md: no fallback).
 *
 * The store is the finnhub_responses table (prisma/schema.prisma), keyed
 * (symbol, endpoint, params_hash) with NO user column — market data is not
 * user-scoped; one answer serves every scan. The TTL per endpoint is
 * FINNHUB_TTL (finnhub-ttl.ts). Daily-tier endpoints never touch the store:
 * they go through finnhubDirect() so the per-run meter still counts them.
 *
 * WHAT IS STORED: a 2xx body that parsed as JSON and is not a vendor error
 * envelope ({ error: "..." }). A 429/403/5xx, a network failure or a parse
 * failure stores nothing (the estimateCache it replaces learned this in
 * 305eab52 — "poisoned cache: empty results from failed fetches were cached").
 * A 2xx `{}` or `[]` IS stored: it is what the vendor said, dated.
 *
 * KEY: the symbol UPPERCASED (Finnhub tickers are uppercase; every scan path
 * already sends them so) and the endpoint's key params canonicalized
 * (sorted, token excluded). Rolling windows computed from today are keyed by
 * their RELATIVE spec (from=-540d) — the caller passes keyParams — so a row is
 * reusable inside its TTL; the absolute dates sent ride on the row.
 *
 * CONCURRENCY: same-process callers for one key share ONE in-flight fetch
 * (Step E6 and Step I5 both want stock/fund-ownership for the same symbol in
 * the same tick — precedent: cikMapInFlight in data-fetchers.ts). Across
 * processes the write is an upsert on the primary key; a P2002 race is
 * retried once and then thrown, never swallowed.
 *
 * PORTS: the store, fetch and the clock are injectable so the tests are
 * hermetic (Claude Code cannot reach Azure — CLAUDE.md); production uses the
 * Prisma store and global fetch.
 */
import { createHash } from 'node:crypto';
import { AsyncLocalStorage } from 'node:async_hooks';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { FINNHUB_TTL, ttlRowOf } from './finnhub-ttl';
import type { FinnhubFetchMeta } from './types';

export type { FinnhubFetchMeta, FinnhubFetchedAt } from './types';

export const FINNHUB_BASE = 'https://finnhub.io/api/v1';

// ── the meter: upstream calls and cache hits, per run ───────────────────────

export interface FinnhubMeter {
  upstream: number;
  hits: number;
  byEndpoint: Record<string, { upstream: number; hits: number }>;
}

const meterStorage = new AsyncLocalStorage<FinnhubMeter>();

export function newFinnhubMeter(): FinnhubMeter {
  return { upstream: 0, hits: 0, byEndpoint: {} };
}

/** Run `fn` with a fresh meter; every Finnhub call made inside (through this module) is counted on it. */
export async function withFinnhubMeter<T>(fn: () => Promise<T>): Promise<{ result: T; meter: FinnhubMeter }> {
  const meter = newFinnhubMeter();
  const result = await meterStorage.run(meter, fn);
  return { result, meter };
}

/** The meter of the run in progress, or null outside withFinnhubMeter. */
export function finnhubMeterSnapshot(): FinnhubMeter | null {
  const m = meterStorage.getStore();
  return m ? { upstream: m.upstream, hits: m.hits, byEndpoint: { ...m.byEndpoint } } : null;
}

function count(endpoint: string, what: 'upstream' | 'hits'): void {
  const m = meterStorage.getStore();
  if (!m) return;
  m[what] += 1;
  const e = (m.byEndpoint[endpoint] ??= { upstream: 0, hits: 0 });
  e[what] += 1;
}

// ── types ──────────────────────────────────────────────────────────────────

export type FinnhubAnswer<T = unknown> =
  | { ok: true; data: T; status: number; meta: FinnhubFetchMeta; storeError: string | null }
  | { ok: false; error: string; status: number | null; stale: { fetchedAt: string; ageMs: number } | null; meta: null; upstreamCalled: boolean };

export interface FinnhubRequest {
  endpoint: string;
  symbol: string;
  /** The query params actually SENT, in order (token excluded — the helper appends it). */
  params?: Record<string, string>;
  /** The params the KEY is built from — pass a relative window (from=-540d) when `params` carries dates computed from today. Defaults to `params`. */
  keyParams?: Record<string, string>;
  apiKey?: string;
  ports?: Partial<FinnhubPorts>;
}

export interface FinnhubCacheRow {
  symbol: string;
  endpoint: string;
  paramsHash: string;
  keyParams: string;
  sentParams: string;
  response: unknown;
  vendorStatus: number;
  fetchedAt: Date;
}

export interface FinnhubCacheStore {
  get(symbol: string, endpoint: string, paramsHash: string): Promise<FinnhubCacheRow | null>;
  /** Insert or OVERWRITE the row for its key. */
  put(row: FinnhubCacheRow): Promise<void>;
}

export interface FinnhubPorts {
  store: FinnhubCacheStore;
  fetch: (url: string) => Promise<Response>;
  now: () => Date;
}

// ── the key ────────────────────────────────────────────────────────────────

/** Sorted, URL-encoded, token-free: the string that is hashed. */
export function canonicalParams(params: Record<string, string> | undefined): string {
  return Object.entries(params ?? {})
    .filter(([k]) => k !== 'token' && k !== 'symbol')
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
    .join('&');
}

export function paramsHash(keyParams: string): string {
  return createHash('sha256').update(keyParams).digest('hex');
}

export function finnhubKeyOf(endpoint: string, keyParams: Record<string, string> | undefined): string {
  const c = canonicalParams(keyParams);
  return c ? `${endpoint}?${c}` : endpoint;
}

/** The URL as the vendor sees it: symbol first, then the sent params in order, then the token. */
export function finnhubUrl(endpoint: string, symbol: string, params: Record<string, string> | undefined, token: string): string {
  const q = [`symbol=${encodeURIComponent(symbol)}`];
  for (const [k, v] of Object.entries(params ?? {})) {
    if (k === 'token' || k === 'symbol') continue;
    q.push(`${encodeURIComponent(k)}=${encodeURIComponent(v)}`);
  }
  q.push(`token=${token}`);
  return `${FINNHUB_BASE}/${endpoint}?${q.join('&')}`;
}

// ── the vendor call ────────────────────────────────────────────────────────

/**
 * PIPE-01: ONE call, never two. A 429 is returned as-is (logged, not retried)
 * so the caller declares the throttle instead of paying twice for an answer the
 * vendor just refused. Moved here from data-fetchers.ts with the URLs.
 */
export async function finnhubFetchOnce(url: string, fetchImpl: (u: string) => Promise<Response> = (u) => fetch(u)): Promise<Response> {
  const resp = await fetchImpl(url);
  if (resp.status === 429) {
    console.warn(`[Finnhub] 429 rate limit on ${url.split('?')[0]} — NOT retried; the caller reports the throttle`);
  }
  return resp;
}

type Vendor =
  | { ok: true; data: unknown; status: number }
  | { ok: false; error: string; status: number | null };

async function callVendor(endpoint: string, symbol: string, params: Record<string, string> | undefined, apiKey: string, fetchImpl: FinnhubPorts['fetch']): Promise<Vendor> {
  count(endpoint, 'upstream');
  let resp: Response;
  try {
    resp = await finnhubFetchOnce(finnhubUrl(endpoint, symbol, params, apiKey), fetchImpl);
  } catch (e: unknown) {
    return { ok: false, error: e instanceof Error ? e.message : String(e), status: null };
  }
  if (!resp.ok) return { ok: false, error: `HTTP ${resp.status}`, status: resp.status };
  let data: unknown;
  try {
    data = await resp.json();
  } catch (e: unknown) {
    return { ok: false, error: `unparseable body: ${e instanceof Error ? e.message : String(e)}`, status: resp.status };
  }
  // Finnhub answers some refusals with a 2xx envelope { error: "..." } — a refusal, not data.
  if (data && typeof data === 'object' && !Array.isArray(data) && typeof (data as { error?: unknown }).error === 'string') {
    return { ok: false, error: `vendor error: ${(data as { error: string }).error}`, status: resp.status };
  }
  return { ok: true, data, status: resp.status };
}

function resolveKey(apiKey: string | undefined): string | null {
  const k = apiKey || process.env.FINNHUB_API_KEY;
  return k && k.trim() ? k : null;
}

// ── the daily path: no store, still metered ────────────────────────────────

/** A daily-tier call: bought every time (the TTL law says no cache), counted, dated now. */
export async function finnhubDirect<T = unknown>(req: FinnhubRequest): Promise<FinnhubAnswer<T>> {
  const row = ttlRowOf(req.endpoint);
  if (row.ttlMs > 0) throw new Error(`finnhub-cache: ${req.endpoint} is ${row.tier}-tier (${row.ttlMs}ms) — it goes through finnhubCached, not finnhubDirect`);
  const apiKey = resolveKey(req.apiKey);
  if (!apiKey) return { ok: false, error: 'FINNHUB_API_KEY not configured', status: null, stale: null, meta: null, upstreamCalled: false };
  const symbol = req.symbol.trim().toUpperCase();
  const fetchImpl = req.ports?.fetch ?? ((u: string) => fetch(u));
  const now = (req.ports?.now ?? (() => new Date()))();
  const v = await callVendor(req.endpoint, symbol, req.params, apiKey, fetchImpl);
  if (!v.ok) return { ok: false, error: v.error, status: v.status, stale: null, meta: null, upstreamCalled: true };
  return {
    ok: true, data: v.data as T, status: v.status, storeError: null,
    meta: { key: finnhubKeyOf(req.endpoint, req.keyParams ?? req.params), endpoint: req.endpoint, tier: row.tier, ttlMs: 0, fetchedAt: now.toISOString(), servedFromCache: false },
  };
}

// ── the cached path ────────────────────────────────────────────────────────

const inFlight = new Map<string, Promise<FinnhubAnswer<unknown>>>();

/** A slow-tier call: the stored answer within its TTL, else fetched, stored and dated now. */
export async function finnhubCached<T = unknown>(req: FinnhubRequest): Promise<FinnhubAnswer<T>> {
  const row = ttlRowOf(req.endpoint);
  if (row.ttlMs <= 0) throw new Error(`finnhub-cache: ${req.endpoint} is daily-tier — no cache by the TTL law; call finnhubDirect`);
  const apiKey = resolveKey(req.apiKey);
  if (!apiKey) return { ok: false, error: 'FINNHUB_API_KEY not configured', status: null, stale: null, meta: null, upstreamCalled: false };

  const symbol = req.symbol.trim().toUpperCase();
  const store = req.ports?.store ?? prismaFinnhubStore;
  const fetchImpl = req.ports?.fetch ?? ((u: string) => fetch(u));
  const nowFn = req.ports?.now ?? (() => new Date());
  const keyParams = canonicalParams(req.keyParams ?? req.params);
  const sentParams = canonicalParams(req.params);
  const hash = paramsHash(keyParams);
  const key = finnhubKeyOf(req.endpoint, req.keyParams ?? req.params);

  // ONE flight per key covers the read AND the fetch: a second caller arriving
  // while the first is between its store read and its store write (Step E6 and
  // Step I5, same tick) awaits the same promise instead of missing the row the
  // first is about to write. A caller arriving after the flight settled reads
  // the row itself — a hit.
  const flightKey = `${symbol}|${req.endpoint}|${hash}`;
  let flight = inFlight.get(flightKey);
  if (!flight) {
    flight = (async (): Promise<FinnhubAnswer<unknown>> => {
      let cached: FinnhubCacheRow | null;
      try {
        cached = await store.get(symbol, req.endpoint, hash);
      } catch (e: unknown) {
        // A store that cannot be read is neither a hit nor a miss: no upstream call
        // is made on its behalf (that would be a paid fallback), the failure is the answer.
        return { ok: false, error: `finnhub cache read failed: ${e instanceof Error ? e.message : String(e)}`, status: null, stale: null, meta: null, upstreamCalled: false };
      }

      const now = nowFn();
      if (cached) {
        const ageMs = now.getTime() - cached.fetchedAt.getTime();
        if (ageMs >= 0 && ageMs < row.ttlMs) {
          count(req.endpoint, 'hits');
          return {
            ok: true, data: cached.response, status: cached.vendorStatus, storeError: null,
            meta: { key, endpoint: req.endpoint, tier: row.tier, ttlMs: row.ttlMs, fetchedAt: cached.fetchedAt.toISOString(), servedFromCache: true },
          };
        }
      }
      const stale = cached ? { fetchedAt: cached.fetchedAt.toISOString(), ageMs: now.getTime() - cached.fetchedAt.getTime() } : null;

      const v = await callVendor(req.endpoint, symbol, req.params, apiKey, fetchImpl);
      if (!v.ok) return { ok: false, error: v.error, status: v.status, stale, meta: null, upstreamCalled: true };
      const fetchedAt = nowFn();
      let storeError: string | null = null;
      try {
        await store.put({ symbol, endpoint: req.endpoint, paramsHash: hash, keyParams, sentParams, response: v.data, vendorStatus: v.status, fetchedAt });
      } catch (e: unknown) {
        // The vendor answered and was paid; the answer is returned. The failed
        // store is DECLARED on the answer so the caller can surface it — never
        // swallowed, never a reason to refetch.
        storeError = `finnhub cache write failed: ${e instanceof Error ? e.message : String(e)}`;
      }
      return {
        ok: true, data: v.data, status: v.status, storeError,
        meta: { key, endpoint: req.endpoint, tier: row.tier, ttlMs: row.ttlMs, fetchedAt: fetchedAt.toISOString(), servedFromCache: false },
      };
    })().finally(() => { inFlight.delete(flightKey); });
    inFlight.set(flightKey, flight);
  }
  return (await flight) as FinnhubAnswer<T>;
}

// ── how a refusal reads on the caller's error channel ──────────────────────

export function formatAge(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000));
  const d = Math.floor(s / 86400), h = Math.floor((s % 86400) / 3600), m = Math.floor((s % 3600) / 60);
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m`;
  return `${s}s`;
}

/** "HTTP 429 — a cached row from 2026-09-08T14:02:11Z (6d 21h old) was NOT served" */
export function finnhubErrorLine(answer: Extract<FinnhubAnswer, { ok: false }>): string {
  if (!answer.stale) return answer.error;
  return `${answer.error} — a cached row from ${answer.stale.fetchedAt} (${formatAge(answer.stale.ageMs)} old) was NOT served`;
}

// ── the Prisma store ───────────────────────────────────────────────────────

function isUniqueViolation(e: unknown): boolean {
  return e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002';
}

export const prismaFinnhubStore: FinnhubCacheStore = {
  async get(symbol, endpoint, hash) {
    const r = await prisma.finnhub_responses.findUnique({ where: { symbol_endpoint_params_hash: { symbol, endpoint, params_hash: hash } } });
    if (!r) return null;
    return { symbol: r.symbol, endpoint: r.endpoint, paramsHash: r.params_hash, keyParams: r.key_params, sentParams: r.sent_params, response: r.response, vendorStatus: r.vendor_status, fetchedAt: r.fetched_at };
  },
  async put(row) {
    const where = { symbol_endpoint_params_hash: { symbol: row.symbol, endpoint: row.endpoint, params_hash: row.paramsHash } };
    const fields = { key_params: row.keyParams, sent_params: row.sentParams, response: row.response as Prisma.InputJsonValue, vendor_status: row.vendorStatus, fetched_at: row.fetchedAt };
    const write = () => prisma.finnhub_responses.upsert({ where, create: { symbol: row.symbol, endpoint: row.endpoint, params_hash: row.paramsHash, ...fields }, update: fields });
    try {
      await write();
    } catch (e: unknown) {
      // Two processes missed the same key at once and both inserted: the loser
      // retries once, finds the row, and overwrites it. A second failure throws.
      if (!isUniqueViolation(e)) throw e;
      await write();
    }
  },
};

/** Every endpoint this module knows — the tests assert the URLs are built nowhere else. */
export const FINNHUB_ENDPOINTS: readonly string[] = FINNHUB_TTL.map((r) => r.endpoint);
