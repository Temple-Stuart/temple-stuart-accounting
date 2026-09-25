/**
 * CANCEL-01 (2026-09-26) — a cancel goes to the right endpoint, shows the quote
 * first, and keeps the money facts.
 *
 * COMMIT 1 — THE GUARD. The cancel route reads the lane and refuses anything but
 * a hotel BY NAME before any vendor call; both lists offer Cancel on the hotel
 * lane only. The route cannot be executed here (a database and a vendor), so its
 * contract is read from source through the reader, the way this repo proves a
 * route it cannot run.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { code, comments } from '../sourceText';

const ROUTE = 'src/app/api/reservations/[id]/cancel/route.ts';
const LISTS = ['src/components/trips/TripBookings.tsx', 'src/components/trips/UnattachedBookings.tsx'];

test('COMMIT 1: a confirmed FLIGHT row → 409 by name (cancel_lane_unsupported), before any vendor call', () => {
  const src = code(ROUTE);
  // The lane is READ off the row the auth chain scoped.
  assert.match(src, /select: \{ id: true, status: true, provider: true, providerBookingId: true, lane: true \}/, 'the lane is selected');
  // The gate, by name, and its place: after the status gate, before the ONLY vendor call.
  const gate = src.indexOf("if (owned.lane !== 'hotel') {");
  const named = src.indexOf("code: 'cancel_lane_unsupported'");
  const statusGate = src.indexOf("if (owned.status !== 'confirmed') {");
  const vendor = src.indexOf('await cancelBooking(owned.providerBookingId)');
  assert.ok(gate > 0 && named > gate, 'the refusal is named');
  assert.ok(statusGate > 0 && statusGate < gate, 'after the ownership and status gates');
  assert.ok(vendor > 0 && named < vendor, 'and BEFORE the vendor call — zero vendor calls for a flight');
  assert.match(src.slice(named - 400, named + 120), /\{ status: 409 \}/, 'a 409, not a 404 that would deny the row');
  // Only one vendor call exists in the file, and it is the HOTEL client's.
  assert.equal((src.match(/await cancelBooking\(/g) ?? []).length, 1, 'exactly one vendor call');
  assert.match(src, /import \{ cancelBooking, parseCancelResult \} from '@\/lib\/liteapiClient';/, 'the hotel client');
  assert.ok(!src.includes('liteapiFlightsClient'), 'COMMIT 1 reaches no flight endpoint at all');
  // The header tells the truth now.
  const head = comments(ROUTE);
  assert.match(head, /HOTELS — single-step provider cancel through/, 'the header names the hotel client');
  assert.ok(!/provider 'liteapi' \(hotels and flights\)/.test(head), 'and no longer claims flights');
});

test('COMMIT 1: both lists offer Cancel on the HOTEL lane only, through the one reader', () => {
  for (const f of LISTS) {
    const src = code(f);
    assert.match(src, /r\.type === 'hotel' && r\.status === 'confirmed' && \(/, `${f}: hotel lane, confirmed`);
    assert.ok(!src.includes("r.provider === 'liteapi' && r.status === 'confirmed'"), `${f}: the provider gate is gone — LiteAPI is both rails`);
    // `type` is the lane word from reservationIdentity — the lists never read .lane raw.
    assert.ok(!/\.lane\b/.test(src), `${f}: no raw lane read`);
  }
});

// ── COMMIT 2 — THE MONEY-EVENTS TABLE (the migration, read; it applies at deploy) ──

const MIGRATION = 'prisma/migrations/20260926090000_cancel_01_money_events/migration.sql';

test('COMMIT 2: money_events — a money fact cannot exist without its arrival (NOT NULL + FK), no default on any stated field, RESTRICT on the reservation', () => {
  const sql = code(MIGRATION);
  const table = sql.slice(sql.indexOf('CREATE TABLE "money_events"'), sql.indexOf('CREATE TABLE "vouchers"'));
  assert.match(table, /"arrivalId"\s+TEXT\s+NOT NULL,/, 'arrivalId NOT NULL');
  assert.match(table, /FOREIGN KEY \("arrivalId"\) REFERENCES "arrivals"\("id"\) ON DELETE RESTRICT/, 'and a foreign key to arrivals');
  assert.match(table, /FOREIGN KEY \("reservationId"\) REFERENCES "reservations"\("id"\) ON DELETE RESTRICT/, 'the reservation is RESTRICT');
  assert.match(table, /"amountCents"\s+INTEGER,/, 'amountCents nullable, no default');
  for (const stated of ['reservationId', 'lane', 'kind', 'amountCents', 'currency', 'refundDestination', 'status', 'vendorReference', 'arrivalId', 'statedAt']) {
    const line = table.split('\n').find((l) => l.includes(`"${stated}"`) && !l.includes('CONSTRAINT') && !l.includes('INDEX') && !l.includes('FOREIGN'))!;
    assert.ok(line && !/DEFAULT/i.test(line), `${stated}: no default`);
  }
  assert.match(table, /CHECK \("kind" IN \('charge', 'refund', 'cancellation_fee', 'change_fee', 'servicing_fee', 'ticketing_fee', 'voucher_issued'\)\)/);
  assert.match(table, /CHECK \("status" IN \('stated', 'settled'\)\)/);
  assert.match(table, /CHECK \("refundDestination" IS NULL OR "refundDestination" IN \('original_payment', 'agency_deposit', 'voucher', 'bsp_settlement', 'manual', 'unknown'\)\)/, 'the vendor enum, verbatim');
  assert.doesNotMatch(sql, /^\s*UPDATE\b/im, 'nothing backfilled');
  // The schema moves with it.
  const schema = code('prisma/schema.prisma');
  assert.match(schema, /\nmodel money_events \{/);
  assert.match(schema, /\n  arrivalId\s+String\n/, 'arrivalId is required in the model');
  assert.match(schema, /\n  amountCents\s+Int\?\n/, 'amountCents nullable in the model');
  assert.match(schema, /\n  cancelIntentAt\s+DateTime\? @db\.Timestamptz\(6\)/, 'reservations.cancelIntentAt');
});

test('COMMIT 2: vouchers — a table, queryable by expiry; passengerNames NULL when not stated', () => {
  const sql = code(MIGRATION);
  const table = sql.slice(sql.indexOf('CREATE TABLE "vouchers"'));
  assert.match(table, /"expiresAt"\s+DATE,/);
  assert.match(table, /CREATE INDEX "vouchers_expiresAt_idx" ON "vouchers"\("expiresAt"\)/, 'expiry is indexed — the reason it is a table');
  assert.match(table, /"passengerNames"\s+JSONB,/, 'NULL when not stated, never a fabricated []');
  assert.match(table, /"arrivalId"\s+TEXT\s+NOT NULL,/);
  assert.match(table, /FOREIGN KEY \("arrivalId"\) REFERENCES "arrivals"\("id"\) ON DELETE RESTRICT/);
  assert.match(sql, /ALTER TABLE "reservations" ADD COLUMN "cancelIntentAt" TIMESTAMPTZ\(6\);/);
  // The status vocabularies were VERIFIED unconstrained, and the migration says so.
  assert.match(comments(MIGRATION), /reservations\.status has NO CHECK constraint/);
  // The reader keeps the SQL comment markers, so a line break inside the sentence reads `\n--    `.
  assert.match(comments(MIGRATION), /commission_ledger\.status has NO[\s-]+CHECK/);
});
