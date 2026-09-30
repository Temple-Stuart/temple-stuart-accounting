/**
 * GUEST-02 (2026-09-30) — a guest cancels their booking: seeded regressions.
 *
 * The ruling: /booking/manage offers Cancel on the one booking the guest's session opened,
 * and the cancel runs the SAME code the account holder's does — one cancel flow
 * (src/lib/reservations/cancelFlow.ts), two gates. Each seed puts back, one at a time, a
 * shape the ruling forbids:
 *
 *   · the gated flow (the ownership law): a call before the gate, a third importer, an
 *     update by another key, an entry that does not take the gate's row first, a gate
 *     handing another row, a stale caller (no call; no import), the public writer's
 *     limiter gone, and a new route calling the flow — counted as a writer, so its
 *     missing identity is caught;
 *   · the guest law's clause 7: the gate (the read, its order, the session first), the
 *     route (the IP, the guest's actor, no-store), the offer, the page (the control,
 *     the dialog's URL, the POST), the dialog's fixed URL, the owner (the landing's
 *     guest_ref, the email's block) and the pins; clause 4's second writer (create form);
 *   · the cancel, status and audit laws' GUEST-02 checks: the account gate's where, the
 *     awaited flow, a vendor word in the flow, the flow's own actor, the audit's owner and
 *     the account's caller.
 *
 * GUEST-02b (2026-09-30) adds six: the flow's answer carries commissionMoved again; a lane lands
 * with userId null; the flight lane emails with no account address; the page skips the re-read;
 * a third caller listed in GATED_FLOWS; a caller that is not a route (two seeds edit the law
 * file itself, as sec02-m does).
 *
 * Each must fail the build by name. The anchors of the edit seeds occur exactly once in
 * their file, which the harness enforces first; a create seed names a file that must not
 * exist (find '').
 */
import type { Seed } from '../prove';

const SEEDS: Seed[] = [
  // ── L4: the gated flow (the ownership law) ──
  {
    name: 'guest02-a the guest route calls the flow before its gate',
    file: 'src/app/api/guest/booking/cancel/route.ts',
    find: 'export async function GET(request: NextRequest) {\n  try {\n    const g = await guestGate(request);',
    replace: 'export async function GET(request: NextRequest) {\n  try {\n    await quoteCancellation(null as never, { actor: humanActor(null, null), accountEmail: null });\n    const g = await guestGate(request);',
    expect: 'calls quoteCancellation without its gate first in the same function',
  },
  {
    name: 'guest02-b a third file imports the flow',
    file: 'src/app/api/reservations/[id]/timeline/route.ts',
    find: 'import { prisma } from \'@/lib/prisma\';',
    replace: 'import { prisma } from \'@/lib/prisma\';\nimport { quoteCancellation } from \'@/lib/reservations/cancelFlow\';\nvoid quoteCancellation;',
    expect: 'ownership law: src/app/api/reservations/[id]/timeline/route.ts imports the gated flow src/lib/reservations/cancelFlow.ts — only its listed callers may',
  },
  {
    name: 'guest02-c the flow updates a reservation by something other than owned.id',
    file: 'src/lib/reservations/cancelFlow.ts',
    find: '          const row = await tx.reservations.update({\n            where: { id: owned.id },\n            data: { status: \'cancelled\' },',
    replace: '          const row = await tx.reservations.update({\n            where: { providerBookingId: owned.providerBookingId },\n            data: { status: \'cancelled\' },',
    expect: 'an update whose WHERE does not name owned.id: a gated flow updates only by owned.id',
  },
  {
    name: 'guest02-d an entry no longer takes the gate’s row first',
    file: 'src/lib/reservations/cancelFlow.ts',
    find: 'export async function cancelReservation(owned: CancelRow, caller: CancelCaller): Promise<NextResponse> {',
    replace: 'export async function cancelReservation(caller: CancelCaller, owned: CancelRow): Promise<NextResponse> {',
    expect: 'does not export cancelReservation(owned, …) — every entry takes the gate’s row first',
  },
  {
    name: 'guest02-e the account’s gate hands the flow another row',
    file: 'src/app/api/reservations/[id]/cancel/route.ts',
    find: '    return await cancelReservation(g.owned, caller);',
    replace: '    return await cancelReservation({ ...g.owned, id }, caller);',
    expect: 'hands cancelReservation { ...g.owned, id } — the gate’s own row is g.owned',
  },
  {
    name: 'guest02-f a listed caller calls no entry (stale)',
    file: 'src/app/api/reservations/[id]/cancel/route.ts',
    find: '    return await quoteCancellation(g.owned, caller);\n  } catch (error) {\n    if (error instanceof TravelSearchQuotaError) {\n      return NextResponse.json(\n        { error: \'Cancellation quotes are temporarily paused. Please try again later.\', code: \'quote_paused\' },\n        { status: 503 }\n      );\n    }\n    console.error(\'[Reservation cancel quote] request error:\', error);\n    return NextResponse.json({ error: \'Failed to quote the cancellation\' }, { status: 500 });\n  }\n}\n\n// ─── POST — THE ACTION ───────────────────────────────────────────────────────\nexport async function POST(\n  request: NextRequest,\n  { params }: { params: Promise<{ id: string }> }\n) {\n  try {\n    const { id } = await params;\n    const g = await gate(id);\n    if (!g.ok) return g.response;\n    const caller: CancelCaller = { actor: humanActor({ id: g.userId, email: g.accountEmail }), accountEmail: g.accountEmail };\n    return await cancelReservation(g.owned, caller);',
    replace: '    return NextResponse.json({ ok: false });\n  } catch (error) {\n    if (error instanceof TravelSearchQuotaError) {\n      return NextResponse.json(\n        { error: \'Cancellation quotes are temporarily paused. Please try again later.\', code: \'quote_paused\' },\n        { status: 503 }\n      );\n    }\n    console.error(\'[Reservation cancel quote] request error:\', error);\n    return NextResponse.json({ error: \'Failed to quote the cancellation\' }, { status: 500 });\n  }\n}\n\n// ─── POST — THE ACTION ───────────────────────────────────────────────────────\nexport async function POST(\n  request: NextRequest,\n  { params }: { params: Promise<{ id: string }> }\n) {\n  try {\n    const { id } = await params;\n    const g = await gate(id);\n    if (!g.ok) return g.response;\n    const caller: CancelCaller = { actor: humanActor({ id: g.userId, email: g.accountEmail }), accountEmail: g.accountEmail };\n    return NextResponse.json({ ok: false });',
    expect: 'ownership law: GATED_FLOWS lists src/app/api/reservations/[id]/cancel/route.ts, which calls no entry of src/lib/reservations/cancelFlow.ts — the entry is stale',
  },
  {
    name: 'guest02-g a listed caller no longer imports the flow (stale)',
    file: 'src/app/api/reservations/[id]/cancel/route.ts',
    find: 'import { CANCEL_ROW_SELECT, cancelReservation, quoteCancellation, type CancelCaller, type CancelRow } from \'@/lib/reservations/cancelFlow\';\n',
    replace: '',
    expect: 'ownership law: GATED_FLOWS lists src/app/api/reservations/[id]/cancel/route.ts, which does not import src/lib/reservations/cancelFlow.ts — the entry is stale',
  },
  {
    name: 'guest02-h the public writer’s limiter is gone',
    file: 'src/app/api/guest/booking/cancel/route.ts',
    find: '      await rateLimit(key, { limit, windowSeconds });\n',
    replace: '      void rateLimit;\n',
    expect: 'the public writer\'s guard "the limiter',
  },
  {
    name: 'guest02-i a new route that calls the flow is a writer — with no identity, it is caught',
    file: 'src/app/api/reservations/[id]/cancel-again/route.ts',
    find: '',
    replace: 'import { cancelReservation } from \'@/lib/reservations/cancelFlow\';\nexport async function POST() { return cancelReservation(null as never, { actor: null as never, accountEmail: null }); }\n',
    expect: 'POST changes data with no getVerifiedEmail() / getCurrentUser() / requireAdmin()',
  },
  // ── the guest law, clause 7.1: the gate ──
  {
    name: 'guest02-j the guest read drops userId: null',
    file: 'src/app/api/guest/booking/cancel/route.ts',
    find: '      where: { id, bookingType: \'guest\', userId: null, provider: { in: [\'liteapi\', \'duffel\'] } },',
    replace: '      where: { id, bookingType: \'guest\', provider: { in: [\'liteapi\', \'duffel\'] } },',
    expect: 'the gate’s read is not { id, bookingType guest, userId null, provider liteapi | duffel }',
  },
  {
    name: 'guest02-k the gate reads the row before the reservation limit',
    file: 'src/lib/guest/guestSession.ts',
    find: '  const byReservation = await ports.limit(`guest-cancel:${reservationId}`, GUEST_CANCEL_LIMITS.reservation.limit, GUEST_CANCEL_LIMITS.reservation.windowSeconds);\n  if (!byReservation.ok) return { status: 429, error: GUEST_WORDS.tooMany, retryAfterSeconds: byReservation.retryAfterSeconds };\n\n  // 4. The session\'s reservation, still a guest\'s — or the one 404.\n  const row = await ports.reservation(reservationId);\n',
    replace: '  const row = await ports.reservation(reservationId);\n  const byReservation = await ports.limit(`guest-cancel:${reservationId}`, GUEST_CANCEL_LIMITS.reservation.limit, GUEST_CANCEL_LIMITS.reservation.windowSeconds);\n  if (!byReservation.ok) return { status: 429, error: GUEST_WORDS.tooMany, retryAfterSeconds: byReservation.retryAfterSeconds };\n\n  // 4. The session\'s reservation, still a guest\'s — or the one 404.\n',
    expect: 'guestCancelGate is not session → 401 → IP → the IP limit → the reservation limit → the read → 404 → the row',
  },
  {
    name: 'guest02-l the session is verified after a limit',
    file: 'src/lib/guest/guestSession.ts',
    find: '  // 1. The session first — none or invalid is 401, before anything is counted or read.\n  const reservationId = verifyGuestSession(input.key, input.cookie, input.now);\n  if (reservationId === null) return { status: 401, error: GUEST_WORDS.sessionEnded };\n\n  // 2. No IP → the one 404: nothing to count the attempt against.\n  if (input.ip === null || input.ip.length === 0) return { status: 404, error: GUEST_WORDS.notOpened };\n\n  // 3. Both limits, the cancel\'s own buckets, before any read.\n  const byIp = await ports.limit(`guest-cancel-ip:${input.ip}`, GUEST_CANCEL_LIMITS.ip.limit, GUEST_CANCEL_LIMITS.ip.windowSeconds);\n  if (!byIp.ok) return { status: 429, error: GUEST_WORDS.tooMany, retryAfterSeconds: byIp.retryAfterSeconds };\n',
    replace: '  // 2. No IP → the one 404: nothing to count the attempt against.\n  if (input.ip === null || input.ip.length === 0) return { status: 404, error: GUEST_WORDS.notOpened };\n\n  // 3. Both limits, the cancel\'s own buckets, before any read.\n  const byIp = await ports.limit(`guest-cancel-ip:${input.ip}`, GUEST_CANCEL_LIMITS.ip.limit, GUEST_CANCEL_LIMITS.ip.windowSeconds);\n  if (!byIp.ok) return { status: 429, error: GUEST_WORDS.tooMany, retryAfterSeconds: byIp.retryAfterSeconds };\n\n  // 1. The session first — none or invalid is 401, before anything is counted or read.\n  const reservationId = verifyGuestSession(input.key, input.cookie, input.now);\n  if (reservationId === null) return { status: 401, error: GUEST_WORDS.sessionEnded };\n',
    expect: 'guestCancelGate is not session → 401 → IP → the IP limit → the reservation limit → the read → 404 → the row',
  },
  // ── clause 7.2: the route ──
  {
    name: 'guest02-m the guest route reads the IP with an unknown bucket',
    file: 'src/app/api/guest/booking/cancel/route.ts',
    find: '  const ip = request.headers.get(\'x-forwarded-for\')?.split(\',\')[0]?.trim() || request.headers.get(\'x-real-ip\') || null;',
    replace: '  const ip = request.headers.get(\'x-forwarded-for\')?.split(\',\')[0]?.trim() || request.headers.get(\'x-real-ip\') || \'unknown\';',
    expect: 'does not read the IP as the lookup reads it (no unknown bucket)',
  },
  {
    name: 'guest02-n the guest actor loses its IP',
    file: 'src/app/api/guest/booking/cancel/route.ts',
    find: '    const caller: CancelCaller = { actor: humanActor(null, g.ip), accountEmail: null };\n    return noStore(await cancelReservation(g.row, caller));',
    replace: '    const caller: CancelCaller = { actor: humanActor(null), accountEmail: null };\n    return noStore(await cancelReservation(g.row, caller));',
    expect: 'the guest’s caller is not humanActor(null, g.ip) in both verbs',
  },
  {
    name: 'guest02-o no-store dropped from the flow’s answer',
    file: 'src/app/api/guest/booking/cancel/route.ts',
    find: '  res.headers.set(\'Cache-Control\', \'no-store\');\n',
    replace: '',
    expect: 'an answer can be cached',
  },
  // ── clause 7.3: the offer ──
  {
    name: 'guest02-p the offer admits a cancelled row',
    file: 'src/lib/guest/guestSession.ts',
    find: '  if (row.provider !== \'liteapi\' || row.status !== \'confirmed\') return null;',
    replace: '  if (row.provider !== \'liteapi\' || (row.status !== \'confirmed\' && row.status !== \'cancelled\')) return null;',
    expect: 'guest booking law: cancelled is offered Cancel',
  },
  // ── clause 7.4: the page ──
  {
    name: 'guest02-q the page shows Cancel without the offer',
    file: 'src/app/booking/manage/page.tsx',
    find: '                {view.cancel && (\n                  <button type="button" onClick={() => setCancelOpen(true)}',
    replace: '                {true && (\n                  <button type="button" onClick={() => setCancelOpen(true)}',
    expect: 'the Cancel control is not drawn only from the offer',
  },
  {
    name: 'guest02-r the page opens the dialog on an owner’s quote URL',
    file: 'src/app/booking/manage/page.tsx',
    find: '              quoteUrl="/api/guest/booking/cancel"',
    replace: '              quoteUrl="/api/reservations/x/cancel"',
    expect: 'does not open the one cancel dialog with the guest’s quote URL, from the offer',
  },
  {
    name: 'guest02-s the page posts the account’s route',
    file: 'src/app/booking/manage/page.tsx',
    find: '      const res = await fetch(\'/api/guest/booking/cancel\', { method: \'POST\' });',
    replace: '      const res = await fetch(`/api/reservations/${view.state}/cancel`, { method: \'POST\' });',
    expect: 'does not post the cancel to the guest’s route, once',
  },
  {
    name: 'guest02-t the dialog’s quote URL is fixed again',
    file: 'src/components/trips/CancelBookingDialog.tsx',
    find: '        const res = await fetch(quoteUrl);',
    replace: '        const res = await fetch(`/api/reservations/${bookingName}/cancel`);',
    expect: 'does not read the quote from its caller’s quoteUrl (required, with no route of its own)',
  },
  // ── clause 7.5: the owner ──
  {
    name: 'guest02-u the landing lands a guest cancel with guest_ref null',
    file: 'src/lib/arrivals/liteapiBooking.ts',
    find: '  const guestRef = input.userId === null ? bookingGuestRef(input.bookingId) : null;',
    replace: '  const guestRef = null;',
    expect: 'the cancellation landing does not name its owner',
  },
  {
    name: 'guest02-v the guest email loses its block',
    file: 'src/lib/reservations/cancelFlow.ts',
    find: '    const guestManage = guestManageFor(owned);',
    replace: '    const guestManage = undefined;',
    expect: 'the cancellation email does not hand guestManageFor’s block, dropping "See this booking" for a guest',
  },
  // ── clause 7.6: the pins ──
  {
    name: 'guest02-w the flow’s new pin loses its dated note',
    file: 'src/lib/travelBookingFlow.ts',
    find: '  // GUEST-02 (2026-09-30): pinned — the ONE cancel flow: the quote and the cancel, moved word for word from the account\'s route; each gate hands it the row it read and its caller. The actor is the caller\'s, the owner the row\'s own userId, and a guest row\'s email carries its manage block. Every vendor call, landing, write, refusal, answer, log and email of an account cancel is unchanged.\n',
    replace: '',
    expect: 'src/lib/reservations/cancelFlow.ts’s pin does not sit under a dated GUEST-02 note saying why it is pinned',
  },
  // ── the cancel, status and audit laws’ GUEST-02 checks ──
  {
    name: 'guest02-x the account’s gate drops userId: user.id',
    file: 'src/app/api/reservations/[id]/cancel/route.ts',
    find: '    where: { id, userId: user.id, provider: { in: [\'liteapi\', \'duffel\'] } },',
    replace: '    where: { id, provider: { in: [\'liteapi\', \'duffel\'] } },',
    expect: 'the account’s gate does not read { id, userId: user.id, provider liteapi | duffel } with CANCEL_ROW_SELECT',
  },
  {
    name: 'guest02-y the account’s gate stops awaiting the flow',
    file: 'src/app/api/reservations/[id]/cancel/route.ts',
    find: '    return await quoteCancellation(g.owned, caller);',
    replace: '    return quoteCancellation(g.owned, caller);',
    expect: 'GET does not await quoteCancellation inside its try',
  },
  {
    name: 'guest02-z the flow compares a vendor status word',
    file: 'src/lib/reservations/cancelFlow.ts',
    find: '  if (owned.lane === \'flight\') return cancelFlight(owned, caller);',
    replace: '  if (owned.lane === \'flight\') return cancelFlight(owned, caller);\n  if (owned.providerBookingId === \'CONFIRMED\') return cancelFlight(owned, caller);',
    expect: 'status law: src/lib/reservations/cancelFlow.ts compares a vendor status word — only the two lane leaves may',
  },
  {
    name: 'guest02-aa the flow builds its own actor',
    file: 'src/lib/reservations/cancelFlow.ts',
    find: '  const actor = caller.actor;\n  const booking = { id: owned.id, userId: owned.userId };\n  await recordBookingEvent({ reservation: booking, kind: \'reservation_cancel_requested\', actor, before: { status: owned.status }, after: { lane: \'hotel\' }',
    replace: '  const actor = humanActor(null);\n  const booking = { id: owned.id, userId: owned.userId };\n  await recordBookingEvent({ reservation: booking, kind: \'reservation_cancel_requested\', actor, before: { status: owned.status }, after: { lane: \'hotel\' }',
    expect: 'builds an actor — the actor is the caller’s, built by its gate',
  },
  {
    name: 'guest02-ab the quote’s audit owner is not the row’s',
    file: 'src/lib/reservations/cancelFlow.ts',
    find: '    reservation: { id: owned.id, userId: owned.userId },\n    kind: \'reservation_cancel_quoted\',',
    replace: '    reservation: { id: owned.id, userId: null },\n    kind: \'reservation_cancel_quoted\',',
    expect: 'the audit’s owner is not the row’s own userId in the quote and both lanes',
  },
  {
    name: 'guest02-ac the account’s caller is not the signed-in human',
    file: 'src/app/api/reservations/[id]/cancel/route.ts',
    find: '    const caller: CancelCaller = { actor: humanActor({ id: g.userId, email: g.accountEmail }), accountEmail: g.accountEmail };\n    return await quoteCancellation(g.owned, caller);',
    replace: '    const caller: CancelCaller = { actor: humanActor(null), accountEmail: g.accountEmail };\n    return await quoteCancellation(g.owned, caller);',
    expect: 'the account’s caller is not humanActor({ id: g.userId, email: g.accountEmail }) in both verbs',
  },
  // ── the guest law, clause 4: the public surface ──
  {
    name: 'guest02-ad a second writer route under /api/guest (create form)',
    file: 'src/app/api/guest/booking/refund/route.ts',
    find: '',
    replace: 'import { prisma } from \'@/lib/prisma\';\nexport async function POST() { await prisma.reservations.update({ where: { id: \'x\' }, data: {} }); return new Response(null); }\n',
    expect: 'exactly the four routes (the three GUEST-01 routes and the GUEST-02 cancel)',
  },
  // ── GUEST-02b (2026-09-30): what only the pin held, now law; the gated flow’s callers closed ──
  {
    name: 'guest02b-a the flow’s answer carries commissionMoved again',
    file: 'src/lib/reservations/cancelFlow.ts',
    find: '      moneyEvents: moneyEvents.length,\n      calendar,',
    replace: '      moneyEvents: moneyEvents.length,\n      commissionMoved,\n      calendar,',
    expect: 'answers commission — Temple Stuart’s books, never the customer’s cancel answer (RECEIPT-01)',
  },
  {
    name: 'guest02b-b a lane lands its cancellation with userId null',
    file: 'src/lib/reservations/cancelFlow.ts',
    find: '        parse: parseFlightCancellationResult,\n        userId: owned.userId,',
    replace: '        parse: parseFlightCancellationResult,\n        userId: null,',
    expect: 'a lane lands its cancellation without the row’s owner (userId: owned.userId)',
  },
  {
    name: 'guest02b-c the flight lane emails with no account address',
    file: 'src/lib/reservations/cancelFlow.ts',
    find: '    owned,\n    caller.accountEmail,\n    decision.final',
    replace: '    owned,\n    null,\n    decision.final',
    expect: 'the flight lane does not email the caller’s address (sendCancellationEmail(owned, caller.accountEmail, …))',
  },
  {
    name: 'guest02b-d the page skips reading the booking again after a cancel',
    file: 'src/app/booking/manage/page.tsx',
    find: '      const read = await readBooking();\n      if (read.ok) {\n        setFailure(null);\n        setView({ state: \'open\', receipt: read.receipt, cancel: read.cancel });\n      } else {\n        setFailure(read.error);\n      }\n',
    replace: '',
    expect: 'does not read the booking again after a successful cancel, before it writes its line',
  },
  {
    name: 'guest02b-e a third caller is listed in GATED_FLOWS',
    file: 'scripts/assert-tool-registry.ts',
    find: '      { file: \'src/app/api/guest/booking/cancel/route.ts\', precondition: /const g = await guestGate\\(request\\);\\s*if \\(!g\\.ok\\) return g\\.response;/, row: \'g.row\', why: \'the guest\\u2019s gate: the signed session, the IP, both limits, then the row read with { id, bookingType guest, userId null, provider liteapi | duffel } (401 / 404 / 429 otherwise)\' },\n',
    replace: '      { file: \'src/app/api/guest/booking/cancel/route.ts\', precondition: /const g = await guestGate\\(request\\);\\s*if \\(!g\\.ok\\) return g\\.response;/, row: \'g.row\', why: \'the guest\\u2019s gate: the signed session, the IP, both limits, then the row read with { id, bookingType guest, userId null, provider liteapi | duffel } (401 / 404 / 429 otherwise)\' },\n      { file: \'src/app/api/reservations/[id]/timeline/route.ts\', precondition: /seeded/, row: \'g.row\', why: \'seeded\' },\n',
    expect: 'gatedCallers holds 3 entries, pinned at 2',
  },
  {
    name: 'guest02b-f a caller that is not a route',
    file: 'scripts/assert-tool-registry.ts',
    find: '      { file: \'src/app/api/guest/booking/cancel/route.ts\', precondition: /const g = await guestGate',
    replace: '      { file: \'src/app/booking/manage/page.tsx\', precondition: /const g = await guestGate',
    expect: 'GATED_FLOWS lists src/app/booking/manage/page.tsx as a caller of src/lib/reservations/cancelFlow.ts — a caller is a route',
  },
];

export default SEEDS;
