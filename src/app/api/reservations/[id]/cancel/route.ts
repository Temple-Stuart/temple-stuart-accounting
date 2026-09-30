import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getVerifiedEmail } from '@/lib/cookie-auth';
import { TravelSearchQuotaError } from '@/lib/travelSearchQuota';
// AUDIT-01 (2026-09-26): every cancel fact is recorded through the one audit port —
// the actor is the human who clicked, built here from the gate's user.
import { humanActor } from '@/lib/reservations/auditTrail';
// GUEST-02 (2026-09-30): what a cancel does after this gate — the one flow both gates run.
import { CANCEL_ROW_SELECT, cancelReservation, quoteCancellation, type CancelCaller, type CancelRow } from '@/lib/reservations/cancelFlow';

// /api/reservations/[id]/cancel — in-app cancellation. ONE resource, two verbs:
//   GUEST-02 (2026-09-30): this file is the ACCOUNT's gate — the signed-in owner and the row they
//   own. What a cancel does after the gate — the quote, the action, both lanes, the email, the
//   audit — lives in src/lib/reservations/cancelFlow.ts (quoteCancellation, cancelReservation),
//   the one flow the guest's gate (src/app/api/guest/booking/cancel/route.ts) runs too. Each verb
//   awaits the flow inside its try, so its catch answers what the flow throws.
//   Why one route with two verbs: the quote and the action are two reads of the
//   SAME resource under the SAME auth chain and ownership row; a second file would
//   carry a second copy of that chain and a second pin.
//
// Auth chain (mirrors the T4 PATCH, ../route.ts:40-74, the SEC-2
// defensive-404 convention):
//   1. getVerifiedEmail → 401.
//   2. user lookup → 404.
//   3. reservations.findFirst({ id, userId: user.id, provider: in
//      ['liteapi','duffel'] }) → 404. Viator (and any
//      future provider) rows 404 until their cancel lane exists.
//      GUEST-02: a guest row (userId null) never matches here — the guest's gate is
//      the other route (src/app/api/guest/booking/cancel/route.ts).
//   4. status must be 'confirmed' → 409 (nothing to cancel otherwise; a
//      'cancel_pending' row is already awaiting the airline, said by name).
//      GUEST-02: step 4 runs in the flow (statusRefusal), for both gates.
//
// NOT in middleware PUBLIC_PATHS (authed
// route). No rate limit on the action: mirrors the authed reservations/[id]
// PATCH convention (rateLimit is this codebase's PUBLIC-paid-route guard).

/** The auth chain, shared by both verbs: the user, and the row they own. */
async function gate(id: string): Promise<{ ok: true; userId: string; accountEmail: string; owned: CancelRow } | { ok: false; response: NextResponse }> {
  const userEmail = await getVerifiedEmail();
  if (!userEmail) {
    return { ok: false, response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
  }
  const user = await prisma.users.findFirst({
    where: { email: { equals: userEmail, mode: 'insensitive' } },
    // CANCEL-02: the account's own stored address is the recipient for an account row.
    select: { id: true, email: true },
  });
  if (!user) {
    return { ok: false, response: NextResponse.json({ error: 'User not found' }, { status: 404 }) };
  }
  // Ownership + scope gate (defensive 404 — never confirms a foreign or
  // guest row exists; provider scope covers the two cancel lanes only).
  const owned = await prisma.reservations.findFirst({
    where: { id, userId: user.id, provider: { in: ['liteapi', 'duffel'] } },
    // CANCEL-01: the lane decides which vendor endpoint a cancel may reach.
    // CANCEL-02: the recipient rule and the email read the rest.
    // GUEST-02 (2026-09-30): the one select both gates read with — this one's, plus userId.
    select: CANCEL_ROW_SELECT,
  });
  if (!owned) {
    return { ok: false, response: NextResponse.json({ error: 'Reservation not found' }, { status: 404 }) };
  }
  return { ok: true, userId: user.id, accountEmail: user.email, owned };
}

// ─── GET — THE QUOTE (CANCEL-01) ─────────────────────────────────────────────
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const g = await gate(id);
    if (!g.ok) return g.response;
    const caller: CancelCaller = { actor: humanActor({ id: g.userId, email: g.accountEmail }), accountEmail: g.accountEmail };
    return await quoteCancellation(g.owned, caller);
  } catch (error) {
    if (error instanceof TravelSearchQuotaError) {
      return NextResponse.json(
        { error: 'Cancellation quotes are temporarily paused. Please try again later.', code: 'quote_paused' },
        { status: 503 }
      );
    }
    console.error('[Reservation cancel quote] request error:', error);
    return NextResponse.json({ error: 'Failed to quote the cancellation' }, { status: 500 });
  }
}

// ─── POST — THE ACTION ───────────────────────────────────────────────────────
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const g = await gate(id);
    if (!g.ok) return g.response;
    const caller: CancelCaller = { actor: humanActor({ id: g.userId, email: g.accountEmail }), accountEmail: g.accountEmail };
    return await cancelReservation(g.owned, caller);
  } catch (error) {
    if (error instanceof TravelSearchQuotaError) {
      return NextResponse.json(
        { error: 'Cancellation is temporarily paused. Please try again later.' },
        { status: 503 }
      );
    }
    console.error('[Reservation cancel] request error:', error);
    return NextResponse.json({ error: 'Failed to cancel the reservation' }, { status: 500 });
  }
}
