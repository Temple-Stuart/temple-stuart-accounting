/**
 * SEC-03 (2026-09-25) — no PII in a URL, no fabricated number in a ledger.
 *
 * The pure leaves (the matcher, the two email templates, the status mapping) are
 * driven directly. The routes and the panel cannot be executed here (a provider,
 * a database and a browser), so their contract is read from source through the
 * reader — the way this repo proves a route it cannot run.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { code, comments } from '../sourceText';
import { proposeMatches } from '../runway/reservationMatcher';
import { flightConfirmation } from '../emailTemplates/flightConfirmation';
import { bookingConfirmation } from '../emailTemplates/bookingConfirmation';
import { flightProviderStatusToReservation } from '../reservations/flightStatus';

const PREBOOK = 'src/app/api/travel/liteapi/flights/prebook/route.ts';
const FBOOK = 'src/app/api/travel/liteapi/flights/book/route.ts';
const HBOOK = 'src/app/api/travel/liteapi/book/route.ts';
const PANEL = 'src/components/trips/LiteApiFlightCheckoutPanel.tsx';
const FCONFIRM = 'src/app/booking/flight-confirm/page.tsx';
const HCONFIRM = 'src/app/booking/confirm/page.tsx';

const OPTS = { amountTolerancePct: 0.05, dateWindowDays: 3 };
const TXN = { id: 't1', amount: 432.1, date: '2026-09-20', name: 'NUITEE FLIGHTS', pending: false };
const RES = { id: 'r1', finalPriceCents: 43210, currency: 'USD', provider: 'liteapi', hotelName: null, createdAt: '2026-09-20' };

// ── the matcher ─────────────────────────────────────────────────────────────

test('matcher: a NULL price EXCLUDES the amount signal, says so, and re-normalizes over date + descriptor', () => {
  const [p] = proposeMatches({ reservations: [{ ...RES, finalPriceCents: null }], transactions: [TXN], opts: OPTS });
  assert.ok(p, 'a proposal still comes from date + descriptor');
  assert.match(p.rationale, /amount: EXCLUDED — reservation price not stated by the vendor \(NULL recorded\)/);
  assert.doesNotMatch(p.rationale, /booked \$/, 'no amount is compared');
  // date 0d (score 1) and descriptor hit (score 1) over weights 0.3 + 0.2 → 1.0.
  assert.equal(p.confidence, 1, 'the excluded weight is redistributed, never scored as neutral');
  assert.ok(!Number.isNaN(p.confidence));
});

test('matcher: a REAL 0 is an amount — against a positive charge it is a contradiction, not a wildcard', () => {
  const out = proposeMatches({ reservations: [{ ...RES, finalPriceCents: 0 }], transactions: [TXN], opts: OPTS });
  assert.equal(out.length, 0, 'a $0 booking does not match a $432.10 charge');
});

test('matcher: a stated price still matches as before, and the rationale names both figures', () => {
  const [p] = proposeMatches({ reservations: [RES], transactions: [TXN], opts: OPTS });
  assert.ok(p);
  assert.match(p.rationale, /amount: \$432\.10 vs booked \$432\.10/);
  assert.equal(p.confidence, 1);
});

test('matcher: the "0 = unknown" reading is gone from the source', () => {
  const src = code('src/lib/runway/reservationMatcher.ts');
  assert.match(src, /const amountKnown = r\.finalPriceCents !== null;/);
  assert.doesNotMatch(src, /finalPriceCents > 0/);
  assert.doesNotMatch(comments('src/lib/runway/reservationMatcher.ts'), /0 = price unknown/);
});

// ── the templates ───────────────────────────────────────────────────────────

const BOOKED = { passengerName: 'Ada Lovelace', passengerCount: 1, bookingId: 'fb_9Q', bookingRef: 'FH-269-ABCDEFGH', pnr: 'PNR123', totalAmountCents: null, currency: 'USD', status: 'CONFIRMED' };

test('flight template: a NULL total says "price not stated" — never 0.00, never NaN, never a dropped line', () => {
  const r = flightConfirmation(BOOKED);
  assert.match(r.text, /Total charged: price not stated by the airline/);
  assert.match(r.html, /price not stated by the airline/);
  for (const bad of ['0.00', 'NaN', 'USD 0', 'null', 'undefined']) assert.ok(!r.text.includes(bad), `no "${bad}"`);
  // A stated total renders exactly as before.
  assert.ok(flightConfirmation({ ...BOOKED, totalAmountCents: 43210 }).text.includes('Total charged: USD 432.10'));
  assert.throws(() => flightConfirmation({ ...BOOKED, totalAmountCents: 432.105 }), /integer number of cents/);
});

test('hotel template: the same — a NULL total is said, a stated one is exact', () => {
  const base = { guestName: 'Ada', hotelName: 'Hotel X', checkinDate: '2026-10-01', checkoutDate: '2026-10-03', confirmationCode: null, bookingId: 'hb_1', totalAmountCents: null, currency: 'USD' };
  const r = bookingConfirmation(base);
  assert.match(r.text, /Total charged: price not stated by the hotel/);
  assert.match(r.html, /price not stated by the hotel/);
  for (const bad of ['0.00', 'NaN', 'null', 'undefined']) assert.ok(!r.text.includes(bad), `no "${bad}"`);
  assert.ok(bookingConfirmation({ ...base, totalAmountCents: 1 }).text.includes('USD 0.01'));
  assert.throws(() => bookingConfirmation({ ...base, totalAmountCents: 1.5 }), /integer number of cents/);
});

// ── the status ──────────────────────────────────────────────────────────────

test('CANCELLED_WITH_CHARGES → cancelled; CREATED and the two PENDING statuses stay unmapped', () => {
  assert.equal(flightProviderStatusToReservation('CANCELLED_WITH_CHARGES'), 'cancelled');
  assert.equal(flightProviderStatusToReservation('cancelled_with_charges'), 'cancelled', 'case-insensitive, as the leaf always was');
  assert.equal(flightProviderStatusToReservation('CANCELLED'), 'cancelled');
  // STATUS-01 (2026-09-26): the three pre-confirmation words are listed as pending; no word is still no status.
  for (const early of ['CREATED', 'PENDING_CONFIRMATION', 'PENDING']) assert.equal(flightProviderStatusToReservation(early), 'pending', `${early} is pending`);
  assert.equal(flightProviderStatusToReservation(null), null, 'no word stays unmapped');
  assert.match(comments('src/lib/reservations/flightStatus.ts'), /SEC-03/, 'the header records the ruling');
});

// ── the URL ─────────────────────────────────────────────────────────────────

test('no returnUrl, confirm page or query string in src carries an email — asserted over the source', () => {
  const panel = code(PANEL);
  const at = panel.indexOf('const q = new URLSearchParams({');
  const q = panel.slice(at, panel.indexOf('});', at) + 3);
  assert.match(q, /prebookId: prebook\.prebookId/);
  assert.match(q, /transactionId: prebook\.transactionId/);
  assert.doesNotMatch(q, /email/i, 'ids only');
  assert.ok(!panel.includes('contactEmail'), 'the panel never names the field');
  const confirm = code(FCONFIRM);
  assert.ok(!/params\.get\('contactEmail'\)/.test(confirm), 'the page reads no email off the link');
  assert.match(confirm, /body: JSON\.stringify\(\{ prebookId, transactionId, \.\.\.\(tripId \? \{ tripId \} : \{\}\) \}\)/, 'and posts the two references (and the trip)');
  assert.match(confirm, /if \(!prebookId \|\| !transactionId\) \{\s*setPhase\('incomplete'\)/, 'a link without its two references is said, never guessed at');
  // The hotel lane never carried one: its holder is collected on the page's own form.
  const hotel = code(HCONFIRM);
  assert.doesNotMatch(hotel, /params\.get\('[^']*[eE]mail[^']*'\)/);
  assert.match(hotel, /const \[holderEmail, setHolderEmail\] = useState\(''\)/);
});

// ── the prebook route: the row, its place, its failure ──────────────────────

test('prebook: the contact is validated BEFORE the vendor call; the row is written AFTER the vendor answers and BEFORE the browser is', () => {
  const src = code(PREBOOK);
  const validated = src.indexOf('const contact: FlightPrebookContact = {');
  const quota = src.indexOf("reserveTravelSearch('flightprebook')");
  const vendor = src.indexOf('await prebookFlight(');
  const write = src.indexOf('prisma.prebook_contacts.create(');
  const answer = src.indexOf('return NextResponse.json({\n      prebookId: prebook.prebookId,\n      transactionId: prebook.transactionId,\n      secretKey: prebook.secretKey,');
  assert.ok(answer > 0, 'the whitelisted envelope is where the secretKey leaves');
  assert.ok(validated > 0 && validated < quota && quota < vendor, 'validate → quota → vendor, the FL-3 order');
  assert.ok(vendor < write, 'the row is keyed on the vendor prebookId, so it follows the answer');
  assert.ok(write < answer, 'and precedes the envelope that carries the secretKey — no card form on a hold with no stored contact');
  // The stored fields are exactly the validated ones, and the search currency when stated.
  for (const field of ['contactFirstName: contact.firstName', 'contactLastName: contact.lastName', 'contactEmail: contact.email', 'contactPhone: contact.phoneNumber', 'searchCurrency: searchCurrency || null']) {
    assert.ok(src.includes(field), field);
  }
  assert.match(src, /\/\^\[A-Z\]\{3\}\$\/\.test\(searchCurrency\)/, 'the currency is validated, not defaulted');
  assert.ok(!/\?\? 'USD'/.test(src));
});

test('prebook: a write that fails is a NAMED 500 with no secretKey in it; a vendor call that fails writes nothing', () => {
  const src = code(PREBOOK);
  const write = src.indexOf('prisma.prebook_contacts.create(');
  const block = src.slice(write, src.indexOf('return NextResponse.json({\n      prebookId: prebook.prebookId,'));
  assert.match(block, /catch \(writeErr\)/, 'its own catch');
  const catchBody = block.slice(block.indexOf('catch (writeErr)'));
  assert.match(catchBody, /code: 'contact_not_stored'/);
  assert.match(catchBody, /\{ status: 500 \}/);
  assert.match(catchBody, /console\.error/, 'loud');
  assert.doesNotMatch(catchBody, /secretKey/, 'nothing to pay with leaves');
  assert.match(catchBody, /Nothing was charged/);
  // The vendor call sits before the write, so its failure reaches the outer catch
  // ladder with no row written; nothing here catches it to write anyway.
  const vendor = src.indexOf('await prebookFlight(');
  assert.ok(vendor < write);
  assert.doesNotMatch(src.slice(vendor, write), /catch/, 'no catch between the vendor call and the write');
});

// ── the book route: the read, its place, the recipient, one attempt ─────────

test('book: the stored contact is read by prebookId; no row → named 400 BEFORE the quota and the vendor; another lane is refused too', () => {
  const src = code(FBOOK);
  const read = src.indexOf('prisma.prebook_contacts.findUnique({ where: { prebookId } })');
  const refuse = src.indexOf("code: 'contact_not_stored'");
  const quota = src.indexOf("reserveTravelSearch('liteapiflightbooking')");
  const vendor = src.indexOf('await bookFlight(');
  assert.ok(read > 0 && refuse > read && refuse < quota && quota < vendor, 'read → refuse → quota → vendor');
  assert.match(src, /if \(!contact \|\| contact\.lane !== 'flight'\)/);
  assert.match(src.slice(refuse - 300, refuse + 100), /\{ status: 400 \}/);
  assert.ok(!src.includes('body.contactEmail'), 'nothing is taken from the body');
  assert.ok(!/params\.get/.test(src), 'nothing is taken from a query string');
});

test('book: the email goes to the STORED address, once per booking — a retry that finds the reservation reports earlier and sends nothing', () => {
  const src = code(FBOOK);
  assert.match(src, /to: contact\.contactEmail,/);
  assert.match(src, /if \(landed\.reservationOutcome === 'existing'\) \{\s*emailStatus = \{ sent: 'earlier' \};\s*\} else \{\s*try \{/);
  const send = src.indexOf('sendTransactionalEmail(');
  const block = src.slice(send - 1400, send + 1400);
  for (const banned of ['userEmail ??', 'holder.email', 'retry', 'setTimeout', 'fallback', 'process.env.EMAIL']) {
    assert.ok(!block.includes(banned), `no ${banned} near the send`);
  }
  // The confirm page renders the third state by name.
  assert.match(code(FCONFIRM), /data-flight-email="earlier"/);
  assert.match(code(FCONFIRM), /\{ sent: 'earlier' \}/);
});

// ── the money ───────────────────────────────────────────────────────────────

test('both book routes: price absent → NULL in both ledgers with a loud log naming the bookingId; no ?? 0', () => {
  for (const f of [FBOOK, HBOOK]) {
    const src = code(f);
    assert.match(src, /const statedCents = statedPrice === null \? null : Math\.round\(statedPrice \* 100\);/, f);
    assert.match(src, /finalPriceCents: statedCents,/, f);
    assert.match(src, /grossAmountCents: statedCents,/, f);
    assert.match(src, /SEC-03 the vendor stated NO price[^\n]*\n\s*bookingId: parsed\.bookingId,/, `${f}: loud, by bookingId`);
    assert.doesNotMatch(src, /\?\? 0\b/, `${f}: no ?? 0`);
    assert.doesNotMatch(src, /resolvedPrice/, f);
  }
  // The hotel route no longer takes a price from the body, and the page no longer posts one.
  assert.doesNotMatch(code(HBOOK), /finalPriceCents\?: number|finalPriceCents \/ 100/);
  assert.doesNotMatch(code(HCONFIRM), /finalPriceCents: Math\.round/);
});

test('both book routes: currency absent → the currency the SEARCH was made in; both absent → the contract-deviation throw; no literal', () => {
  const fb = code(FBOOK);
  assert.match(fb, /const resolvedCurrency = parsed\.currency \?\? contact\.searchCurrency;/, 'flights: from the stored contact');
  assert.match(fb, /if \(resolvedCurrency === null\) \{\s*throw new LiteApiFlightsApiError\(/);
  const hb = code(HBOOK);
  assert.match(hb, /const resolvedCurrency = parsed\.currency \?\? currency;/, 'hotels: from the stated body field');
  assert.match(hb, /if \(resolvedCurrency === undefined\) \{\s*throw new LiteApiError\(/);
  assert.match(hb, /\/\^\[A-Z\]\{3\}\$\/\.test\(currency\)/, 'validated by name');
  for (const f of [FBOOK, HBOOK, PREBOOK, HCONFIRM]) {
    assert.doesNotMatch(code(f), /\?\? 'USD'|\|\| 'USD'/, `${f}: no literal currency`);
  }
  assert.match(code(HCONFIRM), /\.\.\.\(currency \? \{ currency \} : \{\}\),/, 'the page states it only when the link carries it');
  assert.match(code(PANEL), /\.\.\.\(currency \? \{ currency \} : \{\}\),/, 'the panel states it to prebook only when it has one');
});

// ── the readers ─────────────────────────────────────────────────────────────

test('every reader of finalPriceCents handles NULL honestly — said, never 0, never NaN, never summed', () => {
  for (const f of ['src/app/api/reservations/[id]/route.ts', 'src/app/api/reservations/unattached/route.ts', 'src/app/api/trips/[id]/reservations/route.ts']) {
    assert.ok(code(f).includes('amountUsd: r.finalPriceCents === null ? null : r.finalPriceCents / 100,'), f);
  }
  for (const f of ['src/components/trips/TripBookings.tsx', 'src/components/trips/UnattachedBookings.tsx', 'src/components/trips/TripBudgetActual.tsx', 'src/components/hub/MatchReviewSection.tsx', HCONFIRM]) {
    assert.match(code(f), /price not stated/, f);
  }
  const tb = code('src/components/trips/TripBookings.tsx');
  assert.match(tb, /r\.amountUsd === null \? 0 : Math\.round\(r\.amountUsd \* 100\)/, 'the total leaves a NULL out');
  assert.match(tb, /unstatedCount\(rows\) > 0/, 'and says how many it left out');
  assert.match(code('src/components/trips/TripBudgetActual.tsx'), /b\.finalPriceCents === null \? \(/, 'the lens branches before dividing');
  assert.match(code('src/components/hub/MatchReviewSection.tsx'), /q\.reservation\.finalPriceCents === null\s*\? 'price not stated'/);
  assert.match(code('src/app/api/export/route.ts'), /if \(\/Cents\$\/\.test\(k\)\) out\[k\.replace\(\/Cents\$\/, 'Dollars'\)\] = '';/, 'the export keeps the Dollars twin, empty');
  assert.match(code('src/app/api/trips/[id]/actuals/route.ts'), /finalPriceCents: r\.finalPriceCents,/, 'the lens passes NULL through');
  for (const f of ['src/app/api/runway/match/queue/route.ts', 'src/app/api/runway/match/propose/route.ts']) {
    assert.match(code(f), /finalPriceCents: true/, `${f} selects it, and the type carries the NULL`);
  }
});

// ── the schema and the migration ────────────────────────────────────────────

test('the schema and the migration: both money columns nullable; prebook_contacts keyed on prebookId with no default on a stated field; no backfill', () => {
  const schema = code('prisma/schema.prisma');
  assert.match(schema, /\n  finalPriceCents\s+Int\?/);
  assert.match(schema, /\n  grossAmountCents\s+Int\?/);
  assert.match(schema, /\nmodel prebook_contacts \{\n  prebookId\s+String\s+@id/);
  const sql = code('prisma/migrations/20260925130000_sec_03_no_pii_no_fabricated_number/migration.sql');
  assert.ok(sql.includes('ALTER TABLE "reservations" ALTER COLUMN "finalPriceCents" DROP NOT NULL;'));
  assert.ok(sql.includes('ALTER TABLE "commission_ledger" ALTER COLUMN "grossAmountCents" DROP NOT NULL;'));
  assert.ok(sql.includes('CREATE TABLE "prebook_contacts"'));
  assert.doesNotMatch(sql, /^\s*UPDATE\b/im, 'existing rows are untouched (ON UPDATE CASCADE on the key is not a backfill)');
  for (const col of ['prebookId', 'lane', 'contactFirstName', 'contactLastName', 'contactEmail', 'contactPhone']) {
    const line = sql.split('\n').find((l) => l.includes(`"${col}"`) && /VARCHAR/.test(l))!;
    assert.ok(line && /NOT NULL/.test(line) && !/DEFAULT/i.test(line), `${col}: NOT NULL, no default`);
  }
});
