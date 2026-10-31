/**
 * LINK-02 (2026-09-27) — a booking is linked to the budget line it fulfils, by a
 * human, and the line reads Booked.
 *
 * The route's decisions (src/lib/reservations/budgetLink.ts) are driven over a store
 * that keeps the database's rules — the UNIQUE on reservationId refuses a second link —
 * and every audit row goes through the REAL audit port (recordBookingEvent) into a
 * fake chain that keeps writeAuditLog's request_id promise. lineStatusOf is driven
 * over fixtures. The route's prisma adapter, the guards, the screen, the migration
 * and the pins are read from source (TEST-TRUTH-01). The migration's UNIQUE and both
 * RESTRICTs were proven on a scratch Postgres (the PR body carries the output).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { WriteAuditLogInput } from '../audit/writeAuditLog';
import { code, comments, rejoin } from '../sourceText';
import { recordBookingEvent, type AuditWriter } from '../reservations/auditTrail';
import { LINK_WORDS, LinkExistsError, linkBooking, unlinkBooking, type BudgetLinkPorts } from '../reservations/budgetLink';
import { LINE_STATUS, lineStatusOf } from '../trips/lineStatus';
import { BUDGET_LINK_KINDS, bookingEventWords } from '../reservations/timeline';
import { BOOKING_FLOW_FILES, bookingFlowSha256 } from '../travelBookingFlow';

const ROUTE = 'src/app/api/reservations/[id]/budget-link/route.ts';
const GUARD = 'src/lib/trips/budgetLinkGuard.ts';
const ACTUALS = 'src/app/api/trips/[id]/actuals/route.ts';
const LEDGER = 'src/components/trips/TripBudgetActual.tsx';
const CONTROL = 'src/components/trips/TripBookings.tsx';
const TRIP_ROUTE = 'src/app/api/trips/[id]/route.ts';
const ATTACH_ROUTE = 'src/app/api/reservations/[id]/route.ts';
const MIGRATION = 'prisma/migrations/20260927120000_link_02_reservation_budget_links/migration.sql';
const LAW = 'scripts/assert-tool-registry.ts';

const NOW = new Date('2026-09-27T10:00:00.000Z');

interface Store {
  users: Array<{ id: string; email: string }>;
  reservations: Array<{ id: string; userId: string | null; tripId: string | null }>;
  lines: Array<{ id: string; userId: string; tripId: string | null; description: string | null }>;
  links: Array<{ id: string; userId: string; reservationId: string; budgetLineItemId: string; linkedAt: Date; linkedBy: string }>;
  audit: WriteAuditLogInput[];
  /** The id sequence — the store's, like a database's (a link id is never reused). */
  seq: number;
}

/** The fixture: u1 owns trip t1 (Lodging, Flights) and t2 (Car); u2 owns tX; a guest booking on t1. */
function store(): Store {
  return {
    users: [{ id: 'u1', email: 'owner@example.com' }, { id: 'u2', email: 'other@example.com' }],
    reservations: [
      { id: 'r1', userId: 'u1', tripId: 't1' },
      { id: 'r2', userId: 'u1', tripId: 't1' },
      { id: 'r3', userId: 'u1', tripId: 't2' },
      { id: 'r0', userId: 'u1', tripId: null },
      { id: 'rG', userId: null, tripId: 't1' },
      { id: 'rX', userId: 'u2', tripId: 'tX' },
    ],
    lines: [
      { id: 'L1', userId: 'u1', tripId: 't1', description: 'Lodging' },
      { id: 'L2', userId: 'u1', tripId: 't1', description: 'Flights' },
      { id: 'L3', userId: 'u1', tripId: 't2', description: 'Car' },
      { id: 'LX', userId: 'u2', tripId: 'tX', description: 'Theirs' },
    ],
    links: [],
    audit: [],
    seq: 0,
  };
}

/** The ports over the store — the database's rules kept: one link per booking. */
function portsOf(db: Store, opts: { raceOnCreate?: boolean } = {}): BudgetLinkPorts {
  const chain: AuditWriter = async (input) => {
    const at = db.audit.findIndex((r) => r.request_id === input.request_id);
    if (at >= 0) return { id: `al_${at}` };
    db.audit.push(input);
    return { id: `al_${db.audit.length - 1}` };
  };
  return {
    findUser: async (email) => db.users.find((u) => u.email.toLowerCase() === email.toLowerCase()) ?? null,
    findReservation: async (id, userId) => {
      const r = db.reservations.find((x) => x.id === id && x.userId === userId);
      return r ? { id: r.id, tripId: r.tripId } : null;
    },
    findLine: async (id, userId) => {
      const l = db.lines.find((x) => x.id === id && x.userId === userId);
      return l ? { id: l.id, tripId: l.tripId, description: l.description } : null;
    },
    findLink: async (reservationId, userId) => {
      if (opts.raceOnCreate) return null; // the check saw nothing; a concurrent link lands before the write
      const k = db.links.find((x) => x.reservationId === reservationId && x.userId === userId);
      return k ? { id: k.id, budgetLineItemId: k.budgetLineItemId, description: db.lines.find((l) => l.id === k.budgetLineItemId)?.description ?? null } : null;
    },
    createLink: async (row) => {
      if (db.links.some((x) => x.reservationId === row.reservationId)) throw new LinkExistsError(); // the UNIQUE
      db.seq += 1;
      const link = { id: `link_${db.seq}`, ...row };
      db.links.push(link);
      return { id: link.id, budgetLineItemId: link.budgetLineItemId, linkedAt: link.linkedAt };
    },
    deleteLink: async (id, userId) => {
      const before = db.links.length;
      db.links = db.links.filter((x) => !(x.id === id && x.userId === userId));
      return before - db.links.length;
    },
    record: (input) => recordBookingEvent(input, chain),
    now: () => NOW,
  };
}

const OWNER = 'owner@example.com';
const link = (db: Store, reservationId: string, budgetLineItemId: unknown, email: string | null = OWNER, ports = portsOf(db)) =>
  linkBooking(ports, { userEmail: email, reservationId, readBody: async () => ({ budgetLineItemId }) });
const unlink = (db: Store, reservationId: string, email: string | null = OWNER) => unlinkBooking(portsOf(db), { userEmail: email, reservationId });

test('link a booking to its trip\'s line → ONE link row + ONE audit row, through the port, the owner\'s words', async () => {
  const db = store();
  const out = await link(db, 'r1', 'L1');
  assert.equal(out.status, 201);
  assert.deepEqual(db.links, [{ id: 'link_1', userId: 'u1', reservationId: 'r1', budgetLineItemId: 'L1', linkedAt: NOW, linkedBy: OWNER }]);
  assert.equal(db.audit.length, 1);
  const row = db.audit[0];
  assert.equal(row.action.type, 'reservation_budget_linked');
  assert.equal(row.action.description, 'Linked to the budget line “Lodging” — line L1');
  assert.equal(row.action.description, bookingEventWords('reservation_budget_linked', { before: null, after: { budgetLineItemId: 'L1', description: 'Lodging' } }));
  assert.deepEqual(row.actor, { user_id: 'u1', email: OWNER, type: 'human_user', ip: null });
  assert.deepEqual(row.target, { table: 'reservations', id: 'r1' });
  assert.equal(row.payload?.before, null);
  assert.deepEqual(row.payload?.after, { budgetLineItemId: 'L1', description: 'Lodging' });
  assert.equal(row.request_id, 'booking:r1:reservation_budget_linked:link_1');
  assert.deepEqual(out.body, { link: { id: 'link_1', reservationId: 'r1', budgetLineItemId: 'L1', linkedAt: NOW } });
});

test('a second link for the same booking → 409 by name (checked, and on the UNIQUE\'s race); nothing written, nothing audited', async () => {
  const db = store();
  await link(db, 'r1', 'L1');
  const again = await link(db, 'r1', 'L2');
  assert.equal(again.status, 409);
  assert.deepEqual(again.body, { error: LINK_WORDS.linkExists, code: 'budget_link_exists', budgetLineItemId: 'L1' });
  assert.equal(db.links.length, 1);
  assert.equal(db.audit.length, 1);
  // The race: the check saw no link, the UNIQUE refused the write — the same answer.
  const raced = await link(db, 'r1', 'L2', OWNER, portsOf(db, { raceOnCreate: true }));
  assert.equal(raced.status, 409);
  assert.equal(raced.body.code, 'budget_link_exists');
  assert.equal(db.links.length, 1);
  assert.equal(db.audit.length, 1);
});

test('a line of another trip → 409 by name; a booking on no trip → 409; nothing written', async () => {
  const db = store();
  const other = await link(db, 'r1', 'L3');
  assert.equal(other.status, 409);
  assert.deepEqual(other.body, { error: LINK_WORDS.otherTrip, code: 'budget_line_other_trip' });
  const none = await link(db, 'r0', 'L1');
  assert.equal(none.status, 409);
  assert.equal(none.body.code, 'budget_line_other_trip');
  assert.equal(db.links.length, 0);
  assert.equal(db.audit.length, 0);
});

test("another user's line or booking → 404; a guest row → 404; no caller → 401; an unknown caller → 404; no line named → 400", async () => {
  const db = store();
  assert.deepEqual(await link(db, 'r1', 'LX'), { status: 404, body: { error: LINK_WORDS.lineNotFound } });
  assert.deepEqual(await link(db, 'rX', 'L1'), { status: 404, body: { error: LINK_WORDS.reservationNotFound } });
  assert.deepEqual(await link(db, 'rG', 'L1'), { status: 404, body: { error: LINK_WORDS.reservationNotFound } }, 'a guest row never matches the owner scope');
  assert.deepEqual(await link(db, 'r1', 'L1', null), { status: 401, body: { error: LINK_WORDS.unauthorized } });
  assert.deepEqual(await link(db, 'r1', 'L1', 'nobody@example.com'), { status: 404, body: { error: LINK_WORDS.userNotFound } });
  assert.equal((await link(db, 'r1', '   ')).status, 400);
  assert.equal((await link(db, 'r1', 42)).status, 400);
  const badJson = await linkBooking(portsOf(db), { userEmail: OWNER, reservationId: 'r1', readBody: async () => { throw new SyntaxError('Unexpected token'); } });
  assert.deepEqual(badJson, { status: 400, body: { error: 'Invalid JSON body' } });
  // The 404s confirm nothing — the same words whether the row is foreign or absent.
  assert.deepEqual(await link(db, 'r-does-not-exist', 'L1'), { status: 404, body: { error: LINK_WORDS.reservationNotFound } });
  assert.equal(db.links.length, 0);
  assert.equal(db.audit.length, 0);
});

test('one line may carry several bookings (two stays under one Lodging line)', async () => {
  const db = store();
  assert.equal((await link(db, 'r1', 'L1')).status, 201);
  assert.equal((await link(db, 'r2', 'L1')).status, 201);
  assert.deepEqual(db.links.map((k) => [k.reservationId, k.budgetLineItemId]), [['r1', 'L1'], ['r2', 'L1']]);
  assert.equal(db.audit.length, 2);
});

test('unlink → the row is gone + ONE audit row naming the line as it was; unlink with none → 404 by name, nothing audited', async () => {
  const db = store();
  await link(db, 'r1', 'L1');
  const out = await unlink(db, 'r1');
  assert.equal(out.status, 200);
  assert.deepEqual(out.body, { unlinked: { id: 'link_1', reservationId: 'r1', budgetLineItemId: 'L1' } });
  assert.equal(db.links.length, 0);
  assert.equal(db.audit.length, 2);
  const row = db.audit[1];
  assert.equal(row.action.type, 'reservation_budget_unlinked');
  assert.equal(row.action.description, 'Unlinked from the budget line “Lodging” — line L1');
  assert.deepEqual(row.payload?.before, { budgetLineItemId: 'L1', description: 'Lodging' });
  assert.equal(row.payload?.after, null);
  assert.equal(row.request_id, 'booking:r1:reservation_budget_unlinked:link_1');
  const none = await unlink(db, 'r1');
  assert.deepEqual(none, { status: 404, body: { error: LINK_WORDS.noLink, code: 'no_budget_link' } });
  assert.equal(db.audit.length, 2);
  // Another user's booking: the defensive 404 before any link is looked at.
  assert.deepEqual(await unlink(db, 'rX'), { status: 404, body: { error: LINK_WORDS.reservationNotFound } });
  // Relinking after an unlink is a new link, a new fact.
  assert.equal((await link(db, 'r1', 'L2')).status, 201);
  assert.equal(db.audit[2].request_id, 'booking:r1:reservation_budget_linked:link_2');
});

test('lineStatusOf: Saved / Booked / Booked · paid from fixtures; two bookings on one line, one unpaid → Booked', () => {
  const line = { id: 'L1' };
  assert.equal(lineStatusOf(line, []), LINE_STATUS.saved);
  assert.equal(lineStatusOf(line, [{ budgetLineItemId: 'L2', reservationId: 'r9', bankConfirmed: true }]), LINE_STATUS.saved, "another line's link is not this line's");
  assert.equal(lineStatusOf(line, [{ budgetLineItemId: 'L1', reservationId: 'r1', bankConfirmed: false }]), LINE_STATUS.booked);
  assert.equal(lineStatusOf(line, [{ budgetLineItemId: 'L1', reservationId: 'r1', bankConfirmed: true }]), LINE_STATUS.paid);
  assert.equal(lineStatusOf(line, [
    { budgetLineItemId: 'L1', reservationId: 'r1', bankConfirmed: true },
    { budgetLineItemId: 'L1', reservationId: 'r2', bankConfirmed: false },
  ]), LINE_STATUS.booked);
  assert.deepEqual([LINE_STATUS.saved, LINE_STATUS.booked, LINE_STATUS.paid], ['Saved', 'Booked', 'Booked · paid']);
  const leaf = code('src/lib/trips/lineStatus.ts');
  assert.ok(!/^\s*import\s/m.test(leaf) && !/prisma|fetch\s*\(|Date|process\.env/.test(leaf), 'pure');
});

test('the route is the prisma adapter of the leaf: the owner scope on every read, P2002 named, the one audit port', () => {
  const s = code(ROUTE);
  assert.match(s, /findReservation: \(id, userId\) => prisma\.reservations\.findFirst\(\{ where: \{ id, userId \}, select: \{ id: true, tripId: true \} \}\),/);
  assert.match(s, /findLine: \(id, userId\) => prisma\.budget_line_items\.findFirst\(\{ where: \{ id, userId \}, select: \{ id: true, tripId: true, description: true \} \}\),/);
  assert.match(s, /where: \{ reservationId, userId \},/);
  assert.match(s, /deleteLink: async \(id, userId\) => \(await prisma\.reservation_budget_links\.deleteMany\(\{ where: \{ id, userId \} \}\)\)\.count,/);
  assert.match(s, /if \(err instanceof Prisma\.PrismaClientKnownRequestError && err\.code === 'P2002'\) throw new LinkExistsError\(\);/);
  assert.match(s, /record: \(input\) => recordBookingEvent\(input\),/);
  assert.match(s, /userEmail: await getVerifiedEmail\(\)/);
  assert.ok(!/writeAuditLog|requireTier|amount|finalPriceCents/.test(s));
});

test('the writers that would break the link ask FIRST: the trip delete and the attach PATCH (the uncommit was deleted — LEGACY-DEL-01); the guard only reads', () => {
  const fn = (src: string, verb: string) => src.slice(src.indexOf(`export async function ${verb}(`));
  const tripDelete = fn(code(TRIP_ROUTE), 'DELETE');
  assert.ok(tripDelete.indexOf('const linked = await tripLinesLinkedRefusal(user.id, id);') < tripDelete.indexOf('deleteMany('));
  const attach = code(ATTACH_ROUTE);
  assert.match(attach, /select: \{ id: true, tripId: true \},/);
  assert.match(attach, /if \(tripId !== owned\.tripId\) \{\s*const linked = await bookingLinkedRefusal\(user\.id, owned\.id\);\s*if \(linked\) return linked;\s*\}\s*const r = await prisma\.reservations\.update\(/);
  const guard = code(GUARD);
  assert.match(guard, /prisma\.reservation_budget_links\.count\(\{ where: \{ budgetLineItem: \{ tripId, userId \} \} \}\)/);
  assert.match(guard, /status: 409/);
  assert.ok(!/\.(create|update|upsert|delete|deleteMany)\s*\(/.test(guard));
});

test("the screen: the actuals route returns each line's links; the ledger derives the status and shows the bookings beside the plan; the control links by the owner's pick", () => {
  const a = code(ACTUALS);
  assert.match(a, /return NextResponse\.json\(\{ booked, unplanned, window, lines \}\);/);
  assert.match(a, /where: \{ userId: user\.id, status: 'accepted', moneyEventId: null, reservationId: \{ in: budgetLinks\.map\(\(b\) => b\.reservation\.id\) \} \},/, 'paid = an accepted CHARGE link');
  assert.match(a, /displayName: reservationIdentity\(b\.reservation\)\.name,/);
  assert.match(a, /finalPriceCents: b\.reservation\.finalPriceCents,\s*currency: b\.reservation\.currency,/);
  const ledger = code(LEDGER);
  assert.match(ledger, /const status = lineStatusOf\(\{ id: it\.id \}, statusLinks\);/);
  assert.match(ledger, /statusLinks === null \? \(\s*<span className="text-text-faint">\{LINE_WORDS\.none\}<\/span>/, 'no guessed Saved before the links load');
  assert.match(ledger, /data-booked-as=\{it\.id\}/);
  assert.ok(!/>\s*Saved\s*</.test(ledger));
  const control = code(CONTROL);
  assert.match(control, /<select\s+value=""/);
  assert.match(control, /<option value="">\{LINE_WORDS\.choose\}<\/option>/);
  assert.match(control, /fetch\(`\/api\/reservations\/\$\{reservationId\}\/budget-link`/);
  assert.match(control, /if \(onChanged\) onChanged\(\); else \{ load\(\); loadLines\(\); \}/, 'the ledger re-reads its statuses');
  assert.ok(!/\.sort\(/.test(control));
  // The honesty notes, rewritten to what is true.
  for (const f of [LEDGER, ACTUALS]) {
    const text = rejoin(code(f), comments(f));
    assert.ok(!/structurally impossible|shows "Saved" for all rows/.test(text), f);
    assert.match(comments(f), /LINK-02 \(2026-09-27\)/);
  }
});

test('the migration: one line per booking, several bookings per line, RESTRICT both ways, stated fields without defaults, the two enum values', () => {
  const sql = code(MIGRATION);
  assert.match(sql, /CREATE UNIQUE INDEX "reservation_budget_links_reservationId_key" ON "reservation_budget_links"\("reservationId"\);/);
  assert.ok(!/UNIQUE[^;]*"budgetLineItemId"/.test(sql));
  assert.match(sql, /FOREIGN KEY \("reservationId"\) REFERENCES "reservations"\("id"\) ON DELETE RESTRICT/);
  assert.match(sql, /FOREIGN KEY \("budgetLineItemId"\) REFERENCES "budget_line_items"\("id"\) ON DELETE RESTRICT/);
  assert.match(sql, /"linkedAt"\s+TIMESTAMPTZ\(6\) NOT NULL,/);
  assert.match(sql, /"linkedBy"\s+VARCHAR\(255\)\s+NOT NULL,/);
  for (const k of BUDGET_LINK_KINDS) assert.ok(sql.includes(`ALTER TYPE "AuditActionType" ADD VALUE IF NOT EXISTS '${k}';`), k);
  assert.ok(!/\bBEGIN\b|\bCOMMIT\b|INSERT INTO/i.test(sql), 'no transaction block, no backfill');
});

test('the two pinned files are re-pinned, dated, the old hashes stacked; the law carries the budget-link law', () => {
  for (const f of [CONTROL, ATTACH_ROUTE]) {
    const pin = BOOKING_FLOW_FILES.find((p) => p.file === f);
    assert.ok(pin, f);
    assert.equal(bookingFlowSha256(rejoin(code(f), comments(f))), pin.sha256, `${f} re-pinned`);
  }
  const pins = code('src/lib/travelBookingFlow.ts') + comments('src/lib/travelBookingFlow.ts');
  assert.equal((pins.match(/LINK-02 \(2026-09-27\): re-pinned/g) ?? []).length, 2);
  for (const was of ['07c3516b62db9eefea307b5008511d8526ffaca78329c17df4e9fe90dc5adcbc', '12cef6fc6415b72bc836edf9b9b05b613727c2a3914675a3e0e0f502a984d3c4']) assert.ok(pins.includes(`Was ${was} at main 7689c9c8.`), was);
  assert.match(code(LAW), /lawGuard\('The budget-link law', \(\) => \{/);
});
