// Diagnostic only — ACTIVITY-01 STEP 0 (2026-09-22). Alex runs it; the session
// makes NO metered call. Two modes, ONE vendor call each:
//
//   npx tsx scripts/probe-viator-schedules.ts search <city> <country>
//     → POST /products/search with the SAME body the app sends for Things to do
//       (viatorClient.ts:295-303 via :442-446 — destination as a string, sort
//       DEFAULT, pagination start 1 / count 50 (PAGE_SIZE :433), currency USD).
//       The destination id comes from the app's own static map
//       (destinations.ts:568-585, findViatorDestIdFor) — a city outside the map
//       STOPS rather than spend a second call on /destinations.
//     → writes src/lib/__tests__/fixtureViatorSearch.<city-country>.json
//
//   npx tsx scripts/probe-viator-schedules.ts schedule <product-code>
//     → GET /availability/schedules/{product-code}
//       (docs.viator.com/partner-api/technical, operationId availabilitySchedules:
//       parameters = the Accept header + the product-code path param, NO currency
//       parameter; "The pricing is returned in the supplier's currency"; 200 body =
//       ProductAvailabilitySchedule { productCode, bookableItems[], currency,
//       summary.fromPrice }; the endpoint is ✅ for a Basic-access Affiliate key
//       in the docs' "Access to endpoints" table; a 401/403 here means the key's
//       tier does not reach it.)
//     → writes src/lib/__tests__/fixtureViatorSchedule.<product-code>.json
//
// Each mode prints the HTTP status (plus the RateLimit-Limit / -Remaining /
// -Reset and X-Unique-ID headers the docs say a metered response carries) and
// writes the RAW response JSON to the fixture path — after asserting that no
// character run of the API key (the whole key, and every 8-character window of
// it) appears anywhere in the text. A body that fails that assertion is NOT
// written. Non-2xx bodies are printed (first 600 chars) and NOT written.
//
// Mirrors src/lib/viatorClient.ts EXACTLY (same base / key / headers as the app):
//   VIATOR_V2_BASE (:13), getApiKey() (:15-19), v2Headers() (:22-29).
// Env loader + banner + getJson/postJson follow scripts/probe-liteapi-content-reviews.ts.
// Reads the SAME env var the app reads: VIATOR_API_KEY (from .env.local / .env).

import { readFileSync, writeFileSync } from 'node:fs';
import { findViatorDestIdFor } from '../src/lib/destinations';

// ── Minimal .env loader (no dependency): .env.local then .env, no overrides. ──
function loadEnvFile(path: string): void {
  let raw: string;
  try { raw = readFileSync(path, 'utf8'); } catch { return; }
  for (const line of raw.split('\n')) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const eq = t.indexOf('=');
    if (eq === -1) continue;
    const key = t.slice(0, eq).trim();
    let val = t.slice(eq + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) val = val.slice(1, -1);
    if (key && process.env[key] === undefined) process.env[key] = val;
  }
}
loadEnvFile('.env.local');
loadEnvFile('.env');

// ── Mirror viatorClient.ts ───────────────────────────────────────────────────
const VIATOR_V2_BASE = 'https://api.viator.com/partner'; // viatorClient.ts:13
function getApiKey(): string {
  const key = process.env.VIATOR_API_KEY; // :15-19
  if (!key) throw new Error('VIATOR_API_KEY is not set (.env.local / .env / the shell)');
  return key;
}
function v2Headers(): Record<string, string> {
  return { // :22-29
    'Accept-Language': 'en-US',
    'Content-Type': 'application/json',
    'Accept': 'application/json;version=2.0',
    'exp-api-key': getApiKey(),
  };
}

const KEY_PREFIX = (process.env.VIATOR_API_KEY ?? 'none').slice(0, 4); // first 4 ONLY — never the full key

function banner(title: string): void {
  console.log(`\n──────────────────────────────────────────────────────────────`);
  console.log(`${title}  [keyPrefix=${KEY_PREFIX}]`);
  console.log(`──────────────────────────────────────────────────────────────`);
}

interface Answer { status: number; ok: boolean; json: unknown; text: string; headers: Record<string, string> }
const METER_HEADERS = ['ratelimit-limit', 'ratelimit-remaining', 'ratelimit-reset', 'x-unique-id', 'retry-after'];
function pickHeaders(res: Response): Record<string, string> {
  const out: Record<string, string> = {};
  for (const h of METER_HEADERS) { const v = res.headers.get(h); if (v !== null) out[h] = v; }
  return out;
}
async function getJson(url: string): Promise<Answer> {
  const res = await fetch(url, { method: 'GET', headers: v2Headers() });
  const text = await res.text();
  let json: unknown = null; try { json = JSON.parse(text); } catch { /* non-JSON */ }
  return { status: res.status, ok: res.ok, json, text, headers: pickHeaders(res) };
}
async function postJson(url: string, body: unknown): Promise<Answer> {
  const res = await fetch(url, { method: 'POST', headers: v2Headers(), body: JSON.stringify(body) });
  const text = await res.text();
  let json: unknown = null; try { json = JSON.parse(text); } catch { /* non-JSON */ }
  return { status: res.status, ok: res.ok, json, text, headers: pickHeaders(res) };
}

// ── The key-run guard: the fixture goes into a PUBLIC repository. ────────────
const KEY_RUN = 8;
function keyRunsIn(text: string): string[] {
  const key = getApiKey();
  const hits: string[] = [];
  if (text.includes(key)) hits.push('the whole key');
  for (let i = 0; i + KEY_RUN <= key.length; i++) {
    const window = key.slice(i, i + KEY_RUN);
    if (text.includes(window)) hits.push(`window ${i}..${i + KEY_RUN} (${window.slice(0, 2)}…)`);
  }
  return hits;
}

function slugOf(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

function writeFixture(path: string, answer: Answer): void {
  if (answer.json === null) { console.log(`NOT WRITTEN — the body is not JSON. First 600 chars: ${answer.text.slice(0, 600)}`); return; }
  const pretty = JSON.stringify(answer.json, null, 2) + '\n';
  const runs = keyRunsIn(pretty);
  if (runs.length > 0) {
    console.log(`NOT WRITTEN — a run of the API key appears in the body: ${runs.join('; ')}`);
    return;
  }
  writeFileSync(path, pretty, 'utf8');
  console.log(`wrote ${path} (${pretty.length} chars, no run of the key found)`);
}

function printAnswer(answer: Answer): void {
  console.log(`status=${answer.status} ok=${answer.ok}`);
  console.log(`metered headers=${JSON.stringify(answer.headers)}`);
  if (!answer.ok) {
    console.log(`body (first 600): ${answer.text.slice(0, 600)}`);
    if (answer.status === 401 || answer.status === 403) console.log(`!! ${answer.status}: the key's tier does not reach this endpoint — report and stop.`);
    if (answer.status === 429) console.log(`!! 429: the endpoint's allowance (RateLimit-*) or the overall traffic cap — read Retry-After, do not loop.`);
  }
}

function describeSearch(json: unknown): void {
  const d = json as { products?: unknown[]; totalCount?: number } | null;
  const products = Array.isArray(d?.products) ? d!.products! : [];
  console.log(`products=${products.length} totalCount=${d?.totalCount ?? '(absent)'}`);
  const first = products[0] as Record<string, unknown> | undefined;
  if (first) {
    console.log(`product[0] keys=${JSON.stringify(Object.keys(first))}`);
    console.log(`product[0].productCode=${String(first.productCode)}  title=${String(first.title).slice(0, 80)}`);
    console.log(`product[0].pricing=${JSON.stringify(first.pricing)}`);
    console.log(`product[0].duration=${JSON.stringify(first.duration)}  flags=${JSON.stringify(first.flags)}  reviews=${JSON.stringify(first.reviews)}`);
  }
  const codes = products.slice(0, 5).map((p) => String((p as Record<string, unknown>).productCode));
  console.log(`first product codes: ${codes.join(', ')}`);
}

function describeSchedule(json: unknown): void {
  const d = json as { productCode?: string; currency?: string; summary?: { fromPrice?: number }; bookableItems?: unknown[] } | null;
  console.log(`productCode=${d?.productCode}  currency=${d?.currency}  summary.fromPrice=${d?.summary?.fromPrice}`);
  const items = Array.isArray(d?.bookableItems) ? d!.bookableItems! : [];
  console.log(`bookableItems=${items.length}`);
  for (const raw of items.slice(0, 6)) {
    const item = raw as { productOptionCode?: string; seasons?: unknown[] };
    const seasons = Array.isArray(item.seasons) ? item.seasons : [];
    const recs = seasons.flatMap((s) => (Array.isArray((s as { pricingRecords?: unknown[] }).pricingRecords) ? (s as { pricingRecords: unknown[] }).pricingRecords : []));
    const timed = recs.filter((r) => Array.isArray((r as { timedEntries?: unknown[] }).timedEntries)).length;
    const starts = new Set<string>();
    for (const r of recs) for (const t of ((r as { timedEntries?: { startTime?: string }[] }).timedEntries ?? [])) if (t.startTime) starts.add(t.startTime);
    console.log(`  option ${item.productOptionCode ?? '(no productOptionCode)'}: seasons=${seasons.length} pricingRecords=${recs.length} withTimedEntries=${timed} startTimes=${[...starts].sort().join(',') || '(none stated)'}`);
  }
}

async function main(): Promise<void> {
  const [mode, a, b] = process.argv.slice(2);
  console.log(`Viator probe — base=${VIATOR_V2_BASE} keyPrefix=${KEY_PREFIX}`);
  if (KEY_PREFIX === 'none') { console.log('\n!! VIATOR_API_KEY is not set. Put it in .env.local (the app reads the same name).'); process.exit(2); }

  if (mode === 'search') {
    const city = (a ?? '').trim();
    const country = (b ?? '').trim();
    if (!city || !country) { console.log('usage: search <city> <country>'); process.exit(2); }
    const destId = findViatorDestIdFor(city, country); // destinations.ts:568-585 — the route's own resolver (activities/search/route.ts:80)
    if (destId === null) {
      console.log(`!! "${city}" is not in the static destination map (destinations.ts) — the app would spend a /destinations call to resolve it; this probe makes ONE call and stops instead.`);
      process.exit(2);
    }
    // The body the app sends: viatorClient.ts:296-303, invoked from :446 with PAGE_SIZE 50 (:433) and no tags.
    const body = {
      filtering: { destination: String(destId) },
      sorting: { sort: 'DEFAULT' },
      pagination: { start: 1, count: 50 },
      currency: 'USD',
    };
    banner(`POST /products/search — destination ${destId} (${city}, ${country})`);
    console.log(`body=${JSON.stringify(body)}`);
    const answer = await postJson(`${VIATOR_V2_BASE}/products/search`, body);
    printAnswer(answer);
    if (!answer.ok) process.exit(1);
    describeSearch(answer.json);
    writeFixture(`src/lib/__tests__/fixtureViatorSearch.${slugOf(`${city}-${country}`)}.json`, answer);
    return;
  }

  if (mode === 'schedule') {
    const code = (a ?? '').trim();
    if (!code) { console.log('usage: schedule <product-code>'); process.exit(2); }
    banner(`GET /availability/schedules/${code}`);
    const answer = await getJson(`${VIATOR_V2_BASE}/availability/schedules/${encodeURIComponent(code)}`);
    printAnswer(answer);
    if (!answer.ok) process.exit(1);
    describeSchedule(answer.json);
    writeFixture(`src/lib/__tests__/fixtureViatorSchedule.${slugOf(code)}.json`, answer);
    return;
  }

  console.log('usage:\n  npx tsx scripts/probe-viator-schedules.ts search <city> <country>\n  npx tsx scripts/probe-viator-schedules.ts schedule <product-code>');
  process.exit(2);
}

main().catch((e) => { console.error('probe failed:', e instanceof Error ? e.message : String(e)); process.exit(1); });
