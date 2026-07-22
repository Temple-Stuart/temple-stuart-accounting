import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getVerifiedEmail } from '@/lib/cookie-auth';
import { cancelBooking } from '@/lib/liteapiClient';
import { MissingLiteApiKeyError, LiteApiError } from '@/lib/travelErrors';

// POST /api/reservations/[id]/cancel — PR-Cancel-1: in-app LiteAPI cancellation.
//
// Auth chain mirrors the T4 PATCH exactly (../route.ts:40-74, the SEC-2
// defensive-404 convention):
//   1. getVerifiedEmail → 401.
//   2. user lookup → 404.
//   3. reservations.findFirst({ id, userId: user.id, provider: 'liteapi' }) →
//      404. The userId scope is ALSO the guest fence: guest rows (userId null)
//      can never match — guest cancellation stays a SUPPORT path until the
//      claim flow exists. The provider scope keeps this hotel-only v1: Duffel
//      flight cancellation is FLIP-B scope, deliberately excluded here.
//   4. status must be 'confirmed' → 409 otherwise (already-cancelled, pending
//      and failed rows have nothing to cancel).
//
// Money truth: the provider call is the ONLY authority. On its success the row
// flips status → 'cancelled' (the ONLY field written — the reservation is NEVER
// deleted; the financial record lives forever) and the provider's fee/refund/
// currency return VERBATIM (null where the provider didn't state a field —
// never defaulted, never invented). On provider failure (policy-rejected NRFN,
// past-deadline, network) the row is untouched and the provider's message
// surfaces as 502 — mirroring liteapi/book's LiteApiError convention (:142-147).
//
// NOT in middleware PUBLIC_PATHS — this is an authed account route by design.
// No rate limit: mirrors the authed reservations/[id] PATCH convention
// (rateLimit is this codebase's PUBLIC-paid-route guard). Stated, not omitted.

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const userEmail = await getVerifiedEmail();
    if (!userEmail) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const user = await prisma.users.findFirst({
      where: { email: { equals: userEmail, mode: 'insensitive' } },
      select: { id: true },
    });
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Ownership + scope gate (defensive 404 — never confirms a foreign or
    // guest row exists; provider scope excludes flights, FLIP-B).
    const owned = await prisma.reservations.findFirst({
      where: { id, userId: user.id, provider: 'liteapi' },
      select: { id: true, status: true, providerBookingId: true },
    });
    if (!owned) {
      return NextResponse.json({ error: 'Reservation not found' }, { status: 404 });
    }
    if (owned.status !== 'confirmed') {
      return NextResponse.json(
        { error: `Only a confirmed booking can be cancelled — this one is ${owned.status}.` },
        { status: 409 }
      );
    }

    // ─── The provider cancel — the only money authority ──────────────────────
    let cancelled;
    try {
      cancelled = await cancelBooking(owned.providerBookingId);
    } catch (err) {
      if (err instanceof MissingLiteApiKeyError) {
        return NextResponse.json(
          { error: err.message, source: 'liteapi', kind: 'missing_key', mode: err.mode },
          { status: 500 }
        );
      }
      if (err instanceof LiteApiError) {
        // Policy-rejected (NRFN / past deadline) or provider-side failure: the
        // booking stands, our row is untouched, the provider's message surfaces.
        return NextResponse.json(
          { error: err.message, source: 'liteapi', kind: 'api_error', status: err.status },
          { status: 502 }
        );
      }
      console.error('[Reservation cancel] unexpected provider error:', err);
      return NextResponse.json(
        { error: err instanceof Error ? err.message : 'Cancellation failed' },
        { status: 500 }
      );
    }

    // ─── Persist the flip (status is the ONLY field written) ─────────────────
    let row;
    try {
      row = await prisma.reservations.update({
        where: { id: owned.id },
        data: { status: 'cancelled' },
      });
    } catch (dbErr) {
      // The provider ALREADY cancelled — the money truth exists upstream but our
      // row still says confirmed. Surface loudly (mirrors the book routes'
      // DB-fail-after convention); include the provider outcome so it isn't lost.
      console.error('[Reservation cancel] DB update failed AFTER provider cancel:', {
        reservationId: owned.id, providerBookingId: owned.providerBookingId, error: dbErr,
      });
      return NextResponse.json(
        {
          error:
            'The booking was cancelled at the provider, but we could not update the local record — refresh, and contact support if it still shows confirmed.',
          cancellation: {
            providerStatus: cancelled.status,
            cancellationFee: cancelled.cancellationFee,
            refundAmount: cancelled.refundAmount,
            currency: cancelled.currency,
          },
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      reservation: { id: row.id, status: row.status },
      // Provider verbatim — null means "not stated by provider", never zero.
      cancellation: {
        providerStatus: cancelled.status,
        cancellationFee: cancelled.cancellationFee,
        refundAmount: cancelled.refundAmount,
        currency: cancelled.currency,
      },
    });
  } catch (error) {
    console.error('[Reservation cancel] request error:', error);
    return NextResponse.json({ error: 'Failed to cancel the reservation' }, { status: 500 });
  }
}
