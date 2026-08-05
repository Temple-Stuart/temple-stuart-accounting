import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getVerifiedEmail } from '@/lib/cookie-auth';
import { writeAuditLog } from '@/lib/audit/writeAuditLog';

// ─── POST /api/runway/match/review (PR-MATCH-2) ──────────────────────────────
// ONE human decision per call: {linkId, action 'accept'|'reject', notes?} →
// the link's lifecycle terminal state + reviewer stamps (reviewedBy = the
// authed email — the overridden_by convention, schema transactions:445).
// NEVER bulk, NEVER auto: this route is the ONLY writer that can set
// 'accepted'/'rejected', and it moves exactly one row per request, from
// 'proposed' only (already-reviewed → declared 409, the human word stands).
// Ownership via the link's own userId; cross-user → defensive 404 (never
// confirms a foreign row exists — house SEC-2 convention).
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
      select: { id: true, status: true, transactionId: true, reservationId: true, confidence: true },
    });
    if (!link) return NextResponse.json({ error: 'Link not found' }, { status: 404 });
    if (link.status !== 'proposed') {
      return NextResponse.json(
        { error: `Already reviewed (status '${link.status}') — reviews are final in MATCH-2.` },
        { status: 409 }
      );
    }

    const updated = await prisma.transaction_reservation_links.update({
      where: { id: link.id },
      data: {
        status: action === 'accept' ? 'accepted' : 'rejected',
        reviewedAt: new Date(),
        reviewedBy: userEmail,
        reviewNotes: notes || null,
      },
      select: { id: true, status: true, reviewedAt: true },
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
            `${action}ed (confidence ${link.confidence ?? 'n/a'}) via link ${link.id}`,
        },
        target: { table: 'transaction_reservation_links', id: link.id },
        payload: {
          metadata: {
            action,
            transactionId: link.transactionId,
            reservationId: link.reservationId,
            confidence: link.confidence,
            reviewNotes: notes || null,
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

    return NextResponse.json({ link: updated });
  } catch (err) {
    console.error('[Runway match review] error:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Review failed' },
      { status: 500 }
    );
  }
}
