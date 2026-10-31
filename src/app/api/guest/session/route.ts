// GUEST-01 (2026-09-29) — POST /api/guest/session { reference, code }: a guest opens
// ONE booking with the Manage reference and the Manage code from their own booking email.
//
// PUBLIC, and why that is safe to be (the rule for a route with no account behind it):
//   · it calls no paid service and no vendor, sends no email, and writes nothing — the
//     one row it touches is the rate limiter's counter (src/lib/rateLimit.ts), as on
//     every public route;
//   · a request with no IP is refused, and both limits — 10 per IP, then 5 per
//     reference, per 15 minutes — run BEFORE any read;
//   · it reads only guest rows (bookingType 'guest', userId null) under the typed
//     reference, ids only, and compares every row's code in constant time, with one
//     dummy compare when there is none — so every failure (unknown reference, wrong
//     code, an account's booking) is the same 404 and the same line after the same work;
//   · the code is 40 bits derived from the reservation id under a server-only key
//     (src/lib/cookie-auth.ts guestKey) — nothing is stored — and it is never logged,
//     returned or put in a URL;
//   · a match opens a signed, httpOnly, secure, strict cookie for that ONE reservation,
//     for one hour, sent only to /api/guest.
// The decision is src/lib/guest/guestSession.ts openGuestSession; this file wires it.
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { rateLimit, RateLimitError } from '@/lib/rateLimit';
import { failClosedResponse } from '@/lib/http/failClosedResponse';
import { guestKey } from '@/lib/cookie-auth';
import { GUEST_COOKIE, GUEST_COOKIE_PATH, GUEST_SESSION_SECONDS, signGuestSession } from '@/lib/guest/guestAccess';
import { openGuestSession, type GuestLookupPorts } from '@/lib/guest/guestSession';

const ports: GuestLookupPorts = {
  limit: async (key, limit, windowSeconds) => {
    try {
      await rateLimit(key, { limit, windowSeconds });
      return { ok: true };
    } catch (err) {
      if (err instanceof RateLimitError) return { ok: false, retryAfterSeconds: err.retryAfterSeconds };
      throw err;
    }
  },
  guestRowsByReference: (reference) =>
    prisma.reservations.findMany({ where: { providerBookingId: reference, bookingType: 'guest', userId: null }, select: { id: true } }),
};

export async function POST(request: Request) {
  try {
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || request.headers.get('x-real-ip') || null;
    // A body that is not JSON is not a reference and a code: the shapes' 400.
    const body: unknown = await request.json().catch(() => null);
    const key = guestKey();
    const answer = await openGuestSession(ports, { ip, body, key });
    if (answer.status === 429) {
      return NextResponse.json({ error: answer.error }, { status: 429, headers: { 'Retry-After': String(answer.retryAfterSeconds) } });
    }
    if (answer.status !== 200) return NextResponse.json({ error: answer.error }, { status: answer.status });
    const expiresAt = Math.floor(Date.now() / 1000) + GUEST_SESSION_SECONDS;
    const res = NextResponse.json({ ok: true });
    res.cookies.set(GUEST_COOKIE, signGuestSession(key, answer.reservationId, expiresAt), {
      httpOnly: true,
      secure: true,
      sameSite: 'strict',
      path: GUEST_COOKIE_PATH,
      maxAge: GUEST_SESSION_SECONDS,
    });
    return res;
  } catch (err) {
    return failClosedResponse('Guest booking lookup', 'Could not open a booking right now', err);
  }
}
