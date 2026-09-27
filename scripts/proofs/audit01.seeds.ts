/**
 * The audit law's seeded regressions (AUDIT-01, 2026-09-26).
 *
 * The ruling says one thing: EVERY CHANGE TO A BOOKING LEAVES A CHAINED ROW, AND
 * THE BOOKING SHOWS ITS OWN HISTORY. These seeds put back, one at a time, each
 * shape the ruling forbids:
 *
 *   · the migration, the schema or the read route's prefix map loses a kind (clause 1);
 *   · the port's request_id stops being deterministic, it throws on a failed
 *     write, or a read's actor stops following its source (clause 2);
 *   · a listed writer stops recording its kind, or records the wrong actor (clause 3);
 *   · a writer goes back to writeAuditLog by hand with a booking kind (clause 4);
 *   · a call site types a description (clause 5);
 *   · the read records on a dry run; one lane's cancel request is not recorded
 *     before the vendor answers; a refused cancel records more than the refusal (clause 6);
 *   · the timeline leaf reads the clock, or renders an unknown action as a guess (clause 7);
 *   · the timeline route writes, calls the vendor, drops the owner's scope or
 *     lets commission onto the customer's page (clause 8);
 *   · the page types the History heading (clause 9);
 *   · AUDIT-01b (2026-09-27): commission_locked is written under the owner's id, the
 *     port stops refusing it, COMMISSION_ACTOR gains a person, or another file records
 *     it (clause 10); the read route drops its exclusion, lets a filter past it, or a
 *     prefix names commission again (clause 11).
 *
 * Each must fail THE AUDIT LAW by name. The anchors occur exactly once in their
 * file, which the harness enforces before it runs anything.
 */
import type { Seed } from '../prove';

const MIGRATION = 'prisma/migrations/20260926230000_audit_01_booking_audit_enums/migration.sql';
const SCHEMA = 'prisma/schema.prisma';
const PREFIX_ROUTE = 'src/app/api/audit-log/route.ts';
const PORT = 'src/lib/reservations/auditTrail.ts';
const LEAF = 'src/lib/reservations/timeline.ts';
const ROUTE = 'src/app/api/reservations/[id]/timeline/route.ts';
const PAGE = 'src/app/booking/[id]/receipt/page.tsx';
const HOTEL_BOOK = 'src/app/api/travel/liteapi/book/route.ts';
const READ_LEAF = 'src/lib/reservations/vendorRead.ts';
const CANCEL = 'src/app/api/reservations/[id]/cancel/route.ts';
const REVIEW = 'src/app/api/runway/match/review/route.ts';
const COMMIT = 'src/app/api/transactions/commit-to-ledger/route.ts';
const READ_ROUTE = 'src/app/api/audit-log/route.ts';

const SEEDS: Seed[] = [
  {
    name: 'audit01-a the migration drops a kind (clause 1)',
    file: MIGRATION,
    find: `ALTER TYPE "AuditActionType" ADD VALUE IF NOT EXISTS 'commission_locked';`,
    replace: '',
    expect: "does not add 'commission_locked' to AuditActionType",
  },
  {
    name: 'audit01-b the schema drops a kind (clause 1)',
    file: SCHEMA,
    find: '  commission_locked\n',
    replace: '',
    expect: "AuditActionType lacks 'commission_locked'",
  },
  {
    name: "audit01-c the read route's prefix map misses a kind (clause 1)",
    file: PREFIX_ROUTE,
    find: "    'reservation_posted',\n",
    replace: '',
    expect: "'reservation_' list is",
  },
  {
    name: 'audit01-d the request_id stops being deterministic (clause 2)',
    file: PORT,
    find: 'return `booking:${input.reservation.id}:${input.kind}:${input.evidence.id}',
    replace: 'return `booking:${input.reservation.id}:${input.kind}:${input.evidence.id}:${Math.random()}',
    expect: 'the request_id is not booking:<reservationId>:<kind>:<evidenceId>',
  },
  {
    name: 'audit01-e a failed audit write is thrown into the change (clause 2)',
    file: PORT,
    find: '    return { audited: false, reason };\n  }\n}',
    replace: '    throw err;\n  }\n}',
    expect: 'recordBookingEvent throws',
  },
  {
    name: "audit01-f a read's actor stops following its source (clause 2)",
    file: PORT,
    find: "type: source === 'webhook' ? 'external_integration' : 'system_automation', userId: ownerId",
    replace: "type: 'system_automation', userId: ownerId",
    expect: "a read's actor is not the webhook",
  },
  {
    name: 'audit01-g the hotel book route stops recording its confirmation email (clause 3)',
    file: HOTEL_BOOK,
    find: "      await recordEmailOutcome(booking, bookingActor, 'booking_confirmation', landed.arrivalId, emailStatus);\n",
    replace: '',
    expect: `does not record "await recordEmailOutcome(booking, bookingActor, 'booking_confirmation'`,
  },
  {
    name: 'audit01-h the review route stops recording the settle (clause 3)',
    file: REVIEW,
    find: "        kind: 'money_event_settled',",
    replace: "        kind: 'reservation_posted',",
    expect: `does not record "kind: 'money_event_settled',"`,
  },
  {
    name: "audit01-i the vendor read's actor becomes a guessed human (clause 3)",
    file: READ_LEAF,
    find: '  const actor = actorOfReadSource(opts.source, applied.locked.userId);',
    replace: "  const actor = { type: 'human_user' as const, userId: null };",
    expect: 'does not record "const actor = actorOfReadSource(opts.source, applied.locked.userId);"',
  },
  {
    name: 'audit01-j the quote goes back to writeAuditLog by hand (clause 4)',
    file: CANCEL,
    find: "    await recordBookingEvent({\n      reservation: { id: owned.id, userId: g.userId },\n      kind: 'reservation_cancel_quoted',",
    replace: "    await writeAuditLog({ actor: { user_id: g.userId, type: 'human_user' }, action: { type: 'reservation_cancel_quoted', description: 'quoted' }, target: { table: 'reservations', id: owned.id }, request_id: `quote-${owned.id}` });\n    await recordBookingEvent({\n      reservation: { id: owned.id, userId: g.userId },\n      kind: 'reservation_cancel_quoted',",
    expect: "writes the booking kind 'reservation_cancel_quoted' to audit_log directly",
  },
  {
    name: 'audit01-k a call site types a description (clause 5)',
    file: COMMIT,
    find: "            kind: 'reservation_posted',",
    replace: "            kind: 'reservation_posted',\n            description: `Posted entry ${journalEntry.id}`,",
    expect: 'types a description into recordBookingEvent',
  },
  {
    name: 'audit01-l the vendor read records on a dry run (clause 6)',
    file: READ_LEAF,
    find: '  if (!opts.dryRun && applied.arrivalId !== null) {',
    replace: '  if (applied.arrivalId !== null) {',
    expect: 'the read records on a dry run',
  },
  {
    name: "audit01-m the hotel cancel request is not recorded before the vendor's answer (clause 6)",
    file: CANCEL,
    find: "  await recordBookingEvent({ reservation: booking, kind: 'reservation_cancel_requested', actor, before: { status: owned.status }, after: { lane: 'hotel' }, evidence: asItStood(owned) });\n",
    replace: '',
    expect: 'both lanes do not record reservation_cancel_requested',
  },
  {
    name: 'audit01-n a refused flight cancel records more than the refusal (clause 6)',
    file: CANCEL,
    find: "      await recordBookingEvent({ reservation: booking, kind: 'reservation_cancel_refused',",
    replace: "      await recordStatedMoney(owned, userId, actor, 'refused');\n      await recordBookingEvent({ reservation: booking, kind: 'reservation_cancel_refused',",
    expect: 'a refused flight cancel does not record cancel_refused and nothing else',
  },
  {
    name: 'audit01-o the timeline leaf reads the clock (clause 7)',
    file: LEAF,
    find: 'export function timelineOf(input: TimelineInput): TimelineItem[] {\n  const items: TimelineItem[] = [];',
    replace: 'export function timelineOf(input: TimelineInput): TimelineItem[] {\n  const items: TimelineItem[] = [];\n  void Date.now();',
    expect: 'reads the clock — the timeline leaf is pure',
  },
  {
    name: 'audit01-p an unknown audit action renders as a guess (clause 7)',
    file: LEAF,
    find: ': `${r.action_type}: ${r.action_description}`,',
    replace: ": 'Something changed',",
    expect: 'does not render as itself',
  },
  {
    name: 'audit01-q the timeline route writes (clause 8)',
    file: ROUTE,
    find: '  const timeline = timelineOf({',
    replace: '  await prisma.reservations.update({ where: { id: reservation.id }, data: {} });\n  const timeline = timelineOf({',
    expect: 'writes — the timeline route is read-only',
  },
  {
    name: 'audit01-r the timeline route calls the vendor (clause 8)',
    file: ROUTE,
    find: "import { prisma } from '@/lib/prisma';",
    replace: "import { prisma } from '@/lib/prisma';\nimport { getHotelBooking } from '@/lib/liteapiClient';\nvoid getHotelBooking;",
    expect: 'imports a vendor client or calls the wire',
  },
  {
    name: 'audit01-s the timeline route drops the ownership (clause 8)',
    file: ROUTE,
    find: '    where: { id, userId: user.id },',
    replace: '    where: { id },',
    expect: 'does not own the reservation by findFirst { id, userId }',
  },
  {
    name: "audit01-t the timeline route reads audit rows outside the owner's scope (clause 8)",
    file: ROUTE,
    find: '      actor_user_id: user.id,\n',
    replace: '',
    expect: "reads audit rows outside the owner's scope",
  },
  {
    name: "audit01-u the timeline route lets commission onto the customer's page (clause 8)",
    file: ROUTE,
    find: '    commission: [],',
    replace: '    commission: await prisma.commission_ledger.findMany({ where: { reservationId: reservation.id } }),',
    expect: "lets commission onto the customer's page",
  },
  {
    name: 'audit01-v the page types the History heading (clause 9)',
    file: PAGE,
    find: '{HISTORY_WORDS.heading}',
    replace: 'History',
    expect: 'types the History heading',
  },
  {
    name: "audit01-w commission_locked goes back to the owner's actor (clause 10, AUDIT-01b)",
    file: READ_LEAF,
    find: '            actor: COMMISSION_ACTOR,\n',
    replace: '            actor,\n',
    expect: 'commission_locked is not written by COMMISSION_ACTOR',
  },
  {
    name: 'audit01-x the port stops refusing a commission row with a user id (clause 10, AUDIT-01b)',
    file: PORT,
    find: "  if (input.kind === 'commission_locked' && (input.actor.type !== 'system_automation' || input.actor.userId !== null)) {",
    replace: '  if (input.kind === \'commission_locked\' && input.actor.type === \'human_user\') {',
    expect: 'does not refuse, by name and before the write, a commission_locked row',
  },
  {
    name: 'audit01-y COMMISSION_ACTOR gains a person (clause 10, AUDIT-01b)',
    file: PORT,
    find: "Object.freeze({ type: 'system_automation', userId: null, email: null, ip: null })",
    replace: "Object.freeze({ type: 'system_automation', userId: 'u_owner', email: null, ip: null })",
    expect: 'COMMISSION_ACTOR is not the system with no user id',
  },
  {
    name: 'audit01-z another file records commission_locked (clause 10, AUDIT-01b)',
    file: COMMIT,
    find: "            kind: 'reservation_posted',",
    replace: "            kind: 'commission_locked',",
    expect: "records commission_locked — the vendor read's lock is its one writer",
  },
  {
    name: 'audit01-aa the read route drops its exclusion (clause 11, AUDIT-01b)',
    file: READ_ROUTE,
    find: ', NOT: { action_type: { in: NEVER_RETURNED } } };',
    replace: ' };',
    expect: 'base scope does not exclude NEVER_RETURNED for every viewer',
  },
  {
    name: 'audit01-ab a filter lets the read route past its exclusion (clause 11, AUDIT-01b)',
    file: READ_ROUTE,
    find: '    if (actionType) {\n      where.action_type',
    replace: "    if (actionType === 'commission_locked') delete where.NOT;\n    if (actionType) {\n      where.action_type",
    expect: 'replaces its base scope',
  },
  {
    name: 'audit01-ac a prefix names commission again (clause 11, AUDIT-01b)',
    file: READ_ROUTE,
    find: "  money_event_: [\n    'money_event_stated',\n    'money_event_settled',\n  ],\n};",
    replace: "  money_event_: [\n    'money_event_stated',\n    'money_event_settled',\n  ],\n  commission_: [\n    'commission_locked',\n  ],\n};",
    expect: 'prefix map still names commission_locked',
  },
];

export default SEEDS;
