/**
 * The status law's seeded regressions (STATUS-01, 2026-09-26).
 *
 * The ruling says one thing: A WEBHOOK IS A HINT. THE GET IS THE TRUTH. These
 * seeds put back, one at a time, each shape the ruling forbids:
 *
 *   · the receiver writes a reservation itself (clause 1);
 *   · the bytes are read before the token check (clause 1);
 *   · an absent authorization header is let through (clause 1);
 *   · the token compares loosely (clause 1);
 *   · a duplicate event is acted on again (clause 1);
 *   · a booking that is not ours is read from the vendor (clause 1);
 *   · the delivery answer is read for its status (clause 1);
 *   · the webhook path leaves the public list (clause 1);
 *   · a second writer stamps lastVendorReadAt (clause 2);
 *   · the apply leaf stamps our clock (clause 2);
 *   · the confirmation email marker leaves the write (clause 3);
 *   · a third file fires a lifecycle email kind (clause 3);
 *   · the book route defaults a status (clause 4);
 *   · the client defaults CONFIRMED again (clause 4);
 *   · the book route maps the hotel word inline (clause 5);
 *   · a third file turns a vendor word into ours (clause 5);
 *   · the read leaf lets a failed GET throw past read_failed (clause 6);
 *   · the cron stops refusing a wrong secret (clause 7);
 *   · the cron batch goes unbounded (clause 7);
 *   · the cron leaves its hourly schedule (clause 7);
 *   · the migration loses its partial unique dedupe (clause 8);
 *   · the retro grows its own implementation (clause 9).
 *
 * Each must fail THE STATUS LAW by name. The anchors occur exactly once in their
 * file, which the harness enforces before it runs anything.
 */
import type { Seed } from '../prove';

const WEBHOOK_ROUTE = 'src/app/api/webhooks/liteapi/route.ts';
const WEBHOOK_LEAF = 'src/lib/webhooks/liteapiWebhook.ts';
const CRON_ROUTE = 'src/app/api/cron/reservations-refresh/route.ts';
const APPLY = 'src/lib/reservations/applyVendorState.ts';
const READ_LEAF = 'src/lib/reservations/vendorRead.ts';
const HOTEL_BOOK = 'src/app/api/travel/liteapi/book/route.ts';
const HOTEL_CLIENT = 'src/lib/liteapiClient.ts';
const RETRO = 'scripts/status-01-retro-reservations.ts';
const MIGRATION = 'prisma/migrations/20260926120000_status_01_vendor_truth/migration.sql';

const SEEDS: Seed[] = [
  {
    name: 'status01-a the receiver writes a reservation itself (clause 1)',
    file: WEBHOOK_ROUTE,
    find: "    const read = await readAndApplyReservation(row, { source: 'webhook' });",
    replace: "    await prisma.reservations.update({ where: { id: row.id }, data: { status: 'cancelled' } });\n    const read = await readAndApplyReservation(row, { source: 'webhook' });",
    expect: 'writes a reservation — the receiver applies nothing',
  },
  {
    name: 'status01-b the bytes are read before the token check (clause 1)',
    file: WEBHOOK_ROUTE,
    find: '  const expected = process.env.LITEAPI_WEBHOOK_TOKEN;',
    replace: '  const early = Buffer.from(await request.arrayBuffer());\n  void early;\n  const expected = process.env.LITEAPI_WEBHOOK_TOKEN;',
    expect: 'bytes before the token',
  },
  {
    name: 'status01-c an absent authorization header is let through (clause 1)',
    file: WEBHOOK_ROUTE,
    find: '  if (given === null || !constantTimeEqual(given, expected)) {',
    replace: '  if (given !== null && !constantTimeEqual(given, expected)) {',
    expect: 'an absent header is not refused',
  },
  {
    name: 'status01-d the token compares loosely (clause 1)',
    file: WEBHOOK_LEAF,
    find: '  return timingSafeEqual(a, b);',
    replace: '  return a.equals(b);',
    expect: 'does not compare the token in constant time',
  },
  {
    name: 'status01-e a duplicate event is acted on again (clause 1)',
    file: WEBHOOK_ROUTE,
    find: "    if (acted !== null) {\n      await record('duplicate', null);",
    replace: "    if (acted !== null && acted.outcome === 'never') {\n      await record('duplicate', null);",
    expect: 'acts on a duplicate delivery',
  },
  {
    name: 'status01-f a booking that is not ours is read from the vendor (clause 1)',
    file: WEBHOOK_ROUTE,
    find: "    if (row === null) {\n      await record('unknown_booking', null);",
    replace: "    if (row === null && bookingId === null) {\n      await record('unknown_booking', null);",
    expect: 'reads the vendor for a booking that is not ours',
  },
  {
    name: 'status01-g the delivery answer is read for its status (clause 1)',
    file: WEBHOOK_ROUTE,
    find: '  const bookingId = resolveWebhookBookingId(eventName, delivery.response);',
    replace: '  const bookingId = resolveWebhookBookingId(eventName, delivery.response);\n  const hint = (delivery.response as { data?: { status?: string } } | null)?.data?.status;\n  void hint;',
    expect: 'reads the delivery answer for something other than the booking id',
  },
  {
    name: 'status01-h the webhook path leaves the public list (clause 1)',
    file: 'src/middleware.ts',
    find: "  '/api/webhooks/liteapi',\n",
    replace: '',
    expect: 'is not a listed public path',
  },
  {
    name: 'status01-i a second writer stamps lastVendorReadAt (clause 2)',
    file: CRON_ROUTE,
    find: '    const perRow:',
    replace: "    await prisma.reservations.updateMany({ where: { lane: 'flight' }, data: { lastVendorReadAt: new Date() } });\n    const perRow:",
    expect: 'applyVendorState is the only writer of the five STATUS-01 columns',
  },
  {
    name: 'status01-j the apply leaf stamps our clock (clause 2)',
    file: APPLY,
    find: '  const patch: ReservationPatch = { lastVendorReadAt: vendor.readAt };',
    replace: '  const patch: ReservationPatch = { lastVendorReadAt: new Date() };',
    expect: 'lastVendorReadAt is not the landed answer instant',
  },
  {
    name: 'status01-k the confirmation email marker leaves the write (clause 3)',
    file: APPLY,
    find: "        patch.confirmationEmailSentAt = vendor.readAt;\n        emails.push({ kind: 'hotel_confirmation_arrived', confirmationCode: statedCode });",
    replace: "        emails.push({ kind: 'hotel_confirmation_arrived', confirmationCode: statedCode });",
    expect: 'the hotel_confirmation_arrived marker does not ride the same write',
  },
  {
    name: 'status01-l a third file fires a lifecycle email kind (clause 3)',
    file: CRON_ROUTE,
    find: 'const BATCH = 20;',
    replace: "const BATCH = 20;\nconst RESEND = { kind: 'ticketed' };\nvoid RESEND;",
    expect: 'a third file carries a lifecycle email kind',
  },
  {
    name: 'status01-m the book route defaults a status (clause 4)',
    file: HOTEL_BOOK,
    find: "            const status = mappedStatus === null ? 'pending' : mappedStatus;",
    replace: "            const status = mappedStatus ?? 'pending';",
    expect: "defaults a status (?? 'pending')",
  },
  {
    name: 'status01-n the client defaults CONFIRMED again (clause 4)',
    file: HOTEL_CLIENT,
    // Anchored on parseBookResult's own comment line: the same null idiom appears in two other parsers.
    find: "    // leaf (src/lib/reservations/hotelStatus.ts), never here.\n    status: typeof d.status === 'string' ? d.status : null,",
    replace: "    // leaf (src/lib/reservations/hotelStatus.ts), never here.\n    status: (d.status as string | undefined) ?? 'CONFIRMED',",
    expect: "defaults a status (?? 'CONFIRMED')",
  },
  {
    name: 'status01-o the book route maps the hotel word inline (clause 5)',
    file: HOTEL_BOOK,
    find: '            const mappedStatus = hotelProviderStatusToReservation(parsed.status);',
    replace: "            const mappedStatus = (parsed.status ?? '').toUpperCase() === 'CONFIRMED' ? 'confirmed' as const : null;",
    expect: 'compares a vendor status word',
  },
  {
    name: 'status01-p a third file turns a vendor word into ours (clause 5)',
    file: CRON_ROUTE,
    find: 'async function run(request: NextRequest) {',
    replace: "function ours(s: string) { if (s === 'CONFIRMED') return 'confirmed'; return 'pending'; }\nvoid ours;\nasync function run(request: NextRequest) {",
    expect: 'turns a vendor status word into ours outside the two leaves',
  },
  {
    name: 'status01-q the read leaf lets a failed GET throw past read_failed (clause 6)',
    file: READ_LEAF,
    find: "    return { outcome: 'read_failed', kind: 'vendor', reason: `${tag}: GET of ${lane} booking ${row.providerBookingId} failed (${nameErr(err)}) — row untouched, 'read_failed'` };",
    replace: '    throw err;',
    expect: 'a GET that throws is not read_failed by name',
  },
  {
    name: 'status01-r the cron stops refusing a wrong secret (clause 7)',
    file: CRON_ROUTE,
    find: '    if (authHeader !== `Bearer ${cronSecret}`) {',
    replace: '    if (false) {',
    expect: 'does not refuse a wrong CRON_SECRET',
  },
  {
    name: 'status01-s the cron batch goes unbounded (clause 7)',
    file: CRON_ROUTE,
    find: '      take: BATCH,\n',
    replace: '',
    expect: 'the batch is unbounded',
  },
  {
    name: 'status01-t the cron leaves its hourly schedule (clause 7)',
    file: 'vercel.json',
    find: '      "path": "/api/cron/reservations-refresh",\n      "schedule": "0 * * * *"',
    replace: '      "path": "/api/cron/reservations-refresh",\n      "schedule": "0 2 * * *"',
    expect: 'not hourly',
  },
  {
    name: 'status01-u the migration loses its partial unique dedupe (clause 8)',
    file: MIGRATION,
    find: `CREATE UNIQUE INDEX "webhook_events_eventId_acted_key" ON "webhook_events"("eventId") WHERE "outcome" <> 'duplicate';`,
    replace: `CREATE INDEX "webhook_events_eventId_acted_key" ON "webhook_events"("eventId");`,
    expect: 'no partial unique dedupe',
  },
  {
    name: 'status01-v the retro grows its own implementation (clause 9)',
    file: RETRO,
    find: "    const out = await readAndApplyReservation(row, { source: 'retro', dryRun, log: (line) => console.log(`    ${line}`) });",
    replace: "    const out = await (async () => ({ outcome: 'read_failed' as const, kind: 'lane' as const, reason: 'local' }))();",
    expect: 'the retro grows its own implementation',
  },
];

export default SEEDS;
