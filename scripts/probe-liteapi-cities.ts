// Diagnostic only — run: npx tsx scripts/probe-liteapi-cities.ts
//
// Probes LiteAPI's city / country / place list endpoints to find what powers a
// typeahead dropdown of cities LiteAPI actually supports (kills typos like
// "Libson" and guarantees every pick returns hotels via the two-step). NOT wired
// into the app — standalone, not merged.
//
// Mirrors src/lib/liteapiClient.ts EXACTLY (same auth/base/mode as the app + the
// existing scripts/probe-liteapi-lisbon.ts):
//   - LITEAPI_BASE   (liteapiClient.ts:22)
//   - getMode()      (liteapiClient.ts:35-37)
//   - getApiKey()    (liteapiClient.ts:39-46)
//   - headers()      (liteapiClient.ts:48-53)
//
// Reads the SAME env vars: LITEAPI_MODE, LITEAPI_PRODUCTION_KEY (+ SANDBOX). Run:
//   LITEAPI_MODE=production npx tsx scripts/probe-liteapi-cities.ts
// or bare if those are in .env.local.

import { readFileSync } from 'node:fs';

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

// ── Mirror liteapiClient.ts ──────────────────────────────────────────────────
const LITEAPI_BASE = 'https://api.liteapi.travel/v3.0'; // liteapiClient.ts:22
function getMode(): 'sandbox' | 'production' {
  return process.env.LITEAPI_MODE === 'production' ? 'production' : 'sandbox'; // :35-37
}
function getApiKey(): string | undefined {
  const mode = getMode(); // :39-46
  return mode === 'production' ? process.env.LITEAPI_PRODUCTION_KEY : process.env.LITEAPI_SANDBOX_KEY;
}
function headers(): Record<string, string> {
  const key = getApiKey(); // :48-53
  if (!key) throw new Error(`No LiteAPI key for mode=${getMode()} (set LITEAPI_${getMode().toUpperCase()}_KEY)`);
  return { 'X-API-Key': key, 'Content-Type': 'application/json', 'Accept': 'application/json' };
}

const MODE = getMode();
const KEY_PREFIX = (getApiKey() ?? 'none').slice(0, 4); // first 4 ONLY — never the full key

function banner(title: string): void {
  console.log(`\n──────────────────────────────────────────────────────────────`);
  console.log(`${title}  [mode=${MODE} keyPrefix=${KEY_PREFIX}]`);
  console.log(`──────────────────────────────────────────────────────────────`);
}

/** Find the list array in whatever shape the response uses. */
function listArray(json: any): any[] {
  if (Array.isArray(json?.data)) return json.data;
  if (Array.isArray(json)) return json;
  // some responses nest e.g. { data: { cities: [...] } }
  if (json?.data && typeof json.data === 'object') {
    for (const v of Object.values(json.data)) if (Array.isArray(v)) return v as any[];
  }
  return [];
}

async function getJson(url: string): Promise<{ status: number; ok: boolean; json: any; text: string }> {
  const res = await fetch(url, { method: 'GET', headers: headers() });
  const text = await res.text();
  let json: any = null;
  try { json = JSON.parse(text); } catch { /* non-JSON */ }
  return { status: res.status, ok: res.ok, json, text };
}

/** Probe one GET endpoint and dump status + top-level keys + count + first 3 raw. */
async function probe(title: string, path: string): Promise<void> {
  banner(title);
  try {
    const url = `${LITEAPI_BASE}${path}`;
    console.log(`GET ${url}`);
    const { status, json, text } = await getJson(url);
    if (status === 404) {
      console.log(`status=404 → endpoint not available (skip). body: ${text.slice(0, 160)}`);
      return;
    }
    console.log(`status=${status}`);
    console.log(`topLevelKeys=${json ? JSON.stringify(Object.keys(json)) : '(non-JSON body)'}`);
    const arr = listArray(json);
    console.log(`count=${arr.length}`);
    if (arr.length > 0) {
      console.log(`firstItemKeys=${JSON.stringify(Object.keys(arr[0]))}`);
      arr.slice(0, 3).forEach((it, i) => console.log(`  item[${i}]=${JSON.stringify(it).slice(0, 240)}`));
    } else {
      console.log(`rawBody(first 300): ${text.slice(0, 300)}`);
    }
  } catch (e) {
    console.log(`ERROR: ${e instanceof Error ? e.message : String(e)}`);
  }
}

async function main(): Promise<void> {
  console.log(`LiteAPI cities/countries/places probe — base=${LITEAPI_BASE}`);
  console.log(`mode=${MODE} keyPrefix=${KEY_PREFIX}`);
  if (KEY_PREFIX === 'none') {
    console.log(`\n!! No key for mode=${MODE}. Set LITEAPI_${MODE.toUpperCase()}_KEY (or LITEAPI_MODE).`);
    return;
  }

  // 1. Cities in a country (the per-country dropdown source).
  await probe('TEST 1 — GET /data/cities?countryCode=PT', '/data/cities?countryCode=PT');

  // 2. All cities (if supported — likely 400/404 without a country filter).
  await probe('TEST 2 — GET /data/cities (no filter)', '/data/cities');

  // 3. Country list (for the country dropdown).
  await probe('TEST 3 — GET /data/countries', '/data/countries');

  // 4. Place autocomplete (if LiteAPI exposes a textSearch).
  await probe('TEST 4 — GET /data/places?textSearch=Lis', '/data/places?textSearch=Lis');

  console.log(`\n══════════════════════════════════════════════════════════════`);
  console.log(`HOW TO READ:`);
  console.log(`  • The endpoint that returns a 200 with a list whose items expose a CITY NAME + (its country) is the dropdown source.`);
  console.log(`  • Look at firstItemKeys for the field names: city name (e.g. 'city'/'name') + countryCode → build the typeahead {label, cityName, countryCode}.`);
  console.log(`  • /data/countries powers the COUNTRY dropdown; /data/cities?countryCode=XX powers the CITY list per country.`);
  console.log(`  • Any 404 → that endpoint isn't available; use the one(s) that returned 200.`);
  console.log(`══════════════════════════════════════════════════════════════`);
}

main().catch((e) => { console.error('probe failed:', e); process.exit(1); });
