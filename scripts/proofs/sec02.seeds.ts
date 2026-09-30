/**
 * The ownership law's seeded regressions (SEC-02, 2026-09-27).
 *
 * The ruling: every route that changes data proves who you are and that the row
 * is yours, and the build refuses one that doesn't. These seeds put back, one at a
 * time, each shape the law closes:
 *
 *   · the three the ruling names — a trip DELETE with its ownership check removed,
 *     an unlisted public writer, a write scoped only by the request id;
 *   · the census FAIL back — account-tax-mappings answering a foreign row 403;
 *   · the child check removed under an owned parent, the batch count removed, a
 *     helper called without its precondition, a handler with no identity call, a
 *     PUT exported in a form the law cannot read;
 *   · the trust the reader rests on — a public writer's guard, requireAdmin()'s
 *     OWNER_EMAIL check, an owned loader's scope — and a closed table grown.
 *
 * Each must fail the ownership law by name. The anchors occur exactly once in
 * their file, which the harness enforces before it runs anything.
 */
import type { Seed } from '../prove';

const LAW = 'scripts/assert-tool-registry.ts';

const SEEDS: Seed[] = [
  // LEGACY-DEL-02 (2026-09-30): this seed broke the lodging [optionId] route, deleted with the dead travel code;
  // it moves to the live trip DELETE and breaks the same clause there — the ownership check goes, every write under it is anyone's.
  {
    name: 'sec02-a a trip DELETE loses its ownership check (the ruling\'s first seed)',
    file: 'src/app/api/trips/[id]/route.ts',
    find: "    const trip = await prisma.trips.findFirst({\n      where: { id, userId: user.id }\n    });\n\n    if (!trip) {\n      return NextResponse.json({ error: 'Trip not found or not authorized' }, { status: 404 });\n    }\n\n    // LINK-02",
    replace: '    // LINK-02',
    expect: 'trips.delete { id } — the WHERE names no caller',
  },
  {
    name: 'sec02-b an unlisted public writer — a writing route becomes a public path (the ruling\'s second seed)',
    file: 'src/middleware.ts',
    find: "  '/api/proposals',\n];",
    replace: "  '/api/proposals',\n  '/api/trading-journal',\n];",
    expect: '/api/trading-journal is reachable with no session',
  },
  {
    name: 'sec02-c a write scoped only by the request id (the ruling\'s third seed)',
    file: 'src/app/api/trading-journal/route.ts',
    find: '      where: { id, userId: user.id }\n',
    replace: '      where: { id }\n',
    expect: 'trade_journal_entries.deleteMany { id } — the WHERE names no caller',
  },
  {
    name: 'sec02-d the census FAIL returns — a foreign mapping answered 403 "does not belong"',
    file: 'src/app/api/account-tax-mappings/route.ts',
    find: "      where: { id, account: { userId: user.id } },\n      select: { id: true },\n    });\n    if (!mapping) {\n      return NextResponse.json({ error: 'Mapping not found' }, { status: 404 });\n    }\n",
    replace: "      where: { id },\n      include: { account: { select: { userId: true } } },\n    });\n    if (!mapping) {\n      return NextResponse.json({ error: 'Mapping not found' }, { status: 404 });\n    }\n    if (mapping.account.userId !== user.id) {\n      return NextResponse.json({ error: 'Mapping does not belong to this user' }, { status: 403 });\n    }\n",
    expect: 'account_tax_mappings.delete { id: mapping.id } — the WHERE names no caller',
  },
  // LEGACY-DEL-02 (2026-09-30): this seed broke the transfers [optionId] route, deleted with the dead travel code;
  // it moves to the live itinerary PATCH, a child row under an owned trip, and breaks the same clause there.
  {
    name: 'sec02-e the child check goes — the trip is owned, the itinerary row is anyone\'s',
    file: 'src/app/api/trips/[id]/itinerary/[itineraryId]/route.ts',
    find: "    const existing = await prisma.trip_itinerary.findFirst({ where: { id: itineraryId, tripId } });\n    if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });\n",
    replace: '',
    expect: 'trip_itinerary.update { id: itineraryId } — the WHERE names no caller',
  },
  {
    name: 'sec02-f the batch count goes — some of the ids may be another user\'s',
    file: 'src/app/api/transactions/assign-coa/route.ts',
    find: "    if (ownedTxns.length !== transactionIds.length) {\n      return NextResponse.json({ error: 'Some transactions do not belong to your account' }, { status: 403 });\n    }\n",
    replace: '',
    expect: 'transactions.UPDATE id = ${id} — the WHERE names no caller',
  },
  {
    name: 'sec02-g a helper is called without its precondition — the uncommit flips a foreign option',
    file: 'src/app/api/trips/[id]/vendor-commit/route.ts',
    find: "      const owned = await optionBelongsToTrip(optionType, optionId, id);\n      if (!owned) return NextResponse.json({ error: 'Option not found' }, { status: 404 });\n",
    replace: '',
    expect: 'calls setOptionStatus without its ownership check first',
  },
  {
    name: 'sec02-h a handler changes data with no identity call',
    file: 'src/app/api/accounts/update-entity/route.ts',
    find: '    const userEmail = await getVerifiedEmail();\n',
    replace: "    const userEmail = request.headers.get('x-user-email');\n",
    expect: 'POST changes data with no getVerifiedEmail() / getCurrentUser() / requireAdmin()',
  },
  {
    name: 'sec02-i a PUT exported in a form the law cannot read',
    file: 'src/app/api/budgets/route.ts',
    find: "    return NextResponse.json({ error: 'Failed to save budget' }, { status: 500 });\n  }\n}\n",
    replace: "    return NextResponse.json({ error: 'Failed to save budget' }, { status: 500 });\n  }\n}\n\nexport const { PUT } = { PUT: POST };\n",
    expect: 'exports PUT as a destructured export the law cannot read',
  },
  {
    name: 'sec02-j a public writer loses its guard',
    file: 'src/app/api/proposals/route.ts',
    find: '      await rateLimit(`proposal:${ipHash}`, { limit: 5, windowSeconds: 3600 });\n',
    replace: '',
    expect: 'guard "per-ip_hash rate limit 5/hour" is gone',
  },
  {
    name: 'sec02-k requireAdmin() stops checking OWNER_EMAIL',
    file: 'src/lib/require-admin.ts',
    find: '  if (!ownerEmail || userEmail.toLowerCase() !== ownerEmail.toLowerCase()) {',
    replace: '  if (!ownerEmail) {',
    expect: 'requireAdmin() cannot count as an identity call',
  },
  {
    name: 'sec02-l an owned loader stops scoping to the caller',
    file: 'src/lib/operations/loadAuthorizedCalendarBlock.ts',
    find: '    where: { id: blockId, user_id: userId },',
    replace: '    where: { id: blockId },',
    expect: 'the owned loader loadAuthorizedCalendarBlock does not read by { id, user_id|userId }',
  },
  {
    name: 'sec02-m a closed table grows — an owner-console entry added without a ruling',
    file: LAW,
    find: "  { file: 'src/app/api/owner/proposals/[id]/route.ts', why: 'the public proposal form\\'s rows (no owner column) — the owner reviews them' },\n",
    replace: "  { file: 'src/app/api/owner/proposals/[id]/route.ts', why: 'the public proposal form\\'s rows (no owner column) — the owner reviews them' },\n  { file: 'src/app/api/budgets/route.ts', why: 'seeded' },\n",
    expect: 'ownerConsole holds 7 entries, pinned at 6',
  },
];

export default SEEDS;
