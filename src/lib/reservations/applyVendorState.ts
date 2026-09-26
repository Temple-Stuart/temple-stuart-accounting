/**
 * STATUS-01 (2026-09-26) — ONE APPLY LEAF: THE VENDOR'S CURRENT TRUTH ONTO A ROW.
 *
 * Given a reservation row and what the vendor's GET STATED (already landed as an
 * arrival — liteapi · booking_read — never the HTTP object), apply it through
 * ports, purely, so node:test drives every branch with fixtures shaped by the
 * two GET references. This is the ONLY writer of ticketedAt, ticketLimitTime,
 * lastVendorReadAt, ticketedEmailSentAt and confirmationEmailSentAt (the status
 * law), and the one place a post-booking read changes a reservation. Its callers:
 * the webhook receiver, the scheduled refresh, the retro, and LANE-01's
 * refreshFlightReservation (which keeps its own displayName + CAL-01 row logic and
 * hands the status to this leaf).
 *
 *   · status — through the lane's leaf (hotelStatus.ts / flightStatus.ts), by
 *     name; a word outside the leaf's list, or no word, is 'unlisted': the row is
 *     UNCHANGED and the reason is named. No default, ever.
 *   · THE CANCEL-PENDING GUARD (CANCEL-01, moved here and made stricter): a
 *     cancel_pending row never flips back to confirmed while the vendor still says
 *     CONFIRMED, and never to pending either — it waits for a FINAL word.
 *   · cancel_pending → cancelled: cancelIntentAt is cleared, the calendar row is
 *     marked through markBookingCalendarCancelled, the 'estimated' commission rows
 *     move to 'cancelled' exactly as the cancel route does it, and NO money_events
 *     are written: the flight GET does not document the refund and penalty figures
 *     (docs.liteapi.travel/reference/get_flights-bookings-bookingid — refund/fee
 *     rules appear only under journey.terms; no refunded amount, no fee charged),
 *     so the final figures are NOT available from the booking read. Named in the
 *     outcome and the log; nothing is invented in their place.
 *   · providerConfirmationCode — when the vendor states one and ours is null (a
 *     hotel's hotelConfirmationCode, a flight's PNR); a stated code never
 *     overwrites a stated code.
 *   · ticketedAt, ticketLimitTime — when the airline states them and ours is null.
 *   · lastVendorReadAt — the landed response's own arrival timestamp, on every
 *     successful read. Never new Date() in this leaf.
 *   · EMAILS: 'hotel_confirmation_arrived' when the code went null → stated and
 *     confirmationEmailSentAt is null; 'ticketed' when ticketedAt went null →
 *     stated and ticketedEmailSentAt is null. The MARKER rides the SAME patch as
 *     the change. STATUS-01b (2026-09-26): the marker is HALF of the send-once
 *     rule — this leaf never re-reads, so the other half is the row lock the read
 *     leaf takes (vendorRead.ts re-selects the row FOR UPDATE inside its
 *     transaction and hands THAT row here): the second of two overlapping reads
 *     waits for the first commit and then sees the marker set. The caller sends
 *     AFTER its transaction commits, and a failed send is written to audit_log by
 *     name and is not retried automatically. The marker means "the one attempt
 *     was made".
 *
 * Re-reading an unchanged booking changes nothing and sends nothing: `changes`
 * is empty and `emails` is empty; only lastVendorReadAt — the read's own
 * bookkeeping, not a fact about the booking — is stamped.
 *
 * COMM-01 (2026-09-26) — THE LOCK. The vendor's rule
 * (docs.liteapi.travel/docs/revenue-management-and-commission): "A booking is
 * confirmed when a guest completes their stay and checks out of the hotel. Once
 * this happens, your commission will be locked in and included in the next
 * weekly payout." So this leaf locks the commission EXACTLY when: lane hotel AND
 * the vendor's word maps to 'confirmed' AND the stay's check-out DATE is before
 * the read's landed instant (row.checkoutDate < vendor.readAt — no clock here)
 * AND the GET STATED `commission`. Through the commission port: the 'estimated'
 * ledger row moves to 'confirmed' carrying the vendor's figures, the read
 * instant and the read's arrival. A stated 0 is stated (locked at 0, by name).
 * No commission on the read after checkout → no lock, named. A second read finds
 * no 'estimated' row → count 0 → already locked, nothing changes. A flight is
 * never locked (NOT DOCUMENTED). 'paid' is not written here (MATCH-02 / POST-01).
 */
import { flightProviderStatusToReservation } from './flightStatus';
import { hotelProviderStatusToReservation } from './hotelStatus';
import { markBookingCalendarCancelled, type BookingCalendarCancelPort } from '../calendar/bookingEvent';

/** What the hotel GET stated, as parseHotelBookingState reads it, plus when the answer arrived. */
export interface VendorHotelState {
  lane: 'hotel';
  bookingId: string;
  status: string | null;
  hotelConfirmationCode: string | null;
  /** COMM-01: the GET's documented commission figures, verbatim in the booking currency; null when unstated. */
  commission: number | null;
  distributorCommission: number | null;
  clientCommission: number | null;
  processingFee: number | null;
  /** COMM-01: the arrival the read landed as (liteapi · booking_read) — the lock's evidence; null on a dry run. */
  arrivalId: string | null;
  /** The landed response's own arrival instant. */
  readAt: Date;
}

/** What the flight GET stated, as parseFlightBookingDetails reads it, plus when the answer arrived. */
export interface VendorFlightState {
  lane: 'flight';
  bookingId: string;
  status: string | null;
  pnr: string | null;
  ticketedAt: string | null;
  ticketLimitTime: string | null;
  cancelIntentAt: string | null;
  readAt: Date;
}

export type VendorState = VendorHotelState | VendorFlightState;

/** The reservation columns this leaf reads and may write. */
export interface ApplyRow {
  id: string;
  lane: string;
  status: string;
  providerConfirmationCode: string | null;
  ticketedAt: Date | null;
  ticketLimitTime: Date | null;
  cancelIntentAt: Date | null;
  ticketedEmailSentAt: Date | null;
  confirmationEmailSentAt: Date | null;
  /** COMM-01: the stay's check-out DATE (null for a flight) — the lock's gate against the read instant. */
  checkoutDate: Date | null;
}

/** COMM-01: what the lock writes — the vendor's figures in cents, verbatim; null when unstated. */
export interface CommissionFigures {
  lockedCommissionCents: number;
  distributorCommissionCents: number | null;
  clientCommissionCents: number | null;
  processingFeeCents: number | null;
}

export type CommissionLockOutcome =
  | { outcome: 'locked'; cents: number }
  | { outcome: 'already_locked'; cents: number }
  | { outcome: 'not_stated' }
  | { outcome: 'before_checkout' }
  | { outcome: 'not_applicable' };

export type OurStatus = 'pending' | 'confirmed' | 'cancelled' | 'failed';

/** ONE write of the fields that changed, plus the read stamp. */
export interface ReservationPatch {
  status?: OurStatus;
  providerConfirmationCode?: string;
  ticketedAt?: Date;
  ticketLimitTime?: Date;
  cancelIntentAt?: null;
  lastVendorReadAt: Date;
  ticketedEmailSentAt?: Date;
  confirmationEmailSentAt?: Date;
}

export type LifecycleEmailRequest =
  | { kind: 'ticketed' }
  | { kind: 'hotel_confirmation_arrived'; confirmationCode: string };

export interface ApplyPorts {
  /** ONE write per apply — the patch always carries lastVendorReadAt. */
  writeReservation(id: string, patch: ReservationPatch): Promise<void>;
  /** The CAL-01 mark port (prismaBookingCalendar in production). */
  calendar: BookingCalendarCancelPort;
  /** commission_ledger: reservationId + status 'estimated' → 'cancelled'; answers how many moved. */
  cancelCommission(reservationId: string): Promise<number>;
  /** COMM-01: commission_ledger: reservationId + status 'estimated' → 'confirmed' with the vendor's figures, the read instant and its arrival; answers how many locked (0 = already locked). */
  lockCommission(reservationId: string, figures: CommissionFigures, lockedAt: Date, arrivalId: string | null): Promise<number>;
  /** Named lines, once each; default silent. */
  log?: (line: string) => void;
}

export interface ApplyOutcome {
  /** Every fact that changed, by name — empty when the read changed nothing. */
  changes: string[];
  status: 'set' | 'unchanged' | 'unlisted';
  statusValue: string;
  providerStatus: string | null;
  /** The emails the caller sends AFTER its transaction commits; their markers are already in the patch. */
  emails: LifecycleEmailRequest[];
  /** On a status that became cancelled: how many calendar rows were marked and commission rows moved. */
  calendarMarked: number | null;
  commissionMoved: number | null;
  /** On a status that became cancelled: the final figures are not on the booking read — named, never invented. */
  moneyEvents: 'not_available_from_read' | null;
  /** COMM-01: what the lock did on this read. */
  commissionLock: CommissionLockOutcome;
}

/** COMM-01: a stated figure in cents, or null when unstated — never 0 for absent. */
function centsOf(figure: number | null): number | null {
  return figure === null ? null : Math.round(figure * 100);
}

/** The vendor's ISO timestamp as a Date, or null when absent or unparseable (named by the caller). */
function instantOf(iso: string | null): Date | null {
  if (iso === null) return null;
  const t = Date.parse(iso);
  return Number.isNaN(t) ? null : new Date(t);
}

export async function applyVendorState(ports: ApplyPorts, row: ApplyRow, vendor: VendorState): Promise<ApplyOutcome> {
  if (row.lane !== vendor.lane) {
    throw new Error(`reservation ${row.id} is lane "${row.lane}" but the vendor state read is a ${vendor.lane} booking — the wrong GET was applied`);
  }
  const log = ports.log ?? (() => {});
  const patch: ReservationPatch = { lastVendorReadAt: vendor.readAt };
  const changes: string[] = [];
  const emails: LifecycleEmailRequest[] = [];

  // ── THE STATUS — the vendor's word, through the lane's leaf, or unchanged ──
  const mapped = vendor.lane === 'hotel' ? hotelProviderStatusToReservation(vendor.status) : flightProviderStatusToReservation(vendor.status);
  let status: 'set' | 'unchanged' | 'unlisted';
  if (mapped === null) {
    status = 'unlisted';
    log(`[applyVendorState] reservation ${row.id}: the vendor stated ${vendor.status === null ? 'NO status' : `status "${vendor.status}"`}, a word the ${vendor.lane} leaf does not list — status left as "${row.status}"`);
  }
  else if (mapped === row.status) status = 'unchanged';
  // CANCEL-01's guard, moved here (stricter): a cancel the airline ACCEPTED but has
  // not finalized leaves the vendor's status CONFIRMED (or a pending word); neither
  // may undo the request. The row waits for a FINAL word.
  else if (row.status === 'cancel_pending' && mapped === 'confirmed') status = 'unchanged';
  else if (row.status === 'cancel_pending' && mapped === 'pending') status = 'unchanged';
  else { status = 'set'; patch.status = mapped; changes.push(`status ${row.status} → ${mapped} (vendor ${vendor.status})`); }

  let calendarMarked: number | null = null;
  let commissionMoved: number | null = null;
  let moneyEvents: 'not_available_from_read' | null = null;
  if (patch.status === 'cancelled') {
    if (row.cancelIntentAt !== null) { patch.cancelIntentAt = null; changes.push('cancelIntentAt cleared — the cancellation is final'); }
    calendarMarked = await markBookingCalendarCancelled(ports.calendar, row.id).then((r) => r.marked);
    commissionMoved = await ports.cancelCommission(row.id);
    if (commissionMoved === 0) log(`[applyVendorState] reservation ${row.id}: no estimated commission row moved — a commission already locked ('confirmed') on a booking the vendor cancelled after checkout is left as is; the vendor documents no reversal (COMM-01)`);
    moneyEvents = 'not_available_from_read';
    log(`[applyVendorState] reservation ${row.id}: cancelled by the vendor — calendar rows marked ${calendarMarked}, commission rows moved ${commissionMoved}; the refund and fee figures are NOT available from the booking read (the GET documents none), so no money_events row is written`);
  }

  // ── THE CONFIRMATION CODE — stated by the vendor, ours null ────────────────
  const statedCode = vendor.lane === 'hotel' ? vendor.hotelConfirmationCode : vendor.pnr;
  if (statedCode !== null && row.providerConfirmationCode === null) {
    patch.providerConfirmationCode = statedCode;
    changes.push(`providerConfirmationCode null → "${statedCode}"`);
    if (vendor.lane === 'hotel') {
      if (row.confirmationEmailSentAt === null) {
        patch.confirmationEmailSentAt = vendor.readAt;
        emails.push({ kind: 'hotel_confirmation_arrived', confirmationCode: statedCode });
      } else {
        log(`[applyVendorState] reservation ${row.id}: confirmation code arrived but its email was already attempted at ${row.confirmationEmailSentAt.toISOString()} — no second send`);
      }
    }
  }

  // ── THE TICKET — the airline's own timestamps ──────────────────────────────
  if (vendor.lane === 'flight') {
    if (vendor.ticketedAt !== null && row.ticketedAt === null) {
      const at = instantOf(vendor.ticketedAt);
      if (at === null) {
        log(`[applyVendorState] reservation ${row.id}: ticketData.ticketedAt "${vendor.ticketedAt}" is not a timestamp — left NULL`);
      } else {
        patch.ticketedAt = at;
        changes.push(`ticketedAt null → ${vendor.ticketedAt}`);
        if (row.ticketedEmailSentAt === null) {
          patch.ticketedEmailSentAt = vendor.readAt;
          emails.push({ kind: 'ticketed' });
        } else {
          log(`[applyVendorState] reservation ${row.id}: ticketed, but its email was already attempted at ${row.ticketedEmailSentAt.toISOString()} — no second send`);
        }
      }
    }
    if (vendor.ticketLimitTime !== null && row.ticketLimitTime === null) {
      const at = instantOf(vendor.ticketLimitTime);
      if (at === null) log(`[applyVendorState] reservation ${row.id}: ticketLimitTime "${vendor.ticketLimitTime}" is not a timestamp — left NULL`);
      else { patch.ticketLimitTime = at; changes.push(`ticketLimitTime null → ${vendor.ticketLimitTime}`); }
    }
  }

  // ── THE LOCK — COMM-01 (2026-09-26): the vendor's rule, exactly ────────────
  // lane hotel, the vendor's word maps to confirmed, the check-out DATE is before
  // the read's landed instant, and the GET STATED a commission. A stated 0 is stated.
  let commissionLock: CommissionLockOutcome = { outcome: 'not_applicable' };
  if (vendor.lane === 'hotel' && mapped === 'confirmed') {
    const afterCheckout = row.checkoutDate !== null && row.checkoutDate < vendor.readAt;
    if (!afterCheckout) {
      commissionLock = { outcome: 'before_checkout' };
    } else if (vendor.commission === null) {
      commissionLock = { outcome: 'not_stated' };
      log(`[applyVendorState] reservation ${row.id}: the vendor stated no commission on the read after checkout — stays estimated`);
    } else {
      const cents = Math.round(vendor.commission * 100);
      const figures: CommissionFigures = {
        lockedCommissionCents: cents,
        distributorCommissionCents: centsOf(vendor.distributorCommission),
        clientCommissionCents: centsOf(vendor.clientCommission),
        processingFeeCents: centsOf(vendor.processingFee),
      };
      const locked = await ports.lockCommission(row.id, figures, vendor.readAt, vendor.arrivalId);
      if (locked > 0) {
        commissionLock = { outcome: 'locked', cents };
        changes.push(`commission locked at ${cents} cents (vendor commission ${vendor.commission}${cents === 0 ? ' — a stated 0' : ''}; checkout ${row.checkoutDate?.toISOString().slice(0, 10)} < read ${vendor.readAt.toISOString()})`);
        log(`[applyVendorState] reservation ${row.id}: commission LOCKED at ${cents} cents${cents === 0 ? ' — the vendor stated 0' : ''} — ${locked} ledger row(s) estimated → confirmed, evidence arrival ${vendor.arrivalId ?? '(none — dry run)'}`);
      } else {
        commissionLock = { outcome: 'already_locked', cents };
        log(`[applyVendorState] reservation ${row.id}: no estimated commission row — already locked, nothing changes`);
      }
    }
  }

  await ports.writeReservation(row.id, patch);

  return {
    changes,
    status,
    statusValue: patch.status ?? row.status,
    providerStatus: vendor.status,
    emails,
    calendarMarked,
    commissionMoved,
    moneyEvents,
    commissionLock,
  };
}
