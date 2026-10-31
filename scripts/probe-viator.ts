// Diagnostic only — ACTIVITY-01 STEP 0 / 0b / 0c (2026-09-22). Alex runs it; the
// session makes NO metered call. Modes, ONE vendor call each:
//
//   npx tsx scripts/probe-viator.ts search <city> <country> [start]
//     → POST /products/search with the SAME body the app sends for Things to do
//       (viatorClient.ts:296-303 via :446 — destination as a string, sort DEFAULT,
//       pagination start (1, or the optional 1-based cursor) / count 50, currency
//       USD). The destination id comes from the app's own static map
//       (destinations.ts findViatorDestIdFor) — a city outside the map STOPS rather
//       than spend a second call on /destinations.
//     → writes src/lib/__tests__/fixtureViatorSearch.<city-country>[.p<start>].json
//
//   npx tsx scripts/probe-viator.ts product <product-code>
//     → GET /products/{product-code} (docs.viator.com/partner-api/technical,
//       operationId products; ✅ for a Basic-access Affiliate key): the ACTIVE
//       product's pricingInfo { type PER_PERSON | UNIT, ageBands[] { ageBand,
//       startAge, endAge, minTravelersPerBooking, maxTravelersPerBooking } },
//       bookingRequirements { minTravelersPerBooking, maxTravelersPerBooking,
//       requiresAdultForBooking }, cancellationPolicy { type, description,
//       refundEligibility[] }, productOptions[], timeZone, itinerary.duration,
//       inclusions / exclusions — what the Save's party form is built from.
//     → writes src/lib/__tests__/fixtureViatorProduct.<product-code>.json
//
//   npx tsx scripts/probe-viator.ts check <product-code> <YYYY-MM-DD> <BAND=n ...>
//     e.g. check 27424P2 2026-09-25 ADULT=2 CHILD=1
//     → POST /availability/check { productCode, travelDate, currency: 'USD' (the
//       app's one search currency, src/lib/activities/searchContract.ts), paxMix:
//       [{ ageBand, numberOfTravelers }] } (operationId availabilityCheck —
//       parameters: the Accept header; body required: productCode, paxMix,
//       currency, travelDate). The docs' "Access to endpoints" table marks this
//       endpoint ❌ for a Basic-access Affiliate and ✅ from Full-access up: a
//       401/403 here means the key's tier does not reach it. 200 = { currency (as
//       requested), productCode, travelDate, bookableItems[] { productOptionCode,
//       startTime, available, unavailableReason, totalPrice.price.
//       recommendedRetailPrice, lineItems[], extraChargesSummary? } }.
//     → writes src/lib/__tests__/fixtureViatorCheck.<product-code>.<date>.json
//
//   npx tsx scripts/probe-viator.ts schedule <product-code>
//     → GET /availability/schedules/{product-code} (✅ for a Basic-access
//       Affiliate): the product's options, start times, per-band prices in the
//       SUPPLIER's currency (THB for Phuket), sold-out dates and extra charges.
//       The Basic-access path of the Save (the STEP 4 ruling by tier, 2026-09-22)
//       reads this capture beside the product's, with /exchange-rates for the
//       conversion; the Full-access path reads /availability/check instead.
//     → writes src/lib/__tests__/fixtureViatorSchedule.<product-code>.json
//       (commission redacted since 0c — the earlier capture never landed).
//
//   npx tsx scripts/probe-viator.ts fx <SOURCE> <TARGET>      e.g. fx THB USD
//     → POST /exchange-rates { sourceCurrencies: [SOURCE], targetCurrencies:
//       [TARGET] } (operationId exchangeRates; ✅ for a Basic-access Affiliate;
//       the docs: "all pricing is denominated in the currency of the supplier …
//       perform the currency conversion based on the exchange rates given in the
//       response … valid at the time of conversion (as given in the expiry
//       field)"). 200 = { rates[] { sourceCurrency, targetCurrency, rate ("value
//       of targetCurrency per unit of sourceCurrency"), lastUpdated, expiry } }.
//     → writes src/lib/__tests__/fixtureViatorExchangeRates.<source>-<target>.json
//
// Each mode prints the HTTP status (plus the RateLimit-Limit / -Remaining /
// -Reset and X-Unique-ID headers the docs say a metered response carries) and
// writes the response JSON to the fixture path, after two guards:
//   REDACTION (STEP 0b, ruled 2026-09-22; `commission` added 0c): every key named
//   partnerNetPrice, bookingFee, partnerTotalPrice or commission is removed at ANY
//   depth — the docs do not say an affiliate key is spared the PriceObject's
//   commercial terms, and the fixture lands in a PUBLIC repository. A top-level
//   `_redacted` records the distinct key names removed, the count, and the reason;
//   the script prints what it removed. The app and the tests read
//   recommendedRetailPrice only.
//   THE KEY-RUN ASSERTION: no character run of the API key (the whole key, and
//   every 8-character window of it) may appear anywhere in the text.
// A body that fails the key-run assertion is NOT written. Non-2xx bodies are
// printed (first 600 chars) and NOT written. A body that is not a JSON object
// is NOT written (every documented answer is an object).
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

// ── The redaction: the vendor's commercial terms never enter the public tree. ──
const REDACTED_KEYS: readonly string[] = ['partnerNetPrice', 'bookingFee', 'partnerTotalPrice', 'commission'];
const REDACTION_REASON = "commercial terms — not the traveller's price";
/** Returns a copy of `value` with every REDACTED_KEYS-named key removed at any depth; pushes each removal onto `removed`. */
function redact(value: unknown, removed: string[]): unknown {
  if (Array.isArray(value)) return value.map((v) => redact(v, removed));
  if (value !== null && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (REDACTED_KEYS.includes(k)) { removed.push(k); continue; }
      out[k] = redact(v, removed);
    }
    return out;
  }
  return value;
}

function writeFixture(path: string, answer: Answer): void {
  if (answer.json === null) { console.log(`NOT WRITTEN — the body is not JSON. First 600 chars: ${answer.text.slice(0, 600)}`); return; }
  if (Array.isArray(answer.json) || typeof answer.json !== 'object') { console.log(`NOT WRITTEN — the body is not a JSON object (${Array.isArray(answer.json) ? 'array' : typeof answer.json}); the documented answer is an object.`); return; }
  const removed: string[] = [];
  const body = redact(answer.json, removed) as Record<string, unknown>;
  const keys = [...new Set(removed)].sort();
  body._redacted = { keys, count: removed.length, reason: REDACTION_REASON };
  console.log(`redacted: count=${removed.length} keys=${JSON.stringify(keys)} (${REDACTION_REASON})`);
  const pretty = JSON.stringify(body, null, 2) + '\n';
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

function describeProduct(json: unknown): void {
  const d = json as { status?: string; productCode?: string; title?: string; timeZone?: string; pricingInfo?: { type?: string; ageBands?: Array<{ ageBand?: string; startAge?: number; endAge?: number; minTravelersPerBooking?: number; maxTravelersPerBooking?: number }> }; bookingRequirements?: unknown; cancellationPolicy?: { type?: string; description?: string; refundEligibility?: unknown[] }; productOptions?: Array<{ productOptionCode?: string; title?: string }>; itinerary?: { itineraryType?: string; duration?: unknown }; inclusions?: unknown[]; exclusions?: unknown[] } | null;
  console.log(`status=${d?.status} productCode=${d?.productCode} title=${String(d?.title).slice(0, 80)} timeZone=${d?.timeZone}`);
  console.log(`pricingInfo.type=${d?.pricingInfo?.type} ageBands=${JSON.stringify(d?.pricingInfo?.ageBands)}`);
  console.log(`bookingRequirements=${JSON.stringify(d?.bookingRequirements)}`);
  console.log(`cancellationPolicy.type=${d?.cancellationPolicy?.type} refundEligibility=${JSON.stringify(d?.cancellationPolicy?.refundEligibility)}`);
  console.log(`productOptions=${JSON.stringify((d?.productOptions ?? []).map((o) => ({ code: o.productOptionCode, title: o.title })))}`);
  console.log(`itinerary.itineraryType=${d?.itinerary?.itineraryType} duration=${JSON.stringify(d?.itinerary?.duration)}`);
  console.log(`inclusions=${(d?.inclusions ?? []).length} exclusions=${(d?.exclusions ?? []).length}`);
}

function describeCheck(json: unknown): void {
  const d = json as { currency?: string; productCode?: string; travelDate?: string; bookableItems?: Array<{ productOptionCode?: string; startTime?: string; available?: boolean; unavailableReason?: string; totalPrice?: { price?: { recommendedRetailPrice?: number } }; lineItems?: unknown[]; extraChargesSummary?: unknown }> } | null;
  console.log(`currency=${d?.currency} productCode=${d?.productCode} travelDate=${d?.travelDate}`);
  const items = Array.isArray(d?.bookableItems) ? d!.bookableItems! : [];
  console.log(`bookableItems=${items.length}`);
  for (const it of items) {
    console.log(`  option ${it.productOptionCode ?? '(none)'} start=${it.startTime ?? '(none)'} available=${it.available} reason=${it.unavailableReason ?? '-'} totalRRP=${it.totalPrice?.price?.recommendedRetailPrice ?? '-'} lineItems=${(it.lineItems ?? []).length} extraCharges=${it.extraChargesSummary ? 'stated' : 'absent'}`);
  }
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
    const startArg = (process.argv[5] ?? '').trim();
    const start = startArg === '' ? 1 : Number(startArg);
    if (!city || !country || !Number.isInteger(start) || start < 1) { console.log('usage: search <city> <country> [start ≥ 1]'); process.exit(2); }
    const destId = findViatorDestIdFor(city, country); // destinations.ts:568-585 — the route's own resolver (activities/search/route.ts:80)
    if (destId === null) {
      console.log(`!! "${city}" is not in the static destination map (destinations.ts) — the app would spend a /destinations call to resolve it; this probe makes ONE call and stops instead.`);
      process.exit(2);
    }
    // The body the app sends: viatorClient.ts:296-303, invoked from :446 with PAGE_SIZE 50 (:433) and no tags.
    const body = {
      filtering: { destination: String(destId) },
      sorting: { sort: 'DEFAULT' },
      pagination: { start, count: 50 },
      currency: 'USD',
    };
    banner(`POST /products/search — destination ${destId} (${city}, ${country})`);
    console.log(`body=${JSON.stringify(body)}`);
    const answer = await postJson(`${VIATOR_V2_BASE}/products/search`, body);
    printAnswer(answer);
    if (!answer.ok) process.exit(1);
    describeSearch(answer.json);
    writeFixture(`src/lib/__tests__/fixtureViatorSearch.${slugOf(`${city}-${country}`)}${start > 1 ? `.p${start}` : ''}.json`, answer);
    return;
  }

  if (mode === 'product') {
    const code = (a ?? '').trim();
    if (!code) { console.log('usage: product <product-code>'); process.exit(2); }
    banner(`GET /products/${code}`);
    const answer = await getJson(`${VIATOR_V2_BASE}/products/${encodeURIComponent(code)}`);
    printAnswer(answer);
    if (!answer.ok) process.exit(1);
    describeProduct(answer.json);
    writeFixture(`src/lib/__tests__/fixtureViatorProduct.${slugOf(code)}.json`, answer);
    return;
  }

  if (mode === 'check') {
    const code = (a ?? '').trim();
    const date = (b ?? '').trim();
    const bandArgs = process.argv.slice(5);
    const paxMix: Array<{ ageBand: string; numberOfTravelers: number }> = [];
    for (const arg of bandArgs) {
      const m = /^([A-Z]+)=(\d+)$/.exec(arg.trim());
      if (!m) { console.log(`bad band "${arg}" — use BAND=n, e.g. ADULT=2 CHILD=1`); process.exit(2); }
      paxMix.push({ ageBand: m[1], numberOfTravelers: Number(m[2]) });
    }
    if (!code || !/^\d{4}-\d{2}-\d{2}$/.test(date) || paxMix.length === 0) { console.log('usage: check <product-code> <YYYY-MM-DD> <BAND=n ...>   e.g. check 27424P2 2026-09-25 ADULT=2'); process.exit(2); }
    // The body the app will send (ruling B): the product, the date, the app's one search currency, the party per stated band.
    const body = { productCode: code, travelDate: date, currency: 'USD', paxMix };
    banner(`POST /availability/check — ${code} on ${date}, ${paxMix.map((p) => `${p.ageBand}=${p.numberOfTravelers}`).join(' ')}`);
    console.log(`body=${JSON.stringify(body)}`);
    const answer = await postJson(`${VIATOR_V2_BASE}/availability/check`, body);
    printAnswer(answer);
    if (!answer.ok) process.exit(1);
    describeCheck(answer.json);
    writeFixture(`src/lib/__tests__/fixtureViatorCheck.${slugOf(code)}.${date}.json`, answer);
    return;
  }

  if (mode === 'fx') {
    const source = (a ?? '').trim().toUpperCase();
    const target = (b ?? '').trim().toUpperCase();
    if (!/^[A-Z]{3}$/.test(source) || !/^[A-Z]{3}$/.test(target)) { console.log('usage: fx <SOURCE> <TARGET>   e.g. fx THB USD'); process.exit(2); }
    const body = { sourceCurrencies: [source], targetCurrencies: [target] };
    banner(`POST /exchange-rates — ${source} → ${target}`);
    console.log(`body=${JSON.stringify(body)}`);
    const answer = await postJson(`${VIATOR_V2_BASE}/exchange-rates`, body);
    printAnswer(answer);
    if (!answer.ok) process.exit(1);
    const d = answer.json as { rates?: Array<{ sourceCurrency?: string; targetCurrency?: string; rate?: number; lastUpdated?: string; expiry?: string }> } | null;
    for (const r of d?.rates ?? []) console.log(`  rate ${r.sourceCurrency}→${r.targetCurrency}=${r.rate} lastUpdated=${r.lastUpdated} expiry=${r.expiry}`);
    writeFixture(`src/lib/__tests__/fixtureViatorExchangeRates.${slugOf(`${source}-${target}`)}.json`, answer);
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

  console.log('usage:\n  npx tsx scripts/probe-viator.ts search <city> <country> [start]\n  npx tsx scripts/probe-viator.ts product <product-code>\n  npx tsx scripts/probe-viator.ts check <product-code> <YYYY-MM-DD> <BAND=n ...>\n  npx tsx scripts/probe-viator.ts schedule <product-code>\n  npx tsx scripts/probe-viator.ts fx <SOURCE> <TARGET>');
  process.exit(2);
}

main().catch((e) => { console.error('probe failed:', e instanceof Error ? e.message : String(e)); process.exit(1); });
