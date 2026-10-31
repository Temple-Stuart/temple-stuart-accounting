/**
 * The guest booking law (GUEST-01, 2026-09-29) — seeded regressions.
 *
 * The ruling: the Manage reference and the Manage code from a guest's own booking
 * email open that ONE booking on /booking/manage — the vendor's side, read-only.
 * One or more seeds per clause the law states: the one key (a raw secret, a clock in
 * the leaf, a letter read as another, no expiry, a route's own key, a code made under
 * another key); the lookup that leaks nothing (a limit dropped, the guest fence
 * dropped, a distinct wrong-code line, no dummy compare, an early exit, a lax cookie,
 * an 'unknown' IP bucket, a write, a log, a close that does more); one booking, the
 * vendor's side (no session check, the guest fence dropped, a bank part, a cached
 * answer, a settlement column, a Bank section on the guest page, a bank note); the
 * public surface and its door (a prefix entry, a DELETE; the home page's lookup gone, moved
 * above the booking section, asking on load, or the header link back); the code by email
 * only (the guard dropped, the code in a url, "See this booking" kept for a guest, the
 * code in the page's URL, a block line changed, a book route's block dropped, the code
 * answered); the dated re-pins.
 *
 * Each must fail the build by name. The anchors occur exactly once in their file,
 * which the harness enforces before it runs anything.
 */
import type { Seed } from '../prove';

const KEY_FILE = 'src/lib/cookie-auth.ts';
const LEAF = 'src/lib/guest/guestAccess.ts';
const DECISION = 'src/lib/guest/guestSession.ts';
const OPEN = 'src/app/api/guest/session/route.ts';
const END = 'src/app/api/guest/session/end/route.ts';
const BOOKING = 'src/app/api/guest/booking/route.ts';
const RECEIPT = 'src/lib/receipts/bookingReceipt.ts';
const PAGE = 'src/app/booking/manage/page.tsx';
const LOOKUP = 'src/components/guest/GuestBookingLookup.tsx';
const LANDING = 'src/components/landing/Landing.tsx';
const SENDER = 'src/lib/reservations/lifecycleSend.ts';

const SEEDS: Seed[] = [
  // ── 1. one key ──
  {
    name: 'guest01-a guestKey returns the raw secret — a guest value could be a userEmail signature',
    file: KEY_FILE,
    find: "return crypto.createHmac('sha256', getSecret()).update('ts-guest:v1').digest();",
    replace: 'return Buffer.from(getSecret());',
    expect: 'guestKey is not HMAC-SHA256(JWT_SECRET, ts-guest:v1)',
  },
  {
    name: 'guest01-b the leaf reads the clock',
    file: LEAF,
    find: '  if (expiresAt <= now) return null;\n',
    replace: '  if (expiresAt <= Math.floor(Date.now() / 1000)) return null;\n',
    expect: 'src/lib/guest/guestAccess.ts is not pure',
  },
  {
    name: 'guest01-c parse reads an O as a zero',
    file: LEAF,
    find: "const code = typed.toUpperCase().replace(/[\\s-]/g, '');",
    replace: "const code = typed.toUpperCase().replace(/[\\s-]/g, '').replace(/O/g, '0');",
    expect: 'parse reads "ABCD234O" as a code',
  },
  {
    name: 'guest01-d a session never expires',
    file: LEAF,
    find: '  if (expiresAt <= now) return null;\n',
    replace: '',
    expect: 'an expired session verifies',
  },
  {
    name: 'guest01-e the booking route hands the decision a key of its own',
    file: BOOKING,
    find: 'key: guestKey(),',
    replace: "key: Buffer.from('dev-secret'),",
    expect: 'a guest route hands the decision a key other than guestKey()',
  },
  {
    name: 'guest01-f the sender makes a code under the reservation id',
    file: SENDER,
    find: 'code: manageCode(guestKey(), row.id)',
    replace: 'code: manageCode(Buffer.from(row.id), row.id)',
    expect: 'calls manageCode under Buffer.from(row.id)',
  },
  // ── 2. the lookup leaks nothing ──
  {
    name: 'guest01-g the reference limit is dropped',
    file: DECISION,
    find: '  const byReference = await ports.limit(`guest-ref:${reference}`, GUEST_LIMITS.reference.limit, GUEST_LIMITS.reference.windowSeconds);\n  if (!byReference.ok) return { status: 429, error: GUEST_WORDS.tooMany, retryAfterSeconds: byReference.retryAfterSeconds };\n',
    replace: '',
    expect: 'the lookup is not IP → shapes → the IP limit → the reference limit → the read',
  },
  {
    name: 'guest01-h the lookup reads an account row too (userId null dropped)',
    file: OPEN,
    find: "bookingType: 'guest', userId: null }, select: { id: true } })",
    replace: "bookingType: 'guest' }, select: { id: true } })",
    expect: 'reads other than guest rows',
  },
  {
    name: 'guest01-i a wrong code gets a line of its own',
    file: DECISION,
    find: 'return matched.length === 1 ? { status: 200, reservationId: matched[0] } : notOpened();',
    replace: "return matched.length === 1 ? { status: 200, reservationId: matched[0] } : rows.length === 0 ? notOpened() : { status: 404, error: 'That code is wrong.' };",
    expect: 'a success is not exactly one match, or a failure is not the one 404',
  },
  {
    name: 'guest01-j no dummy compare when no row came back',
    file: DECISION,
    find: '  if (rows.length === 0) codesMatch(manageCode(input.key, DUMMY_RESERVATION_ID), code);\n',
    replace: '',
    expect: 'no dummy compare when no row came back',
  },
  {
    name: 'guest01-k the compare exits early',
    file: DECISION,
    find: 'if (codesMatch(manageCode(input.key, row.id), code)) matched.push(row.id);',
    replace: 'if (codesMatch(manageCode(input.key, row.id), code)) { matched.push(row.id); break; }',
    expect: 'not every row is compared in constant time with no early exit',
  },
  {
    name: 'guest01-l the session cookie goes sameSite lax',
    file: OPEN,
    find: "      sameSite: 'strict',\n",
    replace: "      sameSite: 'lax',\n",
    expect: 'does not set the one cookie with exactly httpOnly, secure, sameSite strict',
  },
  {
    name: 'guest01-m no IP is counted in an unknown bucket',
    file: OPEN,
    find: "|| request.headers.get('x-real-ip') || null;",
    replace: "|| request.headers.get('x-real-ip') || 'unknown';",
    expect: 'reads the IP with an unknown bucket',
  },
  {
    name: 'guest01-n the lookup route writes a row',
    file: OPEN,
    find: '    const answer = await openGuestSession(ports, { ip, body, key });\n',
    replace: "    const answer = await openGuestSession(ports, { ip, body, key });\n    await prisma.reservations.updateMany({ where: { providerBookingId: 'x' }, data: { status: 'x' } });\n",
    expect: 'src/app/api/guest/session/route.ts writes — a guest route writes nothing',
  },
  {
    name: 'guest01-o the decision logs the typed code',
    file: DECISION,
    find: '  const code = parseManageCode(body.code);\n',
    replace: "  const code = parseManageCode(body.code);\n  console.log('guest code', code);\n",
    expect: 'src/lib/guest/guestSession.ts logs or redirects',
  },
  {
    name: 'guest01-p the close keeps the cookie a minute',
    file: END,
    find: 'path: GUEST_COOKIE_PATH, maxAge: 0 });',
    replace: 'path: GUEST_COOKIE_PATH, maxAge: 60 });',
    expect: 'does more than clear the cookie',
  },
  // ── 3. one booking, the vendor's side ──
  {
    name: 'guest01-q the booking is read with no session check',
    file: DECISION,
    // GUEST-02 (2026-09-30): the guest's cancel gate verifies the same way; the anchor names the booking's read.
    find: '  if (reservationId === null) return { status: 401, error: GUEST_WORDS.sessionEnded };\n  const reservation = await ports.reservation(reservationId);\n',
    replace: '  const reservation = await ports.reservation(reservationId);\n',
    expect: 'the session is not verified before any read',
  },
  {
    name: 'guest01-r the booking read drops the guest fence',
    file: BOOKING,
    find: "where: { id, bookingType: 'guest', userId: null },",
    replace: 'where: { id },',
    expect: 'src/app/api/guest/booking/route.ts lost the reservation',
  },
  {
    name: 'guest01-s the guest receipt carries the bank part',
    file: RECEIPT,
    find: '    vendor: vendorSide.vendor,\n',
    replace: '    vendor: vendorSide.vendor,\n    bank: vendorSide.bank,\n',
    expect: 'the guest hotel answer carries [header, hotel, flight, vendor, bank',
  },
  {
    name: 'guest01-t the booking answer may be cached',
    file: BOOKING,
    find: 'return NextResponse.json({ receipt: answer.receipt, cancel: answer.cancel }, { headers: NO_STORE });',
    replace: 'return NextResponse.json({ receipt: answer.receipt, cancel: answer.cancel });',
    expect: 'lost the answer, never cached',
  },
  {
    name: 'guest01-u the money events select a settlement column',
    file: BOOKING,
    find: 'select: { id: true, kind: true, amountCents: true, currency: true, statedAt: true },',
    replace: 'select: { id: true, kind: true, amountCents: true, currency: true, statedAt: true, settledTransactionId: true },',
    expect: 'lost the money events with no settlement column',
  },
  {
    name: 'guest01-v the guest page draws a Bank section',
    file: PAGE,
    find: "      {view.state === 'checking' && ",
    replace: "      <section data-receipt-section=\"bank\" />\n      {view.state === 'checking' && ",
    expect: 'src/app/booking/manage/page.tsx draws a Bank, Ledger or History section',
  },
  {
    name: 'guest01-w a guest note names the bank',
    file: RECEIPT,
    find: "'Every figure is the vendor’s own: its landed answer",
    replace: "'Every figure is the vendor’s own (your bank shows the charge): its landed answer",
    expect: 'GUEST_NOTES are not the receipt notes written for a guest',
  },
  // ── 4. the public surface is exact ──
  {
    name: 'guest01-x the middleware opens /api/guest as a prefix',
    file: 'src/middleware.ts',
    find: "  '/api/guest/session',\n",
    replace: "  '/api/guest',\n",
    expect: 'the guest public surface is [',
  },
  {
    name: 'guest01-y the close route exports a DELETE',
    file: END,
    find: 'export async function POST() {',
    replace: 'export async function DELETE() {\n  return NextResponse.json({ ok: true });\n}\n\nexport async function POST() {',
    expect: 'src/app/api/guest/session/end/route.ts exports DELETE, PATCH or PUT',
  },
  // The door (Alex's ruling 17:04): the lookup under the home page's booking section.
  {
    name: 'guest01-z the home page loses its lookup (Alex\'s seed: the door is the lookup)',
    file: LANDING,
    find: "          <GuestBookingLookup onOpened={() => window.location.assign('/booking/manage')} />\n",
    replace: '',
    expect: 'does not mount the lookup directly under the booking section',
  },
  {
    name: 'guest01-z2 the lookup moves above the booking section',
    file: LANDING,
    find: '        <LandingBookingSection onRequireAuth={onRequireAuth} />\n',
    replace: "        <GuestBookingLookup onOpened={() => window.location.assign('/booking/manage')} />\n        <LandingBookingSection onRequireAuth={onRequireAuth} />\n",
    expect: 'does not mount the lookup directly under the booking section',
  },
  {
    name: 'guest01-z3 the lookup box asks on load',
    file: LOOKUP,
    find: "import { useState, useSyncExternalStore, type FormEvent } from 'react';",
    replace: "import { useEffect, useState, useSyncExternalStore, type FormEvent } from 'react';\nexport function useWarm() { useEffect(() => { void fetch('/api/guest/booking'); }, []); }",
    expect: 'asks something on load, or calls more than the submitted lookup',
  },
  {
    name: 'guest01-z4 the header link comes back',
    file: 'src/components/landing/LandingHeader.tsx',
    find: '            <a\n              href="https://github.com/Temple-Stuart/temple-stuart-accounting"',
    replace: '            <Link href="/booking/manage" className="text-xs">Manage booking</Link>\n            <a\n              href="https://github.com/Temple-Stuart/temple-stuart-accounting"',
    expect: 'LandingHeader.tsx links /booking/manage',
  },
  {
    name: 'guest01-z5 the page keeps a form of its own',
    file: PAGE,
    find: '          <h1 className="text-xl font-bold">Manage a booking</h1>\n',
    replace: '          <h1 className="text-xl font-bold">Manage a booking</h1>\n          <input name="code" />\n',
    expect: 'does not mount the one lookup box, or keeps a form of its own',
  },
  {
    name: 'guest01-z6 the fields no longer stack on a phone',
    file: LOOKUP,
    find: 'className="flex flex-col gap-3 sm:flex-row sm:items-end"',
    replace: 'className="flex flex-row gap-3 items-end"',
    expect: 'fields do not stack on a phone',
  },
  // ── 5. the code travels only by email ──
  {
    name: 'guest01-aa guestManageFor loses its guard — an account row gets the block',
    file: SENDER,
    find: "  if (row.bookingType !== 'guest' || row.userId !== null) return undefined;\n",
    replace: '',
    expect: 'guestManageFor answers a block for an account row',
  },
  {
    name: 'guest01-ab the hotel confirmation puts the code in the url',
    file: 'src/lib/emailTemplates/bookingConfirmation.ts',
    find: '...(g.url ? [g.url] : []),',
    replace: '...(g.url ? [`${g.url}&code=${g.code}`] : []),',
    expect: 'the hotel email puts the code inside the url',
  },
  {
    name: 'guest01-ac a guest row keeps "See this booking"',
    file: SENDER,
    find: 'manageUrl: guestManage ? null : bookingManageUrl(row.id),',
    replace: 'manageUrl: bookingManageUrl(row.id),',
    expect: '"See this booking" does not give way to the block',
  },
  {
    name: 'guest01-ad the lookup box posts the code in the URL',
    file: LOOKUP,
    find: "fetch('/api/guest/session', {",
    replace: 'fetch(`/api/guest/session?code=${encodeURIComponent(code)}`, {',
    expect: 'puts the code in a URL, keeps it in browser storage, or logs it',
  },
  {
    name: 'guest01-ad2 the lookup box can be submitted before hydration (a native GET — the code in the URL)',
    file: LOOKUP,
    find: '<fieldset className="space-y-3" disabled={!live}>',
    replace: '<fieldset className="space-y-3">',
    expect: 'can be submitted before the page is live',
  },
  {
    name: 'guest01-ae a lifecycle block line changes',
    file: 'src/lib/emailTemplates/lifecycle.ts',
    find: "    'Keep this code private — with the reference, it opens this booking.',\n",
    replace: "    'Keep this code safe.',\n",
    expect: 'the lifecycle email does not carry the five block lines for a guest',
  },
  {
    name: 'guest01-af the flight book route drops the block',
    file: 'src/app/api/travel/liteapi/flights/book/route.ts',
    find: '            guestManage: guestManageFor(result),\n',
    replace: '',
    expect: 'src/app/api/travel/liteapi/flights/book/route.ts does not hand the confirmation exactly',
  },
  {
    name: 'guest01-ag the lookup answers with what was typed',
    file: OPEN,
    find: 'const res = NextResponse.json({ ok: true });',
    replace: 'const res = NextResponse.json({ ok: true, code: body });',
    expect: 'src/app/api/guest/session/route.ts answers with the code',
  },
  // ── 6. the re-pins are dated ──
  {
    name: 'guest01-ah the hotel book route\'s re-pin loses the hash it had on main',
    file: 'src/lib/travelBookingFlow.ts',
    find: '  // Was d128348733a1f3688b48d084fe9fd60d6f8ce178833f92a18e5b2dbff1abbe0b at main 37909b85.\n',
    replace: '',
    expect: 'src/app/api/travel/liteapi/book/route.ts’s pin does not sit under a dated GUEST-01 note',
  },
];

export default SEEDS;
