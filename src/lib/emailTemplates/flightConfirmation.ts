// ─── Flight booking confirmation template (PR-6a) ────────────────────────────
// PURE module: zero imports — input in, rendered strings out. No env reads, no
// app code, no provider SDK. Mirrors the hotel template's conventions
// (bookingConfirmation.ts): exact integer-cents math with a THROW on
// non-integer input, HTML-escaping of every interpolated string, absence
// DECLARED or the row OMITTED — never placeholder values that look like data,
// and the templestuart.com transactional footer.
//
// Itinerary fields are NULLABLE BY DESIGN: the flights route's in-scope data
// (untyped Duffel order return — PR-5 audit) guarantees payment/reference
// fields but not route details. orderId is the guaranteed reference
// (reservations.providerBookingId); bookingReference is the airline PNR when
// Duffel exposed it. The template does NO date math — departureDateTime
// arrives pre-formatted for display.

export interface FlightConfirmationInput {
  /** First passenger, pre-formatted full name. */
  passengerName: string;
  /** Total pax on the order; rendered as "+N more" when > 1. */
  passengerCount: number;
  /** Duffel order id — always present, the guaranteed reference. */
  orderId: string;
  /** Airline PNR when present; absence is declared, never invented. */
  bookingReference: string | null;
  originIata: string | null;
  destinationIata: string | null;
  /** Pre-formatted display string; rendered as-is. */
  departureDateTime: string | null;
  totalAmountCents: number;
  /** ISO 4217 code, e.g. 'USD' — rendered as the code, never a symbol. */
  currency: string;
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

/** Minimal HTML escape for user-/provider-supplied strings interpolated into
 *  the HTML body (names, references, IATAs — never trust them as markup). */
function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function flightConfirmation(input: FlightConfirmationInput): RenderedEmail {
  const amount = `${input.currency} ${centsToAmount(input.totalAmountCents)}`;
  const hasRoute = !!(input.originIata && input.destinationIata);

  // Subject precedence: real route → airline PNR → order id. Never invented
  // route text.
  const subject = hasRoute
    ? `Flight confirmed — ${input.originIata} → ${input.destinationIata}`
    : input.bookingReference
      ? `Flight confirmed — ref ${input.bookingReference}`
      : `Flight confirmed — order ${input.orderId}`;

  const travelers = input.passengerCount > 1
    ? `${input.passengerName} +${input.passengerCount - 1} more`
    : input.passengerName;

  const airlineRefTextLine = input.bookingReference
    ? `Airline reference: ${input.bookingReference}`
    : `Airline reference: not yet issued — use order reference ${input.orderId}`;

  const text = [
    `Hi ${input.passengerName},`,
    '',
    `Your flight booking is confirmed.`,
    '',
    `Travelers: ${travelers}`,
    ...(hasRoute ? [`Route: ${input.originIata} → ${input.destinationIata}`] : []),
    ...(input.departureDateTime ? [`Departure: ${input.departureDateTime}`] : []),
    `Order reference: ${input.orderId}`,
    airlineRefTextLine,
    `Total charged: ${amount}`,
    '',
    `Keep this email — it is your proof of booking.`,
    '',
    '—',
    `This is a transactional confirmation from templestuart.com for a booking`,
    `just made with this email address. It is not a marketing message.`,
  ].join('\n');

  const airlineRefHtmlCell = input.bookingReference
    ? `<strong>${escapeHtml(input.bookingReference)}</strong>`
    : `not yet issued — use order reference <strong>${escapeHtml(input.orderId)}</strong>`;

  const html = `<div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 560px; margin: 0 auto; padding: 24px; color: #1a1a1a;">
  <h1 style="font-size: 20px; margin: 0 0 16px;">Flight confirmed</h1>
  <p style="margin: 0 0 16px;">Hi ${escapeHtml(input.passengerName)}, your flight booking is confirmed.</p>
  <table style="border-collapse: collapse; width: 100%; margin: 0 0 16px;">
    <tr><td style="padding: 6px 12px 6px 0; color: #666;">Travelers</td><td style="padding: 6px 0;">${escapeHtml(travelers)}</td></tr>
    ${hasRoute ? `<tr><td style="padding: 6px 12px 6px 0; color: #666;">Route</td><td style="padding: 6px 0;">${escapeHtml(input.originIata!)} → ${escapeHtml(input.destinationIata!)}</td></tr>` : ''}
    ${input.departureDateTime ? `<tr><td style="padding: 6px 12px 6px 0; color: #666;">Departure</td><td style="padding: 6px 0;">${escapeHtml(input.departureDateTime)}</td></tr>` : ''}
    <tr><td style="padding: 6px 12px 6px 0; color: #666;">Order reference</td><td style="padding: 6px 0;"><strong>${escapeHtml(input.orderId)}</strong></td></tr>
    <tr><td style="padding: 6px 12px 6px 0; color: #666;">Airline reference</td><td style="padding: 6px 0;">${airlineRefHtmlCell}</td></tr>
    <tr><td style="padding: 6px 12px 6px 0; color: #666;">Total charged</td><td style="padding: 6px 0;">${escapeHtml(amount)}</td></tr>
  </table>
  <p style="margin: 0 0 24px;">Keep this email — it is your proof of booking.</p>
  <p style="margin: 0; padding-top: 16px; border-top: 1px solid #e5e5e5; font-size: 12px; color: #888;">
    This is a transactional confirmation from templestuart.com for a booking just made
    with this email address. It is not a marketing message.
  </p>
</div>`;

  return { subject, html, text };
}
