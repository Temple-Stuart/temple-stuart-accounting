/**
 * BOOKINGS-01 (2026-09-27) — ONE ROW PER BOOKING, FROM THE FACTS ALREADY RECORDED.
 *
 * The one list of a user's bookings (GET /api/reservations) builds every row here,
 * from facts other rulings already record and nothing else:
 *   · the reservation — lane and name through the one reader (./lane.ts
 *     reservationIdentity), the service dates, the status, the confirmation code;
 *     for a flight the ticketing (ticketedAt / ticketLimitTime) and, while a cancel
 *     is pending, the vendor's cancelIntentAt; the last vendor read (STATUS-01);
 *   · the flight's service day as the vendor stated it — its calendar row
 *     (CAL-01 / LANE-01: source 'reservation', from the outbound departure);
 *     CAL-02 (2026-09-27): a flight has one row per stated segment now — the list
 *     route folds them to the reservation and hands the earliest day here;
 *   · the bank — an ACCEPTED CHARGE link (MATCH: transaction_reservation_links,
 *     status 'accepted', no money event);
 *   · the ledger — a POSTED entry that documents the charge (POST-01:
 *     journal_entries.document_reservation_id, no money event);
 *   · the budget line — the owner's link (LINK-02: reservation_budget_links);
 *   · the vendor price and currency AS RECORDED; the receipt (RECEIPT-01) and the trip;
 *   · CAL-02 (2026-09-27): the booking's calendar file (/api/reservations/<id>/ics).
 *
 * Every word is this file's; an absent fact says so. Nothing is computed: no status
 * is derived, no amount is converted or added — the recorded price (integer
 * hundredths, the column's convention) is written with its point placed by string,
 * never by arithmetic.
 *
 * THIS FILE IS PURE: no prisma, no fetch, no clock, no React, no env; its one import
 * is the pure lane reader.
 */
import { LANE_WORD, reservationIdentity } from './lane';

/** The reservation columns a row reads — exactly the recorded ones. */
export interface BookingRowReservation {
  id: string;
  lane: string;
  displayName: string | null;
  providerConfirmationCode: string | null;
  providerBookingId: string;
  status: string;
  tripId: string | null;
  checkinDate: Date | string | null;
  checkoutDate: Date | string | null;
  ticketedAt: Date | string | null;
  ticketLimitTime: Date | string | null;
  cancelIntentAt: Date | string | null;
  lastVendorReadAt: Date | string | null;
  finalPriceCents: number | null;
  currency: string;
  createdAt: Date | string;
}

/** The facts the route loaded for one reservation. */
export interface BookingRowFacts {
  reservation: BookingRowReservation;
  /** The flight's service day from its calendar row (the vendor's outbound), or null. */
  calendarDay: Date | string | null;
  /** An accepted CHARGE link exists (a human's accept in Runway). */
  chargeMatched: boolean;
  /** A posted entry documents the charge. */
  chargePosted: boolean;
  /** The owner's budget-line link, with the line's description — or null. */
  budgetLine: { description: string | null } | null;
}

export interface BookingRow {
  id: string;
  laneWord: string;
  name: string;
  dates: string;
  status: string;
  /** Set only while a cancel is pending: the vendor's stated instant, or that it stated none. */
  cancellation: string | null;
  confirmation: string;
  /** Flights only: ticketed / the deadline / not yet — null for a stay or an activity. */
  ticketing: string | null;
  vendorRead: string;
  bank: string;
  ledger: string;
  budgetLine: string;
  price: string;
  receiptHref: string;
  tripHref: string | null;
  /** CAL-02 (2026-09-27): the booking as an iCalendar file — its rows, for any calendar app. */
  icsHref: string;
}

/** CAL-02 (2026-09-27): the ONE href of a booking's calendar file — the list and the receipt both link it. */
export function bookingIcsHref(reservationId: string): string {
  return `/api/reservations/${reservationId}/ics`;
}

/** Every word the list shows — the page types none. */
export const BOOKING_WORDS = {
  heading: 'Bookings',
  loading: 'reading your bookings…',
  unreadable: 'your bookings could not be read',
  none: 'no bookings yet',
  signIn: 'sign in to see your bookings.',
  receipt: 'Receipt',
  trip: 'Trip',
  /** CAL-02 (2026-09-27): the link to the booking's calendar file. */
  addToCalendar: 'Add to calendar',
  columns: {
    booking: 'Booking',
    dates: 'Dates',
    status: 'Status',
    confirmation: 'Confirmation',
    ticketing: 'Ticketing',
    bank: 'Bank',
    ledger: 'Ledger',
    budgetLine: 'Budget line',
    price: 'Vendor price',
  },
  noDates: 'no service dates stated',
  departs: 'departs',
  notYetStated: 'not yet stated',
  ticketedAt: 'ticketed at',
  ticketBy: 'ticket by',
  notYetTicketed: 'not yet ticketed',
  cancelRequestedAt: 'cancellation requested — the vendor stated it at',
  cancelRequestedNoTime: 'cancellation requested — the vendor stated no time',
  vendorReadAt: 'vendor state read at',
  notYetRead: 'not yet read from the vendor',
  matched: 'matched',
  notMatched: 'not matched',
  posted: 'posted',
  notPosted: 'not posted',
  noBudgetLine: 'no budget line',
  noDescription: '(no description)',
  priceNotStated: 'price not stated by the vendor',
  flight: 'flight',
  /** A column that does not apply to this lane (ticketing on a stay). */
  notApplicable: '—',
} as const;

/** The status column's values in words; any other value renders AS ITSELF — never a guess. */
export const STATUS_WORDS: Readonly<Record<string, string>> = {
  pending: 'pending with the vendor',
  confirmed: 'confirmed',
  cancel_pending: 'cancellation requested — awaiting the airline',
  cancelled: 'cancelled',
  failed: 'failed',
};

const iso = (d: Date | string): string => (typeof d === 'string' ? d : d.toISOString());
const day = (d: Date | string): string => iso(d).slice(0, 10);

/** The recorded price in its own unit: integer hundredths, the point placed by string. */
function priceWords(cents: number | null, currency: string): string {
  if (cents === null) return BOOKING_WORDS.priceNotStated;
  const digits = String(cents);
  // A stated price is a non-negative integer; anything else is shown exactly as recorded.
  if (!/^\d+$/.test(digits)) return `${digits} (hundredths, as recorded) ${currency}`;
  const padded = digits.padStart(3, '0');
  return `${padded.slice(0, -2)}.${padded.slice(-2)} ${currency}`;
}

function datesWords(r: BookingRowReservation, calendarDay: Date | string | null): string {
  if (r.checkinDate !== null && r.checkoutDate !== null) return `${day(r.checkinDate)} → ${day(r.checkoutDate)}`;
  if (r.checkinDate !== null) return day(r.checkinDate);
  if (r.lane === BOOKING_WORDS.flight && calendarDay !== null) return `${BOOKING_WORDS.departs} ${day(calendarDay)}`;
  return BOOKING_WORDS.noDates;
}

function ticketingWords(r: BookingRowReservation): string | null {
  if (r.lane !== BOOKING_WORDS.flight) return null;
  if (r.ticketedAt !== null) return `${BOOKING_WORDS.ticketedAt} ${iso(r.ticketedAt)}`;
  if (r.ticketLimitTime !== null) return `${BOOKING_WORDS.ticketBy} ${iso(r.ticketLimitTime)}`;
  return BOOKING_WORDS.notYetTicketed;
}

export function bookingRowOf(facts: BookingRowFacts): BookingRow {
  const r = facts.reservation;
  const identity = reservationIdentity(r);
  const code = typeof r.providerConfirmationCode === 'string' ? r.providerConfirmationCode.trim() : '';
  const lineDescription = facts.budgetLine?.description?.trim() ?? '';
  return {
    id: r.id,
    laneWord: LANE_WORD[identity.type],
    name: identity.name,
    dates: datesWords(r, facts.calendarDay),
    status: STATUS_WORDS[r.status] ?? r.status,
    cancellation: r.status !== 'cancel_pending'
      ? null
      : r.cancelIntentAt !== null ? `${BOOKING_WORDS.cancelRequestedAt} ${iso(r.cancelIntentAt)}` : BOOKING_WORDS.cancelRequestedNoTime,
    confirmation: code.length > 0 ? code : BOOKING_WORDS.notYetStated,
    ticketing: ticketingWords(r),
    vendorRead: r.lastVendorReadAt !== null ? `${BOOKING_WORDS.vendorReadAt} ${iso(r.lastVendorReadAt)}` : BOOKING_WORDS.notYetRead,
    bank: facts.chargeMatched ? BOOKING_WORDS.matched : BOOKING_WORDS.notMatched,
    ledger: facts.chargePosted ? BOOKING_WORDS.posted : BOOKING_WORDS.notPosted,
    budgetLine: facts.budgetLine === null ? BOOKING_WORDS.noBudgetLine : lineDescription.length > 0 ? lineDescription : BOOKING_WORDS.noDescription,
    price: priceWords(r.finalPriceCents, r.currency),
    receiptHref: `/booking/${r.id}/receipt`,
    tripHref: r.tripId === null ? null : `/budgets/trips/${r.tripId}`,
    icsHref: bookingIcsHref(r.id),
  };
}
