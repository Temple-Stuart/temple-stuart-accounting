/**
 * LAW-02 (2026-09-27) — no fabricated default, no dead config, no schema drift.
 *
 * One test per item the ruling proves here: the prebook with no price is a named
 * failure and never $0.00 (the real parser against a stubbed vendor answer, and the
 * panel's order read from source); the rating is NULL and reads "not rated"; the
 * bank currency is stated or NULL; the dead cron is gone and the returnUrl carries
 * no commission; the document freeze migration; the small truths. Item 4's proof is
 * in comm01.test.ts (the grace), item 6's scratch-Postgres run is in the PR.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { code, comments } from '../sourceText';
import { liteApiHotelToRecommendation, prebookRate } from '../liteapiClient';

/** The mapper's own input type (the client does not export it). */
type LiteApiHotelRate = Parameters<typeof liteApiHotelToRecommendation>[0];
import { prebookUnstatedMoney } from '../checkout/prebookGate';
import { lowestFareLine } from '../flights/fares';

/** Run prebookRate against one stubbed vendor answer — no network, no key of consequence. */
async function prebookOver(answer: unknown) {
  const realFetch = globalThis.fetch;
  const realKey = process.env.LITEAPI_SANDBOX_KEY;
  const realMode = process.env.LITEAPI_MODE;
  process.env.LITEAPI_SANDBOX_KEY = 'sand_test_key';
  delete process.env.LITEAPI_MODE;
  globalThis.fetch = (async () => new Response(JSON.stringify(answer), { status: 200, headers: { 'Content-Type': 'application/json' } })) as typeof fetch;
  try {
    return await prebookRate({ offerId: 'off_1' });
  } finally {
    globalThis.fetch = realFetch;
    if (realKey === undefined) delete process.env.LITEAPI_SANDBOX_KEY; else process.env.LITEAPI_SANDBOX_KEY = realKey;
    if (realMode !== undefined) process.env.LITEAPI_MODE = realMode;
  }
}

test('item 1 — a prebook with NO price and NO currency parses to NULL, never $0.00 USD, and the gate names it', async () => {
  const bare = await prebookOver({ data: { prebookId: 'pb_1', hotelId: 'h_1', offerId: 'off_1', transactionId: 'tx_1', secretKey: 'sk_1' } });
  assert.equal(bare.price, null, 'no price stated → NULL, not 0');
  assert.equal(bare.currency, null, "no currency stated → NULL, not 'USD'");
  assert.equal(prebookUnstatedMoney(bare), 'a price and a currency');
  const stated = await prebookOver({ data: { prebookId: 'pb_2', hotelId: 'h_1', offerId: 'off_1', price: 180, currency: 'EUR', transactionId: 'tx_2', secretKey: 'sk_2' } });
  assert.equal(stated.price, 180);
  assert.equal(stated.currency, 'EUR');
  assert.equal(prebookUnstatedMoney(stated), null, 'a stated hold passes');
  assert.equal(prebookUnstatedMoney({ price: 0, currency: 'USD' }), null, 'a STATED 0 is stated');
  assert.equal(prebookUnstatedMoney({ price: 180, currency: '' }), 'a currency');
  assert.equal(prebookUnstatedMoney({ price: Number.NaN, currency: 'USD' }), 'a price');
});

test('item 1 — the checkout refuses an unstated price BY NAME before any card form; the returnUrl carries no commission', () => {
  const panel = code('src/components/trips/CheckoutPanel.tsx');
  const gateAt = panel.indexOf('const unstatedMoney = prebookUnstatedMoney(p);');
  const setAt = panel.indexOf('setPrebook(p as Prebook);');
  const payAt = panel.indexOf("setPhase('pay');");
  assert.ok(gateAt > 0 && gateAt < setAt && setAt < payAt, 'the gate runs before the hold is kept and before the pay phase');
  const block = panel.slice(gateAt, setAt);
  assert.match(block, /if \(unstatedMoney\) \{\s*if \(!cancelled\) \{\s*fail\(\{\s*kind: 'prebook',\s*message: 'This rate cannot be paid — the vendor stated no price for it\.',\s*detail: `The hold came back without \$\{unstatedMoney\}, so no card is asked for\. Nothing was charged\.`,/);
  assert.match(block, /\}\s*return;\s*\}/, 'and the flow stops there');
  // The price is only ever printed in the pay phase — which a refused hold never reaches.
  assert.match(panel, /money\(prebook\.price, prebook\.currency\)/);
  const q = panel.slice(panel.indexOf('const q = new URLSearchParams({'), panel.indexOf('const returnUrl ='));
  assert.doesNotMatch(q, /\bcommission:/, 'no commission param — /booking/confirm reads none');
  assert.doesNotMatch(code('src/app/booking/confirm/page.tsx'), /get\('commission'\)/);
});

const HOTEL: LiteApiHotelRate = { hotelId: 'lp_1', hotel: { name: 'Ibis Kata' }, roomTypes: [] } as unknown as LiteApiHotelRate;

test('item 1 — an unstated hotel rating is NULL with everything derived from it; an unstated review count is excluded and the weights re-normalized', () => {
  const unrated = liteApiHotelToRecommendation(HOTEL, 0, 'accommodation');
  assert.equal(unrated.googleRating, null, 'not 0 — a 0 rating is a claim');
  assert.equal(unrated.reviewCount, null);
  assert.equal(unrated.sentiment, null, 'no rating, no "negative"');
  assert.equal(unrated.sentimentScore, null);
  assert.equal(unrated.fitScore, null);
  assert.equal(unrated.compositeScore, null, 'nothing to rank on');
  const noReviews = liteApiHotelToRecommendation({ ...HOTEL, hotel: { name: 'Ibis Kata', rating: 9 } } as unknown as LiteApiHotelRate, 0, 'accommodation');
  assert.equal(noReviews.googleRating, 4.5, 'a 0-10 rating on the 0-5 scale');
  assert.equal(noReviews.reviewCount, null);
  // fit 9 → mandateFit 90; quality EXCLUDED; (90·0.40 + 75·0.25) / 0.65 = 84.23 → 84.
  assert.equal(noReviews.compositeScore, 84);
  const full = liteApiHotelToRecommendation({ ...HOTEL, hotel: { name: 'Ibis Kata', rating: 4.2, reviewCount: 1000 } } as unknown as LiteApiHotelRate, 0, 'accommodation');
  assert.equal(full.googleRating, 4.2);
  assert.equal(full.sentiment, 'neutral');
  assert.equal(typeof full.compositeScore, 'number');
  // LEGACY-DEL-01 (2026-09-29): the AI assistant route that ranked a NULL composite last was deleted with the
  // legacy trip planner; the NULL itself is still the client's, checked above.
});

// LEGACY-DEL-01 (2026-09-29): 'the planner says "not rated"…' went with the planner and its words leaf
// (src/components/trips/TripPlannerAI.tsx, src/lib/travel/ratingWords.ts) — the only code it exercised was deleted.

test('item 1 — Plaid\'s account currency is stored as stated or NULL; the refund pass EXCLUDES the amount on NULL; a flight with no outbound is never "nonstop"', () => {
  const exchange = code('src/app/api/plaid/exchange-token/route.ts');
  assert.match(exchange, /isoCurrencyCode: account\.balances\.iso_currency_code \?\? null,/);
  assert.doesNotMatch(exchange, /iso_currency_code \|\| 'USD'/);
  const matcher = code('src/lib/runway/reservationMatcher.ts');
  assert.match(matcher, /accountCurrency: string \| null;/);
  assert.match(matcher, /amount: EXCLUDED — the account currency is not stated \(accounts\.isoCurrencyCode NULL\)/);
  // A group whose representative states no outbound: the line keeps the price and says nothing about stops.
  const fare = { price: 41.46, currency: 'USD' } as never;
  const line = lowestFareLine({ fare, group: { representative: { outboundSegments: [], outbound: undefined } } as never });
  assert.ok(line !== null && !/nonstop|stop/.test(line), line ?? '');
});

test('item 3 — the dead cron is gone from vercel.json; its route is untouched', () => {
  const vercel = JSON.parse(code('vercel.json')) as { crons: Array<{ path: string; schedule: string }> };
  assert.deepEqual(vercel.crons, [{ path: '/api/cron/reservations-refresh', schedule: '0 * * * *' }]);
  const route = code('src/app/api/cron/auto-categorize/route.ts');
  assert.match(route, /export async function POST\(/, 'the route itself stays as it was — POST only');
});

test('item 6 — the document freeze replaces the trigger function: NULL → set allowed, set → other or NULL refused, every old freeze kept', () => {
  const sql = code('prisma/migrations/20260927210000_law_02_document_freeze/migration.sql');
  const original = code('prisma/migrations/20260227000100_protect_journal_entries/migration.sql');
  assert.match(sql, /CREATE OR REPLACE FUNCTION prevent_journal_entry_mutation\(\)/);
  assert.doesNotMatch(sql, /DROP TRIGGER|DROP FUNCTION|UPDATE journal_entries|DELETE FROM/i);
  for (const m of original.matchAll(/NEW\.("?\w+"?) IS DISTINCT FROM OLD\.\1/g)) assert.ok(sql.includes(m[0]), `${m[1]} stays frozen`);
  assert.match(sql, /\(OLD\.document_reservation_id IS NOT NULL AND NEW\.document_reservation_id IS DISTINCT FROM OLD\.document_reservation_id\)/);
  assert.match(sql, /\(OLD\.document_money_event_id IS NOT NULL AND NEW\.document_money_event_id IS DISTINCT FROM OLD\.document_money_event_id\)/);
  assert.match(comments('prisma/migrations/20260927210000_law_02_document_freeze/migration.sql'), /NULL → a value is still allowed/);
});

test('item 7 — the timeline note tells the AUDIT-01b truth; DTSTAMP is read as an instant', () => {
  const note = comments('src/app/api/reservations/[id]/timeline/route.ts');
  assert.doesNotMatch(note, /readable from the owner's audit log\./);
  assert.match(note, /they are NOT readable from the owner's audit\s+\*?\s*log/);
  const ports = code('src/lib/calendar/prismaIcsPorts.ts');
  assert.match(ports, /SELECT id::text AS id, \(updated_at AT TIME ZONE current_setting\('TimeZone'\)\) AS updated_at/);
  assert.doesNotMatch(ports, /updated_at: true/, 'the typed read never takes the timestamp-without-zone as UTC');
});
