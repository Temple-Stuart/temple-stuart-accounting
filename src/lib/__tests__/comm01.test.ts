/**
 * COMM-01 (2026-09-26) — the commission is the vendor's stated figure, never a
 * zero, and it locks when the vendor says it locks.
 *
 * One test per proof the ruling names. The apply leaf and the locked read are
 * driven through fixtures shaped by GET /bookings/{id}; the routes' contracts
 * are read from source the way this repo proves a route it cannot execute
 * without a provider. No live vendor call.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { code, comments, functionBody } from '../sourceText';
import { applyVendorState, type ApplyPorts, type ApplyRow, type CommissionFigures, type ReservationPatch, type VendorHotelState } from '../reservations/applyVendorState';
import { applyLockedRead, type LockedReadPorts, type VendorAnswer, type VendorReadRow } from '../reservations/vendorRead';
import { parseBookResult, parseHotelBookingState } from '../liteapiClient';
import { BOOKING_READ } from '../arrivals/liteapiBooking';
import { FakeLanding } from './fakeLanding';

const APPLY = 'src/lib/reservations/applyVendorState.ts';
const READ_LEAF = 'src/lib/reservations/vendorRead.ts';
const REFRESH = 'src/lib/reservations/refreshFlightReservation.ts';
const HOTEL_BOOK = 'src/app/api/travel/liteapi/book/route.ts';
const FLIGHT_BOOK = 'src/app/api/travel/liteapi/flights/book/route.ts';
const HOTEL_CLIENT = 'src/lib/liteapiClient.ts';
const CONFIRM_PAGE = 'src/app/booking/confirm/page.tsx';
const PANEL = 'src/components/trips/CheckoutPanel.tsx';
const CRON_ROUTE = 'src/app/api/cron/reservations-refresh/route.ts';
const RETRO = 'scripts/status-01-retro-reservations.ts';
const MIGRATION = 'prisma/migrations/20260926150000_comm_01_vendor_commission/migration.sql';

const READ_AT = new Date('2026-09-26T10:00:00.000Z');
const ASKED = new Date('2026-09-26T09:59:59.500Z');
const CHECKED_OUT: ApplyRow = { id: 'res_h1', lane: 'hotel', status: 'confirmed', providerConfirmationCode: 'HCC-4421', ticketedAt: null, ticketLimitTime: null, cancelIntentAt: null, ticketedEmailSentAt: null, confirmationEmailSentAt: null, checkoutDate: new Date('2026-09-20') };

const vendor = (v: Partial<VendorHotelState> & { status: string | null }): VendorHotelState => ({
  lane: 'hotel', bookingId: 'hSq2gVDrf', hotelConfirmationCode: 'HCC-4421', commission: null, distributorCommission: null, clientCommission: null, processingFee: null, arrivalId: 'arr_read_1', readAt: READ_AT, ...v,
});

function fakeApplyPorts(lockAnswer = 1) {
  const writes: ReservationPatch[] = [];
  const locks: Array<{ id: string; figures: CommissionFigures; lockedAt: Date; arrivalId: string | null }> = [];
  const cancels: string[] = [];
  const marked: string[] = [];
  const log: string[] = [];
  const ports: ApplyPorts = {
    writeReservation: async (_id, patch) => { writes.push(patch); },
    calendar: { async markCancelled(_s, sourceId) { marked.push(sourceId); return 1; } },
    cancelCommission: async (id) => { cancels.push(id); return 1; },
    lockCommission: async (id, figures, lockedAt, arrivalId) => { locks.push({ id, figures, lockedAt, arrivalId }); return lockAnswer; },
    log: (line) => log.push(line),
  };
  return { ports, writes, locks, cancels, marked, log };
}

// ── the book routes ─────────────────────────────────────────────────────────

test('hotel book answer with commission 12.34 → row 1234, estimated; without the field → NULL with a named log, estimated', () => {
  assert.equal(parseBookResult({ bookingId: 'h', commission: 12.34 }).commission, 12.34, 'the vendor word, verbatim');
  assert.equal(Math.round(12.34 * 100), 1234, 'the cents the route writes');
  assert.equal(parseBookResult({ bookingId: 'h' }).commission, undefined, 'absent stays absent — the route records NULL');
  const r = code(HOTEL_BOOK);
  assert.match(r, /const statedCommission = typeof parsed\.commission === 'number' \? parsed\.commission : null;/, 'the vendor figure or null — no browser figure, no 0');
  assert.match(r, /commissionAmountCents: statedCommission === null \? null : Math\.round\(statedCommission \* 100\),/, 'NULL when unstated, cents when stated');
  assert.match(r, /COMM-01 the vendor stated NO commission on the book answer — commissionAmountCents recorded NULL/, 'named log');
  assert.match(r, /status: 'estimated',/);
  assert.ok(!/resolvedCommission|commissionAmountCents \/ 100|: 0\)/.test(r), 'the fallback chain is gone');
});

test('a book body carrying commissionAmountCents → 400 by name, before any vendor call or query', () => {
  const r = code(HOTEL_BOOK);
  const refuse = r.indexOf("Object.prototype.hasOwnProperty.call(body, 'commissionAmountCents')");
  assert.ok(refuse > 0, 'the refusal exists');
  assert.match(r, /\{ error: 'commissionAmountCents is not accepted — a client never states a ledger amount' \},\s*\{ status: 400 \}/);
  assert.ok(refuse < r.indexOf('prisma.users.findFirst'), 'before the account lookup');
  assert.ok(refuse < r.indexOf('bookRate('), 'before the vendor');
  assert.ok(!/commissionAmountCents\?: number/.test(r), 'not in the accepted body type');
  assert.ok(!/currency, commissionAmountCents,/.test(r), 'not destructured');
  assert.ok(!/commissionAmountCents/.test(code(CONFIRM_PAGE)), 'the confirm page posts none');
  assert.ok(!/params\.get\('commission'\)/.test(code(CONFIRM_PAGE)), 'and reads no commission param');
});

test('flight book → commissionAmountCents NULL, estimated, the reason from the docs by name', () => {
  const r = code(FLIGHT_BOOK);
  assert.match(r, /commissionAmountCents: null,/);
  assert.ok(!/commissionAmountCents: 0/.test(r));
  const c = comments(FLIGHT_BOOK);
  assert.match(c, /distributorCommission/);
  assert.match(c, /NOT DOCUMENTED/);
  assert.match(c, /never inferred from a markup/);
});

// ── the lock, through the one apply leaf ────────────────────────────────────

test('read after checkout, status CONFIRMED, commission stated → the ledger row locks: figures in cents, lockedAt = readAt, the read arrival as evidence', async () => {
  const f = fakeApplyPorts();
  const out = await applyVendorState(f.ports, CHECKED_OUT, vendor({ status: 'CONFIRMED', commission: 12.34, distributorCommission: 3.2, clientCommission: 9.14, processingFee: 0.5 }));
  assert.equal(out.status, 'unchanged', 'the row was already confirmed');
  assert.deepEqual(out.commissionLock, { outcome: 'locked', cents: 1234 });
  assert.deepEqual(f.locks, [{ id: 'res_h1', figures: { lockedCommissionCents: 1234, distributorCommissionCents: 320, clientCommissionCents: 914, processingFeeCents: 50 }, lockedAt: READ_AT, arrivalId: 'arr_read_1' }]);
  assert.ok(out.changes.some((c) => /commission locked at 1234 cents/.test(c)), 'named in the changes');
  assert.ok(f.log.some((l) => /commission LOCKED at 1234 cents/.test(l)));
  assert.deepEqual(f.writes, [{ lastVendorReadAt: READ_AT }], 'the reservation itself: only the read stamp');
  assert.equal(f.cancels.length, 0);
  // Unstated sub-figures stay NULL, never 0.
  const g = fakeApplyPorts();
  await applyVendorState(g.ports, CHECKED_OUT, vendor({ status: 'CONFIRMED', commission: 12.34 }));
  assert.deepEqual(g.locks[0].figures, { lockedCommissionCents: 1234, distributorCommissionCents: null, clientCommissionCents: null, processingFeeCents: null });
});

test('a second read after the lock → count 0 → already locked, nothing changes, no second log of a lock', async () => {
  const f = fakeApplyPorts(0);
  const out = await applyVendorState(f.ports, CHECKED_OUT, vendor({ status: 'CONFIRMED', commission: 12.34 }));
  assert.deepEqual(out.commissionLock, { outcome: 'already_locked', cents: 1234 });
  assert.deepEqual(out.changes, []);
  assert.deepEqual(out.emails, []);
  assert.ok(!f.log.some((l) => /LOCKED/.test(l)), 'no log of a lock');
  assert.ok(f.log.some((l) => /already locked, nothing changes/.test(l)));
  assert.deepEqual(f.writes, [{ lastVendorReadAt: READ_AT }]);
});

test('a stated 0 is stated: locked at 0, by name', async () => {
  const f = fakeApplyPorts();
  const out = await applyVendorState(f.ports, CHECKED_OUT, vendor({ status: 'CONFIRMED', commission: 0 }));
  assert.deepEqual(out.commissionLock, { outcome: 'locked', cents: 0 });
  assert.equal(f.locks[0].figures.lockedCommissionCents, 0);
  assert.ok(f.log.some((l) => /LOCKED at 0 cents — the vendor stated 0/.test(l)));
});

test('read BEFORE checkout with commission stated → no lock, the port is not called, status stays estimated', async () => {
  for (const checkoutDate of [new Date('2026-09-27'), new Date('2026-10-04'), null]) {
    const f = fakeApplyPorts();
    const out = await applyVendorState(f.ports, { ...CHECKED_OUT, checkoutDate }, vendor({ status: 'CONFIRMED', commission: 12.34 }));
    assert.deepEqual(out.commissionLock, { outcome: 'before_checkout' }, String(checkoutDate));
    assert.equal(f.locks.length, 0, 'the port is not called');
    assert.deepEqual(out.changes, []);
  }
  // The check-out day itself, read after that day's midnight UTC: the date is before the instant → the lock runs (the ruling's rule, exactly).
  const g = fakeApplyPorts();
  const out = await applyVendorState(g.ports, { ...CHECKED_OUT, checkoutDate: new Date('2026-09-25') }, vendor({ status: 'CONFIRMED', commission: 1 }));
  assert.equal(out.commissionLock.outcome, 'locked');
});

test('read after checkout with NO commission field → no lock, named log', async () => {
  const f = fakeApplyPorts();
  const out = await applyVendorState(f.ports, CHECKED_OUT, vendor({ status: 'CONFIRMED', commission: null }));
  assert.deepEqual(out.commissionLock, { outcome: 'not_stated' });
  assert.equal(f.locks.length, 0);
  assert.ok(f.log.some((l) => /the vendor stated no commission on the read after checkout — stays estimated/.test(l)));
});

test('read after checkout, status CANCELLED → the cancel move, never a lock; a locked commission on a vendor-cancelled booking is left as is, by name', async () => {
  const f = fakeApplyPorts();
  const out = await applyVendorState(f.ports, CHECKED_OUT, vendor({ status: 'CANCELED', commission: 12.34 }));
  assert.equal(out.statusValue, 'cancelled');
  assert.deepEqual(f.cancels, ['res_h1'], 'the cancel move');
  assert.equal(f.locks.length, 0, 'never a lock');
  assert.deepEqual(out.commissionLock, { outcome: 'not_applicable' });
  // The estimated row was already locked ('confirmed'): the cancel move finds nothing and says so.
  const g = fakeApplyPorts();
  g.ports.cancelCommission = async () => 0;
  await applyVendorState(g.ports, CHECKED_OUT, vendor({ status: 'CANCELED', commission: 12.34 }));
  assert.ok(g.log.some((l) => /already locked \('confirmed'\) on a booking the vendor cancelled after checkout is left as is; the vendor documents no reversal/.test(l)));
  // A flight never locks (NOT DOCUMENTED): the lane gate comes first.
  const h = fakeApplyPorts();
  const flight = await applyVendorState(h.ports, { ...CHECKED_OUT, id: 'res_f1', lane: 'flight', checkoutDate: null }, { lane: 'flight', bookingId: 'fb_9Q', status: 'CONFIRMED', pnr: null, ticketedAt: null, ticketLimitTime: null, cancelIntentAt: null, readAt: READ_AT });
  assert.deepEqual(flight.commissionLock, { outcome: 'not_applicable' });
  assert.equal(h.locks.length, 0);
  assert.match(code(REFRESH), /a flight locks no commission — NOT DOCUMENTED \(COMM-01\)/, 'the refresh names it');
});

test('the locked read: the lock port writes the figures, the read instant and THE READ ARRIVAL as evidence; a second read is already locked', async () => {
  const landing = new FakeLanding();
  const locks: Array<{ id: string; figures: CommissionFigures; lockedAt: Date; arrivalId: string | null }> = [];
  let answer = 1;
  const row: VendorReadRow = {
    id: 'res_h1', userId: 'u_1', bookingType: 'account', guestEmail: null, provider: 'liteapi', lane: 'hotel', displayName: 'Hotel Temple', providerBookingId: 'hSq2gVDrf', providerConfirmationCode: 'HCC-4421', status: 'confirmed',
    checkinDate: new Date('2026-09-17'), checkoutDate: new Date('2026-09-20'), cancelIntentAt: null, ticketedAt: null, ticketLimitTime: null, lastVendorReadAt: null, ticketedEmailSentAt: null, confirmationEmailSentAt: null, createdAt: new Date('2026-09-01'),
  };
  const ports: LockedReadPorts = {
    lock: async () => row,
    landing: { landing, now: () => READ_AT },
    apply: {
      writeReservation: async () => {},
      calendar: { async markCancelled() { return 0; } },
      cancelCommission: async () => 0,
      lockCommission: async (id, figures, lockedAt, arrivalId) => { locks.push({ id, figures, lockedAt, arrivalId }); return answer; },
    },
    calendar: { async find() { return true; }, async insert() {}, async markCancelled() { return 0; } },
  };
  const object = { bookingId: 'hSq2gVDrf', status: 'CONFIRMED', hotelConfirmationCode: 'HCC-4421', commission: 12.34, distributorCommission: 3.2, clientCommission: 9.14, processingFee: 0.5, sellingPrice: '150.00' };
  const text = JSON.stringify({ data: object });
  const read: VendorAnswer = { answer: { httpStatus: 200, body: Buffer.from(text, 'utf8'), asked: ASKED, arrived: READ_AT, json: JSON.parse(text) }, object };
  const first = await applyLockedRead(ports, { id: 'res_h1', lane: 'hotel', providerBookingId: 'hSq2gVDrf' }, read, READ_AT);
  const arrival = landing.rowsOf(BOOKING_READ)[0].row.id;
  assert.deepEqual(first.commissionLock, { outcome: 'locked', cents: 1234 });
  assert.deepEqual(locks, [{ id: 'res_h1', figures: { lockedCommissionCents: 1234, distributorCommissionCents: 320, clientCommissionCents: 914, processingFeeCents: 50 }, lockedAt: READ_AT, arrivalId: arrival }], 'the evidence is the landed read arrival');
  answer = 0;
  const second = await applyLockedRead(ports, { id: 'res_h1', lane: 'hotel', providerBookingId: 'hSq2gVDrf' }, read, READ_AT);
  assert.deepEqual(second.commissionLock, { outcome: 'already_locked', cents: 1234 });
  assert.deepEqual(second.changes, []);
  assert.equal(landing.rowsOf(BOOKING_READ).length, 1, 'the same state again is already_landed');
  // The production port shape: 'estimated' → 'confirmed' with exactly these columns.
  const r = code(READ_LEAF);
  assert.match(r, /lockCommission: async \(reservationId, figures, lockedAt, arrivalId\) => \(await tx\.commission_ledger\.updateMany\(\{\s*where: \{ reservationId, status: 'estimated' \},\s*data: \{\s*status: 'confirmed',\s*lockedCommissionCents: figures\.lockedCommissionCents,\s*distributorCommissionCents: figures\.distributorCommissionCents,\s*clientCommissionCents: figures\.clientCommissionCents,\s*processingFeeCents: figures\.processingFeeCents,\s*lockedAt,\s*lockArrivalId: arrivalId,\s*\},\s*\}\)\)\.count,/);
  assert.match(r, /arrivalId: landed\.arrivalId,/, 'the read leaf hands the landed arrival to the leaf');
});

test('the hotel read parser states the documented figures verbatim, null when absent', () => {
  const s = parseHotelBookingState({ bookingId: 'h', status: 'CONFIRMED', commission: 12.34, distributorCommission: 3.2, clientCommission: 9.14, processingFee: 0.5, sellingPrice: '150.00' });
  assert.deepEqual([s.commission, s.distributorCommission, s.clientCommission, s.processingFee, s.sellingPrice], [12.34, 3.2, 9.14, 0.5, '150.00']);
  const none = parseHotelBookingState({ bookingId: 'h', status: 'CONFIRMED' });
  assert.deepEqual([none.commission, none.distributorCommission, none.clientCommission, none.processingFee, none.sellingPrice], [null, null, null, null, null]);
  assert.equal(parseHotelBookingState({ bookingId: 'h', commission: '12' }).commission, null, 'a non-number is not a figure');
});

// ── the readers, the client, the cron, the retro ───────────────────────────

test('every reader renders NULL as not stated — the checkout panel, the prebook parser; no literal 0 commission anywhere in src', () => {
  assert.match(code(PANEL), /prebook\.commission === null \? 'not stated' : money\(prebook\.commission, prebook\.currency\)/);
  assert.ok(!/prebook\.commission > 0 &&/.test(code(PANEL)), 'no longer hidden as if zero');
  assert.match(code(PANEL), /commission: number \| null;/);
  const client = code(HOTEL_CLIENT);
  assert.match(client, /commission: typeof d\.commission === 'number' \? d\.commission : null,/, 'the prebook states null');
  assert.match(client, /commission: number \| null;/);
  assert.ok(!/commission: d\.commission \?\? 0/.test(client));
  const files: string[] = [];
  const walk = (dir: string) => {
    for (const name of readdirSync(dir)) {
      const p = join(dir, name);
      if (statSync(p).isDirectory()) { if (name !== 'node_modules' && name !== '__tests__') walk(p); }
      else if (/\.tsx?$/.test(name)) files.push(p);
    }
  };
  walk('src');
  const zeros = files.filter((f) => /commissionAmountCents: 0\b|commission \?\? 0|commission: 0\b|commissionAmountCents \?\? 0/.test(code(f)));
  assert.deepEqual(zeros, [], 'no literal 0 commission');
  const writers = files.filter((f) => /commissionAmountCents:/.test(code(f))).sort();
  assert.deepEqual(writers, [FLIGHT_BOOK, HOTEL_BOOK].sort(), 'the two book routes are the only writers of the book-time figure');
  // AUDIT-01 (2026-09-26): the timeline words leaf names the locked figure to SAY it (a row type's field and
  // the facts handed to its words) — it cannot write: it is pure (no prisma), proven here and by the audit law.
  const TIMELINE_LEAF = 'src/lib/reservations/timeline.ts';
  assert.ok(!/prisma|^\s*import\s/m.test(code(TIMELINE_LEAF)), 'the timeline leaf reaches no database');
  const lockers = files.filter((f) => /lockedCommissionCents:/.test(code(f)) && f !== TIMELINE_LEAF).sort();
  assert.deepEqual(lockers, [APPLY, READ_LEAF].sort(), 'the apply leaf shapes the figures; the read leaf writes them');
});

test('the cron reads a checked-out stay once more to lock; the retro prints the lock', () => {
  const r = code(CRON_ROUTE);
  assert.match(r, /\{ lane: 'hotel', status: 'confirmed', checkoutDate: \{ lt: new Date\(\) \}, commission_ledger: \{ some: \{ status: 'estimated' \} \} \},/);
  assert.match(comments(CRON_ROUTE), /The lock arm adds at most ONE read per checked-out stay/, 'the arithmetic restated');
  assert.match(r, /const BATCH = 20;/, 'BATCH kept');
  assert.match(code(RETRO), /commissionLock/, 'the retro prints the lock');
  assert.match(code(RETRO), /readAndApplyReservation\(row, \{ source: 'retro'/, 'no second retro — the one leaf');
});

test('the apply leaf: the lock rule exactly — lane hotel, mapped confirmed, checkoutDate < readAt, a stated commission; no clock', () => {
  const leaf = code(APPLY);
  assert.match(leaf, /if \(vendor\.lane === 'hotel' && mapped === 'confirmed'\) \{\s*const afterCheckout = row\.checkoutDate !== null && row\.checkoutDate < vendor\.readAt;/);
  assert.match(leaf, /else if \(vendor\.commission === null\) \{\s*commissionLock = \{ outcome: 'not_stated' \};/);
  assert.match(leaf, /await ports\.lockCommission\(row\.id, figures, vendor\.readAt, vendor\.arrivalId\)/);
  assert.ok(!/new Date\(\)/.test(leaf), 'no clock in the leaf');
  assert.ok(!/\* 0\.|margin|markup/.test(functionBody(leaf, 'applyVendorState') ?? ''), 'nothing computed from a price and a margin');
});

test('the migration: commissionAmountCents nullable, the six lock columns, the RESTRICT evidence key, the four-word CHECK; no default, no backfill; the schema follows', () => {
  const sql = code(MIGRATION);
  for (const must of [
    'ALTER TABLE "commission_ledger" ALTER COLUMN "commissionAmountCents" DROP NOT NULL;',
    'ADD COLUMN "lockedCommissionCents"      INTEGER;', 'ADD COLUMN "distributorCommissionCents" INTEGER;', 'ADD COLUMN "clientCommissionCents"      INTEGER;', 'ADD COLUMN "processingFeeCents"         INTEGER;',
    'ADD COLUMN "lockedAt"                   TIMESTAMPTZ(6);', 'ADD COLUMN "lockArrivalId"              TEXT;',
    'FOREIGN KEY ("lockArrivalId") REFERENCES "arrivals"("id") ON DELETE RESTRICT',
    `CHECK ("status" IN ('estimated', 'confirmed', 'paid', 'cancelled'))`,
  ]) assert.ok(sql.includes(must), must);
  assert.ok(!/DEFAULT/.test(sql), 'no default');
  assert.ok(!/^\s*UPDATE\b/im.test(sql), 'no backfill');
  assert.match(comments(MIGRATION), /SELECT status, count\(\*\) FROM commission_ledger GROUP BY 1;/, 'the pre-flight query for Alex');
  const schema = code('prisma/schema.prisma');
  const at = schema.indexOf('\nmodel commission_ledger {');
  const block = schema.slice(at, schema.indexOf('\n}', at));
  assert.match(block, /\n  commissionAmountCents Int\?\n/);
  for (const col of ['lockedCommissionCents', 'distributorCommissionCents', 'clientCommissionCents', 'processingFeeCents']) assert.match(block, new RegExp(`\\n  ${col}\\s+Int\\?\\n`), col);
  assert.match(block, /lockedAt\s+DateTime\? @db\.Timestamptz\(6\)/);
  assert.match(block, /lockArrival arrivals\?\s+@relation\("commission_lock", fields: \[lockArrivalId\], references: \[id\], onDelete: Restrict/);
});
