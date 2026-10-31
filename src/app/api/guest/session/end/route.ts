// GUEST-01 (2026-09-29) — POST /api/guest/session/end: "Close this booking".
//
// PUBLIC (under /api/guest/session), and safe to be: it clears the guest's own
// booking cookie — the same name and path, maxAge 0 — and does nothing else. No
// read, no write, no vendor, no email.
import { NextResponse } from 'next/server';
import { GUEST_COOKIE, GUEST_COOKIE_PATH } from '@/lib/guest/guestAccess';

export async function POST() {
  const res = NextResponse.json({ ok: true });
  res.cookies.set(GUEST_COOKIE, '', { httpOnly: true, secure: true, sameSite: 'strict', path: GUEST_COOKIE_PATH, maxAge: 0 });
  return res;
}
