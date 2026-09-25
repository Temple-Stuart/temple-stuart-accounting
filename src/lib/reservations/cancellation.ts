/**
 * CANCEL-01 (2026-09-26) — WHAT A CANCEL ANSWER WRITES.
 *
 * The cancel route lands the vendor's answer as an arrival (liteapi ·
 * cancellation) and then writes what the answer STATES: the reservation's
 * status, one money_events row per money fact (refund, cancellation fee, each
 * voucher issued), and a vouchers row per voucher. This leaf DECIDES those
 * writes, purely, from the parsed answer and the arrival it was read from — so
 * node:test drives every branch with fixtures shaped by the vendor's two doc
 * pages, and the route applies the decision through prisma.
 *
 *   · 200 CANCELLED / CANCELLED_WITH_CHARGES → status 'cancelled'; money rows.
 *   · 202 (status stays CONFIRMED at the airline) → status 'cancel_pending';
 *     NO money rows — nothing is stated finally yet. The webhook receiver and the
 *     scheduled refresh that resolve a 202 into its final status and its money
 *     facts are item 3, NOT this PR.
 *   · a hotel PUT answer → the same money rows (refund, cancellation fee) it
 *     always stated and the route always discarded.
 *
 * NO FALLBACK. An amount the vendor did not state is NULL, never 0. A voucher
 * with no code is not a voucher row (it is named) — its money fact still is.
 * Every row points at the arrival (arrivalId), because the table refuses one
 * that does not.
 *
 * CANCEL-02 (2026-09-26) adds, at the end of this file, who is TOLD about a
 * cancellation (cancelRecipient) and what the email says about the money
 * (cancellationEmailFacts, read from the rows above, never from the answer).
 */
import type { CancelBookingResult } from '../liteapiClient';
import type { FlightCancellationResult, FlightVoucher } from '../liteapiFlightsClient';
import { flightProviderStatusToReservation } from './flightStatus';

export type MoneyEventKind = 'charge' | 'refund' | 'cancellation_fee' | 'change_fee' | 'servicing_fee' | 'ticketing_fee' | 'voucher_issued';

/** One money_events row, exactly as the table takes it. */
export interface MoneyEventRow {
  reservationId: string;
  lane: 'hotel' | 'flight' | 'activity';
  kind: MoneyEventKind;
  /** Integer cents the vendor stated, or NULL — never 0 for unknown. */
  amountCents: number | null;
  currency: string | null;
  refundDestination: string | null;
  status: 'stated';
  vendorReference: string | null;
  arrivalId: string;
  statedAt: Date;
}

/** One vouchers row, exactly as the table takes it. */
export interface VoucherRow {
  reservationId: string;
  vendorVoucherId: string | null;
  code: string;
  airline: string | null;
  amountCents: number | null;
  currency: string | null;
  validFrom: Date | null;
  expiresAt: Date | null;
  passengerNames: string[] | null;
  notes: string | null;
  arrivalId: string;
  statedAt: Date;
}

/** The evidence every row points at. */
export interface CancellationEvidence {
  reservationId: string;
  arrivalId: string;
  /** The instant the vendor's answer arrived — the arrival's clock. */
  statedAt: Date;
}

/** Vendor units → integer cents; absence stays absent. Throws on a non-finite figure. */
export function centsOf(amount: number | null): number | null {
  if (amount === null) return null;
  if (!Number.isFinite(amount)) throw new Error(`a vendor amount must be a finite number, got: ${amount}`);
  return Math.round(amount * 100);
}

/** 'YYYY-MM-DD' → the DATE column's day (midday UTC, the calendar's own idiom); anything else stays null. */
function dayOrNull(iso: string | null): Date | null {
  if (iso === null || !/^\d{4}-\d{2}-\d{2}/.test(iso)) return null;
  return new Date(`${iso.slice(0, 10)}T12:00:00Z`);
}

/** The HOTEL cancel's money facts: the refund and the fee its answer states. */
export function hotelCancelMoneyEvents(parsed: CancelBookingResult, ev: CancellationEvidence): MoneyEventRow[] {
  const base = { reservationId: ev.reservationId, lane: 'hotel' as const, status: 'stated' as const, vendorReference: parsed.bookingId, arrivalId: ev.arrivalId, statedAt: ev.statedAt };
  return [
    { ...base, kind: 'refund', amountCents: centsOf(parsed.refundAmount), currency: parsed.currency, refundDestination: null },
    { ...base, kind: 'cancellation_fee', amountCents: centsOf(parsed.cancellationFee), currency: parsed.currency, refundDestination: null },
  ];
}

export interface FlightCancelDecision {
  /** 'cancelled' on a final 200; 'cancel_pending' on a 202. */
  status: 'cancelled' | 'cancel_pending';
  final: boolean;
  moneyEvents: MoneyEventRow[];
  vouchers: VoucherRow[];
  /** Vouchers the vendor stated without a code — named, not written as a voucher row (their money fact still is). */
  vouchersWithoutCode: FlightVoucher[];
  /** On a final cancel the 'estimated' commission rows move to 'cancelled'. */
  commission: 'cancel' | 'leave';
}

/**
 * What a flight cancel answer writes. The outcome is the HTTP status the vendor
 * answered with: 200 is final, 202 is accepted and awaiting the airline. A 200
 * whose status word does not map to 'cancelled' is a contract deviation and is
 * thrown, never written as cancelled.
 */
export function flightCancelDecision(parsed: FlightCancellationResult, httpStatus: number, ev: CancellationEvidence): FlightCancelDecision {
  if (httpStatus === 202) {
    return { status: 'cancel_pending', final: false, moneyEvents: [], vouchers: [], vouchersWithoutCode: [], commission: 'leave' };
  }
  if (httpStatus !== 200) throw new Error(`flight cancellation answered ${httpStatus} — the reference documents 200 (final) and 202 (awaiting the airline) only`);
  if (flightProviderStatusToReservation(parsed.status) !== 'cancelled') {
    throw new Error(`flight cancellation 200 states status "${parsed.status ?? 'absent'}", which is not a final cancellation — contract deviation from the documented shape`);
  }
  const base = { reservationId: ev.reservationId, lane: 'flight' as const, status: 'stated' as const, arrivalId: ev.arrivalId, statedAt: ev.statedAt };
  const moneyEvents: MoneyEventRow[] = [
    { ...base, kind: 'refund', amountCents: centsOf(parsed.refundAmount), currency: parsed.currency, refundDestination: parsed.destination, vendorReference: parsed.bookingId },
    { ...base, kind: 'cancellation_fee', amountCents: centsOf(parsed.cancellationFee), currency: parsed.currency, refundDestination: null, vendorReference: parsed.bookingId },
  ];
  const vouchers: VoucherRow[] = [];
  const vouchersWithoutCode: FlightVoucher[] = [];
  for (const v of parsed.vouchers) {
    moneyEvents.push({
      ...base,
      kind: 'voucher_issued',
      amountCents: centsOf(v.amount?.amount ?? null),
      currency: v.amount?.currency ?? null,
      refundDestination: 'voucher',
      vendorReference: v.code ?? v.vendorVoucherId,
    });
    if (v.code === null) { vouchersWithoutCode.push(v); continue; }
    vouchers.push({
      reservationId: ev.reservationId,
      vendorVoucherId: v.vendorVoucherId,
      code: v.code,
      airline: v.airline,
      amountCents: centsOf(v.amount?.amount ?? null),
      currency: v.amount?.currency ?? null,
      validFrom: dayOrNull(v.validFrom),
      expiresAt: dayOrNull(v.expiresAt),
      passengerNames: v.passengerNames,
      notes: v.notes,
      arrivalId: ev.arrivalId,
      statedAt: ev.statedAt,
    });
  }
  return { status: 'cancelled', final: true, moneyEvents, vouchers, vouchersWithoutCode, commission: 'cancel' };
}

// ─── CANCEL-02 (2026-09-26): who is told, and what they are told ─────────────

/** The reservation fields the recipient rule reads. */
export interface RecipientRow {
  bookingType: string;
  guestEmail: string | null;
}

export type CancelRecipient = { to: string } | { to: null; reason: 'no_recipient_stated' };

/**
 * WHO HEARS ABOUT A CANCELLATION. An ACCOUNT booking → the owning account's
 * email (the users row the reservation's userId points at). A GUEST booking →
 * reservations.guestEmail, when the book route stated one. Neither → NO send,
 * named. NO FALLBACK: a guest row is never sent to the account holder's address,
 * an account row is never sent to a guest address, nothing is invented.
 *
 * Which rows can be emailed today (main c17dc9dd): every account row (hotel or
 * flight — the cancel route is owner-only, so every cancel it serves is one);
 * a guest HOTEL row (book/route.ts writes guestEmail = holder.email); a guest
 * FLIGHT row CANNOT — flights/book/route.ts writes guestEmail null and SEC-03
 * did not copy prebook_contacts.contactEmail onto the reservation (the row
 * carries no prebookId to look it up by). Guest rows cannot reach the cancel
 * route at all (its ownership gate needs userId), so today this rule serves
 * account rows and states the guest case honestly.
 */
export function cancelRecipient(row: RecipientRow, accountEmail: string | null): CancelRecipient {
  if (row.bookingType === 'account') {
    const email = typeof accountEmail === 'string' ? accountEmail.trim() : '';
    return email.length > 0 ? { to: email } : { to: null, reason: 'no_recipient_stated' };
  }
  const guest = typeof row.guestEmail === 'string' ? row.guestEmail.trim() : '';
  return guest.length > 0 ? { to: guest } : { to: null, reason: 'no_recipient_stated' };
}

/** What the cancelled email says about the money — read from the money_events and vouchers ROWS, never from the answer again. */
export interface CancellationEmailFacts {
  refund: { amountCents: number | null; currency: string | null };
  fee: { amountCents: number | null; currency: string | null };
  destination: string | null;
  vouchers: Array<{ code: string; airline: string | null; amountCents: number | null; currency: string | null; expiresAt: string | null }>;
}

/** YYYY-MM-DD of a DATE-column value, or null. */
function dayString(d: Date | null): string | null {
  return d === null ? null : d.toISOString().slice(0, 10);
}

/**
 * The email's money facts, exactly as money_events holds them: the 'refund' row
 * and the 'cancellation_fee' row (amountCents NULL = "not stated by the vendor"),
 * the refund row's destination, and each vouchers row. A row that does not exist
 * is the same absence as a NULL amount — nothing is invented in its place.
 */
export function cancellationEmailFacts(moneyEvents: MoneyEventRow[], vouchers: VoucherRow[]): CancellationEmailFacts {
  const refund = moneyEvents.find((e) => e.kind === 'refund');
  const fee = moneyEvents.find((e) => e.kind === 'cancellation_fee');
  return {
    refund: { amountCents: refund ? refund.amountCents : null, currency: refund ? refund.currency : null },
    fee: { amountCents: fee ? fee.amountCents : null, currency: fee ? fee.currency : null },
    destination: refund ? refund.refundDestination : null,
    vouchers: vouchers.map((v) => ({ code: v.code, airline: v.airline, amountCents: v.amountCents, currency: v.currency, expiresAt: dayString(v.expiresAt) })),
  };
}
