// GUEST-02 (2026-09-30) — /api/guest/booking/cancel: a guest cancels the ONE booking their
// session opened. ONE resource, two verbs, as on the account's route:
//   GET  — the quote (a flight's, read from the airline; a hotel shows its stored terms);
//   POST — the cancel.
// PUBLIC (it rides the '/api/guest/booking' prefix in PUBLIC_PATHS — no new entry), and why that
// is safe to be:
//   · the guestBooking session is verified FIRST — a value signed under the server-only guest key
//     (src/lib/cookie-auth.ts guestKey), naming one reservation, for one hour, minted only by the
//     rate-limited, constant-time lookup; none or an invalid one is 401 before anything is counted
//     or read;
//   · a request with no IP is the one 404, and both limits — 10 per IP, then 5 per reservation, per
//     15 minutes, the cancel's own buckets — run BEFORE any read;
//   · the row is read again as still a guest's — { id, bookingType 'guest', userId null, provider
//     liteapi | duffel } — or the one 404;
//   · then the SAME flow the account's cancel runs (src/lib/reservations/cancelFlow.ts), with the
//     same metered vendor calls — never a second copy of a money path;
//   · the cookie is httpOnly, secure and sameSite strict, sent only to /api/guest — another site
//     cannot send it.
// Every answer is never cached, and the cookie is never logged.
// The decision is src/lib/guest/guestSession.ts guestCancelGate; this file wires it.
import { NextResponse, type NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { rateLimit, RateLimitError } from '@/lib/rateLimit';
import { guestKey } from '@/lib/cookie-auth';
import { TravelSearchQuotaError } from '@/lib/travelSearchQuota';
import { humanActor } from '@/lib/reservations/auditTrail';
import { GUEST_COOKIE } from '@/lib/guest/guestAccess';
import { guestCancelGate, type GuestCancelPorts } from '@/lib/guest/guestSession';
import { CANCEL_ROW_SELECT, cancelReservation, quoteCancellation, type CancelCaller, type CancelRow } from '@/lib/reservations/cancelFlow';

const NO_STORE = { 'Cache-Control': 'no-store' };

const ports: GuestCancelPorts<CancelRow> = {
  limit: async (key, limit, windowSeconds) => {
    try {
      await rateLimit(key, { limit, windowSeconds });
      return { ok: true };
    } catch (err) {
      if (err instanceof RateLimitError) return { ok: false, retryAfterSeconds: err.retryAfterSeconds };
      throw err;
    }
  },
  reservation: (id) =>
    prisma.reservations.findFirst({
      where: { id, bookingType: 'guest', userId: null, provider: { in: ['liteapi', 'duffel'] } },
      select: CANCEL_ROW_SELECT,
    }),
};

/** The guest's gate, shared by both verbs: the session, the IP, both limits, the row — or the answer that refuses. */
async function guestGate(request: NextRequest): Promise<{ ok: true; ip: string; row: CancelRow } | { ok: false; response: NextResponse }> {
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || request.headers.get('x-real-ip') || null;
  const answer = await guestCancelGate(ports, {
    cookie: request.cookies.get(GUEST_COOKIE)?.value ?? null,
    ip,
    key: guestKey(),
    now: Math.floor(Date.now() / 1000),
  });
  if (answer.status === 200) return { ok: true, ip: answer.ip, row: answer.row };
  if (answer.status === 429) {
    return { ok: false, response: NextResponse.json({ error: answer.error }, { status: 429, headers: { ...NO_STORE, 'Retry-After': String(answer.retryAfterSeconds) } }) };
  }
  return { ok: false, response: NextResponse.json({ error: answer.error }, { status: answer.status, headers: NO_STORE }) };
}

/** The flow's answer, never cached. */
function noStore(res: NextResponse): NextResponse {
  res.headers.set('Cache-Control', 'no-store');
  return res;
}

// ─── GET — THE QUOTE ─────────────────────────────────────────────────────────
export async function GET(request: NextRequest) {
  try {
    const g = await guestGate(request);
    if (!g.ok) return g.response;
    const caller: CancelCaller = { actor: humanActor(null, g.ip), accountEmail: null };
    return noStore(await quoteCancellation(g.row, caller));
  } catch (error) {
    if (error instanceof TravelSearchQuotaError) {
      return NextResponse.json(
        { error: 'Cancellation quotes are temporarily paused. Please try again later.', code: 'quote_paused' },
        { status: 503, headers: NO_STORE }
      );
    }
    console.error('[Guest cancel quote] request error:', error);
    return NextResponse.json({ error: 'Failed to quote the cancellation' }, { status: 500, headers: NO_STORE });
  }
}

// ─── POST — THE CANCEL ───────────────────────────────────────────────────────
export async function POST(request: NextRequest) {
  try {
    const g = await guestGate(request);
    if (!g.ok) return g.response;
    const caller: CancelCaller = { actor: humanActor(null, g.ip), accountEmail: null };
    return noStore(await cancelReservation(g.row, caller));
  } catch (error) {
    if (error instanceof TravelSearchQuotaError) {
      return NextResponse.json(
        { error: 'Cancellation is temporarily paused. Please try again later.' },
        { status: 503, headers: NO_STORE }
      );
    }
    console.error('[Guest cancel] request error:', error);
    return NextResponse.json({ error: 'Failed to cancel the reservation' }, { status: 500, headers: NO_STORE });
  }
}
