import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getVerifiedEmail } from '@/lib/cookie-auth';
import { cancelBooking } from '@/lib/liteapiClient';
import { MissingLiteApiKeyError, LiteApiError } from '@/lib/travelErrors';
import {
  createOrderCancellation,
  getOrderCancellation,
  confirmOrderCancellation,
  DuffelApiError,
} from '@/lib/duffel';

// POST /api/reservations/[id]/cancel — in-app cancellation.
//   PR-Cancel-1: provider 'liteapi' (hotels) — single-step provider cancel.
//   PR-Cancel-2: provider 'duffel' (flights) — QUOTE-FIRST two-step:
//     body {} or { action: 'quote' }   → create the PENDING cancellation and
//       return Duffel's actual refund quote (refund_amount/refund_to/
//       expires_at) VERBATIM — nothing committed, status untouched.
//     body { action: 'confirm', cancellationId } → verify the quote belongs to
//       THIS reservation's order (getOrderCancellation — the pre-confirm
//       ownership check, BEFORE the irreversible commit), then confirm → flip
//       status 'cancelled' (the ONLY field written) → return the confirmed
//       object verbatim. Refunds land in the DUFFEL BALANCE, not the
//       customer's card — the UI states that truth.
//
// Auth chain (both providers — mirrors the T4 PATCH, ../route.ts:40-74, the
// SEC-2 defensive-404 convention):
//   1. getVerifiedEmail → 401.
//   2. user lookup → 404.
//   3. reservations.findFirst({ id, userId: user.id, provider: in
//      ['liteapi','duffel'] }) → 404. The userId scope is ALSO the guest
//      fence: guest rows (userId null) can never match — guest cancellation
//      stays a SUPPORT path until the claim flow exists. Viator (and any
//      future provider) rows 404 until their cancel lane exists.
//   4. status must be 'confirmed' → 409 (nothing to cancel otherwise).
//
// MODE GATE — deliberately NONE here (see duffel.ts ORDER CANCELLATIONS note):
// DUFFEL_ALLOW_LIVE_BOOKING gates NEW bookings only; a paused booking pipeline
// must never trap customers in bookings they can't cancel.
//
// Money truth: the provider's response is the ONLY authority; absent fields
// return null ("not stated"), never defaulted. Rows are NEVER deleted — the
// financial record lives forever. NOT in middleware PUBLIC_PATHS (authed
// route). No rate limit: mirrors the authed reservations/[id] PATCH
// convention (rateLimit is this codebase's PUBLIC-paid-route guard).

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
    // guest row exists; provider scope covers the two cancel lanes only).
    const owned = await prisma.reservations.findFirst({
      where: { id, userId: user.id, provider: { in: ['liteapi', 'duffel'] } },
      select: { id: true, status: true, provider: true, providerBookingId: true },
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

    // ─── Provider dispatch ───────────────────────────────────────────────────
    if (owned.provider === 'duffel') {
      // Body is optional: absent/unparseable → the default 'quote' action.
      const body = await request.json().catch(() => ({}));
      const action = body?.action === 'confirm' ? 'confirm' : 'quote';

      if (action === 'quote') {
        // ── STEP 1: the pending cancellation — Duffel's actual quote, nothing
        //    committed, reservation status untouched. ──
        try {
          const quote = await createOrderCancellation(owned.providerBookingId);
          return NextResponse.json({
            cancellation: {
              id: quote.id,
              refundAmount: quote.refundAmount,
              refundCurrency: quote.refundCurrency,
              refundTo: quote.refundTo,
              expiresAt: quote.expiresAt,
            },
          });
        } catch (err) {
          if (err instanceof DuffelApiError) {
            // Non-cancellable order (already departed, already cancelled at the
            // carrier, unsupported fare…): the provider's message VERBATIM plus
            // the honest manual-handling line — no invented reasons.
            return NextResponse.json(
              {
                error: `${err.message} — this booking can't be cancelled in-app and needs manual handling; please contact support.`,
                source: 'duffel',
                kind: 'api_error',
                code: err.code,
                requestId: err.requestId,
              },
              { status: 502 }
            );
          }
          throw err;
        }
      }

      // ── STEP 2: confirm — irreversible. ──
      const cancellationId = body?.cancellationId;
      if (typeof cancellationId !== 'string' || cancellationId.length === 0) {
        return NextResponse.json(
          { error: 'cancellationId is required to confirm a cancellation' },
          { status: 400 }
        );
      }

      let confirmed;
      try {
        // Pre-confirm OWNERSHIP check: the quote must reference THIS
        // reservation's order. Without this, a crafted cancellationId could
        // commit a cancellation on a DIFFERENT order while flipping this row —
        // checked BEFORE the irreversible confirm, never after.
        const pending = await getOrderCancellation(cancellationId);
        if (pending.orderId !== owned.providerBookingId) {
          return NextResponse.json({ error: 'Cancellation not found' }, { status: 404 });
        }
        confirmed = await confirmOrderCancellation(cancellationId);
      } catch (err) {
        if (err instanceof DuffelApiError) {
          if (err.code === 'order_cancellation_stale') {
            // Only the NEWEST quote confirms. Honest copy inviting a re-quote;
            // reservation untouched.
            return NextResponse.json(
              {
                error:
                  'This cancellation quote is no longer current — request a fresh quote to see the up-to-date refund before confirming.',
                code: 'quote_stale',
              },
              { status: 409 }
            );
          }
          // Anything else (including an expired quote, which Duffel reports
          // with its own message): provider message verbatim, row untouched.
          return NextResponse.json(
            { error: err.message, source: 'duffel', kind: 'api_error', code: err.code, requestId: err.requestId },
            { status: 502 }
          );
        }
        throw err;
      }

      // ─── Persist the flip (status is the ONLY field written) ─────────────
      let row;
      try {
        row = await prisma.reservations.update({
          where: { id: owned.id },
          data: { status: 'cancelled' },
        });
      } catch (dbErr) {
        // Duffel ALREADY cancelled — surface loudly with the provider outcome
        // so the money truth isn't lost (mirrors the book routes' convention).
        console.error('[Reservation cancel] DB update failed AFTER Duffel confirm:', {
          reservationId: owned.id, providerBookingId: owned.providerBookingId, error: dbErr,
        });
        return NextResponse.json(
          {
            error:
              'The flight was cancelled at Duffel, but we could not update the local record — refresh, and contact support if it still shows confirmed.',
            cancellation: {
              id: confirmed.id,
              refundAmount: confirmed.refundAmount,
              refundCurrency: confirmed.refundCurrency,
              refundTo: confirmed.refundTo,
              confirmedAt: confirmed.confirmedAt,
            },
          },
          { status: 500 }
        );
      }

      return NextResponse.json({
        reservation: { id: row.id, status: row.status },
        // Provider verbatim — null means "not stated by provider".
        cancellation: {
          id: confirmed.id,
          refundAmount: confirmed.refundAmount,
          refundCurrency: confirmed.refundCurrency,
          refundTo: confirmed.refundTo,
          confirmedAt: confirmed.confirmedAt,
        },
      });
    }

    // ─── provider 'liteapi' (PR-Cancel-1 — behavior unchanged) ───────────────
    // The provider cancel — the only money authority.
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
