/**
 * AUDIT-01 (2026-09-26) — every change to a booking leaves a chained row, and the
 * booking shows its own history.
 *
 * One test per proof the ruling names. The port is driven over a fake chain writer
 * that keeps writeAuditLog's own promise (a request_id it already holds returns the
 * row it holds, src/lib/audit/writeAuditLog.ts:66-71) and over a writer that
 * throws; the derivations and the timeline leaf are pure and driven over fixtures;
 * the callers, the route, the page, the migration, the schema and the law are read
 * from source the way this repo proves what it cannot execute without a database.
 * No live call, no database.
 */
import { test, mock } from 'node:test';
import assert from 'node:assert/strict';
import { AuditActionType } from '@prisma/client';
import type { WriteAuditLogInput } from '../audit/writeAuditLog';
import { code, comments, rejoin } from '../sourceText';
import {
  actorOfReadSource, bookingAuditInput, bookingEventRequestId, emailEventOf, humanActor, readChangesOf, recordBookingEvent, recordEmailOutcome,
  type AuditWriter, type BookingEventInput, type ReadChangeRow,
} from '../reservations/auditTrail';
import { BOOKING_EVENT_KINDS, HISTORY_WORDS, bookingEventWords, timelineOf, type TimelineInput } from '../reservations/timeline';
import { BOOKING_FLOW_FILES, bookingFlowSha256 } from '../travelBookingFlow';

const PORT = 'src/lib/reservations/auditTrail.ts';
const LEAF = 'src/lib/reservations/timeline.ts';
const ROUTE = 'src/app/api/reservations/[id]/timeline/route.ts';
const PAGE = 'src/app/booking/[id]/receipt/page.tsx';
const PREFIX_ROUTE = 'src/app/api/audit-log/route.ts';
const HOTEL_BOOK = 'src/app/api/travel/liteapi/book/route.ts';
const FLIGHT_BOOK = 'src/app/api/travel/liteapi/flights/book/route.ts';
const READ_LEAF = 'src/lib/reservations/vendorRead.ts';
const SENDER = 'src/lib/reservations/lifecycleSend.ts';
const CANCEL = 'src/app/api/reservations/[id]/cancel/route.ts';
const REVIEW = 'src/app/api/runway/match/review/route.ts';
const COMMIT = 'src/app/api/transactions/commit-to-ledger/route.ts';
const RETRO = 'scripts/lane-01-retro-flights.ts';
const MIGRATION = 'prisma/migrations/20260926230000_audit_01_booking_audit_enums/migration.sql';
const LAW = 'scripts/assert-tool-registry.ts';

/** The chain, as writeAuditLog keeps it: one row per request_id — a repeat returns the row already there. */
function fakeChain(): { writer: AuditWriter; rows: WriteAuditLogInput[] } {
  const rows: WriteAuditLogInput[] = [];
  const writer: AuditWriter = async (input) => {
    const at = rows.findIndex((r) => r.request_id === input.request_id);
    if (at >= 0) return { id: `al_${at}` };
    rows.push(input);
    return { id: `al_${rows.length - 1}` };
  };
  return { writer, rows };
}

const OWNER = 'u_owner';
const RES = { id: 'res_1', userId: OWNER };
const ARRIVAL = { table: 'arrivals', id: 'arr_read_1' };

/** Capture console.error for one body; restore after. */
async function capturingErrors<T>(body: () => Promise<T>): Promise<{ out: T; logged: unknown[][] }> {
  const logged: unknown[][] = [];
  const spy = mock.method(console, 'error', (...args: unknown[]) => { logged.push(args); });
  try {
    return { out: await body(), logged };
  } finally {
    spy.mock.restore();
  }
}

// ── the port ──────────────────────────────────────────────────────────────────

test('each actor is recorded as the ruling names it — a human by id, the cron and the retro as the OWNER (system_automation), the webhook as the OWNER (external_integration), a guest as null and named', async () => {
  const { writer, rows } = fakeChain();
  const base = { reservation: RES, kind: 'reservation_status_changed' as const, before: { status: 'pending' }, after: { status: 'confirmed', providerStatus: 'CONFIRMED' } };
  await recordBookingEvent({ ...base, actor: humanActor({ id: OWNER, email: 'owner@example.com' }, '10.0.0.1'), evidence: { table: 'arrivals', id: 'a1' } }, writer);
  await recordBookingEvent({ ...base, actor: actorOfReadSource('cron', OWNER), evidence: { table: 'arrivals', id: 'a2' } }, writer);
  await recordBookingEvent({ ...base, actor: actorOfReadSource('retro', OWNER), evidence: { table: 'arrivals', id: 'a3' } }, writer);
  await recordBookingEvent({ ...base, actor: actorOfReadSource('webhook', OWNER), evidence: { table: 'arrivals', id: 'a4' } }, writer);
  await recordBookingEvent({ ...base, reservation: { id: 'res_guest', userId: null }, kind: 'reservation_booked', actor: humanActor(null, '10.0.0.2'), evidence: { table: 'arrivals', id: 'a5' } }, writer);
  assert.deepEqual(rows.map((r) => [r.actor.type, r.actor.user_id]), [
    ['human_user', OWNER],
    ['system_automation', OWNER],
    ['system_automation', OWNER],
    ['external_integration', OWNER],
    ['human_user', null],
  ]);
  assert.equal(rows[0].actor.email, 'owner@example.com');
  assert.equal(rows[0].actor.ip, '10.0.0.1');
  assert.deepEqual(rows[4].payload?.metadata, { reservationId: 'res_guest', evidence: { table: 'arrivals', id: 'a5' }, owner: 'guest' }, 'a guest booking is named, never silent');
  assert.equal((rows[1].payload?.metadata as { owner: string }).owner, 'account');
});

test('the row: target the reservation (or, for money and commission, that row with the reservation in the metadata), the changed fields only, the description from the words leaf, the deterministic request_id', () => {
  const input: BookingEventInput = { reservation: RES, kind: 'reservation_ticketed', actor: actorOfReadSource('cron', OWNER), before: { ticketedAt: null }, after: { ticketedAt: '2026-09-26T08:00:00.000Z' }, evidence: ARRIVAL };
  const row = bookingAuditInput(input);
  assert.deepEqual(row.target, { table: 'reservations', id: 'res_1' });
  assert.equal(row.action.type, 'reservation_ticketed');
  assert.equal(row.action.description, bookingEventWords('reservation_ticketed', { before: input.before, after: input.after }));
  assert.equal(row.action.description, 'Ticketed at 2026-09-26T08:00:00.000Z');
  assert.deepEqual(row.payload?.before, { ticketedAt: null });
  assert.deepEqual(row.payload?.after, { ticketedAt: '2026-09-26T08:00:00.000Z' });
  assert.equal(row.request_id, 'booking:res_1:reservation_ticketed:arr_read_1');
  assert.equal(bookingEventRequestId({ ...input, requestKey: 'Error' }), 'booking:res_1:reservation_ticketed:arr_read_1:Error');
  const money = bookingAuditInput({ ...input, kind: 'money_event_stated', before: null, after: { kind: 'refund', amountCents: 12000, currency: 'USD' }, evidence: { table: 'money_events', id: 'me_1' }, target: { table: 'money_events', id: 'me_1' } });
  assert.deepEqual(money.target, { table: 'money_events', id: 'me_1' });
  assert.equal((money.payload?.metadata as { reservationId: string }).reservationId, 'res_1', 'the timeline joins it by the metadata');
  assert.ok(!/description/.test(/export interface BookingEventInput \{[\s\S]*?\n\}/.exec(code(PORT))?.[0] ?? 'x'), 'no call site can hand in a description');
});

test('the same fact twice → ONE row: the same evidence is the same request_id, and the chain returns the row it holds', async () => {
  const { writer, rows } = fakeChain();
  const input: BookingEventInput = { reservation: RES, kind: 'reservation_confirmation_code_arrived', actor: actorOfReadSource('webhook', OWNER), before: { providerConfirmationCode: null }, after: { providerConfirmationCode: 'HC-1' }, evidence: ARRIVAL };
  const first = await recordBookingEvent(input, writer);
  const again = await recordBookingEvent(input, writer);
  assert.deepEqual(first, { audited: true, id: 'al_0' });
  assert.deepEqual(again, { audited: true, id: 'al_0' });
  assert.equal(rows.length, 1);
  // A different read (new evidence) is a new fact.
  await recordBookingEvent({ ...input, evidence: { table: 'arrivals', id: 'arr_read_2' } }, writer);
  assert.equal(rows.length, 2);
});

test('an audit write that throws: the change stands, the answer is { audited: false }, console.error names it, NOTHING is thrown', async () => {
  const store = { status: 'pending' };
  // The change commits first (the callers' order, proven from source below) …
  store.status = 'confirmed';
  const throwing: AuditWriter = async () => { const e = new Error('could not serialize access'); e.name = 'PrismaClientKnownRequestError'; throw e; };
  const { out, logged } = await capturingErrors(() => recordBookingEvent({ reservation: RES, kind: 'reservation_status_changed', actor: actorOfReadSource('cron', OWNER), before: { status: 'pending' }, after: { status: 'confirmed', providerStatus: 'CONFIRMED' }, evidence: ARRIVAL }, throwing));
  assert.deepEqual(out, { audited: false, reason: 'PrismaClientKnownRequestError: could not serialize access' });
  assert.equal(store.status, 'confirmed', 'the change is intact');
  assert.equal(logged.length, 1);
  assert.equal(logged[0][0], '[booking audit] audit row NOT written — the change stands:');
  assert.deepEqual(logged[0][1], { request_id: 'booking:res_1:reservation_status_changed:arr_read_1', kind: 'reservation_status_changed', reservationId: 'res_1', reason: 'PrismaClientKnownRequestError: could not serialize access' });
  // The email path shares the port: the same promise.
  const email = await capturingErrors(() => recordEmailOutcome(RES, humanActor({ id: OWNER, email: null }), 'cancellation', 'arr_c', { sent: true, id: 'msg_1' }, throwing));
  assert.equal(email.out.audited, false);
  assert.equal(email.logged.length, 1);
});

// ── the vendor read ───────────────────────────────────────────────────────────

test('a vendor read that changed three facts → three rows; an unchanged read → zero', async () => {
  const before: ReadChangeRow = { status: 'pending', providerConfirmationCode: null, ticketedAt: null, ticketLimitTime: null, cancelIntentAt: null };
  const changes = readChangesOf(before, { status: 'confirmed', providerConfirmationCode: 'PNR123', ticketedAt: new Date('2026-09-26T09:00:00.000Z') }, 'TICKETED');
  assert.deepEqual(changes.map((c) => c.kind), ['reservation_status_changed', 'reservation_confirmation_code_arrived', 'reservation_ticketed']);
  assert.deepEqual(changes[0], { kind: 'reservation_status_changed', before: { status: 'pending' }, after: { status: 'confirmed', providerStatus: 'TICKETED' } });
  const { writer, rows } = fakeChain();
  for (const c of changes) await recordBookingEvent({ reservation: RES, kind: c.kind, actor: actorOfReadSource('cron', OWNER), before: c.before, after: c.after, evidence: ARRIVAL }, writer);
  assert.equal(rows.length, 3);
  assert.equal(new Set(rows.map((r) => r.request_id)).size, 3);
  // Unchanged: no patch, or a patch that restates what the row already holds.
  assert.deepEqual(readChangesOf(before, null, 'PENDING'), []);
  assert.deepEqual(readChangesOf({ ...before, status: 'confirmed', providerConfirmationCode: 'PNR123' }, { status: 'confirmed', providerConfirmationCode: 'PNR123' }, 'CONFIRMED'), []);
  // The vendor finalizing a pending cancel is a cancel, not a status move.
  assert.deepEqual(readChangesOf({ ...before, status: 'cancel_pending', cancelIntentAt: new Date('2026-09-25T00:00:00.000Z') }, { status: 'cancelled' }, 'CANCELLED').map((c) => c.kind), ['reservation_cancelled']);
  assert.deepEqual(readChangesOf(before, { ticketLimitTime: new Date('2026-09-27T00:00:00.000Z') }, 'PENDING').map((c) => c.kind), ['reservation_ticket_limit_stated']);
});

test('the read leaf records after its transaction commits, never on a dry run, the landed read as the evidence, the actor by its source; the commission lock by its ledger row', () => {
  const r = code(READ_LEAF);
  const at = (s: string) => { const i = r.indexOf(s); assert.ok(i >= 0, `missing: ${s}`); return i; };
  assert.ok(at('prisma.$transaction(async (tx) => applyLockedRead(') < at('readChangesOf(applied.locked, wouldWrite, applied.providerStatus)'));
  assert.match(r, /if \(!opts\.dryRun && applied\.arrivalId !== null\) \{/);
  assert.match(r, /const evidence = \{ table: 'arrivals', id: applied\.arrivalId \};/);
  assert.match(r, /const actor = actorOfReadSource\(opts\.source, applied\.locked\.userId\);/);
  assert.match(r, /where: \{ reservationId: applied\.locked\.id, lockArrivalId: applied\.arrivalId \},/);
  assert.match(r, /kind: 'commission_locked',[\s\S]{0,700}target: \{ table: 'commission_ledger', id: lockedRow\.id \},/);
  assert.ok(!/writeAuditLog/.test(r));
});

// ── the callers ───────────────────────────────────────────────────────────────

test('both book routes record reservation_booked after the transaction, the landed book answer as the evidence, the booking human as the actor (a guest: null)', () => {
  for (const f of [HOTEL_BOOK, FLIGHT_BOOK]) {
    const s = code(f);
    assert.ok(s.indexOf('const result = landed.reservation;') < s.indexOf("kind: 'reservation_booked',"), `${f}: after the commit`);
    assert.match(s, /const bookingActor = humanActor\(user \? \{ id: user\.id, email: userEmail \} : null, ip\);/);
    assert.match(s, /kind: 'reservation_booked',[\s\S]{0,600}evidence: \{ table: 'arrivals', id: landed\.arrivalId \},/);
    assert.ok(!/writeAuditLog|'system_other'/.test(s), `${f}: no hand-written audit row`);
  }
  assert.match(code(HOTEL_BOOK), /await recordEmailOutcome\(booking, bookingActor, 'booking_confirmation', landed\.arrivalId, emailStatus\);/);
  assert.match(code(FLIGHT_BOOK), /await recordEmailOutcome\(booking, bookingActor, 'flight_confirmation', landed\.arrivalId, emailStatus\);/);
  assert.match(code(FLIGHT_BOOK), /bookingActor,\s*\);/, 'the lifecycle sends carry the booking human');
  assert.match(code(RETRO), /sendLifecycleEmail\(row, request, actorOfReadSource\('retro', row\.userId\)\)/, 'the LANE-01 retro sends as the owner, system_automation');
});

test('the cancel: 200 → requested, cancelled, a money_event_stated per row; 202 → requested, cancel_pending; 409 → requested, cancel_refused, nothing else', () => {
  const s = code(CANCEL);
  // The two lanes are the route's own (not exported) — each read from its declaration to the next top-level one.
  const lane = (name: string) => { const from = s.indexOf(`\nasync function ${name}(`); const next = s.slice(from + 1).search(/\n(?:async )?function |\nexport /); return from < 0 ? '' : s.slice(from, next < 0 ? undefined : from + 1 + next); };
  const hotel = lane('cancelHotel');
  const flight = lane('cancelFlight');
  assert.ok(hotel.length > 0 && flight.length > 0);
  // The request, before the vendor's answer — both lanes.
  assert.ok(hotel.indexOf("kind: 'reservation_cancel_requested'") < hotel.indexOf('await cancelBooking(owned.providerBookingId)'));
  assert.ok(flight.indexOf("kind: 'reservation_cancel_requested'") < flight.indexOf('await cancelFlightBooking(owned.providerBookingId)'));
  // Hotel 200: cancelled with the landed cancellation, then the money, then the email.
  const hc = hotel.indexOf("kind: 'reservation_cancelled'"), hm = hotel.indexOf('await recordStatedMoney(owned, userId, actor, landed.arrivalId);'), he = hotel.indexOf("await recordEmailOutcome(booking, actor, 'cancellation', landed.arrivalId, emailStatus);");
  assert.ok(hc > hotel.indexOf('landed = await prisma.$transaction(') && hc < hm && hm < he);
  // Flight: final → cancelled + money; pending → cancel_pending; 409 → refused and nothing else.
  assert.match(flight, /if \(decision\.final\) \{\s*await recordBookingEvent\(\{ reservation: booking, kind: 'reservation_cancelled',[^\n]*\n\s*await recordStatedMoney\(owned, userId, actor, landed\.arrivalId\);\s*\} else \{\s*await recordBookingEvent\(\{ reservation: booking, kind: 'reservation_cancel_pending',/);
  const refusal = flight.slice(flight.indexOf('if (err instanceof LiteApiFlightsApiError && err.status === 409) {'));
  const refused = refusal.slice(0, refusal.indexOf('{ status: 409 }'));
  assert.match(refused, /kind: 'reservation_cancel_refused'/);
  assert.ok(!/reservation_cancelled|recordStatedMoney|recordEmailOutcome|cancel_pending/.test(refused), 'a refusal records nothing else');
  // The money: one row per money_events row the arrival wrote, each its own evidence and target.
  const money = s.slice(s.indexOf('async function recordStatedMoney('), s.indexOf('// ─── GET — THE QUOTE'));
  assert.match(money, /where: \{ arrivalId, reservationId: owned\.id \},/);
  assert.match(money, /for \(const m of rows\) \{\s*await recordBookingEvent\(\{/);
  assert.match(money, /evidence: \{ table: 'money_events', id: m\.id \},\s*target: \{ table: 'money_events', id: m\.id \},/);
  // The quote: after the vendor answered it; its evidence the answer's bytes.
  assert.ok(s.indexOf('quoted = await getFlightCancellationQuote(owned.providerBookingId);') < s.indexOf("kind: 'reservation_cancel_quoted',"));
  assert.match(s, /evidence: \{ table: 'provider_answer', id: createHash\('sha256'\)\.update\(quoted\.answer\.body\)\.digest\('hex'\) \},/);
  assert.match(code(CANCEL), /await recordEmailOutcome\(booking, actor, decision\.final \? 'cancellation' : 'cancel_pending', landed\.arrivalId, emailStatus\);/);
});

test('the settle → money_event_settled with the bank row as its evidence, after the transaction, beside the link row; the posting → reservation_posted with the entry as its evidence', async () => {
  const s = code(REVIEW);
  assert.ok(s.indexOf('const updated = await prisma.$transaction(') < s.indexOf("kind: 'money_event_settled',"));
  assert.match(s, /if \(settles && link\.moneyEventId !== null\) \{\s*await recordBookingEvent\(\{/);
  assert.match(s, /evidence: \{ table: 'transactions', id: link\.transactionId \},\s*target: \{ table: 'money_events', id: link\.moneyEventId \},/);
  assert.match(s, /target: \{ table: 'transaction_reservation_links', id: link\.id \},/, 'the link row stays');
  assert.match(s, /settledKind = event\.kind;/);
  const settled = bookingAuditInput({ reservation: RES, kind: 'money_event_settled', actor: humanActor({ id: OWNER, email: null }), before: { status: 'stated' }, after: { status: 'settled', kind: 'refund', settledTransactionId: 'tx_9', settledAt: '2026-09-26T10:00:00.000Z' }, evidence: { table: 'transactions', id: 'tx_9' }, target: { table: 'money_events', id: 'me_1' } });
  assert.equal(settled.action.description, 'The refund settled — bank row tx_9');
  assert.equal(settled.request_id, 'booking:res_1:money_event_settled:tx_9');
  const c = code(COMMIT);
  assert.ok(c.indexOf('const journalEntry = await commitPlaidTransaction(prisma, {') < c.indexOf("kind: 'reservation_posted',"));
  assert.match(c, /if \(document !== null\) \{\s*await recordBookingEvent\(\{\s*reservation: \{ id: document\.reservationId, userId: user\.id \},\s*kind: 'reservation_posted',/);
  assert.match(c, /evidence: \{ table: 'journal_entries', id: journalEntry\.id \},/);
});

test('the email: sent → reservation_email_sent with the message id; failed → reservation_email_failed by kind and error class; the old system_other failure write is gone', async () => {
  assert.deepEqual(emailEventOf({ sent: true, id: 're_abc' }, 'ticketed', 'lifecycle'), { kind: 'reservation_email_sent', before: null, after: { email: 'ticketed', messageId: 're_abc' }, evidence: { table: 'email', id: 're_abc' } });
  assert.deepEqual(emailEventOf({ sent: false, error: 'ResendError' }, 'cancellation', 'arr_c'), { kind: 'reservation_email_failed', before: null, after: { email: 'cancellation', errorClass: 'ResendError' }, evidence: { table: 'email_attempt', id: 'cancellation:arr_c' }, requestKey: 'ResendError' });
  const { writer, rows } = fakeChain();
  await recordEmailOutcome(RES, actorOfReadSource('cron', OWNER), 'ticketed', 'lifecycle', { sent: true, id: 're_abc' }, writer);
  await recordEmailOutcome(RES, actorOfReadSource('cron', OWNER), 'ticketed', 'lifecycle', { sent: false, error: 'ResendError' }, writer);
  assert.deepEqual(rows.map((r) => [r.action.type, r.action.description, r.request_id]), [
    ['reservation_email_sent', 'Emailed the ticketed notice — message re_abc', 'booking:res_1:reservation_email_sent:re_abc'],
    ['reservation_email_failed', 'NOT emailed: the ticketed notice — ResendError', 'booking:res_1:reservation_email_failed:ticketed:lifecycle:ResendError'],
  ]);
  const s = code(SENDER);
  assert.ok(!/writeAuditLog|system_other|lifecycle_email_failed/.test(s), 'the old write is gone');
  assert.match(s, /await recordEmailOutcome\(booking, actor, request\.kind, 'lifecycle', \{ sent: false, error: errorClass \}\);/);
  assert.match(s, /await recordEmailOutcome\(booking, actor, request\.kind, 'lifecycle', \{ sent: true, id \}\);/);
  assert.match(comments(SENDER), /The\s*\n?\s*\*?\s*old 'system_other' lifecycle_email_failed write is gone/);
});

// ── the timeline ──────────────────────────────────────────────────────────────

const FIXTURE: TimelineInput = {
  arrivals: [
    { id: 'arr_book', resource: 'booking', arrived: '2026-09-20T10:00:01.000Z', asked: '2026-09-20T10:00:00.000Z', payload: { status: 'CONFIRMED' } },
    { id: 'arr_read', resource: 'booking_read', arrived: '2026-09-21T09:00:00.000Z', asked: '2026-09-21T08:59:59.000Z', payload: { status: 'CANCELLED' } },
  ],
  webhookEvents: [{ id: 'wh_1', eventType: 'booking.cancelled', outcome: 'applied', receivedAt: '2026-09-21T08:59:00.000Z' }],
  auditRows: [
    { id: 'al_booked', created_at: '2026-09-20T10:00:01.000Z', action_type: 'reservation_booked', action_description: 'stored text', payload_before: null, payload_after: { status: 'confirmed', providerBookingId: 'bk_1' } },
    { id: 'al_status', created_at: '2026-09-21T09:00:00.000Z', action_type: 'reservation_status_changed', action_description: 'stored text', payload_before: { status: 'confirmed' }, payload_after: { status: 'cancelled', providerStatus: 'CANCELLED' } },
    { id: 'al_old', created_at: '2026-09-19T12:00:00.000Z', action_type: 'system_other', action_description: 'reservation_created — flight bk_1', payload_before: null, payload_after: null },
  ],
  moneyEvents: [{ id: 'me_1', kind: 'refund', amountCents: 12000, currency: 'USD', status: 'settled', statedAt: '2026-09-21T09:00:00.000Z', settledTransactionId: 'tx_9', settledAt: '2026-09-24T00:00:00.000Z' }],
  commission: [],
  journalEntries: [{ id: 'je_1', date: '2026-09-22', status: 'posted', created_at: '2026-09-22T12:00:00.000Z', document_money_event_id: null }],
  calendarRows: [{ id: 'cal_1', start_date: '2026-10-01', status: 'cancelled', created_at: '2026-09-20T10:00:02.000Z', updated_at: '2026-09-21T09:00:05.000Z' }],
};

test('the timeline: every source, ordered by instant then kind (the cause before its record), each line its words and its evidence; an unknown audit action renders as itself', () => {
  const t = timelineOf(FIXTURE);
  assert.deepEqual(t.map((i) => [i.at, i.kind, i.evidence.table, i.evidence.id]), [
    ['2026-09-19T12:00:00.000Z', 'audit', 'audit_log', 'al_old'],
    ['2026-09-20T10:00:01.000Z', 'arrival_booking', 'arrivals', 'arr_book'],
    ['2026-09-20T10:00:01.000Z', 'reservation_booked', 'audit_log', 'al_booked'],
    ['2026-09-20T10:00:02.000Z', 'calendar', 'calendar_events', 'cal_1'],
    ['2026-09-21T08:59:00.000Z', 'webhook', 'webhook_events', 'wh_1'],
    ['2026-09-21T09:00:00.000Z', 'arrival_booking_read', 'arrivals', 'arr_read'],
    ['2026-09-21T09:00:00.000Z', 'reservation_status_changed', 'audit_log', 'al_status'],
    ['2026-09-21T09:00:00.000Z', 'money_event', 'money_events', 'me_1'],
    ['2026-09-21T09:00:05.000Z', 'calendar_cancelled', 'calendar_events', 'cal_1'],
    ['2026-09-22T12:00:00.000Z', 'journal_entry', 'journal_entries', 'je_1'],
    ['2026-09-24T00:00:00.000Z', 'money_event_settlement', 'money_events', 'me_1'],
  ]);
  assert.equal(t[0].words, 'system_other: reservation_created — flight bk_1', 'unknown → as itself, verbatim');
  assert.equal(t[2].words, bookingEventWords('reservation_booked', { before: null, after: { status: 'confirmed', providerBookingId: 'bk_1' } }), 'a known row is rendered by the leaf, not its stored text');
  assert.equal(t[6].words, bookingEventWords('reservation_status_changed', { before: { status: 'confirmed' }, after: { status: 'cancelled', providerStatus: 'CANCELLED' } }));
  assert.equal(t[10].words, 'The refund settled — bank row tx_9');
  assert.deepEqual(timelineOf(FIXTURE), t, 'pure: the same input, the same history');
  assert.deepEqual(timelineOf({ arrivals: [], webhookEvents: [], auditRows: [], moneyEvents: [], commission: [], journalEntries: [], calendarRows: [] }), []);
  for (const k of BOOKING_EVENT_KINDS) assert.equal(typeof bookingEventWords(k, { before: null, after: null }), 'string', `${k} has words`);
  const leaf = code(LEAF);
  assert.ok(!/^\s*import\s/m.test(leaf) && !/prisma|fetch\s*\(|process\.env|Date\.now|new Date\s*\(\s*\)/.test(leaf), 'the leaf is pure');
});

test('the timeline route: the receipt route’s auth (401, 404 foreign or guest), no vendor client, zero writes, the owner’s audit rows, commission kept off the customer’s page', () => {
  const s = code(ROUTE);
  assert.match(s, /if \(!userEmail\) return NextResponse\.json\(\{ error: 'Unauthorized' \}, \{ status: 401 \}\);/);
  assert.match(s, /if \(!user\) return NextResponse\.json\(\{ error: 'User not found' \}, \{ status: 404 \}\);/);
  assert.match(s, /where: \{ id, userId: user\.id \},/, 'a guest row (userId null) and a foreign row never match');
  assert.match(s, /if \(!reservation\) return NextResponse\.json\(\{ error: 'Reservation not found' \}, \{ status: 404 \}\);/);
  assert.ok(s.indexOf("{ status: 404 });\n\n  const arrivalSelect") > 0, 'nothing is read before the ownership answers');
  assert.ok(!/liteapiClient|liteapiFlightsClient|viator|\bfetch\s*\(|reserveTravelSearch|getFlightBooking|getHotelBooking/.test(s), 'no vendor client');
  assert.ok(!/\.(create|createMany|update|updateMany|upsert|delete|deleteMany)\s*\(|\$executeRaw|\$queryRaw|\$transaction|recordBookingEvent|writeAuditLog/.test(s), 'zero writes');
  assert.match(s, /actor_user_id: user\.id,/);
  assert.match(s, /\{ payload_metadata: \{ path: \['reservationId'\], equals: reservation\.id \} \},/);
  assert.match(s, /\{ resource: BOOKING_READ, their_id: bookingReadTheirId\(reservation\.providerBookingId\) \},/);
  assert.match(s, /\{ resource: CANCELLATION, their_id: cancellationTheirId\(reservation\.providerBookingId\) \},/);
  assert.match(s, /where: \{ provider: LITEAPI, bookingId: reservation\.providerBookingId \},/);
  assert.match(s, /where: \{ user_id: user\.id, source: 'reservation', source_id: reservation\.id \},/);
  assert.match(s, /action_type: \{ not: 'commission_locked' \},/);
  assert.match(s, /commission: \[\],/);
  assert.ok(!/commission_ledger/.test(s));
  assert.match(comments(ROUTE), /COMMISSION IS NOT READ HERE/);
});

test('the receipt page gains a History section: one more authed GET, the leaf’s items verbatim, the leaf’s words — none typed, printable, no commission', () => {
  const s = code(PAGE);
  assert.match(s, /fetch\(`\/api\/reservations\/\$\{encodeURIComponent\(id\)\}\/timeline`\)/);
  assert.match(s, /data-receipt-section="history"/);
  for (const w of ['{HISTORY_WORDS.heading}', '{HISTORY_WORDS.note}', '{HISTORY_WORDS.reading}', '{HISTORY_WORDS.none}', '{item.words}', '{item.evidence.table}', '{item.evidence.id}']) assert.ok(s.includes(w), w);
  assert.ok(!/['"`>]\s*History\s*['"`<]/.test(s));
  assert.ok(!/commission/i.test(s));
  assert.ok(!/no-print[^\n]*data-receipt-section="history"|data-receipt-section="history"[^\n]*no-print/.test(s), 'the history prints');
  assert.equal(HISTORY_WORDS.heading, 'History');
});

// ── the enum, the map, the pins, the law ──────────────────────────────────────

test('the sixteen enum values: the migration adds each (outside a transaction, no backfill), the schema and the generated client carry each, the read route’s prefix map covers the three families', () => {
  const sql = code(MIGRATION);
  const added = [...sql.matchAll(/ALTER TYPE "AuditActionType" ADD VALUE IF NOT EXISTS '(\w+)';/g)].map((m) => m[1]);
  assert.deepEqual(added, [...BOOKING_EVENT_KINDS]);
  assert.ok(!/\bBEGIN\b|\bCOMMIT\b|INSERT|UPDATE|DELETE/i.test(sql));
  const values = Object.values(AuditActionType) as string[];
  for (const k of BOOKING_EVENT_KINDS) assert.ok(values.includes(k), `the generated client carries ${k}`);
  const schemaEnum = /enum AuditActionType \{([\s\S]*?)\n\}/.exec(code('prisma/schema.prisma'))?.[1] ?? '';
  for (const k of BOOKING_EVENT_KINDS) assert.match(schemaEnum, new RegExp(`^\\s*${k}\\s*$`, 'm'));
  const map = code(PREFIX_ROUTE);
  for (const family of ['reservation_', 'money_event_', 'commission_']) {
    const list = new RegExp(`\\n  ${family}: \\[([^\\]]*)\\]`).exec(map)?.[1] ?? '';
    assert.deepEqual([...list.matchAll(/'(\w+)'/g)].map((m) => m[1]).sort(), BOOKING_EVENT_KINDS.filter((k) => k.startsWith(family)).slice().sort(), family);
  }
});

test('the three pinned files are re-pinned, dated, the old hashes stacked', () => {
  for (const f of [HOTEL_BOOK, FLIGHT_BOOK, CANCEL]) {
    const pin = BOOKING_FLOW_FILES.find((p) => p.file === f);
    assert.ok(pin, f);
    assert.equal(bookingFlowSha256(rejoin(code(f), comments(f))), pin.sha256, `${f} re-pinned`);
  }
  const pins = code('src/lib/travelBookingFlow.ts') + comments('src/lib/travelBookingFlow.ts');
  assert.equal((pins.match(/AUDIT-01 \(2026-09-26\): re-pinned/g) ?? []).length, 3);
  for (const was of ['441552e306910d94a0c0aa068f3dd3a1575a544f139fdab45ce57da106332707', '62b828c1c9468cd1a10b2cb43ca4b76099f49ef9eb905fdac80f44409a349f8b', 'd9b52813b8bf26b624a6f476a1def46a9f1e37085d30f5ee58d9199b2eb9e9fe']) {
    assert.ok(pins.includes(`Was ${was} at main 651c2f0e.`), was);
  }
});

test('the audit law runs over every clause the ruling names', () => {
  const law = code(LAW);
  assert.match(law, /lawGuard\('The audit law', \(\) => \{/);
  for (const clause of ['CLAUSE 1. THE ENUM', 'CLAUSE 2. THE ONE PORT', 'CLAUSE 3. EVERY LISTED WRITER CALLS THE PORT', 'CLAUSE 4. NO RESERVATION WRITE SITE CALLS writeAuditLog DIRECTLY', 'CLAUSE 5. THE DESCRIPTIONS COME FROM THE WORDS LEAF', 'CLAUSE 6. THE ORDER', 'CLAUSE 7. THE TIMELINE LEAF IS PURE', 'CLAUSE 8. THE TIMELINE ROUTE READS ONLY', 'CLAUSE 9. THE RECEIPT PAGE SHOWS THE HISTORY']) {
    assert.ok(comments(LAW).includes(clause), clause);
  }
});
