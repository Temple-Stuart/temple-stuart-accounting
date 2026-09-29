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
  /** Null when LiteAPI's book answer stated no name — the hotel row is then
   *  OMITTED (never "Unknown"/"N/A"). SEC-02b (2026-09-27): never the booking
   *  request's name — the route no longer reads one. */
  hotelName: string | null;
  /** ISO YYYY-MM-DD — rendered as-is, no timezone math. SEC-02b (2026-09-27): the
   *  vendor's stated day or NULL — a NULL is SAID ("not stated by the hotel"),
   *  never a date from the booking link. */
  checkinDate: string | null;
  /** As checkinDate. */
  checkoutDate: string | null;
  /** Null when the hotel has not issued a code yet — rendered as an honest
   *  "not yet issued" line pointing at the booking reference. */
  confirmationCode: string | null;
  /** LiteAPI bookingId — always present (BookResult.bookingId), the guaranteed
   *  reference for this reservation. */
  bookingId: string;
  /** Integer cents, or NULL — SEC-03 (2026-09-25): the vendor stated no price,
   *  so the ledger holds NULL and this line says "price not stated". Never 0. */
  totalAmountCents: number | null;
  /** ISO 4217 code, e.g. 'USD' — rendered as the code, never a symbol. */
  currency: string;
  /** GUEST-01 (2026-09-29): a GUEST booking's way back — given only for a row with no
   *  account; the email then carries the manage block. An account booking has none. */
  guestManage?: GuestManage;
}

/** GUEST-01: the reference and the manage code that open one guest booking on /booking/manage. */
export interface GuestManage {
  /** The booking's Manage reference — the row's providerBookingId. */
  reference: string;
  /** The 8-character manage code, shown XXXX-XXXX. */
  code: string;
  /** /booking/manage?ref=<reference>, absolute — the code is never in it. Null omits the link line. */
  url: string | null;
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

/** GUEST-01: the manage block, text — the same five lines in every booking email that carries it. */
function guestManageText(g: GuestManage): string[] {
  return [
    'Manage this booking without an account',
    `Manage reference: ${g.reference}`,
    `Manage code: ${g.code.slice(0, 4)}-${g.code.slice(4)}`,
    ...(g.url ? [g.url] : []),
    'Keep this code private — with the reference, it opens this booking.',
  ];
}

/** GUEST-01: the manage block, HTML — the url as a link, omitted when null. */
function guestManageHtml(g: GuestManage): string {
  return `<div style="margin: 0 0 24px; padding: 12px 16px; border: 1px solid #e5e5e5;" data-guest-manage>
    <p style="margin: 0 0 8px; font-weight: 600;">Manage this booking without an account</p>
    <p style="margin: 0 0 4px;">Manage reference: <strong>${escapeHtml(g.reference)}</strong></p>
    <p style="margin: 0 0 4px;">Manage code: <strong>${escapeHtml(`${g.code.slice(0, 4)}-${g.code.slice(4)}`)}</strong></p>
    ${g.url ? `<p style="margin: 0 0 4px;"><a href="${escapeHtml(g.url)}">${escapeHtml(g.url)}</a></p>` : ''}
    <p style="margin: 8px 0 0; font-size: 12px; color: #666;">Keep this code private — with the reference, it opens this booking.</p>
  </div>`;
}

/** SEC-02b: the words for a day the vendor did not state. */
export const DAY_NOT_STATED = 'not stated by the hotel — see your booking reference';

export function bookingConfirmation(input: BookingConfirmationInput): RenderedEmail {
  const checkin = input.checkinDate ?? DAY_NOT_STATED;
  const checkout = input.checkoutDate ?? DAY_NOT_STATED;
  // SEC-03: a price the vendor did not state is SAID — never rendered as 0.00.
  const amount = input.totalAmountCents === null
    ? `price not stated by the hotel — your card statement shows the amount`
    : `${input.currency} ${centsToAmount(input.totalAmountCents)}`;

  // Subject: the hotel name when we truly have one; the stay window otherwise.
  // Never a placeholder name.
  const subject = input.hotelName
    ? `Booking confirmed — ${input.hotelName}`
    : input.checkinDate !== null && input.checkoutDate !== null
      ? `Booking confirmed — ${input.checkinDate} to ${input.checkoutDate}`
      : `Booking confirmed — reference ${input.bookingId}`;

  const confirmationTextLine = input.confirmationCode
    ? `Hotel confirmation code: ${input.confirmationCode}`
    : `Hotel confirmation code: not yet issued — use booking reference ${input.bookingId}`;

  const text = [
    `Hi ${input.guestName},`,
    '',
    `Your hotel booking is confirmed.`,
    '',
    ...(input.hotelName ? [`Hotel: ${input.hotelName}`] : []),
    `Check-in: ${checkin}`,
    `Check-out: ${checkout}`,
    `Booking reference: ${input.bookingId}`,
    confirmationTextLine,
    `Total charged: ${amount}`,
    '',
    ...(input.guestManage ? [...guestManageText(input.guestManage), ''] : []),
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
    <tr><td style="padding: 6px 12px 6px 0; color: #666;">Check-in</td><td style="padding: 6px 0;">${escapeHtml(checkin)}</td></tr>
    <tr><td style="padding: 6px 12px 6px 0; color: #666;">Check-out</td><td style="padding: 6px 0;">${escapeHtml(checkout)}</td></tr>
    <tr><td style="padding: 6px 12px 6px 0; color: #666;">Booking reference</td><td style="padding: 6px 0;"><strong>${escapeHtml(input.bookingId)}</strong></td></tr>
    <tr><td style="padding: 6px 12px 6px 0; color: #666;">Confirmation code</td><td style="padding: 6px 0;">${confirmationHtmlCell}</td></tr>
    <tr><td style="padding: 6px 12px 6px 0; color: #666;">Total charged</td><td style="padding: 6px 0;">${escapeHtml(amount)}</td></tr>
  </table>${input.guestManage ? `\n  ${guestManageHtml(input.guestManage)}` : ''}
  <p style="margin: 0 0 24px;">Keep this email — it is your proof of booking.</p>
  <p style="margin: 0; padding-top: 16px; border-top: 1px solid #e5e5e5; font-size: 12px; color: #888;">
    This is a transactional confirmation from templestuart.com for a booking just made
    with this email address. It is not a marketing message.
  </p>
</div>`;

  return { subject, html, text };
}
