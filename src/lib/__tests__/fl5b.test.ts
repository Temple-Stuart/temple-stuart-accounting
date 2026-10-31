/**
 * FL-5b (2026-09-23) — the flight confirmation email, restored.
 *
 * The template is pure, so it is driven directly. The route's contract — a
 * required contact, the send after the transaction, the failure that never fails
 * a paid booking — is read from the source, the way this repo proves a route it
 * cannot execute without a provider.
 *
 * SEC-03 (2026-09-25): the contact is still REQUIRED, and still the one address
 * the panel validated — but it no longer rides the returnUrl. The prebook route
 * stores it under the vendor prebookId and the book route reads it there; the
 * three tests below that used to read it off the link now read it off the row.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { code } from '../sourceText';
import { flightConfirmation, statusLine } from '../emailTemplates/flightConfirmation';

const ROUTE = 'src/app/api/travel/liteapi/flights/book/route.ts';
const PANEL = 'src/components/trips/LiteApiFlightCheckoutPanel.tsx';
// FL-4c (2026-09-23): the booking moved here with the rail's redirect.
const CONFIRM = 'src/app/booking/flight-confirm/page.tsx';

const BOOKED = {
  passengerName: 'Ada Lovelace',
  passengerCount: 1,
  bookingId: 'fb_9Q',
  bookingRef: 'FH-269-ABCDEFGH',
  pnr: 'PNR123',
  totalAmountCents: 43210,
  currency: 'USD',
  status: 'CONFIRMED',
};

test('the template carries NO itinerary field — the payload has none, so neither does the email', () => {
  const r = flightConfirmation(BOOKED);
  const all = `${r.subject}\n${r.text}\n${r.html}`.toLowerCase();
  // The three Duffel fields 34fdb749 took away with the old rail.
  for (const gone of ['departure', 'origin', 'destination', 'iata', 'route:', 'airport', 'depart', 'arrive', 'terminal', 'gate']) {
    assert.ok(!all.includes(gone), `the email says nothing about "${gone}"`);
  }
  // And the template does not even accept them.
  const src = code('src/lib/emailTemplates/flightConfirmation.ts');
  for (const field of ['originIata', 'destinationIata', 'departureDateTime']) {
    assert.ok(!src.includes(field), `${field} is not a field of this template`);
  }
});

test('an absent field omits its line ENTIRELY — no placeholder that looks like data', () => {
  const bare = flightConfirmation({ ...BOOKED, passengerName: null, bookingRef: null, pnr: null });
  assert.ok(!bare.text.includes('Travelers:'), 'no travelers line without a name');
  assert.ok(!bare.text.includes('Booking reference:'), 'no reference line without one');
  assert.ok(!bare.text.includes('Airline reference'), 'no PNR line without one');
  assert.ok(!bare.html.includes('Travelers'), 'the html row is gone too, not blank');
  // Nothing stands in for the missing values.
  for (const stand of ['n/a', 'N/A', 'null', 'undefined', 'TBD', 'unknown', '--', 'not available']) {
    assert.ok(!bare.text.includes(stand), `no "${stand}" standing in for absent data`);
  }
  // What IS always there: the guaranteed reference and the money.
  assert.ok(bare.text.includes('fb_9Q'));
  assert.ok(bare.text.includes('USD 432.10'));
  assert.ok(bare.text.startsWith('Hi,'), 'the greeting simply loses the name');
});

test('PENDING_CONFIRMATION and PENDING say the ticket is being issued, never that something went wrong', () => {
  for (const status of ['PENDING_CONFIRMATION', 'PENDING']) {
    const r = flightConfirmation({ ...BOOKED, status });
    assert.match(r.subject, /ticket on its way/i, `${status}: the subject is success-shaped`);
    assert.match(r.text, /booked and paid for/i, `${status}: the booking is stated as done`);
    assert.match(r.text, /issuing your ticket/i, `${status}: and the ticket as in progress`);
    for (const alarm of ['fail', 'error', 'problem', 'unable', 'could not', 'sorry', 'wrong']) {
      assert.ok(!r.text.toLowerCase().includes(alarm), `${status}: never says "${alarm}"`);
    }
  }
  // CONFIRMED and TICKETED claim the ticket; an unknown status claims neither.
  assert.match(statusLine('TICKETED').sentence, /ticket is issued/i);
  assert.match(statusLine('CONFIRMED').sentence, /ticket is issued/i);
  const unknown = statusLine('SOMETHING_NEW');
  assert.match(unknown.sentence, /not yet reported/i, 'an unknown status is stated, not guessed');
  assert.ok(!/ticket is issued/i.test(unknown.sentence), 'and never claims the ticket');
});

test('the money is exact integer cents, and a non-integer THROWS rather than rounding', () => {
  assert.ok(flightConfirmation({ ...BOOKED, totalAmountCents: 1 }).text.includes('USD 0.01'));
  assert.ok(flightConfirmation({ ...BOOKED, totalAmountCents: 100000 }).text.includes('USD 1000.00'));
  assert.throws(() => flightConfirmation({ ...BOOKED, totalAmountCents: 432.105 }), /integer number of cents/);
});

test('provider strings are escaped — a reference is never markup', () => {
  const r = flightConfirmation({ ...BOOKED, passengerName: '<script>alert(1)</script>' });
  assert.ok(!r.html.includes('<script>'), 'the script tag is escaped');
  assert.ok(r.html.includes('&lt;script&gt;'));
});

test('the contact is REQUIRED — read from the row the prebook route stored, and refused by name BEFORE the quota and the provider call', () => {
  const src = code(ROUTE);
  // SEC-03: the address is validated ONCE, at prebook, with that route's regex, and
  // stored; this route reads the row and refuses its absence by name.
  const prebookRe = code('src/app/api/travel/liteapi/flights/prebook/route.ts').match(/\/\^\[\^\\s@\]\+@\[\^\\s@\]\+\\\.\[\^\\s@\]\+\$\//);
  assert.ok(prebookRe, 'the prebook route still validates with it');
  assert.ok(!src.includes('contactEmail is required'), 'the body no longer carries the address, so nothing here validates one');
  const read = src.indexOf('prisma.prebook_contacts.findUnique({ where: { prebookId } })');
  const refused = src.indexOf("code: 'contact_not_stored'");
  const quota = src.indexOf("reserveTravelSearch('liteapiflightbooking')");
  const provider = src.indexOf('await bookFlight(');
  assert.ok(read > 0 && refused > read, 'the row is read, and its absence refused by name');
  assert.ok(quota > 0 && provider > quota, 'the quota and the provider call are where expected');
  assert.ok(refused < quota, 'a missing contact costs no quota');
  assert.ok(refused < provider, 'and no provider call — no money spent');
});

test('the email is sent AFTER the reservation transaction, and its failure never fails a paid booking', () => {
  const src = code(ROUTE);
  const tx = src.indexOf('prisma.$transaction');
  const send = src.indexOf('sendTransactionalEmail(');
  assert.ok(tx > 0 && send > tx, 'the transaction commits first');
  // Its own try/catch, and the catch only records — a throw here would reach the
  // outer catch and turn a real, paid booking into a 500.
  const block = src.slice(send - 900, send + 1200);
  assert.match(block, /catch \(emailErr\)/, 'its own catch');
  assert.match(block, /console\.error/, 'loud');
  const catchBody = block.slice(block.indexOf('catch (emailErr)'));
  assert.doesNotMatch(catchBody.slice(0, 500), /throw |return NextResponse/, 'the catch never fails the booking');
  assert.match(catchBody, /emailStatus = \{ sent: false/, 'it records the failure instead');
  // Reported in the envelope, next to the seven whitelisted fields.
  assert.match(src, /email: emailStatus,/, 'email.sent rides the response');
});

test('a missing RESEND_API_KEY or EMAIL_FROM is DECLARED by the sender, and lands in that same catch', () => {
  const email = code('src/lib/email.ts');
  assert.match(email, /if \(!apiKey\) throw new EmailConfigError\('RESEND_API_KEY'\)/);
  assert.match(email, /if \(!from\) throw new EmailConfigError\('EMAIL_FROM'\)/);
  // It THROWS — it does not skip silently — so the route's catch turns it into
  // email.sent=false with the class named, and the booking still answers 200.
  assert.ok(!email.includes('return { id: ') || email.includes('throw new EmailSendError'), 'no silent success path');
  const src = code(ROUTE);
  assert.match(src, /errorClass = emailErr instanceof Error \? emailErr\.name/, 'the error CLASS is what is reported');
});

test('nothing here defaults a recipient, retries, or reaches for another transport', () => {
  const src = code(ROUTE);
  const send = src.indexOf('sendTransactionalEmail(');
  const block = src.slice(send - 1200, send + 1400);
  assert.match(block, /to: contact\.contactEmail,/, 'the recipient is the STORED contact, and only that (SEC-03)');
  for (const banned of ['userEmail ??', 'holder.email', 'retry', 'setTimeout', 'fallback', 'process.env.EMAIL']) {
    assert.ok(!block.includes(banned), `no ${banned} anywhere near the send`);
  }
});

test('the contact the panel validated is the one the prebook route stores — and it rides no link', () => {
  const src = code(PANEL);
  // FL-4c moved the BOOK CALL off this panel: the vendor's documented payment rail
  // redirects, so /booking/flight-confirm finishes the booking. SEC-03 took the
  // address OFF that redirect: the SAME address validated here is sent ONCE, to
  // prebook, which stores it under the vendor prebookId; the returnUrl carries
  // ids only.
  assert.match(src, /EMAIL_RE\.test\(email\.trim\(\)\)/, 'the panel validates it before it is ever sent');
  assert.match(src, /email: email\.trim\(\),/, 'and hands it to prebook');
  const at = src.indexOf('const q = new URLSearchParams({');
  // Scoped to the call's own closing `});`, never a character count.
  const q = src.slice(at, src.indexOf('});', at) + 3);
  assert.match(q, /prebookId: prebook\.prebookId/);
  assert.match(q, /transactionId: prebook\.transactionId/);
  assert.doesNotMatch(q, /email/i, 'the link carries no address');
  assert.ok(!src.includes('contactEmail'), 'the field is not named on this panel at all');
  assert.ok(!src.includes("'/api/travel/liteapi/flights/book'"), 'the panel no longer books — the rail redirects');
});

test('the confirm page books with that contact, and says whether the email went out', () => {
  const src = code(CONFIRM);
  assert.match(src, /'\/api\/travel\/liteapi\/flights\/book'/, 'the same route, unchanged');
  assert.match(src, /body: JSON\.stringify\(\{ prebookId, transactionId, \.\.\.\(tripId \? \{ tripId \} : \{\}\) \}\)/, 'with the two references the link carried (SEC-03: no address)');
  assert.ok(!/params\.get\('contactEmail'\)/.test(src), 'nothing reads an address off the link');
  // The email outcome is stated either way — a booking that could not be emailed
  // is still a booking, and never reads as a failed one. SEC-03 adds the third
  // state: a retry that found the booking already recorded sends no second email.
  assert.match(src, /data-flight-email="sent"/);
  assert.match(src, /data-flight-email="failed"/);
  assert.match(src, /data-flight-email="earlier"/);
  assert.match(src, /Your booking is complete and paid/, 'a failed email never reads as a failed booking');
  // A link that arrived without its references is SAID, never guessed at.
  assert.match(src, /setPhase\('incomplete'\)/);
});
