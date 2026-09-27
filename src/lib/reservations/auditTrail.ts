/**
 * AUDIT-01 (2026-09-26) — EVERY CHANGE TO A BOOKING LEAVES A CHAINED ROW.
 *
 * THE ONE AUDIT PORT. The primary tables (arrivals, webhook_events, money_events,
 * commission_ledger, journal_entries) stay the evidence; audit_log is the
 * human-readable, tamper-evident INDEX of every change, written RIGHT AFTER the
 * change commits.
 *
 * WHY NOT INSIDE THE CHANGE'S TRANSACTION. writeAuditLog (src/lib/audit/
 * writeAuditLog.ts) opens its OWN Serializable transaction (:60, :123): it reads
 * the chain's last row, hashes the new content over its prev_hash (:84-99) and
 * inserts — and retries on a serialization abort (:127-134). A row written inside
 * a caller's transaction would chain onto a head the caller's snapshot cannot
 * guarantee, and its retry would re-run the caller's writes. So the change
 * commits first, and this port records it after.
 *
 * WHAT IT GUARANTEES.
 *   · request_id = `booking:<reservationId>:<kind>:<evidenceId>[:<requestKey>]` —
 *     the evidence is the row that IS the fact (an arrival id, a webhook event id,
 *     a money event id, an entry id, an email's message id). The same fact from
 *     the same evidence collapses to ONE row: writeAuditLog returns the existing
 *     row for a request_id it already holds (:66-71).
 *   · the description comes from the words leaf (src/lib/reservations/
 *     timeline.ts bookingEventWords) — never typed at a call site;
 *   · target { table: 'reservations', id } — or, for money_event_* and
 *     commission_locked, that row, with reservationId in payload_metadata so the
 *     timeline joins it;
 *   · payload_before / payload_after carry the fields that changed, as stated —
 *     never the whole row, never an address;
 *   · actor: a human's click → human_user with their id; the cron and the retro →
 *     system_automation with user_id = the booking's OWNER (so the owner's audit
 *     view shows it); the webhook → external_integration, the same owner; a guest
 *     booking → user_id null, named in the metadata.
 *   · a failed audit write is console.error'd BY NAME with its request_id and
 *     NEVER thrown — the change already committed and stands. The caller gets
 *     { audited: false, reason }.
 */
import type { WriteAuditLogInput } from '@/lib/audit/writeAuditLog';
import { writeAuditLog } from '@/lib/audit/writeAuditLog';
import { bookingEventWords, type BookingEventKind, type Evidence } from './timeline';

export type { BookingEventKind, Evidence } from './timeline';

export interface BookingActor {
  type: 'human_user' | 'system_automation' | 'external_integration';
  /** The human's id, or — for the cron, the retro and the webhook — the booking's OWNER; null for a guest booking. */
  userId: string | null;
  email?: string | null;
  ip?: string | null;
}

/** The actor of a vendor read, by who asked for it: the cron and the retro are ours; the webhook is the vendor's. */
export function actorOfReadSource(source: 'webhook' | 'cron' | 'retro', ownerId: string | null): BookingActor {
  return { type: source === 'webhook' ? 'external_integration' : 'system_automation', userId: ownerId };
}

/** A human's click — the signed-in user, or a guest (no account: user_id null, named). */
export function humanActor(user: { id: string; email: string | null } | null, ip?: string | null): BookingActor {
  return { type: 'human_user', userId: user?.id ?? null, email: user?.email ?? null, ip: ip ?? null };
}

export interface BookingEventInput {
  /** The booking, and its OWNER (null = a guest booking). */
  reservation: { id: string; userId: string | null };
  kind: BookingEventKind;
  actor: BookingActor;
  /** The fields that changed, as they were — null when the fact has no before. */
  before: Record<string, unknown> | null;
  /** The fields that changed, as stated now. */
  after: Record<string, unknown> | null;
  /** The row that IS the fact. */
  evidence: Evidence;
  /** Appended to the request_id when one evidence row carries more than one fact of a kind (an email's kind and error class). */
  requestKey?: string;
  /** money_event_* and commission_locked: that row. Default: the reservation. */
  target?: { table: string; id: string };
}

export type AuditOutcome = { audited: true; id: string } | { audited: false; reason: string };

/** The chain's writer — writeAuditLog in production; a node:test port in the proofs. */
export type AuditWriter = (input: WriteAuditLogInput) => Promise<{ id: string }>;

export function bookingEventRequestId(input: Pick<BookingEventInput, 'reservation' | 'kind' | 'evidence' | 'requestKey'>): string {
  return `booking:${input.reservation.id}:${input.kind}:${input.evidence.id}${input.requestKey ? `:${input.requestKey}` : ''}`;
}

/** The WriteAuditLogInput for a booking event — pure; the port writes it. */
export function bookingAuditInput(input: BookingEventInput): WriteAuditLogInput {
  return {
    actor: { user_id: input.actor.userId, email: input.actor.email ?? null, type: input.actor.type, ip: input.actor.ip ?? null },
    action: { type: input.kind, description: bookingEventWords(input.kind, { before: input.before, after: input.after }) },
    target: input.target ?? { table: 'reservations', id: input.reservation.id },
    payload: {
      before: input.before,
      after: input.after,
      metadata: {
        reservationId: input.reservation.id,
        evidence: input.evidence,
        // Named, never silent: a guest booking has no owner to scope it to.
        owner: input.reservation.userId === null ? 'guest' : 'account',
      },
    },
    request_id: bookingEventRequestId(input),
  };
}

export async function recordBookingEvent(input: BookingEventInput, writer: AuditWriter = writeAuditLog): Promise<AuditOutcome> {
  const request_id = bookingEventRequestId(input);
  try {
    const row = await writer(bookingAuditInput(input));
    return { audited: true, id: row.id };
  } catch (err) {
    const reason = err instanceof Error ? `${err.name}: ${err.message}` : String(err);
    // Loud and named — the change already committed and stands; the index row is what is missing.
    console.error('[booking audit] audit row NOT written — the change stands:', { request_id, kind: input.kind, reservationId: input.reservation.id, reason });
    return { audited: false, reason };
  }
}

// ─── the derivations the callers hand the port (pure) ───────────────────────

/** The reservation columns a vendor read may change, as they were before it. */
export interface ReadChangeRow {
  status: string;
  providerConfirmationCode: string | null;
  ticketedAt: Date | null;
  ticketLimitTime: Date | null;
  cancelIntentAt: Date | null;
}

/** The one write a vendor read made (applyVendorState's / refreshFlightReservation's patch). */
export interface ReadChangePatch {
  status?: string;
  providerConfirmationCode?: string;
  ticketedAt?: Date;
  ticketLimitTime?: Date;
  cancelIntentAt?: Date | null;
}

export interface DerivedChange {
  kind: BookingEventKind;
  before: Record<string, unknown>;
  after: Record<string, unknown>;
}

const isoOrNull = (d: Date | null | undefined): string | null => (d === null || d === undefined ? null : d.toISOString());

/**
 * One change per fact the read's write changed — nothing for an unchanged read.
 * A status move from cancel_pending to cancelled is the vendor FINALIZING the
 * cancel (reservation_cancelled); any other status move is status_changed. The
 * vendor's own word rides beside the status.
 */
export function readChangesOf(before: ReadChangeRow, patch: ReadChangePatch | null, providerStatus: string | null): DerivedChange[] {
  if (patch === null) return [];
  const out: DerivedChange[] = [];
  if (patch.status !== undefined && patch.status !== before.status) {
    if (before.status === 'cancel_pending' && patch.status === 'cancelled') {
      out.push({ kind: 'reservation_cancelled', before: { status: before.status, cancelIntentAt: isoOrNull(before.cancelIntentAt) }, after: { status: patch.status, cancelIntentAt: patch.cancelIntentAt === undefined ? isoOrNull(before.cancelIntentAt) : isoOrNull(patch.cancelIntentAt), providerStatus } });
    } else {
      out.push({ kind: 'reservation_status_changed', before: { status: before.status }, after: { status: patch.status, providerStatus } });
    }
  }
  if (patch.providerConfirmationCode !== undefined && before.providerConfirmationCode === null) {
    out.push({ kind: 'reservation_confirmation_code_arrived', before: { providerConfirmationCode: null }, after: { providerConfirmationCode: patch.providerConfirmationCode } });
  }
  if (patch.ticketedAt !== undefined && before.ticketedAt === null) {
    out.push({ kind: 'reservation_ticketed', before: { ticketedAt: null }, after: { ticketedAt: patch.ticketedAt.toISOString() } });
  }
  if (patch.ticketLimitTime !== undefined && before.ticketLimitTime === null) {
    out.push({ kind: 'reservation_ticket_limit_stated', before: { ticketLimitTime: null }, after: { ticketLimitTime: patch.ticketLimitTime.toISOString() } });
  }
  return out;
}

/** Which email a send site sent — the words leaf's EMAIL_WORDS keys. */
export type BookingEmailKind = 'booking_confirmation' | 'flight_confirmation' | 'cancellation' | 'cancel_pending' | 'ticketed' | 'hotel_confirmation_arrived';

export type EmailSendStatus = { sent: true; id: string } | { sent: false; error: string };

/**
 * The email's event: SENT, with the provider's message id as the evidence; or
 * FAILED, keyed by the send's request key and the error class (no message id
 * exists). No recipient address is recorded.
 */
export function emailEventOf(status: EmailSendStatus, email: BookingEmailKind, requestKey: string): Pick<BookingEventInput, 'kind' | 'before' | 'after' | 'evidence' | 'requestKey'> {
  if (status.sent) {
    return { kind: 'reservation_email_sent', before: null, after: { email, messageId: status.id }, evidence: { table: 'email', id: status.id } };
  }
  return { kind: 'reservation_email_failed', before: null, after: { email, errorClass: status.error }, evidence: { table: 'email_attempt', id: `${email}:${requestKey}` }, requestKey: status.error };
}

/** Record an email's outcome through the port. */
export function recordEmailOutcome(
  reservation: BookingEventInput['reservation'],
  actor: BookingActor,
  email: BookingEmailKind,
  requestKey: string,
  status: EmailSendStatus,
  writer: AuditWriter = writeAuditLog,
): Promise<AuditOutcome> {
  return recordBookingEvent({ reservation, actor, ...emailEventOf(status, email, requestKey) }, writer);
}
