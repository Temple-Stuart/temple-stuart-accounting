// Diagnostic only — run: npx tsx scripts/probe-liteapi-lisbon.ts
//
// Standalone LiteAPI probe for Lisbon (v2). NOT wired into the app. v1 proved
// /data/hotels returns 200 real hotels but /hotels/rates returned data[]=n/a
// (expected field absent). v2 prints the RAW rates response shape (top-level
// keys + body) AND tests the TWO-STEP: hotelIds from /data/hotels → /hotels/rates
// {hotelIds[]}. Settles whether the fix is the two-step (build it) or an account/
// coverage issue.
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
  // Captures hotel IDs for the TEST 5 two-step.
  let catalogIds: string[] = [];
  let idFieldName = '(unknown)';
  banner('TEST 1 — GET /data/hotels?cityName=Lisbon&countryCode=PT');
  try {
    const url = `${LITEAPI_BASE}/data/hotels?cityName=${encodeURIComponent(CITY_NAME)}&countryCode=${COUNTRY_CODE}`;
    const { status, json, text } = await getJson(url);
    const arr = hotelsArray(json);
    console.log(`status=${status}  catalogHotels=${arr.length}`);
    const first = arr[0];
    if (first) {
      // Reveal the EXACT shape so the build knows the id field name.
      idFieldName = first.id !== undefined ? 'id' : first.hotelId !== undefined ? 'hotelId' : '(neither id nor hotelId!)';
      console.log(`firstHotelKeys=${JSON.stringify(Object.keys(first))}`);
      console.log(`idField='${idFieldName}'`);
      console.log(`sample[0]=${firstHotelSummary(arr)}`);
      if (arr[1]) console.log(`sample[1]=id=${arr[1].id ?? arr[1].hotelId} name=${JSON.stringify(arr[1].name ?? arr[1].hotel?.name)}`);
    }
    // Collect up to 20 ids for the two-step (accept either id field).
    catalogIds = arr
      .map((h: any) => h.id ?? h.hotelId)
      .filter((x: any) => typeof x === 'string' && x.length > 0)
      .slice(0, 20);
    console.log(`collectedIdsForTwoStep=${catalogIds.length}`);
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

  // TEST 3 — /hotels/rates by cityName (what the app did before the coords fix).
  // Print the RAW shape — the v1 probe showed data[]=n/a, so the expected field
  // is absent; we need to SEE the actual top-level keys + body.
  banner('TEST 3 — POST /hotels/rates  (cityName=Lisbon) — RAW shape');
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
    console.log(`status=${status}`);
    console.log(`topLevelKeys=${json ? JSON.stringify(Object.keys(json)) : '(non-JSON body)'}`);
    if (json && typeof json.data !== 'undefined') {
      console.log(`typeof data=${Array.isArray(json.data) ? `array(len=${json.data.length})` : typeof json.data}`);
      if (json.data && !Array.isArray(json.data)) console.log(`data subKeys=${JSON.stringify(Object.keys(json.data))}`);
    }
    console.log(`rawBody(first 800): ${text.slice(0, 800)}`);
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
    console.log(`status=${status}`);
    console.log(`topLevelKeys=${json ? JSON.stringify(Object.keys(json)) : '(non-JSON body)'}`);
    const dataLen = Array.isArray(json?.data) ? json.data.length : 'n/a';
    console.log(`data[]=${dataLen}`);
    if (dataLen === 'n/a') console.log(`rawBody(first 500): ${text.slice(0, 500)}`);
  } catch (e) {
    console.log(`ERROR: ${e instanceof Error ? e.message : String(e)}`);
  }

  // TEST 5 — THE TWO-STEP: hotelIds from TEST 1's /data/hotels → /hotels/rates.
  // This is the candidate fix for long-tail cities: resolve the city to real
  // hotelIds via the catalog, then price exactly those.
  banner('TEST 5 — POST /hotels/rates  (hotelIds[] from TEST 1) — the two-step');
  if (catalogIds.length === 0) {
    console.log(`skipped: TEST 1 returned no usable hotel IDs (idField='${idFieldName}').`);
  } else {
    try {
      const body = {
        hotelIds: catalogIds,
        checkin: CHECKIN,
        checkout: CHECKOUT,
        occupancies: OCCUPANCIES,
        currency: 'USD',
        guestNationality: 'US',
      };
      const { status, json, text } = await postJson(`${LITEAPI_BASE}/hotels/rates`, body);
      console.log(`status=${status}  sentHotelIds=${catalogIds.length}`);
      console.log(`topLevelKeys=${json ? JSON.stringify(Object.keys(json)) : '(non-JSON body)'}`);
      const rateArr = Array.isArray(json?.data) ? json.data : [];
      console.log(`rateEntries(data[])=${rateArr.length}`);
      const r0 = rateArr[0];
      if (r0) {
        console.log(`rate[0]Keys=${JSON.stringify(Object.keys(r0))}`);
        const hid = r0.hotelId ?? r0.id ?? '(no id)';
        // Best-effort price dig (path may differ — rawBody below shows the truth).
        const price =
          r0?.roomTypes?.[0]?.rates?.[0]?.retailRate?.total?.[0]?.amount ??
          r0?.roomTypes?.[0]?.offerRetailRate?.amount ??
          '(price path unknown — see rawBody)';
        console.log(`rate[0]: hotelId=${hid}  price=${price}`);
      }
      console.log(`rawBody(first 800): ${text.slice(0, 800)}`);
    } catch (e) {
      console.log(`ERROR: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  // ── How to read it ───────────────────────────────────────────────────────
  console.log(`\n══════════════════════════════════════════════════════════════`);
  console.log(`HOW TO READ:`);
  console.log(`  • Any 401/403  → production account NOT activated (or wrong key). No code fix helps — activate with LiteAPI first.`);
  console.log(`  • T1 firstHotelKeys/idField → the EXACT hotel id field to use in the two-step build.`);
  console.log(`  • T3/T4 topLevelKeys + rawBody → what the cityName/coords rates call actually returns (empty vs different shape vs error).`);
  console.log(`  • T5 rateEntries>0 → THE TWO-STEP IS THE FIX: resolve city → hotelIds (/data/hotels) → price via /hotels/rates {hotelIds[]}. Build it.`);
  console.log(`  • T5 rateEntries=0 on 200 → IDs returned but no bookable rates for the window (try other dates) — coverage, not code.`);
  console.log(`══════════════════════════════════════════════════════════════`);
}

main().catch((e) => {
  console.error('probe failed:', e);
  process.exit(1);
});
