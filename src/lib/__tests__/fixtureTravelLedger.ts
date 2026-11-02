/**
 * TRAVEL-02a (Alex, 2026-11-02) — THE TRAVEL LEDGER'S FIXTURES: the `ledger` facts GET /api/reservations answers for one
 * caller, as the route orders them (newest booking first, each booking's money events by statedAt). Four bookings:
 *   · a hotel in PHP, matched to a USD bank row, posted, with two current receipts on the posting;
 *   · a flight in USD, unmatched and unposted, with a stated airline voucher (a voucher is NEGATIVE on the ledger);
 *   · a cancelled hotel, unattached, in USD, matched; its refund stated, its cancellation fee settled, a voucher the
 *     vendor stated no amount for ('amount not stated');
 *   · an unattached activity the vendor stated no price for ('price not stated').
 * The instants straddle a day boundary in Asia/Bangkok (the viewer's zone the tests draw them in), so the DATE rule's two
 * faces — the viewer's day on screen, the instant in the CSV — are both proven.
 */
import type { LedgerBookingIn } from '../reservations/travelLedger';

export const VIEWER_ZONE = 'Asia/Bangkok';

export const HOTEL_PHP: LedgerBookingIn = {
  id: 'res-hotel-php',
  createdAt: '2026-10-20T20:30:00.000Z',
  lane: 'hotel',
  provider: 'liteapi',
  displayName: 'Hotel PHP Proof',
  providerBookingId: 'bk-php',
  confirmation: 'HCC-4421',
  status: 'confirmed',
  finalPriceCents: 1234500,
  currency: 'PHP',
  checkinDate: '2026-10-31',
  checkoutDate: '2026-11-02',
  calendarDay: null,
  trip: { id: 'trip-bali', name: 'Bali 2026' },
  budgetLine: { coaCode: 'P-9200' },
  charge: { matched: true, posted: true, bank: { amount: 212.34, currency: 'USD', date: '2026-10-21' }, postedDay: '2026-10-22', postedEntryId: 'je-hotel-php' },
  receipts: 2,
  moneyEvents: [],
};

export const FLIGHT_USD: LedgerBookingIn = {
  id: 'res-flight-usd',
  createdAt: '2026-10-21T00:00:00.000Z',
  lane: 'flight',
  provider: 'liteapi',
  displayName: 'AirAsia CNX → DPS',
  providerBookingId: 'fb-9Q',
  confirmation: null,
  status: 'confirmed',
  finalPriceCents: 18950,
  currency: 'USD',
  checkinDate: null,
  checkoutDate: null,
  calendarDay: '2026-10-31',
  trip: { id: 'trip-bali', name: 'Bali 2026' },
  budgetLine: null,
  charge: { matched: false, posted: false, bank: null, postedDay: null, postedEntryId: null },
  receipts: 0,
  moneyEvents: [
    { id: 'me-voucher-flight', kind: 'voucher_issued', amountCents: 5000, currency: 'USD', status: 'stated', statedAt: '2026-10-26T03:00:00.000Z', settledAt: null, settledBank: null },
  ],
};

export const HOTEL_CANCELLED: LedgerBookingIn = {
  id: 'res-hotel-cancelled',
  createdAt: '2026-10-23T10:00:00.000Z',
  lane: 'hotel',
  provider: 'liteapi',
  displayName: null,
  providerBookingId: 'bk-7',
  confirmation: 'HCC-7',
  status: 'cancelled',
  finalPriceCents: 30000,
  currency: 'USD',
  checkinDate: '2026-11-10',
  checkoutDate: '2026-11-12',
  calendarDay: null,
  trip: null,
  budgetLine: { coaCode: 'B-6100' },
  charge: { matched: true, posted: false, bank: { amount: 300, currency: 'USD', date: '2026-10-18' }, postedDay: null, postedEntryId: null },
  receipts: 0,
  moneyEvents: [
    { id: 'me-refund', kind: 'refund', amountCents: 30000, currency: 'USD', status: 'stated', statedAt: '2026-10-25T09:00:00.000Z', settledAt: null, settledBank: null },
    { id: 'me-fee', kind: 'cancellation_fee', amountCents: 2500, currency: 'USD', status: 'settled', statedAt: '2026-10-25T09:00:00.000Z', settledAt: '2026-10-29T15:00:00.000Z', settledBank: { amount: 25, currency: 'USD', date: '2026-10-29' } },
    { id: 'me-voucher-null', kind: 'voucher_issued', amountCents: null, currency: null, status: 'stated', statedAt: '2026-10-25T09:00:01.000Z', settledAt: null, settledBank: null },
  ],
};

export const ACTIVITY_UNPRICED: LedgerBookingIn = {
  id: 'res-activity',
  createdAt: '2026-10-24T12:00:00.000Z',
  lane: 'activity',
  provider: 'viator',
  displayName: 'Ubud Rice Terrace Walk',
  providerBookingId: 'v-1',
  confirmation: 'VT-1',
  status: 'pending',
  finalPriceCents: null,
  currency: 'USD',
  checkinDate: null,
  checkoutDate: null,
  calendarDay: null,
  trip: null,
  budgetLine: null,
  charge: { matched: false, posted: false, bank: null, postedDay: null, postedEntryId: null },
  receipts: 0,
  moneyEvents: [],
};

/** The route's order: newest booking first. */
export const LEDGER_FIXTURE: readonly LedgerBookingIn[] = [ACTIVITY_UNPRICED, HOTEL_CANCELLED, FLIGHT_USD, HOTEL_PHP];
