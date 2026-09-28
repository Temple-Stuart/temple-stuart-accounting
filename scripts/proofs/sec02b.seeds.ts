/**
 * The SEC-02b laws' seeded regressions (2026-09-27).
 *
 * The ruling: the stay's dates and name are the vendor's (NULL, named, when it did
 * not state them — never the link's); no route response carries a password hash;
 * every bearer is compared in constant time. These seeds put back, one at a time,
 * each shape the three laws close:
 *
 *   · the vendor-stay law — the route storing the link's date, the body declaring
 *     or destructuring a stay date again, the name falling back to the body, the
 *     unstated log unnamed, the leaf taking a second argument or passing a
 *     non-date through, the confirm page posting its date again, 'your stay'
 *     back, the email printing a NULL day, the commission lock reading a NULL day;
 *   · the password-hash law — the RSVP create returning the whole row, the trip
 *     GET pulling participants whole, a response naming passwordHash, the one
 *     select gaining the hash;
 *   · the constant-time bearer law — each of the four bearers the ruling names
 *     (and the webhook token) back to `!==`, the comparator losing timingSafeEqual.
 *
 * Each must fail its law by name. The anchors occur exactly once in their file,
 * which the harness enforces before it runs anything.
 */
import type { Seed } from '../prove';

const BOOK = 'src/app/api/travel/liteapi/book/route.ts';
const STAY = 'src/lib/reservations/stayDates.ts';
const CONFIRM = 'src/app/booking/confirm/page.tsx';
const RSVP = 'src/app/api/trips/rsvp/route.ts';

const SEEDS: Seed[] = [
  // ── the vendor-stay law ──
  {
    name: 'sec02b-a the route stores the link\'s check-in again (the ruling\'s first seed)',
    file: BOOK,
    find: '                checkinDate: stay.checkinDate,\n',
    replace: "                checkinDate: new Date(body.checkinDate + 'T12:00:00Z'),\n",
    expect: 'reads body.checkinDate',
  },
  {
    name: 'sec02b-b the body interface declares checkinDate again',
    file: BOOK,
    find: '  guests?: BookGuest[];\n  guestCount?: number;\n',
    replace: '  guests?: BookGuest[];\n  checkinDate?: string;\n  guestCount?: number;\n',
    expect: 'BookRequestBody declares checkinDate again',
  },
  {
    name: 'sec02b-c the body destructure takes checkinDate again',
    file: BOOK,
    find: '      guestCount,\n      currency,\n    } = body;\n',
    replace: '      checkinDate, guestCount,\n      currency,\n    } = body;\n',
    expect: 'the body destructure takes checkinDate again',
  },
  {
    name: 'sec02b-d the hotel name falls back to the body\'s',
    file: BOOK,
    find: '            const resolvedHotelName = stay.hotelName;\n',
    replace: '            const resolvedHotelName = stay.hotelName ?? body.hotelName ?? null;\n',
    expect: 'the hotel name is no longer exactly stay.hotelName',
  },
  {
    name: 'sec02b-e an unstated stay is logged without its name and bookingId',
    file: BOOK,
    find: '              console.error(unstatedStayLine(parsed.bookingId, stay.unstated), {\n',
    replace: "              console.error('[LiteAPI book] stay partly unstated', {\n",
    expect: 'is no longer logged by name and bookingId (unstatedStayLine)',
  },
  {
    name: 'sec02b-f the leaf passes a string that is no calendar day through',
    file: STAY,
    find: '  if (!m) return null;\n',
    replace: '  if (!m) return v;\n',
    expect: 'statedStayDay("next tuesday") is "next tuesday"',
  },
  {
    name: 'sec02b-g the leaf takes a defaulted second argument — a door for the link',
    file: STAY,
    find: 'export function bookedStay(answer: { hotelName?: unknown; checkin?: unknown; checkout?: unknown }): BookedStay {\n  const hotelName = statedHotelName(answer.hotelName);\n',
    replace: 'export function bookedStay(answer: { hotelName?: unknown; checkin?: unknown; checkout?: unknown }, link: { hotelName?: unknown } = {}): BookedStay {\n  const hotelName = statedHotelName(answer.hotelName) ?? statedHotelName(link.hotelName);\n',
    expect: "bookedStay's signature is no longer the vendor's answer alone",
  },
  {
    name: 'sec02b-h the confirm page posts its link\'s check-in again',
    file: CONFIRM,
    find: "          // SEC-02b: no checkinDate / checkoutDate / hotelName — the stay is the vendor's.\n          guestCount: 1,\n",
    replace: '          checkinDate: checkin,\n          guestCount: 1,\n',
    expect: 'the book request sends checkinDate again',
  },
  {
    name: "sec02b-i 'your stay' comes back",
    file: CONFIRM,
    find: "  const hotelName = params.get('hotelName');\n",
    replace: "  const hotelName = params.get('hotelName') || 'your stay';\n",
    expect: "'your stay' is back",
  },
  {
    name: 'sec02b-j the email prints a NULL day instead of saying it',
    file: 'src/lib/emailTemplates/bookingConfirmation.ts',
    find: '  const checkin = input.checkinDate ?? DAY_NOT_STATED;\n',
    replace: '  const checkin = input.checkinDate as string;\n',
    expect: 'bookingConfirmation throws on a stay with no stated days',
  },
  {
    name: 'sec02b-k the commission lock reads a NULL check-out as a date',
    file: 'src/lib/reservations/applyVendorState.ts',
    find: 'const afterCheckout = row.checkoutDate !== null && row.checkoutDate.getTime()',
    replace: 'const afterCheckout = row.checkoutDate!.getTime()',
    expect: 'the commission lock no longer requires a stated check-out',
  },
  // ── the password-hash law ──
  {
    name: 'sec02b-l the RSVP create returns the whole row again (the ruling\'s password seed)',
    file: RSVP,
    find: '          passwordHash\n        },\n        select: PARTICIPANT_RESPONSE_SELECT,\n      });\n',
    replace: '          passwordHash\n        },\n      });\n',
    expect: 'a whole trip_participants row (passwordHash included)',
  },
  {
    name: 'sec02b-m the trip GET pulls participants whole again',
    file: 'src/app/api/trips/[id]/route.ts',
    find: '          select: PARTICIPANT_RESPONSE_SELECT,\n          orderBy: { createdAt: \'asc\' }\n',
    replace: '          orderBy: { createdAt: \'asc\' }\n',
    expect: 'with participants: { … } with no select — a hash-holding relation, whole',
  },
  {
    name: 'sec02b-n the RSVP GET names passwordHash in its answer',
    file: RSVP,
    find: '        hasPassword: !!participant.passwordHash\n',
    replace: '        passwordHash: participant.passwordHash\n',
    expect: 'the response body names a password column',
  },
  {
    name: 'sec02b-o the one participant select gains the hash',
    file: 'src/lib/trips/participantSelect.ts',
    find: '  isOwner: true,\n',
    replace: '  isOwner: true,\n  passwordHash: true,\n',
    expect: 'PARTICIPANT_RESPONSE_SELECT selects passwordHash',
  },
  // ── the constant-time bearer law ──
  {
    name: 'sec02b-p the reservations-refresh cron compares with !== again',
    file: 'src/app/api/cron/reservations-refresh/route.ts',
    find: '    if (authHeader === null || !constantTimeEqual(authHeader, `Bearer ${cronSecret}`)) {\n',
    replace: '    if (authHeader !== `Bearer ${cronSecret}`) {\n',
    expect: 'src/app/api/cron/reservations-refresh/route.ts compares a `Bearer ${…}` template with ===/!==',
  },
  {
    name: 'sec02b-q the auto-categorize cron compares with !== again',
    file: 'src/app/api/cron/auto-categorize/route.ts',
    find: '    if (authHeader === null || !constantTimeEqual(authHeader, `Bearer ${cronSecret}`)) {\n',
    replace: '    if (authHeader !== `Bearer ${cronSecret}`) {\n',
    expect: 'src/app/api/cron/auto-categorize/route.ts compares a `Bearer ${…}` template with ===/!==',
  },
  {
    name: 'sec02b-r the audit-ingest callback compares with !== again',
    file: 'src/app/api/operations/projects/[id]/audit-ingest/route.ts',
    find: '    if (authHeader === null || !constantTimeEqual(authHeader, `Bearer ${secret}`)) {\n',
    replace: '    if (authHeader !== `Bearer ${secret}`) {\n',
    expect: 'src/app/api/operations/projects/[id]/audit-ingest/route.ts compares a `Bearer ${…}` template with ===/!==',
  },
  {
    name: 'sec02b-s the exec-ingest callback compares with !== again',
    file: 'src/app/api/operations/projects/[id]/exec-ingest/route.ts',
    find: '    if (authHeader === null || !constantTimeEqual(authHeader, `Bearer ${secret}`)) {\n',
    replace: '    if (authHeader !== `Bearer ${secret}`) {\n',
    expect: 'src/app/api/operations/projects/[id]/exec-ingest/route.ts compares a `Bearer ${…}` template with ===/!==',
  },
  {
    name: 'sec02b-t the LiteAPI webhook compares its token with !==',
    file: 'src/app/api/webhooks/liteapi/route.ts',
    find: '  if (given === null || !constantTimeEqual(given, expected)) {\n',
    replace: '  if (given !== expected) {\n',
    expect: 'src/app/api/webhooks/liteapi/route.ts compares expected with ===/!==',
  },
  {
    name: 'sec02b-u the comparator loses timingSafeEqual',
    file: 'src/lib/webhooks/liteapiWebhook.ts',
    find: '  return timingSafeEqual(a, b);\n',
    replace: '  return a.equals(b);\n',
    expect: 'constantTimeEqual is no longer a length check then timingSafeEqual',
  },
];

export default SEEDS;
