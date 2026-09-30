/**
 * SEC-02 (2026-09-27) — every route that changes data proves who you are and that
 * the row is yours. The ownership law's reader (src/lib/security/ownershipLaw.ts)
 * driven over fixtures — the house pattern passes, each broken shape fails — and
 * over the real routes the census named: the 48th DELETE/PATCH/PUT file a narrower
 * count missed, and the one FAIL, fixed.
 *
 * GUEST-02 (2026-09-30): the gated flow's three readers — the entry calls in a file, the
 * modules a file imports, the writes a gated flow may not make — driven over fixtures and
 * over the one cancel flow and its two gates.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, statSync } from 'node:fs';
import { resolve } from 'node:path';
import { code, functionBody } from '../sourceText';
import { entryCalls, exportedMethods, flowWriteRefusals, handlerIdentity, importSpecifiers, inScope, judgeWrites, provenOwned, writeSites } from '../security/ownershipLaw';

function routes(dir = 'src/app/api'): string[] {
  const out: string[] = [];
  for (const name of readdirSync(resolve(process.cwd(), dir))) {
    const rel = `${dir}/${name}`;
    if (statSync(resolve(process.cwd(), rel)).isDirectory()) out.push(...routes(rel));
    else if (name === 'route.ts') out.push(rel);
  }
  return out;
}

const HOUSE = `
export async function DELETE(request: Request, { params }: { params: Promise<{ id: string; optionId: string }> }) {
  const { id, optionId } = await params;
  const userEmail = await getVerifiedEmail();
  if (!userEmail) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const user = await prisma.users.findFirst({ where: { email: { equals: userEmail, mode: 'insensitive' } } });
  if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });
  const trip = await prisma.trips.findFirst({ where: { id, userId: user.id } });
  if (!trip) return NextResponse.json({ error: 'Trip not found' }, { status: 404 });
  const option = await prisma.trip_lodging_options.findFirst({ where: { id: optionId, trip_id: id }, select: { id: true } });
  if (!option) return NextResponse.json({ error: 'Option not found' }, { status: 404 });
  await prisma.trip_lodging_options.delete({ where: { id: optionId } });
  return NextResponse.json({ success: true });
}
`;

test('every export form is read — the destructured PUT a `function|const` count misses', () => {
  const forms = exportedMethods(`export const { GET, POST, PUT } = serve({ client, functions });\nexport { handler as PATCH };\nexport const DELETE = wrap(x);\nexport async function POST() {}`);
  assert.deepEqual(forms.map((f) => `${f.method}:${f.form}`), ['GET:destructured', 'POST:destructured', 'PUT:destructured', 'PATCH:reexport', 'DELETE:const', 'POST:function']);
  const inngest = exportedMethods(code('src/app/api/inngest/route.ts'));
  assert.ok(inngest.some((m) => m.method === 'PUT' && m.form === 'destructured'), 'the inngest route serves PUT');
  const all = routes();
  const narrow = all.filter((f) => /export\s+(?:async\s+)?(?:function|const)\s+(?:DELETE|PATCH|PUT)\b/.test(code(f)));
  const wide = all.filter((f) => exportedMethods(code(f)).some((m) => m.method === 'DELETE' || m.method === 'PATCH' || m.method === 'PUT'));
  // VENDOR-01 (2026-09-29): + src/app/api/operations/plan-vendors/route.ts DELETE — an owned writer the
  // ownership law reads (the cart-plan gate first, every write scoped to user.id); the only change.
  assert.ok(narrow.includes('src/app/api/operations/plan-vendors/route.ts'));
  // LEGACY-DEL-01 (2026-09-29): four of them were the legacy planner's — the scanner-results, destinations, commit and
  // participants routes, each exporting DELETE — deleted with it.
  // LEGACY-DEL-02 (2026-09-30): four more went with the dead travel code — the lodging, transfers, vehicles and
  // activities [optionId] routes, each exporting PATCH and DELETE.
  assert.equal(narrow.length, 40, 'the count the ruling verified on main 11445ca1 (47), + the plan-vendors DELETE (VENDOR-01), − the four legacy-planner routes (LEGACY-DEL-01), − the four option routes (LEGACY-DEL-02)');
  assert.equal(wide.length, 41, 'the census: 40 + the inngest route (49 before the four legacy-planner routes left — LEGACY-DEL-01; 45 before the four option routes left — LEGACY-DEL-02)');
  assert.deepEqual(wide.filter((f) => !narrow.includes(f)), ['src/app/api/inngest/route.ts']);
});

test('the house pattern passes: verified email → user → { id, userId } → 404 → the child by { id, parentId } → the scoped write', () => {
  const [verdict] = judgeWrites(HOUSE);
  assert.equal(verdict.ok, true);
  assert.equal(verdict.how, 'owned');
  const [id] = handlerIdentity(HOUSE);
  assert.ok(id.identityAt !== null && id.firstWriteAt !== null && id.identityAt < id.firstWriteAt, 'who is asking is proven before the write');
  assert.equal(inScope(HOUSE), true);
});

test('each broken shape fails: no parent check, no child check, a supplied userId, no identity', () => {
  const noParent = HOUSE.replace("  const trip = await prisma.trips.findFirst({ where: { id, userId: user.id } });\n  if (!trip) return NextResponse.json({ error: 'Trip not found' }, { status: 404 });\n", '');
  assert.equal(judgeWrites(noParent)[0].ok, false, 'the option is checked against a trip nobody proved the caller\'s');
  const noChild = HOUSE.replace("  const option = await prisma.trip_lodging_options.findFirst({ where: { id: optionId, trip_id: id }, select: { id: true } });\n  if (!option) return NextResponse.json({ error: 'Option not found' }, { status: 404 });\n", '');
  assert.equal(judgeWrites(noChild)[0].ok, false, 'the trip is owned; the option id is anyone\'s');
  const supplied = HOUSE.replace('{ id, userId: user.id }', '{ id, userId: body.userId }');
  assert.equal(judgeWrites(supplied)[0].ok, false, 'a userId the request supplied is not the caller');
  const anonymous = HOUSE.replace('await getVerifiedEmail()', "request.headers.get('x-email')");
  assert.equal(handlerIdentity(anonymous)[0].identityAt, null);
});

test('the census FAIL, fixed: a foreign mapping and a missing one get the same 404; the old 403 split fails the reader', () => {
  const route = code('src/app/api/account-tax-mappings/route.ts');
  const del = functionBody(route, 'DELETE') ?? '';
  assert.match(del, /where: \{ id, account: \{ userId: user\.id \} \},/);
  assert.doesNotMatch(del, /status: 403/);
  assert.doesNotMatch(del, /does not belong to this user/);
  assert.ok(judgeWrites(route).every((v) => v.ok), 'every write in the file is scoped');
  const old = `
export async function DELETE(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const id = new URL(request.url).searchParams.get('id');
  const mapping = await prisma.account_tax_mappings.findFirst({ where: { id }, include: { account: { select: { userId: true } } } });
  if (!mapping) return NextResponse.json({ error: 'Mapping not found' }, { status: 404 });
  if (mapping.account.userId !== user.id) return NextResponse.json({ error: 'Mapping does not belong to this user' }, { status: 403 });
  await prisma.account_tax_mappings.delete({ where: { id } });
}`;
  assert.equal(judgeWrites(old)[0].ok, false, 'two answers — 404 missing, 403 foreign — confirm the row exists; the reader does not accept it');
  const chain = old.replace(/  if \(!mapping\) return[^\n]*\n  if \(mapping\.account\.userId !== user\.id\)/, '  if (!mapping || mapping.account.userId !== user.id)');
  assert.equal(judgeWrites(chain)[0].ok, true, 'one condition, one answer: the owner chain');
});

test('the batch: a caller-scoped findMany over the ids, then the count — else the list is not proven', () => {
  const batch = `
export async function POST(request: Request) {
  const userEmail = await getVerifiedEmail();
  const user = await prisma.users.findFirst({ where: { email: { equals: userEmail, mode: 'insensitive' } } });
  const { transactionIds } = await request.json();
  const owned = await prisma.transactions.findMany({ where: { id: { in: transactionIds }, accounts: { userId: user.id } } });
  if (owned.length !== transactionIds.length) return NextResponse.json({ error: 'x' }, { status: 403 });
  for (const id of transactionIds) {
    await prisma.$executeRawUnsafe(\`UPDATE transactions SET "accountCode" = $1 WHERE id = $2\`, code, id);
  }
}`;
  const [raw] = writeSites(batch);
  assert.equal(raw.where, 'id = ${id}', 'a positional $2 is read as the argument it binds');
  assert.equal(judgeWrites(batch)[0].ok, true);
  assert.equal(judgeWrites(batch.replace(/  if \(owned\.length[^\n]*\n/, ''))[0].ok, false, 'without the count, some ids may be another user\'s');
});

test('a proof covers the name it proved, not a later declaration of the same name', () => {
  const region = `
  const participant = await prisma.trip_participants.create({ data: { tripId: trip.id } });
  const other = 1;
  const participant2 = 2;
  `;
  assert.ok(provenOwned(region).has('participant'), 'a row this request created is its own');
  const shadowed = `${region}
  const participant = await prisma.trip_participants.findUnique({ where: { inviteToken: token } });
  `;
  assert.equal(provenOwned(shadowed).has('participant'), false, 'the later read by a token is not the created row');
});

test('the real routes the ruling sampled read as the house pattern, write for write', () => {
  for (const f of [
    // LEGACY-DEL-01 (2026-09-29): the participants, destinations, commit and scanner-results routes were
    // deleted with the legacy trip planner and left this sample; the live routes keep every check.
    // LEGACY-DEL-02 (2026-09-30): the lodging, transfers, vehicles and activities [optionId] routes were deleted
    // with the dead travel code and left this sample; the two live trip writers keep every check.
    'src/app/api/trips/[id]/route.ts',
    'src/app/api/trips/[id]/budget-line/route.ts',
  ]) {
    const c = code(f);
    for (const v of judgeWrites(c)) assert.ok(v.ok, `${f}:${v.site.line} ${v.site.model}.${v.site.op}`);
    for (const h of handlerIdentity(c)) assert.ok(h.identityAt !== null && (h.firstWriteAt === null || h.identityAt < h.firstWriteAt), `${f} ${h.method}`);
  }
});

// ── GUEST-02 (2026-09-30): the gated flow's readers ──────────────────────────

const GATED = `
import { quoteCancellation, cancelReservation } from '@/lib/reservations/cancelFlow';
export async function quoteCancellation(owned: Row) { return null; }
async function gate(id: string) { return { ok: true, owned: { id } }; }
export async function GET(request: Request) {
  const g = await gate('x');
  if (!g.ok) return g.response;
  return await quoteCancellation(g.owned, caller);
}
export async function POST(request: Request) {
  return cancelReservation(body.row, caller);
}
`;

test('GUEST-02 entryCalls: every call of an entry — its function, the text before it there, its first argument; a definition is not a call', () => {
  const calls = entryCalls(GATED, ['quoteCancellation', 'cancelReservation']);
  assert.deepEqual(calls.map((c) => [c.entry, c.fn, c.firstArg]), [['quoteCancellation', 'GET', 'g.owned'], ['cancelReservation', 'POST', 'body.row']]);
  assert.match(calls[0].before, /const g = await gate\('x'\);\s*if \(!g\.ok\) return g\.response;\s*return await $/, 'the gate stands before the call in its function');
  assert.ok(!/gate\(/.test(calls[1].before), 'no gate before the ungated call');
  assert.deepEqual(entryCalls(GATED, []), []);
});

test('GUEST-02 importSpecifiers: import … from, export … from, a side-effect import, import() and require()', () => {
  const src = "import a from './a';\nimport type { B } from \"@/lib/b\";\nexport { c } from '../c';\nimport './d';\nconst e = await import('@/lib/e');\nconst f = require('f');\n";
  assert.deepEqual(importSpecifiers(src).sort(), ['./a', './d', '../c', '@/lib/b', '@/lib/e', 'f'].sort());
});

test('GUEST-02 flowWriteRefusals: an update names the owned row\'s id (as id or reservationId); a delete, an upsert and raw SQL are refused; a create is not judged', () => {
  const ok = `
async function f(owned: Row) {
  await tx.reservations.update({ where: { id: owned.id }, data: { status: 'cancelled' } });
  await tx.commission_ledger.updateMany({ where: { reservationId: owned.id, status: 'estimated' }, data: { status: 'cancelled' } });
  await tx.money_events.createMany({ data: rows });
}`;
  assert.deepEqual(flowWriteRefusals(ok, 'owned'), []);
  const bad = `
async function f(owned: Row, body: Body) {
  await tx.reservations.update({ where: { id: body.id }, data: {} });
  await prisma.reservations.updateMany({ where: { userId: owned.userId }, data: {} });
  await prisma.money_events.delete({ where: { id: owned.id } });
  await prisma.vouchers.upsert({ where: { id: owned.id }, create: {}, update: {} });
  await prisma.$executeRaw\`UPDATE reservations SET status = 'x' WHERE id = \${owned.id}\`;
  await prisma.$queryRaw\`SELECT 1\`;
}`;
  assert.deepEqual(flowWriteRefusals(bad, 'owned').map((r) => r.why), [
    'an update whose WHERE does not name owned.id',
    'an updateMany whose WHERE does not name owned.id',
    'a delete',
    'an upsert',
    'raw SQL',
    'raw SQL',
  ]);
});

test('GUEST-02 the one cancel flow and its two gates, read: no refused write in the flow; each gate calls both entries with its own row, behind its gate', () => {
  assert.deepEqual(flowWriteRefusals(code('src/lib/reservations/cancelFlow.ts'), 'owned'), []);
  const entries = ['quoteCancellation', 'cancelReservation'];
  for (const [file, gate, row] of [
    ['src/app/api/reservations/[id]/cancel/route.ts', /const g = await gate\(id\);\s*if \(!g\.ok\) return g\.response;/, 'g.owned'],
    ['src/app/api/guest/booking/cancel/route.ts', /const g = await guestGate\(request\);\s*if \(!g\.ok\) return g\.response;/, 'g.row'],
  ] as const) {
    const src = code(file);
    const calls = entryCalls(src, entries);
    assert.deepEqual(calls.map((c) => [c.entry, c.fn, c.firstArg]), [['quoteCancellation', 'GET', row], ['cancelReservation', 'POST', row]], file);
    for (const c of calls) assert.match(c.before, gate, `${file}: ${c.entry} behind its gate`);
    assert.ok(importSpecifiers(src).includes('@/lib/reservations/cancelFlow'), file);
    assert.equal(inScope(src), false, `${file}: its writes are the flow's — the law counts it as a writer by its entry calls`);
  }
});
