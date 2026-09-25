// ─── Flight booking confirmation template (FL-5b, 2026-09-23) ────────────────
// PURE module: zero imports — input in, rendered strings out. No env reads, no
// app code, no provider SDK. Mirrors the hotel template's conventions
// (bookingConfirmation.ts): exact integer-cents math with a THROW on
// non-integer input, HTML-escaping of every interpolated string, absence
// DECLARED or the row OMITTED — never placeholder values that look like data,
// and the templestuart.com transactional footer.
//
// ─── WHAT THIS IS, AND WHAT IT LOST ─────────────────────────────────────────
// This template existed once before, for DUFFEL (40bbb12a, 2026-07-20). 34fdb749
// rebuilt flights on LiteAPI on 2026-08-04 and deleted the Duffel route, taking
// the email and this file with it. The LiteAPI route has carried the comment
// "FL-5b (confirmation email) is where a contact re-enters this lane" ever since.
// This is that file, restored and RE-CUT to the payload LiteAPI actually returns.
//
// THREE DUFFEL FIELDS ARE GONE, AND THEY ARE NOT COMING BACK HERE:
//   originIata · destinationIata · departureDateTime
// LiteAPI's book answer — data[0].booking, the object flightBookingObjectOf
// returns (liteapiFlightsClient.ts:423-438) — carries bookingId, bookingRef,
// status, paymentStatus, pricing, payment, order.reference.provider.pnr and
// passengers. It carries NO segments, NO airports and NO date of travel; CAL-01
// established the same thing when it looked for a day to put a flight on and
// found none. An itinerary line here would be invented, so there is none. This
// email says WHAT WAS BOOKED AND PAID, and no more than that.
//
// LiteAPI adds one field Duffel's version never had: `status`. It decides the
// tense — see statusLine below.

export interface FlightConfirmationInput {
  /** First passenger, pre-formatted full name. Null when the payload named none. */
  passengerName: string | null;
  /** Total pax on the booking; rendered as "+N more" when > 1. */
  passengerCount: number;
  /** LiteAPI's booking id — always present, the guaranteed reference. */
  bookingId: string;
  /** LiteAPI's own booking reference ("FH-YYM-XXXXXXXX") when present. */
  bookingRef: string | null;
  /** The airline PNR (order.reference.provider.pnr) when the provider issued one. */
  pnr: string | null;
  /** Integer cents, or NULL — SEC-03 (2026-09-25): the vendor stated no price,
   *  so the ledger holds NULL and this line says "price not stated". Never 0. */
  totalAmountCents: number | null;
  /** ISO 4217 code, e.g. 'USD' — rendered as the code, never a symbol. */
  currency: string;
  /** The provider's status VERBATIM, or null. Decides the tense, never the truth. */
  status: string | null;
}

export interface RenderedEmail {
  subject: string;
  html: string;
  text: string;
}

/** Integer cents → "1234.56" (always two decimals, sign preserved). Throws on
 *  non-integer input — never rounds or truncates silently. */
function centsToAmount(cents: number): string {
  if (!Number.isSafeInteger(cents)) {
    throw new Error(`totalAmountCents must be an integer number of cents, got: ${cents}`);
  }
  const sign = cents < 0 ? '-' : '';
  const abs = Math.abs(cents);
  return `${sign}${Math.floor(abs / 100)}.${String(abs % 100).padStart(2, '0')}`;
}

/** Minimal HTML escape for provider-supplied strings interpolated into the HTML
 *  body (names, references — never trust them as markup). */
function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * THE TENSE, FROM THE PROVIDER'S OWN STATUS.
 *
 * PENDING_CONFIRMATION and PENDING are SUCCESS-SHAPED — the route persists them
 * as 'pending' precisely because the provider is still finalizing, not because
 * anything went wrong (flights/book/route.ts:128-136). The email must say the
 * ticket is being issued. It must never suggest a problem, and it must never
 * claim a ticket is issued when the provider has not said so.
 */
export function statusLine(status: string | null): { headline: string; sentence: string } {
  const s = (status ?? '').toUpperCase();
  if (s === 'CONFIRMED' || s === 'TICKETED') {
    return { headline: 'Flight confirmed', sentence: 'Your flight is booked and your ticket is issued.' };
  }
  if (s === 'PENDING_CONFIRMATION' || s === 'PENDING') {
    return {
      headline: 'Flight booked — ticket on its way',
      sentence: 'Your flight is booked and paid for. The airline is issuing your ticket now; your reference below is already valid.',
    };
  }
  if (s === 'CANCELLED') {
    return { headline: 'Flight booking cancelled', sentence: 'This booking is cancelled. If that is unexpected, reply to this email with the reference below.' };
  }
  // An unknown status is NOT dressed up as either outcome. It is stated.
  return {
    headline: 'Flight booked',
    sentence: 'Your flight is booked and paid for. The airline has not yet reported a final ticket status; your reference below is already valid.',
  };
}

export function flightConfirmation(input: FlightConfirmationInput): RenderedEmail {
  // SEC-03: a price the vendor did not state is SAID — never rendered as 0.00.
  const amount = input.totalAmountCents === null
    ? `price not stated by the airline — your card statement shows the amount`
    : `${input.currency} ${centsToAmount(input.totalAmountCents)}`;
  const { headline, sentence } = statusLine(input.status);

  // Subject precedence: the airline PNR → LiteAPI's own reference → the booking
  // id. Never an invented route, because there is no route on the payload.
  const ref = input.pnr ?? input.bookingRef ?? input.bookingId;
  const subject = `${headline} — ${ref}`;

  // A name we were not given is not guessed at, and the line it would have sat
  // on is dropped. The greeting simply loses the name.
  const greeting = input.passengerName ? `Hi ${input.passengerName},` : 'Hi,';
  const travelers = input.passengerName === null
    ? null
    : input.passengerCount > 1
      ? `${input.passengerName} +${input.passengerCount - 1} more`
      : input.passengerName;

  const text = [
    greeting,
    '',
    sentence,
    '',
    ...(travelers ? [`Travelers: ${travelers}`] : []),
    `Booking id: ${input.bookingId}`,
    ...(input.bookingRef ? [`Booking reference: ${input.bookingRef}`] : []),
    ...(input.pnr ? [`Airline reference (PNR): ${input.pnr}`] : []),
    `Total charged: ${amount}`,
    '',
    'Keep this email — it is your proof of booking.',
    '',
    '—',
    'This is a transactional confirmation from templestuart.com for a booking',
    'just made with this email address. It is not a marketing message.',
  ].join('\n');

  const row = (label: string, value: string, strong = false) =>
    `<tr><td style="padding: 6px 12px 6px 0; color: #666;">${label}</td><td style="padding: 6px 0;">${strong ? `<strong>${value}</strong>` : value}</td></tr>`;

  const html = `<div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 560px; margin: 0 auto; padding: 24px; color: #1a1a1a;">
  <h1 style="font-size: 20px; margin: 0 0 16px;">${escapeHtml(headline)}</h1>
  <p style="margin: 0 0 16px;">${escapeHtml(greeting)} ${escapeHtml(sentence)}</p>
  <table style="border-collapse: collapse; width: 100%; margin: 0 0 16px;">
    ${travelers ? row('Travelers', escapeHtml(travelers)) : ''}
    ${row('Booking id', escapeHtml(input.bookingId), true)}
    ${input.bookingRef ? row('Booking reference', escapeHtml(input.bookingRef), true) : ''}
    ${input.pnr ? row('Airline reference (PNR)', escapeHtml(input.pnr), true) : ''}
    ${row('Total charged', escapeHtml(amount))}
  </table>
  <p style="margin: 0 0 24px;">Keep this email — it is your proof of booking.</p>
  <p style="margin: 0; padding-top: 16px; border-top: 1px solid #e5e5e5; font-size: 12px; color: #888;">
    This is a transactional confirmation from templestuart.com for a booking just made
    with this email address. It is not a marketing message.
  </p>
</div>`;

  return { subject, html, text };
}
