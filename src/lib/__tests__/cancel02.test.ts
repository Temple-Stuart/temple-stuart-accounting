/**
 * CANCEL-02 (2026-09-26) — a cancellation is confirmed in writing.
 *
 * The lifecycle templates and the two cancel leaves are pure and driven directly.
 * The route cannot be executed here (a database, a vendor, a mail provider), so
 * its contract — the send after the commit, its own catch, the recipient rule,
 * email.sent in the envelope — is read from source through the reader.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { code, comments } from '../sourceText';
import { lifecycleEmail, statedMoney, type LifecycleInput } from '../emailTemplates/lifecycle';
import { cancelRecipient, cancellationEmailFacts, flightCancelDecision, hotelCancelMoneyEvents } from '../reservations/cancellation';
import { parseCancelResult } from '../liteapiClient';
import { flightCancellationObjectOf, parseFlightCancellationResult } from '../liteapiFlightsClient';

const ROUTE = 'src/app/api/reservations/[id]/cancel/route.ts';
const TEMPLATE = 'src/lib/emailTemplates/lifecycle.ts';
const LEAF = 'src/lib/reservations/cancellation.ts';

const ARRIVED = new Date('2026-09-26T09:05:00Z');
const EV = { reservationId: 'res_f1', arrivalId: 'arr_1', statedAt: ARRIVED };
const COMMON = { name: 'Thai Vietjet Air BKK → HKT', lane: 'flight' as const, reference: 'PNR123', checkinDate: null, checkoutDate: null, manageUrl: 'https://www.templestuart.com/travel' };

/** POST .../cancellations — 200, final, with charges, refund back to the card. */
const FINAL_ANSWER = { data: { bookingId: 'fb_9Q', status: 'CANCELLED_WITH_CHARGES', cancellation_fee: 51.6, refund_amount: 380.5, currency: 'USD', destination: 'original_payment', vouchers: null } };
/** 200, final, refund as a voucher. */
const VOUCHER_ANSWER = { data: { bookingId: 'fb_9Q', status: 'CANCELLED', cancellation_fee: 0, refund_amount: 380.5, currency: 'USD', destination: 'voucher', vouchers: [{ voucherId: 'v_1', code: 'VJ-CREDIT-1', airline: 'VZ', pricing: { display: { amount: 380.5, currency: 'THB' } }, validFrom: '2026-09-26', expiresAt: '2027-09-25', passengerNames: ['Ada Lovelace'], notes: 'non-transferable' }] } };
/** 200 with NO amounts stated. */
const SILENT_ANSWER = { data: { bookingId: 'fb_9Q', status: 'CANCELLED', currency: 'USD' } };

const FORBIDDEN = ['undefined', 'null', '$0', 'NaN', 'not stated by the airline'];
function assertClean(r: { subject: string; text: string; html: string }, label: string) {
  const all = `${r.subject}\n${r.text}\n${r.html}`;
  for (const bad of FORBIDDEN) assert.ok(!all.includes(bad), `${label}: no "${bad}" anywhere in the email`);
}

// ── the cancelled template, from the ROWS ───────────────────────────────────

test('final cancel → the body carries the stated refund, fee, destination exactly as money_events holds them, the mandated next-email sentence, and the manage link', () => {
  const parsed = parseFlightCancellationResult(flightCancellationObjectOf(FINAL_ANSWER));
  const d = flightCancelDecision(parsed, 200, EV);
  const facts = cancellationEmailFacts(d.moneyEvents, d.vouchers);
  assert.deepEqual(facts, { refund: { amountCents: 38050, currency: 'USD' }, fee: { amountCents: 5160, currency: 'USD' }, destination: 'original_payment', vouchers: [] });
  const r = lifecycleEmail({ kind: 'cancelled', ...COMMON, ...facts, providerStatus: parsed.status });
  assert.equal(r.subject, 'Booking cancelled — Thai Vietjet Air BKK → HKT');
  assert.match(r.text, /Refund: USD 380\.50/);
  assert.match(r.text, /Cancellation fee: USD 51\.60/);
  assert.match(r.text, /Refund goes: back to the card you paid with/);
  assert.match(r.text, /Reference: PNR123/);
  assert.match(r.text, /Vendor status: CANCELLED_WITH_CHARGES/);
  assert.match(r.text, /We will email you again when the vendor confirms the refund was issued\./);
  assert.match(r.text, /See this booking: https:\/\/www\.templestuart\.com\/travel/);
  assert.match(r.html, /<a href="https:\/\/www\.templestuart\.com\/travel">See this booking<\/a>/);
  assert.ok(!r.text.includes('Dates:'), 'a flight has no stay dates — the line is omitted');
  assert.ok(!/\b(today|tomorrow|within \d+|business days|working days)\b/i.test(r.text), 'no promised timeline this app does not control');
  assertClean(r, 'final');
});

test('a voucher renders with its code and expiry; a stated 0 fee is 0.00, not "not stated"', () => {
  const parsed = parseFlightCancellationResult(flightCancellationObjectOf(VOUCHER_ANSWER));
  const d = flightCancelDecision(parsed, 200, EV);
  const facts = cancellationEmailFacts(d.moneyEvents, d.vouchers);
  assert.deepEqual(facts.vouchers, [{ code: 'VJ-CREDIT-1', airline: 'VZ', amountCents: 38050, currency: 'THB', expiresAt: '2027-09-25' }]);
  const r = lifecycleEmail({ kind: 'cancelled', ...COMMON, ...facts, providerStatus: parsed.status });
  assert.match(r.text, /Voucher VJ-CREDIT-1 \(VZ\): THB 380\.50 · expires 2027-09-25/);
  assert.match(r.text, /Cancellation fee: USD 0\.00/, 'the vendor stated 0');
  assert.match(r.text, /Refund goes: as an airline voucher, not cash/);
  assertClean(r, 'voucher');
  // A voucher with no expiry omits that part; no airline omits the parentheses.
  const bare = lifecycleEmail({ kind: 'cancelled', ...COMMON, ...facts, vouchers: [{ code: 'X1', airline: null, amountCents: null, currency: null, expiresAt: null }], providerStatus: null });
  assert.match(bare.text, /Voucher X1: amount not stated by the vendor\n/);
  assert.ok(!bare.text.includes('expires'), 'no expiry line without one');
  assert.ok(!bare.text.includes('Vendor status'), 'no status line without one');
  assertClean(bare, 'bare voucher');
});

test('a NULL amount renders "not stated by the vendor" — from the answer that stated none, through the rows', () => {
  const parsed = parseFlightCancellationResult(flightCancellationObjectOf(SILENT_ANSWER));
  const d = flightCancelDecision(parsed, 200, EV);
  const facts = cancellationEmailFacts(d.moneyEvents, d.vouchers);
  assert.equal(facts.refund.amountCents, null);
  assert.equal(facts.fee.amountCents, null);
  const r = lifecycleEmail({ kind: 'cancelled', ...COMMON, ...facts, providerStatus: 'CANCELLED' });
  assert.match(r.text, /Refund: refund amount not stated by the vendor/);
  assert.match(r.text, /Cancellation fee: fee not stated by the vendor/);
  assert.ok(!r.text.includes('Refund goes:'), 'no destination stated → the line is omitted');
  assertClean(r, 'silent');
  assert.equal(statedMoney({ amountCents: null, currency: 'USD' }, 'refund amount'), 'refund amount not stated by the vendor');
  assert.equal(statedMoney({ amountCents: 1, currency: null }, 'fee'), '0.01', 'a stated amount with no currency shows the number alone');
  assert.throws(() => statedMoney({ amountCents: 12.5, currency: 'USD' }, 'fee'), /integer number of cents/);
  // A hotel: the same rows, the same words, plus its dates.
  const hotelRows = hotelCancelMoneyEvents(parseCancelResult({ bookingId: 'hSq2gVDrf', status: 'CANCELLED_WITH_CHARGES', currency: 'USD', cancellation_fee: 25, refund_amount: 125 }), { reservationId: 'res_h1', arrivalId: 'arr_h', statedAt: ARRIVED });
  const h = lifecycleEmail({ kind: 'cancelled', name: 'Hotel Temple', lane: 'hotel', reference: 'HCC-4421', checkinDate: '2026-10-01', checkoutDate: '2026-10-04', manageUrl: null, ...cancellationEmailFacts(hotelRows, []), providerStatus: 'CANCELLED_WITH_CHARGES' });
  assert.match(h.text, /your hotel booking is cancelled/);
  assert.match(h.text, /Dates: 2026-10-01 → 2026-10-04/);
  assert.match(h.text, /Refund: USD 125\.00/);
  assert.match(h.text, /Cancellation fee: USD 25\.00/);
  assert.ok(!h.text.includes('See this booking'), 'no manage line without an origin');
  assert.ok(!h.html.includes('<a href'), 'and no link in the html either');
  assertClean(h, 'hotel');
});

test('the pending template: cancellation requested, awaiting the airline, what happens next, the reference — and no money figures', () => {
  const r = lifecycleEmail({ kind: 'cancel_pending', ...COMMON });
  assert.equal(r.subject, 'Cancellation requested — Thai Vietjet Air BKK → HKT');
  assert.match(r.text, /accepted by the airline and is awaiting its confirmation/);
  assert.match(r.text, /stays confirmed until the airline finalizes/);
  assert.match(r.text, /When the airline finalizes it, the refund and any fee are stated, and we will email you those figures\./);
  assert.match(r.text, /Reference: PNR123/);
  assert.ok(!/Refund:|fee/i.test(r.text.replace(/refund and any fee are stated/, '')), 'no figure before the airline states one');
  assertClean(r, 'pending');
});

test("'ticketed' and 'hotel_confirmation_arrived' render (STATUS-01 slots) and have ZERO callers in src today", () => {
  const t = lifecycleEmail({ kind: 'ticketed', ...COMMON, pnr: 'PNR123' });
  assert.match(t.text, /the airline has issued your ticket/);
  assert.match(t.text, /Airline reference \(PNR\): PNR123/);
  assertClean(t, 'ticketed');
  const t2 = lifecycleEmail({ kind: 'ticketed', ...COMMON, pnr: null });
  assert.ok(!t2.text.includes('Airline reference'), 'no PNR line without one');
  const h = lifecycleEmail({ kind: 'hotel_confirmation_arrived', name: 'Hotel Temple', lane: 'hotel', reference: 'hSq2gVDrf', checkinDate: '2026-10-01', checkoutDate: '2026-10-04', manageUrl: null, confirmationCode: 'HCC-4421' });
  assert.match(h.text, /Confirmation code: HCC-4421/);
  assertClean(h, 'hotel_confirmation_arrived');
  assert.match(comments(TEMPLATE), /Documented as fired by STATUS-01; NO caller in CANCEL-02/);
  // Zero callers: every source file under src/ (through the reader), except the template itself.
  const files: string[] = [];
  const walk = (dir: string) => {
    for (const name of readdirSync(dir)) {
      const p = join(dir, name);
      // Tests are not callers: this file renders both slots on purpose.
      if (statSync(p).isDirectory()) { if (name !== 'node_modules' && name !== '__tests__') walk(p); }
      else if (/\.tsx?$/.test(name)) files.push(p);
    }
  };
  walk('src');
  const callers = files.filter((f) => f !== TEMPLATE && /kind: 'ticketed'|kind: 'hotel_confirmation_arrived'/.test(code(f)));
  assert.deepEqual(callers, [], 'no file fires the two STATUS-01 templates');
  assert.ok(files.length > 100, 'the walk saw the tree');
});

test('every template omits absent lines and never contains "undefined", "null", "$0" or "NaN" — a matrix of inputs', () => {
  const money = [{ amountCents: null, currency: null }, { amountCents: 0, currency: 'USD' }, { amountCents: 38050, currency: null }, { amountCents: -1500, currency: 'EUR' }];
  const identities = [
    { name: 'Hotel Temple', lane: 'hotel' as const, reference: 'HCC-4421', checkinDate: '2026-10-01', checkoutDate: '2026-10-04', manageUrl: null },
    { name: 'Flight booking fb_9Q', lane: 'flight' as const, reference: 'fb_9Q', checkinDate: null, checkoutDate: null, manageUrl: 'https://www.templestuart.com/travel' },
  ];
  let rendered = 0;
  for (const id of identities) {
    for (const refund of money) for (const fee of money) for (const destination of [null, 'original_payment', 'unknown', 'agency_deposit']) {
      const input: LifecycleInput = { kind: 'cancelled', ...id, refund, fee, destination, vouchers: [], providerStatus: null };
      const r = lifecycleEmail(input);
      assertClean(r, `cancelled ${JSON.stringify({ refund, fee, destination })}`);
      if (id.checkinDate === null) assert.ok(!r.text.includes('Dates:'));
      if (destination === null) assert.ok(!r.text.includes('Refund goes:'));
      if (id.manageUrl === null) assert.ok(!r.text.includes('See this booking'));
      rendered += 1;
    }
    assertClean(lifecycleEmail({ kind: 'cancel_pending', ...id }), 'pending');
    assertClean(lifecycleEmail({ kind: 'ticketed', ...id, pnr: null }), 'ticketed');
    assertClean(lifecycleEmail({ kind: 'hotel_confirmation_arrived', ...id, confirmationCode: 'X' }), 'hotel_confirmation_arrived');
  }
  assert.equal(rendered, 2 * 4 * 4 * 4);
  // Provider strings are escaped in the html — a name is never markup.
  const evil = lifecycleEmail({ kind: 'cancel_pending', ...COMMON, name: '<script>alert(1)</script>' });
  assert.ok(!evil.html.includes('<script>'));
  assert.ok(evil.html.includes('&lt;script&gt;'));
});

// ── who is told ─────────────────────────────────────────────────────────────

test('recipient: account → the user email; guest with guestEmail → it; guest without → no_recipient_stated; never the other address', () => {
  assert.deepEqual(cancelRecipient({ bookingType: 'account', guestEmail: null }, 'alex@example.com'), { to: 'alex@example.com' });
  assert.deepEqual(cancelRecipient({ bookingType: 'account', guestEmail: 'someone@else.example' }, 'alex@example.com'), { to: 'alex@example.com' }, 'an account row is sent to the account, whatever guestEmail carries');
  assert.deepEqual(cancelRecipient({ bookingType: 'guest', guestEmail: 'ada@example.com' }, 'alex@example.com'), { to: 'ada@example.com' });
  assert.deepEqual(cancelRecipient({ bookingType: 'guest', guestEmail: null }, 'alex@example.com'), { to: null, reason: 'no_recipient_stated' }, 'a guest row is NEVER sent to the account holder');
  assert.deepEqual(cancelRecipient({ bookingType: 'guest', guestEmail: '   ' }, 'alex@example.com'), { to: null, reason: 'no_recipient_stated' });
  assert.deepEqual(cancelRecipient({ bookingType: 'account', guestEmail: 'ada@example.com' }, null), { to: null, reason: 'no_recipient_stated' }, 'an account row with no account email is never sent to a guest address');
  const leaf = code(LEAF);
  assert.ok(!/accountEmail \?\? |guestEmail \?\? |\?\? accountEmail|\?\? row\.guestEmail/.test(leaf), 'no fallback from one address to another');
  assert.match(comments(LEAF), /a guest[\s*]+FLIGHT row CANNOT/, 'which rows cannot be emailed is stated in the leaf');
});

// ── the route ───────────────────────────────────────────────────────────────

test('the route: both lanes send AFTER the transaction, once, in their own catch; a failure or a missing recipient never fails the cancel; email.sent rides both envelopes', () => {
  const src = code(ROUTE);
  const hotel = src.slice(src.indexOf('async function cancelHotel('), src.indexOf('async function cancelFlight('));
  const flight = src.slice(src.indexOf('async function cancelFlight('));
  for (const [name, lane] of [['hotel', hotel], ['flight', flight]] as const) {
    const tx = lane.indexOf('prisma.$transaction');
    const send = lane.indexOf('await sendCancellationEmail(');
    assert.ok(tx > 0 && send > tx, `${name}: after the commit`);
    assert.equal((lane.match(/await sendCancellationEmail\(/g) ?? []).length, 1, `${name}: exactly one send`);
    assert.match(lane, /email: emailStatus,/, `${name}: reported`);
  }
  // The final figures from the ROWS on a 200, the pending template on a 202.
  assert.match(hotel, /\{ kind: 'cancelled', moneyEvents, vouchers: \[\], providerStatus: landed\.parsed\.status \}/);
  assert.match(flight, /decision\.final\s*\? \{ kind: 'cancelled', moneyEvents: decision\.moneyEvents, vouchers: decision\.vouchers, providerStatus: landed\.parsed\.status \}\s*: \{ kind: 'cancel_pending' \}/);
  // Anchored on code, not a comment — the reader hands back code with comments blanked.
  const sender = src.slice(src.indexOf('async function sendCancellationEmail('), src.indexOf('function statusRefusal('));
  assert.match(sender, /const recipient = cancelRecipient\(owned, accountEmail\);/);
  assert.match(sender, /return \{ sent: false, error: recipient\.reason \};/, 'no recipient → named, no send');
  assert.ok(sender.indexOf("return { sent: false, error: recipient.reason };") < sender.indexOf('sendTransactionalEmail('), 'refused before any send');
  assert.match(sender, /catch \(emailErr\)/, 'its own catch');
  const catchBody = sender.slice(sender.indexOf('catch (emailErr)'));
  assert.doesNotMatch(catchBody, /throw |return NextResponse/, 'the catch never fails the cancel');
  assert.match(catchBody, /return \{ sent: false, error: errorClass \};/);
  assert.match(sender, /cancellationEmailFacts\(outcome\.moneyEvents, outcome\.vouchers\)/, 'the figures come from the rows');
  assert.match(sender, /manageUrl\(owned\.id\)/);
  assert.match(src, /return `\$\{origin\.trim\(\)\.replace\(\/\\\/\+\$\/, ''\)\}\/travel`;/, 'the manage link is the travel tab, where a booking is seen today');
  for (const banned of ['userEmail ??', 'accountEmail ??', 'guestEmail ??', '?? accountEmail', 'retry', 'setTimeout', 'fallback']) {
    assert.ok(!sender.includes(banned), `no ${banned} in the email path`);
  }
  // The gate reads what the recipient rule and the identity lines need.
  assert.match(src, /select: \{ id: true, email: true \}/, 'the account email from the users row');
  assert.match(src, /bookingType: true, guestEmail: true, displayName: true, providerConfirmationCode: true, checkinDate: true, checkoutDate: true,/);
  assert.match(src, /reservationIdentity\(owned\)/, 'the name through the one reader');
  assert.ok(!/CANCEL-02: the cancellation EMAIL attaches here — NOT this PR/.test(comments(ROUTE)), 'the absence note is gone');
});
