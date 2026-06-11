// Diagnostic only — run: npx tsx scripts/probe-liteapi-lisbon.ts
//
// Standalone LiteAPI probe for Lisbon. NOT wired into the app. Settles whether
// the "only Canggu" empty-results bug is RESOLUTION (cityName brittle, coords/
// catalog fix it → 200 with data on the coord/catalog calls) or ACCOUNT COVERAGE
// (production account not activated → 401/403 everywhere).
//
// It mirrors src/lib/liteapiClient.ts EXACTLY so the auth/base/mode match the app:
//   - LITEAPI_BASE          (liteapiClient.ts:22)
//   - getMode()             (liteapiClient.ts:35-37)
//   - getApiKey()           (liteapiClient.ts:39-46)
//   - headers()             (liteapiClient.ts:48-53)
//   - /data/hotel GET shape (liteapiClient.ts:828-831)
//   - /hotels/rates POST    (liteapiClient.ts:244-249) cityName body (:223-236)
//                            / coords body (:210-222)
//
// Reads the SAME env vars the app uses: LITEAPI_MODE, LITEAPI_PRODUCTION_KEY
// (and LITEAPI_SANDBOX_KEY). Run with the prod key, e.g.:
//   LITEAPI_MODE=production npx tsx scripts/probe-liteapi-lisbon.ts
// or just `npx tsx scripts/probe-liteapi-lisbon.ts` if those are in .env.local.

import { readFileSync } from 'node:fs';

// ── Minimal .env loader (no dependency): load .env.local then .env, without
//    overriding vars already present in the environment. ──────────────────────
function loadEnvFile(path: string): void {
  let raw: string;
  try {
    raw = readFileSync(path, 'utf8');
  } catch {
    return; // file absent — fine
  }
  for (const line of raw.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let val = trimmed.slice(eq + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    if (key && process.env[key] === undefined) process.env[key] = val;
  }
}
loadEnvFile('.env.local');
loadEnvFile('.env');

// ── Mirror liteapiClient.ts ──────────────────────────────────────────────────
const LITEAPI_BASE = 'https://api.liteapi.travel/v3.0'; // liteapiClient.ts:22

function getMode(): 'sandbox' | 'production' {
  // liteapiClient.ts:35-37
  return process.env.LITEAPI_MODE === 'production' ? 'production' : 'sandbox';
}

function getApiKey(): string | undefined {
  // liteapiClient.ts:39-46
  const mode = getMode();
  return mode === 'production'
    ? process.env.LITEAPI_PRODUCTION_KEY
    : process.env.LITEAPI_SANDBOX_KEY;
}

function headers(): Record<string, string> {
  // liteapiClient.ts:48-53
  const key = getApiKey();
  if (!key) throw new Error(`No LiteAPI key set for mode=${getMode()} (set LITEAPI_${getMode().toUpperCase()}_KEY)`);
  return {
    'X-API-Key': key,
    'Content-Type': 'application/json',
    'Accept': 'application/json',
  };
}

// ── Helpers ──────────────────────────────────────────────────────────────────
const MODE = getMode();
const KEY_PREFIX = (getApiKey() ?? 'none').slice(0, 4); // first 4 ONLY — never the full key

function banner(title: string): void {
  console.log(`\n──────────────────────────────────────────────────────────────`);
  console.log(`${title}  [mode=${MODE} keyPrefix=${KEY_PREFIX}]`);
  console.log(`──────────────────────────────────────────────────────────────`);
}

/** Find an array of hotels in whatever shape the response uses. */
function hotelsArray(json: any): any[] {
  if (Array.isArray(json?.data)) return json.data;
  if (Array.isArray(json?.hotels)) return json.hotels;
  if (Array.isArray(json)) return json;
  return [];
}
function firstHotelSummary(arr: any[]): string {
  const h = arr[0];
  if (!h) return '(none)';
  const id = h.id ?? h.hotelId ?? '(no id)';
  const name = h.name ?? h.hotel?.name ?? '(no name)';
  return `id=${id} name=${JSON.stringify(name)}`;
}

// Future dates (mirrors a real search: today+30 → today+33).
function isoPlusDays(days: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}
const CHECKIN = isoPlusDays(30);
const CHECKOUT = isoPlusDays(33);
const OCCUPANCIES = [{ adults: 2 }];

// Lisbon
const CITY_NAME = 'Lisbon';
const COUNTRY_CODE = 'PT';
const LAT = 38.7223;
const LNG = -9.1393;
const RADIUS = 25_000;

async function getJson(url: string): Promise<{ status: number; ok: boolean; json: any; text: string }> {
  const res = await fetch(url, { method: 'GET', headers: headers() });
  const text = await res.text();
  let json: any = null;
  try { json = JSON.parse(text); } catch { /* non-JSON body */ }
  return { status: res.status, ok: res.ok, json, text };
}
async function postJson(url: string, body: unknown): Promise<{ status: number; ok: boolean; json: any; text: string }> {
  const res = await fetch(url, { method: 'POST', headers: headers(), body: JSON.stringify(body) });
  const text = await res.text();
  let json: any = null;
  try { json = JSON.parse(text); } catch { /* non-JSON body */ }
  return { status: res.status, ok: res.ok, json, text };
}

async function main(): Promise<void> {
  console.log(`LiteAPI Lisbon probe — base=${LITEAPI_BASE}`);
  console.log(`mode=${MODE} keyPrefix=${KEY_PREFIX} checkin=${CHECKIN} checkout=${CHECKOUT}`);
  if (KEY_PREFIX === 'none') {
    console.log(`\n!! No key for mode=${MODE}. Set LITEAPI_${MODE.toUpperCase()}_KEY (or LITEAPI_MODE).`);
    return;
  }

  // TEST 1 — /data/hotels by city name (the catalog step the two-step flow needs)
  banner('TEST 1 — GET /data/hotels?cityName=Lisbon&countryCode=PT');
  try {
    const url = `${LITEAPI_BASE}/data/hotels?cityName=${encodeURIComponent(CITY_NAME)}&countryCode=${COUNTRY_CODE}`;
    const { status, json, text } = await getJson(url);
    const arr = hotelsArray(json);
    console.log(`status=${status}  catalogHotels=${arr.length}  first=${firstHotelSummary(arr)}`);
    if (status >= 400) console.log(`body: ${text.slice(0, 300)}`);
  } catch (e) {
    console.log(`ERROR: ${e instanceof Error ? e.message : String(e)}`);
  }

  // TEST 2 — /data/hotels by coordinates (if the catalog supports geo)
  banner('TEST 2 — GET /data/hotels?latitude/longitude/radius (Lisbon)');
  try {
    const url = `${LITEAPI_BASE}/data/hotels?latitude=${LAT}&longitude=${LNG}&radius=${RADIUS}&countryCode=${COUNTRY_CODE}`;
    const { status, json, text } = await getJson(url);
    const arr = hotelsArray(json);
    console.log(`status=${status}  catalogHotels=${arr.length}  first=${firstHotelSummary(arr)}`);
    if (status >= 400) console.log(`body: ${text.slice(0, 300)} (if /data/hotels has no coord param, this 4xx is expected — note it)`);
  } catch (e) {
    console.log(`ERROR: ${e instanceof Error ? e.message : String(e)}`);
  }

  // TEST 3 — /hotels/rates by cityName (what the app did before the coords fix)
  banner('TEST 3 — POST /hotels/rates  (cityName=Lisbon)');
  try {
    const body = {
      cityName: CITY_NAME,
      countryCode: COUNTRY_CODE,
      checkin: CHECKIN,
      checkout: CHECKOUT,
      occupancies: OCCUPANCIES,
      currency: 'USD',
      guestNationality: 'US',
      includeHotelData: true,
    };
    const { status, json, text } = await postJson(`${LITEAPI_BASE}/hotels/rates`, body);
    const dataLen = Array.isArray(json?.data) ? json.data.length : 'n/a';
    const hotelsLen = Array.isArray(json?.hotels) ? json.hotels.length : 'n/a';
    console.log(`status=${status}  data[]=${dataLen}  hotels[]=${hotelsLen}`);
    if (status >= 400) console.log(`body: ${text.slice(0, 300)}`);
  } catch (e) {
    console.log(`ERROR: ${e instanceof Error ? e.message : String(e)}`);
  }

  // TEST 4 — /hotels/rates by coordinates (what the coords fix now does)
  banner('TEST 4 — POST /hotels/rates  (latitude/longitude/radius=25km, Lisbon)');
  try {
    const body = {
      latitude: LAT,
      longitude: LNG,
      radius: RADIUS,
      countryCode: COUNTRY_CODE,
      checkin: CHECKIN,
      checkout: CHECKOUT,
      occupancies: OCCUPANCIES,
      currency: 'USD',
      guestNationality: 'US',
      includeHotelData: true,
    };
    const { status, json, text } = await postJson(`${LITEAPI_BASE}/hotels/rates`, body);
    const dataLen = Array.isArray(json?.data) ? json.data.length : 'n/a';
    const hotelsLen = Array.isArray(json?.hotels) ? json.hotels.length : 'n/a';
    console.log(`status=${status}  data[]=${dataLen}  hotels[]=${hotelsLen}`);
    if (status >= 400) console.log(`body: ${text.slice(0, 300)}`);
  } catch (e) {
    console.log(`ERROR: ${e instanceof Error ? e.message : String(e)}`);
  }

  // ── How to read it ───────────────────────────────────────────────────────
  console.log(`\n══════════════════════════════════════════════════════════════`);
  console.log(`HOW TO READ:`);
  console.log(`  • Any 401/403  → production account NOT activated (or wrong key). No code fix helps — activate with LiteAPI first.`);
  console.log(`  • T3 cityName data[]=0 but T4 coords data[]>0 → RESOLUTION bug; the coords fix (already shipped) is correct.`);
  console.log(`  • T1 /data/hotels >0 → the catalog two-step is viable for long-tail cities (and shows the live list shape).`);
  console.log(`  • All 200 but every count=0 → account is activated but has no Lisbon inventory (coverage) — escalate to LiteAPI.`);
  console.log(`══════════════════════════════════════════════════════════════`);
}

main().catch((e) => {
  console.error('probe failed:', e);
  process.exit(1);
});
