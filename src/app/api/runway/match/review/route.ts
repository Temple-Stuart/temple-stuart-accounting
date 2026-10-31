import { NextRequest, NextResponse } from 'next/server';
import { failClosedResponse } from '@/lib/http/failClosedResponse';
import { prisma } from '@/lib/prisma';
import { getVerifiedEmail } from '@/lib/cookie-auth';
import { writeAuditLog } from '@/lib/audit/writeAuditLog';
import { humanActor, recordBookingEvent } from '@/lib/reservations/auditTrail';
import { ValidationError } from '@/lib/errors/ValidationError';

// ─── POST /api/runway/match/review (PR-MATCH-2) ──────────────────────────────
// ONE human decision per call: {linkId, action 'accept'|'reject', notes?} →
// the link's lifecycle terminal state + reviewer stamps (reviewedBy = the
// authed email — the overridden_by convention, schema transactions:445).
// NEVER bulk, NEVER auto: this route is the ONLY writer that can set
// 'accepted'/'rejected', and it moves exactly one row per request, from
// 'proposed' only (already-reviewed → declared 409, the human word stands).
// Ownership via the link's own userId; cross-user → defensive 404 (never
// confirms a foreign row exists — house SEC-2 convention).
//
// MATCH-02 (2026-09-26): ACCEPTING A REFUND LINK SETTLES ITS MONEY EVENT. A link
// carrying moneyEventId is an inflow proposed against the refund the vendor
// stated; the accept moves that money event from 'stated' to 'settled' IN THE
// SAME TRANSACTION as the link's flip, with its evidence — settledTransactionId
// = the link's bank row, settledAt = this review's instant (the SQL CHECK holds
// both together). An event already settled (by another accepted link) → 409 by
// name, nothing flips. A reject changes the event nothing. THIS ROUTE IS THE
// ONLY WRITER OF 'settled'.
//
// AUDIT-01 (2026-09-26): the settle is a change to a booking's money, so it
// leaves a chained row through the ONE audit port (src/lib/reservations/
// auditTrail.ts) — money_event_settled, the bank row its evidence, the money
// event its target, the reservation named in payload_metadata — written after
// the transaction commits, beside the link's own row below (which stays: it
// records the link decision, accept AND reject, on the link's table).
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function POST(request: NextRequest) {
  try {
    const userEmail = await getVerifiedEmail();
    if (!userEmail) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const user = await prisma.users.findFirst({
      where: { email: { equals: userEmail, mode: 'insensitive' } },
      select: { id: true },
    });
    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

    let body: { linkId?: unknown; action?: unknown; notes?: unknown };
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }
    const linkId = typeof body.linkId === 'string' ? body.linkId.trim() : '';
    const action = body.action;
    const notes = typeof body.notes === 'string' ? body.notes.trim() : '';
    if (!UUID_RE.test(linkId)) {
      return NextResponse.json({ error: 'linkId must be a link UUID' }, { status: 400 });
    }
    if (action !== 'accept' && action !== 'reject') {
      return NextResponse.json({ error: "action must be 'accept' or 'reject'" }, { status: 400 });
    }

    // Ownership — defensive 404 on anything not owned by this user.
    const link = await prisma.transaction_reservation_links.findFirst({
      where: { id: linkId, userId: user.id },
      select: { id: true, status: true, transactionId: true, reservationId: true, confidence: true, moneyEventId: true },
    });
    if (!link) return NextResponse.json({ error: 'Link not found' }, { status: 404 });
    if (link.status !== 'proposed') {
      return NextResponse.json(
        { error: `Already reviewed (status '${link.status}') — reviews are final in MATCH-2.` },
        { status: 409 }
      );
    }

    const reviewedAt = new Date();
    const settles = action === 'accept' && link.moneyEventId !== null;
    // AUDIT-01: the settled event's kind, read inside the transaction, for the chained row after it.
    let settledKind: string | null = null;
    const updated = await prisma.$transaction(async (tx) => {
      // MATCH-02: the refund's money event settles with the accept, or nothing flips.
      if (settles) {
        const event = await tx.money_events.findUnique({
          where: { id: link.moneyEventId as string },
          select: { id: true, status: true, settledTransactionId: true, kind: true },
        });
        if (!event) {
          throw new ValidationError(`MATCH-02 money event ${link.moneyEventId} named by link ${link.id} is not there`, { status: 404 });
        }
        if (event.status !== 'stated') {
          throw new ValidationError(
            `MATCH-02 money event ${event.id} is already ${event.status}${event.settledTransactionId ? ` by bank row ${event.settledTransactionId}` : ''} — a refund settles once; reject this proposal`,
            { status: 409 }
          );
        }
        const settled = await tx.money_events.updateMany({
          where: { id: event.id, status: 'stated' },
          data: { status: 'settled', settledTransactionId: link.transactionId, settledAt: reviewedAt },
        });
        if (settled.count !== 1) {
          throw new ValidationError(`MATCH-02 money event ${event.id} was settled by another accept while this one ran — a refund settles once`, { status: 409 });
        }
        settledKind = event.kind;
      }
      return tx.transaction_reservation_links.update({
        where: { id: link.id },
        data: {
          status: action === 'accept' ? 'accepted' : 'rejected',
          reviewedAt,
          reviewedBy: userEmail,
          reviewNotes: notes || null,
        },
        select: { id: true, status: true, reviewedAt: true, moneyEventId: true },
      });
    });

    // ─── Audit trail (PR-MATCH-2b) ───────────────────────────────────────────
    // A match decision changes financial IDENTITY (which bank row a booking
    // is), so both accept AND reject are audit-logged — the FL-5 pattern:
    // 'system_other' (no reservation enum value; adding one is a gated
    // migration), request_id keyed on linkId+action so a retried request
    // cannot double-log, and a failed audit write is DECLARED (loud log) but
    // never fails the review itself (the D5 rationale).
    try {
      await writeAuditLog({
        actor: { user_id: user.id, email: userEmail, type: 'human_user' },
        action: {
          type: 'system_other',
          description:
            `match_review_${action} — transaction ${link.transactionId} ↔ reservation ${link.reservationId} ` +
            `${action}ed (confidence ${link.confidence ?? 'n/a'}) via link ${link.id}` +
            (settles ? ` — refund money event ${link.moneyEventId} settled by bank row ${link.transactionId}` : ''),
        },
        target: { table: 'transaction_reservation_links', id: link.id },
        payload: {
          metadata: {
            action,
            transactionId: link.transactionId,
            reservationId: link.reservationId,
            confidence: link.confidence,
            reviewNotes: notes || null,
            // MATCH-02: the refund the accept settled, when it did.
            moneyEventId: link.moneyEventId,
            settled: settles,
          },
        },
        request_id: `match-review-${link.id}-${action}`,
      });
    } catch (auditErr) {
      console.error('[Runway match review] audit log FAILED (review itself succeeded):', {
        linkId: link.id, action,
        error: auditErr instanceof Error ? auditErr.message : auditErr,
      });
    }

    // AUDIT-01: the settle, through the one port — after the commit; a failed write is named there, never thrown.
    if (settles && link.moneyEventId !== null) {
      await recordBookingEvent({
        reservation: { id: link.reservationId, userId: user.id },
        kind: 'money_event_settled',
        actor: humanActor({ id: user.id, email: userEmail }),
        before: { status: 'stated' },
        after: { status: 'settled', kind: settledKind, settledTransactionId: link.transactionId, settledAt: reviewedAt.toISOString() },
        evidence: { table: 'transactions', id: link.transactionId },
        target: { table: 'money_events', id: link.moneyEventId },
      });
    }

    return NextResponse.json({ link: updated });
  } catch (err) {
    return failClosedResponse('Runway match review', 'Review failed', err);
  }
}
