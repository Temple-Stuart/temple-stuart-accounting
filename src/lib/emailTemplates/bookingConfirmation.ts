// ─── Hotel booking confirmation template (PR-Email-2, amended PR-2b) ─────────
// PURE module: zero imports — input in, rendered strings out. No env reads, no
// app code, no provider SDK. Amount rendering rule: the input is integer cents
// + an ISO 4217 code, rendered as "<CODE> <units>.<cc>" with exact integer
// math — no float division, no locale/symbol table, no rounding. Non-integer
// cents THROW (fail-loud) rather than being silently normalized.
//
// PR-2b (provider reality): LiteAPI does not guarantee hotelName or a hotel
// confirmation code at booking time (BookResult marks them optional) — only
// bookingId is always present. So hotelName/confirmationCode are NULLABLE
// here and their ABSENCE IS DECLARED in the rendered email (row omitted, or
// an honest "not yet issued" line) — never papered over with placeholder
// values that look like data. bookingId is the guaranteed reference.

export interface BookingConfirmationInput {
  guestName: string;
  /** Null when neither LiteAPI nor the booking request supplied a name — the
   *  hotel row is then OMITTED (never "Unknown"/"N/A"). */
  hotelName: string | null;
  /** ISO YYYY-MM-DD — rendered as-is, no timezone math. */
  checkinDate: string;
  /** ISO YYYY-MM-DD — rendered as-is, no timezone math. */
  checkoutDate: string;
  /** Null when the hotel has not issued a code yet — rendered as an honest
   *  "not yet issued" line pointing at the booking reference. */
  confirmationCode: string | null;
  /** LiteAPI bookingId — always present (BookResult.bookingId), the guaranteed
   *  reference for this reservation. */
  bookingId: string;
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
 *  the HTML body (names, codes, and bookingId — never trust them as markup). */
function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function bookingConfirmation(input: BookingConfirmationInput): RenderedEmail {
  const amount = `${input.currency} ${centsToAmount(input.totalAmountCents)}`;

  // Subject: the hotel name when we truly have one; the stay window otherwise.
  // Never a placeholder name.
  const subject = input.hotelName
    ? `Booking confirmed — ${input.hotelName}`
    : `Booking confirmed — ${input.checkinDate} to ${input.checkoutDate}`;

  const confirmationTextLine = input.confirmationCode
    ? `Hotel confirmation code: ${input.confirmationCode}`
    : `Hotel confirmation code: not yet issued — use booking reference ${input.bookingId}`;

  const text = [
    `Hi ${input.guestName},`,
    '',
    `Your hotel booking is confirmed.`,
    '',
    ...(input.hotelName ? [`Hotel: ${input.hotelName}`] : []),
    `Check-in: ${input.checkinDate}`,
    `Check-out: ${input.checkoutDate}`,
    `Booking reference: ${input.bookingId}`,
    confirmationTextLine,
    `Total charged: ${amount}`,
    '',
    `Keep this email — it is your proof of booking.`,
    '',
    '—',
    `This is a transactional confirmation from templestuart.com for a booking`,
    `just made with this email address. It is not a marketing message.`,
  ].join('\n');

  const confirmationHtmlCell = input.confirmationCode
    ? `<strong>${escapeHtml(input.confirmationCode)}</strong>`
    : `not yet issued — use booking reference <strong>${escapeHtml(input.bookingId)}</strong>`;

  const html = `<div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 560px; margin: 0 auto; padding: 24px; color: #1a1a1a;">
  <h1 style="font-size: 20px; margin: 0 0 16px;">Booking confirmed</h1>
  <p style="margin: 0 0 16px;">Hi ${escapeHtml(input.guestName)}, your hotel booking is confirmed.</p>
  <table style="border-collapse: collapse; width: 100%; margin: 0 0 16px;">
    ${input.hotelName ? `<tr><td style="padding: 6px 12px 6px 0; color: #666;">Hotel</td><td style="padding: 6px 0;">${escapeHtml(input.hotelName)}</td></tr>` : ''}
    <tr><td style="padding: 6px 12px 6px 0; color: #666;">Check-in</td><td style="padding: 6px 0;">${escapeHtml(input.checkinDate)}</td></tr>
    <tr><td style="padding: 6px 12px 6px 0; color: #666;">Check-out</td><td style="padding: 6px 0;">${escapeHtml(input.checkoutDate)}</td></tr>
    <tr><td style="padding: 6px 12px 6px 0; color: #666;">Booking reference</td><td style="padding: 6px 0;"><strong>${escapeHtml(input.bookingId)}</strong></td></tr>
    <tr><td style="padding: 6px 12px 6px 0; color: #666;">Confirmation code</td><td style="padding: 6px 0;">${confirmationHtmlCell}</td></tr>
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
