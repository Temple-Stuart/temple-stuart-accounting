// Diagnostic only — run: npx tsx scripts/probe-liteapi-content-reviews.ts
//
// Confirms the LIVE shapes the rich checkout box needs (PR-RC1/RC2), so we map
// real fields (no guessing): hotel CONTENT (photos + T&C), guest REVIEWS, and the
// prebook CANCELLATION policy. NOT wired into the app.
//
// Mirrors src/lib/liteapiClient.ts EXACTLY (same auth/base/mode as the app + the
// existing scripts/probe-liteapi-*.ts):
//   LITEAPI_BASE (:22), getMode() (:35-37), getApiKey() (:39-46), headers() (:48-53)
// offerId dig mirrors extractOfferId (:468-472); cancellation dig mirrors :672.
//
// Reads the SAME env vars: LITEAPI_MODE, LITEAPI_PRODUCTION_KEY (+ SANDBOX). Run:
//   LITEAPI_MODE=production npx tsx scripts/probe-liteapi-content-reviews.ts
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

/** Mirror extractOfferId (liteapiClient.ts:468-472). */
function firstOfferId(rateItem: any): string | null {
  for (const room of rateItem?.roomTypes || []) {
    if (room?.offerId) return room.offerId;
    for (const rate of room?.rates || []) if (rate?.offerId) return rate.offerId;
  }
  return null;
}
/** Mirror the prebook cancellation dig (liteapiClient.ts:672). */
function findCancellation(d: any): unknown {
  return d?.roomTypes?.[0]?.rates?.[0]?.cancellationPolicies ?? d?.cancellationPolicies ?? null;
}

async function main(): Promise<void> {
  console.log(`LiteAPI content/reviews/cancellation probe — base=${LITEAPI_BASE}`);
  console.log(`mode=${MODE} keyPrefix=${KEY_PREFIX} checkin=${CHECKIN} checkout=${CHECKOUT}`);
  if (KEY_PREFIX === 'none') {
    console.log(`\n!! No key for mode=${MODE}. Set LITEAPI_${MODE.toUpperCase()}_KEY (or LITEAPI_MODE).`);
    return;
  }

  // STEP 1 — catalog → a hotelId.
  banner('STEP 1 — GET /data/hotels?cityName=Canggu&countryCode=ID');
  let hotelId: string | null = null;
  try {
    const { status, json } = await getJson(`${LITEAPI_BASE}/data/hotels?cityName=Canggu&countryCode=ID`);
    const list: any[] = Array.isArray(json?.data) ? json.data : [];
    hotelId = list[0]?.id ?? list[0]?.hotelId ?? null;
    console.log(`status=${status}  catalogLen=${list.length}  hotelId=${hotelId ?? '(none)'}`);
  } catch (e) { console.log(`ERROR: ${e instanceof Error ? e.message : String(e)}`); }
  if (!hotelId) { console.log('\nNo hotelId — cannot continue.'); return; }

  // STEP 2 — /data/hotel → content shape (photos + T&C + facilities).
  banner('STEP 2 — GET /data/hotel?hotelId=<id> — CONTENT shape');
  try {
    const { status, json, text } = await getJson(`${LITEAPI_BASE}/data/hotel?hotelId=${encodeURIComponent(hotelId)}`);
    console.log(`status=${status}`);
    console.log(`topLevelKeys=${json ? JSON.stringify(Object.keys(json)) : '(non-JSON)'}`);
    const d = json?.data ?? json ?? {};
    console.log(`data subKeys=${JSON.stringify(Object.keys(d))}`);
    const imgs = Array.isArray(d.hotelImages) ? d.hotelImages : [];
    console.log(`hotelImages: count=${imgs.length}  first keys=${imgs[0] ? JSON.stringify(Object.keys(imgs[0])) : '(none)'}`);
    if (imgs[0]) console.log(`  image[0]: url=${imgs[0].url ? 'present' : 'ABSENT'}  urlHd=${imgs[0].urlHd ? 'present' : 'ABSENT'}  defaultImage=${imgs[0].defaultImage}`);
    console.log(`hotelDescription=${d.hotelDescription != null}  hotelImportantInformation(T&C)=${d.hotelImportantInformation != null}`);
    console.log(`hotelFacilities(len)=${Array.isArray(d.hotelFacilities) ? d.hotelFacilities.length : 'n/a'}  facilities(len)=${Array.isArray(d.facilities) ? d.facilities.length : 'n/a'}`);
    console.log(`starRating=${d.starRating}  rating=${d.rating}  reviewCount=${d.reviewCount}  stars=${d.stars}`);
    console.log(`rawBody(first 1000): ${text.slice(0, 1000)}`);
  } catch (e) { console.log(`ERROR: ${e instanceof Error ? e.message : String(e)}`); }

  // STEP 3 — /data/reviews → reviews shape (headline/pros/cons/score).
  banner('STEP 3 — GET /data/reviews?hotelId=<id>&limit=8 — REVIEWS shape');
  try {
    const { status, json, text } = await getJson(`${LITEAPI_BASE}/data/reviews?hotelId=${encodeURIComponent(hotelId)}&limit=8`);
    console.log(`status=${status}`);
    console.log(`topLevelKeys=${json ? JSON.stringify(Object.keys(json)) : '(non-JSON)'}`);
    const arr: any[] = Array.isArray(json?.data) ? json.data : [];
    console.log(`reviews count=${arr.length}`);
    const r0 = arr[0];
    if (r0) {
      console.log(`review[0] keys=${JSON.stringify(Object.keys(r0))}`);
      console.log(`  averageScore=${r0.averageScore}  name=${r0.name != null}  date=${r0.date != null}  headline=${r0.headline != null}  pros=${r0.pros != null}  cons=${r0.cons != null}  type=${r0.type != null}`);
    }
    console.log(`rawBody(first 800): ${text.slice(0, 800)}`);
  } catch (e) { console.log(`ERROR: ${e instanceof Error ? e.message : String(e)}`); }

  // STEP 4 — rate → offerId → prebook → the CANCELLATION shape specifically.
  banner('STEP 4 — POST /hotels/rates → offerId → /rates/prebook — CANCELLATION shape');
  try {
    const rateRes = await postJson(`${LITEAPI_BASE}/hotels/rates`, {
      hotelIds: [hotelId], checkin: CHECKIN, checkout: CHECKOUT,
      occupancies: [{ adults: 2 }], currency: 'USD', guestNationality: 'US',
    });
    const rates: any[] = Array.isArray(rateRes.json?.data) ? rateRes.json.data : [];
    const offerId = rates.length ? firstOfferId(rates[0]) : null;
    console.log(`rates status=${rateRes.status}  rateEntries=${rates.length}  offerId=${offerId ?? '(none)'}`);
    if (!offerId) { console.log(`(no offerId — cannot prebook; rates rawBody: ${rateRes.text.slice(0, 400)})`); return; }

    const pb = await postJson(`${LITEAPI_BASE}/rates/prebook`, { offerId, usePaymentSdk: true });
    console.log(`prebook status=${pb.status}  topLevelKeys=${pb.json ? JSON.stringify(Object.keys(pb.json)) : '(non-JSON)'}`);
    const d = pb.json?.data ?? pb.json ?? {};
    const cancel = findCancellation(d);
    console.log(`cancellationPolicies present=${cancel != null}`);
    if (cancel != null) {
      console.log(`cancellationPolicies keys=${typeof cancel === 'object' && !Array.isArray(cancel) ? JSON.stringify(Object.keys(cancel as object)) : (Array.isArray(cancel) ? `array(len=${(cancel as any[]).length})` : typeof cancel)}`);
      console.log(`cancellationPolicies RAW: ${JSON.stringify(cancel).slice(0, 800)}`);
    } else {
      console.log(`(no cancellationPolicies on data — checking roomTypes path; prebook rawBody first 800): ${pb.text.slice(0, 800)}`);
    }
  } catch (e) { console.log(`ERROR: ${e instanceof Error ? e.message : String(e)}`); }

  console.log(`\n══════════════════════════════════════════════════════════════`);
  console.log(`HOW TO READ:`);
  console.log(`  • STEP 2: which image field is populated (url vs urlHd) → the gallery source; T&C = hotelImportantInformation.`);
  console.log(`  • STEP 3: review[0] keys + pros/cons populated → what the reviews list renders (honest empty if count=0).`);
  console.log(`  • STEP 4: the cancellationPolicies RAW shape (refundableTag? cancelPolicyInfos[]?) → how to render the policy. It's FREE (prebook the panel already does).`);
  console.log(`  • Any 401/403 → production account not activated for that endpoint.`);
  console.log(`══════════════════════════════════════════════════════════════`);
}

main().catch((e) => { console.error('probe failed:', e); process.exit(1); });
