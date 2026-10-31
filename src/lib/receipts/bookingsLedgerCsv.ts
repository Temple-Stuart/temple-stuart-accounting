/**
 * RECEIPT-01 (2026-09-26) — THE EXPORT CARRIES THE LEDGER SHAPE.
 *
 * bookings_ledger.csv: one row per reservation of the user, the chain an auditor
 * reads — the booking, the vendor's figure (the receipt leaf's total line, from
 * the landed book answer), the bank row the accepted charge link names, the
 * posted entry's D/C lines, and the refunds the vendor stated. The columns are
 * fixed, in this order and no others. Every unknown is EMPTY, never 0; every
 * amount is the recorded figure, never converted, never summed: a booking with
 * more than one stated refund lists each figure, separated by ';', because a sum
 * would be a computed total and this export computes none.
 *
 * PURE: no prisma, no fetch, no clock. The export route loads the rows and hands
 * them here; node:test drives it with fixtures.
 */
import type { BookingReceipt } from './bookingReceipt';

export const BOOKINGS_LEDGER_COLUMNS = [
  'booking_id', 'lane', 'provider_booking_id', 'confirmation_code', 'status',
  'traveler', 'booked_at', 'service_start', 'service_end',
  'vendor_amount', 'vendor_currency', 'vendor_arrival_id',
  'bank_transaction_id', 'bank_descriptor', 'bank_amount', 'bank_date',
  'journal_entry_id', 'journal_date', 'account_code', 'account_name',
  'debit_cents', 'credit_cents',
  'refund_count', 'refunds_stated_cents', 'refunds_settled_cents',
  'refund_currency',
] as const;

export type BookingsLedgerColumn = (typeof BOOKINGS_LEDGER_COLUMNS)[number];
export type BookingsLedgerRow = Record<BookingsLedgerColumn, string>;

/** The reservation columns the row reads beside the receipt. */
export interface BookingsLedgerReservation {
  id: string;
  lane: string;
  providerBookingId: string;
  providerConfirmationCode: string | null;
  status: string;
  createdAt: Date | string;
  checkinDate: Date | string | null;
  checkoutDate: Date | string | null;
}

const NOT_STATED_HOLDER = 'not stated by the vendor';

function iso(d: Date | string | null | undefined): string {
  if (d === null || d === undefined) return '';
  return typeof d === 'string' ? d : d.toISOString();
}
function isoDay(d: Date | string | null | undefined): string {
  return iso(d).slice(0, 10);
}

/** One row: the reservation's own columns, the receipt's raw figures. Unknown → ''. */
export function bookingsLedgerRow(reservation: BookingsLedgerReservation, receipt: BookingReceipt): BookingsLedgerRow {
  const refunds = receipt.refunds.filter((r) => r.raw.kind === 'refund');
  const stated = refunds.filter((r) => r.raw.status === 'stated' && r.raw.amountCents !== null).map((r) => r.raw.amountCents as string);
  const settled = refunds.filter((r) => r.raw.status === 'settled' && r.raw.amountCents !== null).map((r) => r.raw.amountCents as string);
  const currencies = [...new Set(refunds.map((r) => r.raw.currency).filter((c): c is string => c !== null))];
  return {
    booking_id: reservation.id,
    lane: reservation.lane,
    provider_booking_id: reservation.providerBookingId,
    confirmation_code: reservation.providerConfirmationCode ?? '',
    status: reservation.status,
    traveler: receipt.header.holder === NOT_STATED_HOLDER ? '' : receipt.header.holder,
    booked_at: iso(reservation.createdAt),
    service_start: isoDay(reservation.checkinDate),
    service_end: isoDay(reservation.checkoutDate),
    vendor_amount: receipt.vendor.raw.amount ?? '',
    vendor_currency: receipt.vendor.raw.currency ?? '',
    vendor_arrival_id: receipt.vendor.raw.arrivalId ?? '',
    bank_transaction_id: receipt.bank.raw.transactionId ?? '',
    bank_descriptor: receipt.bank.raw.descriptor ?? '',
    bank_amount: receipt.bank.raw.amount ?? '',
    bank_date: receipt.bank.raw.date ?? '',
    journal_entry_id: receipt.ledger.raw.entryId ?? '',
    journal_date: receipt.ledger.raw.date ?? '',
    account_code: receipt.ledger.raw.accountCode ?? '',
    account_name: receipt.ledger.raw.accountName ?? '',
    debit_cents: receipt.ledger.raw.debitCents ?? '',
    credit_cents: receipt.ledger.raw.creditCents ?? '',
    refund_count: String(refunds.length),
    refunds_stated_cents: stated.join(';'),
    refunds_settled_cents: settled.join(';'),
    refund_currency: currencies.join(';'),
  };
}

/** CSV-escape one cell (RFC 4180: quote when needed, double inner quotes) — the export route's own rule. */
export function csvCell(s: string): string {
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** The whole file: the fixed header, then one line per row in the columns' order. No rows → the header alone. */
export function bookingsLedgerCsv(rows: BookingsLedgerRow[]): string {
  const lines = [BOOKINGS_LEDGER_COLUMNS.map(csvCell).join(',')];
  for (const r of rows) lines.push(BOOKINGS_LEDGER_COLUMNS.map((c) => csvCell(r[c])).join(','));
  return lines.join('\n') + '\n';
}
