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
}

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
  };
}
