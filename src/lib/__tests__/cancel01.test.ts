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
