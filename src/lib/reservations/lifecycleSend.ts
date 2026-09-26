/**
 * STATUS-01 (2026-09-26) — THE ONE ATTEMPT AT A LIFECYCLE EMAIL, AFTER THE COMMIT.
 *
 * applyVendorState decides that an email is owed and stamps its marker in the
 * SAME transaction as the change that earned it (ticketedEmailSentAt /
 * confirmationEmailSentAt); with the row lock the read leaf takes (STATUS-01b),
 * two overlapping reads cannot both send.
 * This module makes the one attempt after that transaction commits: the
 * recipient by the CANCEL-02 rule (an account row → the account's stored email;
 * a guest row → guestEmail when stated; neither → no send, named), the body from
 * the lifecycle leaf, the send through the booking emails' own sender. A failed
 * send is written to audit_log BY NAME and is NOT retried automatically — the
 * marker means "the one attempt was made". No fallback address, no retry.
 *
 * AUDIT-01 (2026-09-26): both outcomes go through the ONE audit port
 * (src/lib/reservations/auditTrail.ts) — reservation_email_sent with the
 * provider's message id as the evidence, reservation_email_failed keyed by the
 * kind and the error class (a missing recipient is a failure by name too). The
 * old 'system_other' lifecycle_email_failed write is gone. The actor is the
 * caller's: the read's source (the cron, the retro, the webhook) or the booking
 * human — handed in, never guessed here.
 */
import { prisma } from '@/lib/prisma';
import { sendTransactionalEmail } from '@/lib/email';
import { lifecycleEmail } from '@/lib/emailTemplates/lifecycle';
import { recordEmailOutcome, type BookingActor } from './auditTrail';
import { reservationIdentity } from './lane';
import { cancelRecipient } from './cancellation';
import type { LifecycleEmailRequest } from './applyVendorState';

/** The reservation columns the send reads. */
export interface LifecycleSendRow {
  id: string;
  userId: string | null;
  bookingType: string;
  guestEmail: string | null;
  lane: string;
  displayName: string | null;
  providerConfirmationCode: string | null;
  providerBookingId: string;
  checkinDate: Date | null;
  checkoutDate: Date | null;
}

export type LifecycleEmailStatus = { kind: LifecycleEmailRequest['kind']; sent: true; id: string } | { kind: LifecycleEmailRequest['kind']; sent: false; error: string };

const day = (d: Date | null): string | null => (d === null ? null : d.toISOString().slice(0, 10));

/** Where a booking can be seen TODAY: the travel tab, absolute, from the deployment's
 *  public origin; null (and the line omitted) when it is not set — a host is never invented. */
export function bookingManageUrl(reservationId: string): string | null {
  const origin = process.env.NEXT_PUBLIC_APP_URL;
  if (typeof origin !== 'string' || origin.trim().length === 0) {
    console.error('[lifecycle email] NEXT_PUBLIC_APP_URL is not set — the email carries no manage link:', { reservationId });
    return null;
  }
  return `${origin.trim().replace(/\/+$/, '')}/travel`;
}

/** The account's stored email for an account row, read by the row's userId — null for a guest row or a vanished user. */
async function accountEmailOf(row: LifecycleSendRow): Promise<string | null> {
  if (row.userId === null) return null;
  const user = await prisma.users.findUnique({ where: { id: row.userId }, select: { email: true } });
  return user ? user.email : null;
}

export async function sendLifecycleEmail(row: LifecycleSendRow, request: LifecycleEmailRequest, actor: BookingActor): Promise<LifecycleEmailStatus> {
  const booking = { id: row.id, userId: row.userId };
  const recipient = cancelRecipient(row, await accountEmailOf(row));
  if (recipient.to === null) {
    console.error('[lifecycle email] no recipient stated — no email sent:', { reservationId: row.id, kind: request.kind, bookingType: row.bookingType, reason: recipient.reason });
    await recordEmailOutcome(booking, actor, request.kind, 'lifecycle', { sent: false, error: recipient.reason });
    return { kind: request.kind, sent: false, error: recipient.reason };
  }
  try {
    const identity = reservationIdentity(row);
    // A reservation row whose lane the reader admits is one of the three; the leaf's type is the reader's.
    const common = {
      name: identity.name,
      lane: identity.type,
      reference: row.providerConfirmationCode ?? row.providerBookingId,
      checkinDate: day(row.checkinDate),
      checkoutDate: day(row.checkoutDate),
      manageUrl: bookingManageUrl(row.id),
    };
    const rendered = request.kind === 'ticketed'
      ? lifecycleEmail({ kind: 'ticketed', ...common, pnr: row.providerConfirmationCode })
      : lifecycleEmail({ kind: 'hotel_confirmation_arrived', ...common, confirmationCode: request.confirmationCode });
    const { id } = await sendTransactionalEmail({ to: recipient.to, subject: rendered.subject, html: rendered.html, text: rendered.text });
    // AUDIT-01: the send is recorded, the message id its evidence.
    await recordEmailOutcome(booking, actor, request.kind, 'lifecycle', { sent: true, id });
    return { kind: request.kind, sent: true, id };
  } catch (emailErr) {
    const errorClass = emailErr instanceof Error ? emailErr.name : 'UnknownError';
    const message = emailErr instanceof Error ? emailErr.message : String(emailErr);
    console.error('[lifecycle email] send FAILED — the one attempt was made, the marker stands, no retry:', { reservationId: row.id, kind: request.kind, errorClass, message });
    // AUDIT-01: by name, in the tamper-evident log, through the one port — the record that the attempt failed.
    await recordEmailOutcome(booking, actor, request.kind, 'lifecycle', { sent: false, error: errorClass });
    return { kind: request.kind, sent: false, error: errorClass };
  }
}
