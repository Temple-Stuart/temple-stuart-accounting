// ─── Lifecycle emails — CANCEL-02 (2026-09-26) ───────────────────────────────
// ONE LEAF, keyed on the event kind, for what happens to a booking AFTER it is
// booked. The two booking confirmations stay where they are
// (bookingConfirmation.ts, flightConfirmation.ts); this file is what a customer
// hears when the booking's life moves on:
//
//   'cancelled'        — fired by the cancel route on a FINAL cancel (200): what
//                        was cancelled, the refund and the fee AS STATED by the
//                        vendor (a NULL amount says "not stated by the vendor",
//                        never 0), where the refund goes in plain words, any
//                        voucher with its code and expiry, and the one sentence
//                        about the next email. No timeline this app does not
//                        control.
//   'cancel_pending'   — fired by the cancel route on a 202: the airline accepted
//                        the request and has not finalized; the booking stays
//                        confirmed until it does; what happens next; the reference.
//   'ticketed'         — the airline issued the ticket after a PENDING booking.
//                        Documented as fired by STATUS-01; NO caller in CANCEL-02
//                        (a test asserts zero callers today).
//   'hotel_confirmation_arrived'
//                      — the hotel issued its confirmation code after booking.
//                        Documented as fired by STATUS-01; NO caller in CANCEL-02.
//
// EVERY TEMPLATE: an absent field OMITS its line — never a placeholder, never
// "undefined", "null", "$0" or "NaN". The manage link points where the booking
// can be seen TODAY — the travel tab — and is omitted when the caller has no
// origin to build it from. Pure: no env, no clock, no fetch.

import { destinationWords } from '@/lib/reservations/cancellationWords';

export interface RenderedEmail {
  subject: string;
  html: string;
  text: string;
}

/** A money figure as money_events holds it: integer cents, or NULL = not stated. */
export interface LifecycleMoney {
  amountCents: number | null;
  currency: string | null;
}

/** A voucher as the vouchers table holds it. */
export interface LifecycleVoucher {
  code: string;
  airline: string | null;
  amountCents: number | null;
  currency: string | null;
  /** YYYY-MM-DD, or null when the vendor stated none. */
  expiresAt: string | null;
}

interface LifecycleCommon {
  /** The one reader's name for the row — a stated hotel or route, else the lane word and the reference. */
  name: string;
  lane: 'hotel' | 'flight' | 'activity';
  /** The human confirmation code the vendor gave, else the provider's booking id. */
  reference: string;
  /** A stay's dates (YYYY-MM-DD) — null on a flight. */
  checkinDate: string | null;
  checkoutDate: string | null;
  /** Where the booking can be seen today, absolute. Null omits the line. */
  manageUrl: string | null;
}

export type LifecycleInput =
  | (LifecycleCommon & {
      kind: 'cancelled';
      refund: LifecycleMoney;
      fee: LifecycleMoney;
      /** The vendor's destination word, verbatim, or null. */
      destination: string | null;
      vouchers: LifecycleVoucher[];
      /** The vendor's final status word (CANCELLED | CANCELLED_WITH_CHARGES), or null. */
      providerStatus: string | null;
    })
  | (LifecycleCommon & { kind: 'cancel_pending' })
  | (LifecycleCommon & { kind: 'ticketed'; pnr: string | null })
  | (LifecycleCommon & { kind: 'hotel_confirmation_arrived'; confirmationCode: string });

export type LifecycleKind = LifecycleInput['kind'];

/** Integer cents → "1234.56". Throws on a non-integer — never rounds silently. */
function centsToAmount(cents: number): string {
  if (!Number.isSafeInteger(cents)) {
    throw new Error(`amountCents must be an integer number of cents, got: ${cents}`);
  }
  const sign = cents < 0 ? '-' : '';
  const abs = Math.abs(cents);
  return `${sign}${Math.floor(abs / 100)}.${String(abs % 100).padStart(2, '0')}`;
}

/** A stated figure with its currency, or the honest absence — the ruling's own words. */
export function statedMoney(m: LifecycleMoney, what: 'refund amount' | 'fee'): string {
  if (m.amountCents === null) return `${what} not stated by the vendor`;
  return `${m.currency ? `${m.currency} ` : ''}${centsToAmount(m.amountCents)}`;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

const LANE_NOUN: Record<LifecycleCommon['lane'], string> = { hotel: 'hotel booking', flight: 'flight', activity: 'activity booking' };

/** The lines every lifecycle email shares: what the booking is, when, its reference. */
function identityLines(input: LifecycleCommon): Array<[string, string]> {
  const lines: Array<[string, string]> = [['Booking', input.name]];
  if (input.checkinDate && input.checkoutDate) lines.push(['Dates', `${input.checkinDate} → ${input.checkoutDate}`]);
  lines.push(['Reference', input.reference]);
  return lines;
}

function voucherLine(v: LifecycleVoucher): string {
  const amount = v.amountCents === null ? 'amount not stated by the vendor' : `${v.currency ? `${v.currency} ` : ''}${centsToAmount(v.amountCents)}`;
  return `Voucher ${v.code}${v.airline ? ` (${v.airline})` : ''}: ${amount}${v.expiresAt ? ` · expires ${v.expiresAt}` : ''}`;
}

const FOOTER_TEXT = ['—', 'This is a transactional message from templestuart.com about a booking made', 'with this email address. It is not a marketing message.'];
const FOOTER_HTML = `<p style="margin: 0; padding-top: 16px; border-top: 1px solid #e5e5e5; font-size: 12px; color: #888;">
    This is a transactional message from templestuart.com about a booking made
    with this email address. It is not a marketing message.
  </p>`;

/** One render, shared: a headline, a sentence, labelled rows, extra paragraphs, the manage link. */
function render(input: LifecycleCommon, headline: string, sentence: string, rows: Array<[string, string]>, paragraphs: string[]): RenderedEmail {
  const text = [
    'Hi,',
    '',
    sentence,
    '',
    ...rows.map(([label, value]) => `${label}: ${value}`),
    '',
    ...paragraphs.flatMap((p) => [p, '']),
    ...(input.manageUrl ? [`See this booking: ${input.manageUrl}`, ''] : []),
    ...FOOTER_TEXT,
  ].join('\n');

  const row = ([label, value]: [string, string]) =>
    `<tr><td style="padding: 6px 12px 6px 0; color: #666;">${escapeHtml(label)}</td><td style="padding: 6px 0;">${escapeHtml(value)}</td></tr>`;

  const html = `<div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 560px; margin: 0 auto; padding: 24px; color: #1a1a1a;">
  <h1 style="font-size: 20px; margin: 0 0 16px;">${escapeHtml(headline)}</h1>
  <p style="margin: 0 0 16px;">Hi, ${escapeHtml(sentence)}</p>
  <table style="border-collapse: collapse; width: 100%; margin: 0 0 16px;">
    ${rows.map(row).join('\n    ')}
  </table>
  ${paragraphs.map((p) => `<p style="margin: 0 0 16px;">${escapeHtml(p)}</p>`).join('\n  ')}
  ${input.manageUrl ? `<p style="margin: 0 0 24px;"><a href="${escapeHtml(input.manageUrl)}">See this booking</a></p>` : ''}
  ${FOOTER_HTML}
</div>`;

  return { subject: `${headline} — ${input.name}`, html, text };
}

export function lifecycleEmail(input: LifecycleInput): RenderedEmail {
  switch (input.kind) {
    case 'cancelled': {
      const rows = identityLines(input);
      rows.push(['Refund', statedMoney(input.refund, 'refund amount')]);
      rows.push(['Cancellation fee', statedMoney(input.fee, 'fee')]);
      if (input.destination !== null) rows.push(['Refund goes', destinationWords(input.destination)]);
      if (input.providerStatus) rows.push(['Vendor status', input.providerStatus]);
      const paragraphs = [
        ...input.vouchers.map(voucherLine),
        'We will email you again when the vendor confirms the refund was issued.',
      ];
      return render(input, 'Booking cancelled', `your ${LANE_NOUN[input.lane]} is cancelled. The vendor has stated what follows.`, rows, paragraphs);
    }
    case 'cancel_pending': {
      const rows = identityLines(input);
      return render(
        input,
        'Cancellation requested',
        `your cancellation request for this ${LANE_NOUN[input.lane]} has been accepted by the airline and is awaiting its confirmation. The booking stays confirmed until the airline finalizes the cancellation.`,
        rows,
        ['When the airline finalizes it, the refund and any fee are stated, and we will email you those figures.'],
      );
    }
    case 'ticketed': {
      // STATUS-01 fires this; CANCEL-02 has no caller.
      const rows = identityLines(input);
      if (input.pnr) rows.push(['Airline reference (PNR)', input.pnr]);
      return render(input, 'Ticket issued', 'the airline has issued your ticket. Your reference below is valid for travel.', rows, []);
    }
    case 'hotel_confirmation_arrived': {
      // STATUS-01 fires this; CANCEL-02 has no caller.
      const rows = identityLines(input);
      rows.push(['Confirmation code', input.confirmationCode]);
      return render(input, 'Hotel confirmation received', 'the hotel has issued its confirmation code for your stay.', rows, []);
    }
  }
}
