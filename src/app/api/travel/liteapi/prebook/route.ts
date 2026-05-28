import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getVerifiedEmail } from '@/lib/cookie-auth';
import { prebookRate } from '@/lib/liteapiClient';
import { MissingLiteApiKeyError, LiteApiError } from '@/lib/travelErrors';

// POST /api/travel/liteapi/prebook
// Body: { tripId, offerId, usePaymentSdk? }
// Auth: cookie-verified email → user lookup → trip ownership check.
// Stores nothing — prebook is just a quote + SDK payment context. The book
// route is what writes reservations + commission rows.

export async function POST(request: NextRequest) {
  // ─── Auth (cookie verify + user lookup FIRST — security mandate) ─────────
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

  let body: { tripId?: string; offerId?: string; usePaymentSdk?: boolean };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const { tripId, offerId, usePaymentSdk } = body;
  if (!tripId || !offerId) {
    return NextResponse.json(
      { error: 'tripId and offerId are required' },
      { status: 400 }
    );
  }

  // ─── Ownership check — user-scoped query per security mandate ────────────
  const trip = await prisma.trips.findFirst({
    where: { id: tripId, userId: user.id },
    select: { id: true },
  });
  if (!trip) {
    return NextResponse.json({ error: 'Trip not found' }, { status: 404 });
  }

  try {
    const prebook = await prebookRate({ offerId, usePaymentSdk });
    // Return the prebook payload as-is — client uses transactionId + secretKey
    // to drive the LiteAPI Payment SDK in the browser. Sensitive bits
    // (secretKey) are scoped to this single prebook session, time-limited
    // server-side by LiteAPI.
    return NextResponse.json({ prebook });
  } catch (err) {
    if (err instanceof MissingLiteApiKeyError) {
      return NextResponse.json(
        { error: err.message, source: 'liteapi', kind: 'missing_key', mode: err.mode },
        { status: 500 }
      );
    }
    if (err instanceof LiteApiError) {
      return NextResponse.json(
        { error: err.message, source: 'liteapi', kind: 'api_error', status: err.status },
        { status: 502 }
      );
    }
    console.error('[LiteAPI prebook] unexpected error:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Prebook failed' },
      { status: 500 }
    );
  }
}
