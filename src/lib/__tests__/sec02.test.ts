/**
 * SEC-02 (2026-09-27) — every route that changes data proves who you are and that
 * the row is yours. The ownership law's reader (src/lib/security/ownershipLaw.ts)
 * driven over fixtures — the house pattern passes, each broken shape fails — and
 * over the real routes the census named: the 48th DELETE/PATCH/PUT file a narrower
 * count missed, and the one FAIL, fixed.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, statSync } from 'node:fs';
import { resolve } from 'node:path';
import { code, functionBody } from '../sourceText';
import { exportedMethods, handlerIdentity, inScope, judgeWrites, provenOwned, writeSites } from '../security/ownershipLaw';

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
  assert.equal(narrow.length, 44, 'the count the ruling verified on main 11445ca1 (47), + the plan-vendors DELETE (VENDOR-01), − the four legacy-planner routes (LEGACY-DEL-01)');
  assert.equal(wide.length, 45, 'the census: 44 + the inngest route (49 before the four legacy-planner routes left — LEGACY-DEL-01)');
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
    'src/app/api/trips/[id]/route.ts',
    'src/app/api/trips/[id]/budget-line/route.ts',
    'src/app/api/trips/[id]/lodging/[optionId]/route.ts',
    'src/app/api/trips/[id]/transfers/[optionId]/route.ts',
    'src/app/api/trips/[id]/vehicles/[optionId]/route.ts',
    'src/app/api/trips/[id]/activities/[optionId]/route.ts',
  ]) {
    const c = code(f);
    for (const v of judgeWrites(c)) assert.ok(v.ok, `${f}:${v.site.line} ${v.site.model}.${v.site.op}`);
    for (const h of handlerIdentity(c)) assert.ok(h.identityAt !== null && (h.firstWriteAt === null || h.identityAt < h.firstWriteAt), `${f} ${h.method}`);
  }
});
