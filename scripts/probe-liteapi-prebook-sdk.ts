// Diagnostic only — run: npx tsx scripts/probe-liteapi-prebook-sdk.ts
//
// Confirms the PRODUCTION /rates/prebook response shape with usePaymentSdk:true —
// the secretKey + transactionId + prebookId the LiteAPI hosted Payment SDK needs
// (PR-B2). Three steps: catalog → rate (offerId) → prebook. NOT wired into the app.
//
// Mirrors src/lib/liteapiClient.ts EXACTLY (same auth/base/mode as the app + the
// existing scripts/probe-liteapi-lisbon.ts):
//   LITEAPI_BASE (:22), getMode() (:35-37), getApiKey() (:39-46), headers() (:48-53)
// offerId dig mirrors extractOfferId (liteapiClient.ts:468-472).
//
// Reads the SAME env vars: LITEAPI_MODE, LITEAPI_PRODUCTION_KEY (+ SANDBOX). Run:
//   LITEAPI_MODE=production npx tsx scripts/probe-liteapi-prebook-sdk.ts
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
  return getMode() === 'production' ? process.env.LITEAPI_PRODUCTION_KEY : process.env.LITEAPI_SANDBOX_KEY; // :39-46
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

function isoPlusDays(days: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}
const CHECKIN = isoPlusDays(30);
const CHECKOUT = isoPlusDays(33);

async function getJson(url: string) {
  const res = await fetch(url, { method: 'GET', headers: headers() });
  const text = await res.text();
  let json: any = null; try { json = JSON.parse(text); } catch { /* non-JSON */ }
  return { status: res.status, ok: res.ok, json, text };
}
async function postJson(url: string, body: unknown) {
  const res = await fetch(url, { method: 'POST', headers: headers(), body: JSON.stringify(body) });
  const text = await res.text();
  let json: any = null; try { json = JSON.parse(text); } catch { /* non-JSON */ }
  return { status: res.status, ok: res.ok, json, text };
}

/** Mirror extractOfferId (liteapiClient.ts:468-472): roomTypes[].offerId, else
 *  roomTypes[].rates[].offerId. */
function firstOfferId(rateItem: any): string | null {
  for (const room of rateItem?.roomTypes || []) {
    if (room?.offerId) return room.offerId;
    for (const rate of room?.rates || []) {
      if (rate?.offerId) return rate.offerId;
    }
  }
  return null;
}

async function main(): Promise<void> {
  console.log(`LiteAPI prebook/SDK probe — base=${LITEAPI_BASE}`);
  console.log(`mode=${MODE} keyPrefix=${KEY_PREFIX} checkin=${CHECKIN} checkout=${CHECKOUT}`);
  if (KEY_PREFIX === 'none') {
    console.log(`\n!! No key for mode=${MODE}. Set LITEAPI_${MODE.toUpperCase()}_KEY (or LITEAPI_MODE).`);
    return;
  }

  // STEP 1 — catalog → a hotelId (Canggu, ID).
  banner('STEP 1 — GET /data/hotels?cityName=Canggu&countryCode=ID');
  let hotelId: string | null = null;
  try {
    const { status, json, text } = await getJson(`${LITEAPI_BASE}/data/hotels?cityName=Canggu&countryCode=ID`);
    const list: any[] = Array.isArray(json?.data) ? json.data : [];
    hotelId = list[0]?.id ?? list[0]?.hotelId ?? null;
    console.log(`status=${status}  catalogLen=${list.length}  hotelId=${hotelId ?? '(none)'}`);
    if (status >= 400) console.log(`body: ${text.slice(0, 300)}`);
  } catch (e) { console.log(`ERROR: ${e instanceof Error ? e.message : String(e)}`); }
  if (!hotelId) { console.log('\nNo hotelId — cannot continue.'); return; }

  // STEP 2 — rate → an offerId.
  banner('STEP 2 — POST /hotels/rates {hotelIds:[that id]} → offerId');
  let offerId: string | null = null;
  try {
    const body = {
      hotelIds: [hotelId],
      checkin: CHECKIN, checkout: CHECKOUT,
      occupancies: [{ adults: 2 }],
      currency: 'USD', guestNationality: 'US',
    };
    const { status, json, text } = await postJson(`${LITEAPI_BASE}/hotels/rates`, body);
    const rates: any[] = Array.isArray(json?.data) ? json.data : [];
    offerId = rates.length ? firstOfferId(rates[0]) : null;
    console.log(`status=${status}  rateEntries=${rates.length}  errCode=${json?.error?.code ?? 'none'}  offerId=${offerId ?? '(none)'}`);
    if (!offerId) console.log(`rawBody(first 600): ${text.slice(0, 600)}`);
  } catch (e) { console.log(`ERROR: ${e instanceof Error ? e.message : String(e)}`); }
  if (!offerId) { console.log('\nNo offerId — cannot prebook.'); return; }

  // STEP 3 — prebook with usePaymentSdk:true → the SDK payment context.
  banner('STEP 3 — POST /rates/prebook { offerId, usePaymentSdk:true } — THE SDK SHAPE');
  try {
    const { status, json, text } = await postJson(`${LITEAPI_BASE}/rates/prebook`, { offerId, usePaymentSdk: true });
    console.log(`status=${status}`);
    console.log(`topLevelKeys=${json ? JSON.stringify(Object.keys(json)) : '(non-JSON body)'}`);
    if (json?.data && typeof json.data === 'object') {
      console.log(`data subKeys=${JSON.stringify(Object.keys(json.data))}`);
    }
    // Flag the fields the SDK needs (presence only — never print the secretKey value).
    const d = json?.data ?? json ?? {};
    console.log(`has prebookId=${d.prebookId != null}  transactionId=${d.transactionId != null}  secretKey=${d.secretKey != null}  price=${d.price != null}  paymentTypes=${d.paymentTypes != null}`);
    console.log(`rawBody(first 1200): ${text.slice(0, 1200)}`);
  } catch (e) { console.log(`ERROR: ${e instanceof Error ? e.message : String(e)}`); }

  console.log(`\n══════════════════════════════════════════════════════════════`);
  console.log(`HOW TO READ:`);
  console.log(`  • STEP 3 topLevelKeys / data subKeys + rawBody → the EXACT prebook shape.`);
  console.log(`  • secretKey + transactionId present → the SDK handoff is available; PR-B2 inits the hosted SDK with secretKey, then books with transactionId.`);
  console.log(`  • Note WHERE they live (root vs data.*) so the prebook client maps them correctly.`);
  console.log(`  • If status 401/403 → production account not activated for booking — fix before PR-B2.`);
  console.log(`══════════════════════════════════════════════════════════════`);
}

main().catch((e) => { console.error('probe failed:', e); process.exit(1); });
