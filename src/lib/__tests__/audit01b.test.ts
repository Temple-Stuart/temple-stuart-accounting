/**
 * AUDIT-01b (2026-09-27) — Temple Stuart's commission never reaches a customer's
 * audit view.
 *
 * THE DEFECT (AUDIT-01's own finding): commission_locked rows were written under
 * the booking OWNER's user id, and the audit-log read route scopes by
 * actor_user_id = the viewer — so a customer read the margin. The fix: the lock
 * is written by COMMISSION_ACTOR (system_automation, user_id NULL), the port
 * refuses any other actor by name, and the read route excludes commission_locked
 * for every viewer.
 *
 * The port is driven over a fake chain writer. The read route cannot be invoked
 * outside a Next request scope (its auth reads next/headers cookies), so — the
 * repo's TEST-TRUTH-01 way — its `where` is anchored to its source exactly and
 * then EVALUATED over the rows the port writes (and a row AUDIT-01 could already
 * have written under the owner's id), for every filter a viewer can pass.
 */
import { test, mock } from 'node:test';
import assert from 'node:assert/strict';
import type { WriteAuditLogInput } from '../audit/writeAuditLog';
import { code, comments } from '../sourceText';
import { COMMISSION_ACTOR, actorOfReadSource, humanActor, recordBookingEvent, type AuditWriter, type BookingEventInput } from '../reservations/auditTrail';

const PORT = 'src/lib/reservations/auditTrail.ts';
const READ_LEAF = 'src/lib/reservations/vendorRead.ts';
const READ_ROUTE = 'src/app/api/audit-log/route.ts';
const TIMELINE_ROUTE = 'src/app/api/reservations/[id]/timeline/route.ts';
const LAW = 'scripts/assert-tool-registry.ts';

const OWNER = 'u_owner';
const RES = { id: 'res_1', userId: OWNER };

/** The chain as writeAuditLog keeps it — one row per request_id. */
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

/** The input the vendor read hands the port for a lock (vendorRead.ts, the commission_locked call). */
function lockInput(actor: BookingEventInput['actor']): BookingEventInput {
  return {
    reservation: RES,
    kind: 'commission_locked',
    actor,
    before: { status: 'estimated' },
    after: { status: 'confirmed', currency: 'USD', lockedCommissionCents: 1840, distributorCommissionCents: 1200, clientCommissionCents: 640, processingFeeCents: 55, lockedAt: '2026-09-27T09:00:00.000Z' },
    evidence: { table: 'arrivals', id: 'arr_read_1' },
    target: { table: 'commission_ledger', id: 'cl_1' },
  };
}

test('a lock writes a row with user_id NULL, system_automation, the reservation still named in the metadata', async () => {
  const { writer, rows } = fakeChain();
  const out = await recordBookingEvent(lockInput(COMMISSION_ACTOR), writer);
  assert.deepEqual(out, { audited: true, id: 'al_0' });
  assert.equal(rows.length, 1);
  assert.deepEqual(rows[0].actor, { user_id: null, email: null, type: 'system_automation', ip: null });
  assert.equal(rows[0].action.type, 'commission_locked');
  assert.deepEqual(rows[0].target, { table: 'commission_ledger', id: 'cl_1' });
  assert.deepEqual(rows[0].payload?.metadata, { reservationId: 'res_1', evidence: { table: 'arrivals', id: 'arr_read_1' }, owner: 'account' });
  assert.ok(Object.isFrozen(COMMISSION_ACTOR), 'nobody can put a person into it at runtime');
  // The caller: the vendor read writes the lock through COMMISSION_ACTOR, and its other changes still under the read's actor.
  const r = code(READ_LEAF);
  const at = r.indexOf("kind: 'commission_locked',");
  const call = r.slice(at, r.indexOf("target: { table: 'commission_ledger'", at));
  assert.match(call, /\bactor: COMMISSION_ACTOR,/);
  assert.doesNotMatch(call, /\n\s*actor,/);
  assert.match(r, /audited\.push\(\{ kind: change\.kind, outcome: await recordBookingEvent\(\{ reservation: booking, kind: change\.kind, actor, before: change\.before, after: change\.after, evidence \}\) \}\);/, 'the status/code/ticket rows are unchanged — still the owner');
});

test("the port REFUSES commission_locked under any other actor — by name, never thrown, never written, never corrected", async () => {
  for (const actor of [actorOfReadSource('cron', OWNER), actorOfReadSource('retro', OWNER), actorOfReadSource('webhook', OWNER), humanActor({ id: OWNER, email: 'owner@example.com' }), humanActor(null), { type: 'system_automation' as const, userId: OWNER }]) {
    const { writer, rows } = fakeChain();
    const logged: unknown[][] = [];
    const spy = mock.method(console, 'error', (...args: unknown[]) => { logged.push(args); });
    let out;
    try {
      out = await recordBookingEvent(lockInput(actor), writer);
    } finally {
      spy.mock.restore();
    }
    assert.equal(out.audited, false, `${actor.type} ${actor.userId}`);
    assert.equal(rows.length, 0, 'nothing is written');
    assert.equal(logged.length, 1);
    assert.equal(logged[0][0], '[booking audit] audit row NOT written — the change stands:');
    assert.equal((logged[0][1] as { request_id: string }).request_id, 'booking:res_1:commission_locked:arr_read_1');
    assert.match((logged[0][1] as { reason: string }).reason, /commission_locked refused — it is written by COMMISSION_ACTOR/);
  }
  // Every other kind keeps its caller's actor — the refusal is commission's alone.
  const { writer, rows } = fakeChain();
  await recordBookingEvent({ ...lockInput(actorOfReadSource('cron', OWNER)), kind: 'reservation_ticketed', before: { ticketedAt: null }, after: { ticketedAt: '2026-09-27T09:00:00.000Z' }, target: undefined }, writer);
  assert.equal(rows[0].actor.user_id, OWNER);
});

// ── the read route, evaluated ────────────────────────────────────────────────

type Row = { id: string; actor_user_id: string | null; action_type: string; target_table: string; target_id: string | null };
type Where = Record<string, unknown>;

/** Prisma's semantics for the keys the route uses: equality, { in }, { not }, and NOT. */
function matches(row: Row, where: Where): boolean {
  return Object.entries(where).every(([key, want]) => {
    if (key === 'NOT') return !matches(row, want as Where);
    const have = (row as Record<string, unknown>)[key];
    if (want !== null && typeof want === 'object') {
      const w = want as { in?: unknown[]; not?: unknown };
      if (w.in !== undefined) return w.in.includes(have);
      if ('not' in w) return have !== w.not;
    }
    return have === want;
  });
}

test('the read route, for the booking OWNER, returns ZERO commission_locked rows — under every filter a viewer can pass, including a row written under their id before this fix', async () => {
  const s = code(READ_ROUTE);
  // The route, anchored to its source exactly.
  const neverReturned = /const NEVER_RETURNED: AuditActionType\[\] = \[([^\]]*)\];/.exec(s)?.[1];
  assert.equal(neverReturned, "'commission_locked'");
  assert.ok(s.includes('const where: Prisma.audit_logWhereInput = { actor_user_id: user.id, NOT: { action_type: { in: NEVER_RETURNED } } };'));
  assert.match(s, /if \(actionType\) \{\s*where\.action_type = actionType as AuditActionType;\s*\} else if \(prefix\) \{\s*const list = SUBSYSTEM_ACTION_TYPES\[prefix\];\s*if \(!list \|\| list\.length === 0\) \{\s*return NextResponse\.json\(\{ count: 0, rows: \[\] \}\);\s*\}\s*where\.action_type = \{ in: list \};\s*\}/);
  assert.match(s, /if \(targetTable\) where\.target_table = targetTable;\s*if \(targetId\) where\.target_id = targetId;/);
  assert.ok(!/\bwhere\s*=\s*\{|where\.NOT\s*=|delete\s+where\.NOT/.test(s), 'no filter replaces the base scope');
  const mapSrc = /const SUBSYSTEM_ACTION_TYPES[^=]*=\s*\{([\s\S]*?)\n\};/.exec(s)?.[1] ?? '';
  const map: Record<string, string[]> = {};
  for (const m of mapSrc.matchAll(/\n  (\w+): \[([^\]]*)\]/g)) map[m[1]] = [...m[2].matchAll(/'(\w+)'/g)].map((x) => x[1]);
  assert.deepEqual(Object.keys(map).sort(), ['money_event_', 'operations_', 'reservation_']);
  assert.ok(!Object.values(map).flat().includes('commission_locked'));

  // The rows: the lock as the port now writes it; a lock as AUDIT-01 wrote it (the owner's id — audit_log is
  // append-only, so any such row stays); and the owner's own booking row.
  const { writer, rows: written } = fakeChain();
  await recordBookingEvent(lockInput(COMMISSION_ACTOR), writer);
  await recordBookingEvent({ reservation: RES, kind: 'reservation_booked', actor: humanActor({ id: OWNER, email: null }), before: null, after: { status: 'confirmed' }, evidence: { table: 'arrivals', id: 'arr_book' } }, writer);
  const table: Row[] = [
    ...written.map((w, i) => ({ id: `al_${i}`, actor_user_id: w.actor.user_id ?? null, action_type: w.action.type, target_table: w.target.table, target_id: w.target.id ?? null })),
    { id: 'al_legacy', actor_user_id: OWNER, action_type: 'commission_locked', target_table: 'commission_ledger', target_id: 'cl_1' },
  ];
  assert.equal(table.find((r) => r.id === 'al_0')?.actor_user_id, null);

  /** The route's where for one query, built exactly as the anchored source builds it. */
  const query = (q: { action_type?: string; prefix?: string; target_table?: string; target_id?: string }): Row[] => {
    const where: Where = { actor_user_id: OWNER, NOT: { action_type: { in: ['commission_locked'] } } };
    if (q.action_type) where.action_type = q.action_type;
    else if (q.prefix) {
      const list = map[q.prefix];
      if (!list || list.length === 0) return [];
      where.action_type = { in: list };
    }
    if (q.target_table) where.target_table = q.target_table;
    if (q.target_id) where.target_id = q.target_id;
    return table.filter((r) => matches(r, where));
  };
  const queries = [{}, { action_type: 'commission_locked' }, { prefix: 'commission_' }, { prefix: 'reservation_' }, { target_table: 'commission_ledger' }, { target_id: 'cl_1' }, { target_table: 'commission_ledger', action_type: 'commission_locked' }];
  for (const q of queries) {
    const got = query(q);
    assert.equal(got.filter((r) => r.action_type === 'commission_locked').length, 0, JSON.stringify(q));
  }
  assert.deepEqual(query({}).map((r) => r.action_type), ['reservation_booked'], 'the owner still reads their own booking');
  // Without the exclusion, the legacy row WOULD reach the owner — the defense is load-bearing.
  assert.equal(table.filter((r) => matches(r, { actor_user_id: OWNER, action_type: 'commission_locked' })).length, 1);
});

test('the timeline route already keeps commission off the customer page — confirmed, unchanged', () => {
  const s = code(TIMELINE_ROUTE);
  assert.match(s, /actor_user_id: user\.id,\s*action_type: \{ not: 'commission_locked' \},/);
  assert.match(s, /commission: \[\],/);
  assert.ok(!/commission_ledger/.test(s));
});

test('the audit law carries the two AUDIT-01b clauses; the port and the caller say why', () => {
  const law = comments(LAW);
  assert.ok(law.includes('CLAUSE 10. commission_locked IS NEVER WRITTEN WITH A USER ID (AUDIT-01b, 2026-09-27).'));
  assert.ok(law.includes('CLAUSE 11. THE READ ROUTE NEVER RETURNS commission_locked (AUDIT-01b, 2026-09-27).'));
  assert.match(comments(PORT), /AUDIT-01b \(2026-09-27\): commission_locked is the ONE exception/);
  assert.match(comments(READ_ROUTE), /AUDIT-01b \(2026-09-27\): action types this route NEVER returns, to any viewer\./);
});
