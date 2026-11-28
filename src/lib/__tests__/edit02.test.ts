/**
 * EDIT-02 (Alex, 2026-11-28) — EVERY CELL OPENS, EXCEPT THE FORMULAS: "only some of the fileds can be edited by clicking on the cell... not
 * all.... they should all be able to be edited, eccept for formula driven cells..."
 *
 * PART 0 — a plan coded on a Books line is refused by name (routines/[id]/route.ts DELETE; src/lib/operations/linkHold.ts).
 * PART 1 — the open rule: every column but the six worked out. PART 2 — the plan's cells on every plan, ITEMS, and the trip's place.
 * PART 3 — DATE: a one-off moves with its rows. Each part's tests land in the commit that builds it.
 *
 * HERMETIC, on edit01.test.ts's model — no database, no network, the only clock the one handed in. The rules are DRIVEN directly over
 * made-up rows; the routes and the screens are anchored to their source with comments stripped (the reader law). Every plan, vendor,
 * place, day, account and amount below is invented. No pin here names a line number.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { code, comments } from '../sourceText';
import { ROUTINE_CODED_ON_BOOKS_WORDS, routineHoldsLinksWords } from '../operations/linkHold';
import { deleteRow } from '../../components/workbench/operations/ledger/cellSaves';

const ROUTINE_ROUTE = 'src/app/api/operations/routines/[id]/route.ts';
const HOLD = 'src/lib/operations/linkHold.ts';

/** A handler's body in a route's source: from its export to the next export. */
const bodyOf = (src: string, verb: string): string => {
  const at = src.indexOf(`export async function ${verb}(`);
  if (at < 0) return assert.fail(`no ${verb} in the route`);
  const next = src.indexOf('\nexport async function ', at + 1);
  return src.slice(at, next < 0 ? undefined : next);
};
/** Each step found after the one before it. */
const inOrder = (text: string, steps: readonly string[], what: string): void => {
  let from = 0;
  for (const step of steps) {
    const i = text.indexOf(step, from);
    assert.notEqual(i, -1, `${what}: ${JSON.stringify(step)} comes after the step before it`);
    from = i + step.length;
  }
};
type Sent = { readonly url: string; readonly method: string; readonly body: unknown };
/** A stand-in fetch: every request recorded, each answered in turn from the queue handed in — and every answer queued is asked for. */
async function standIn<T>(queue: readonly (readonly [number, unknown])[], run: () => Promise<T>): Promise<{ readonly result: T; readonly sent: readonly Sent[] }> {
  const g = globalThis as unknown as { fetch: unknown };
  const real = g.fetch;
  const sent: Sent[] = [];
  const left = [...queue];
  g.fetch = async (url: string, init?: RequestInit) => {
    sent.push({ url, method: init?.method ?? 'GET', body: init?.body === undefined ? null : JSON.parse(String(init.body)) });
    const next = left.shift();
    if (next === undefined) throw new Error(`no answer queued for ${url}`);
    return new Response(JSON.stringify(next[1]), { status: next[0], headers: { 'content-type': 'application/json' } });
  };
  try {
    const result = await run();
    assert.equal(left.length, 0, 'every queued answer was asked for');
    return { result, sent };
  } finally {
    g.fetch = real;
  }
}

// ── PART 0 — A PLAN CODED ON A BOOKS LINE IS REFUSED BY NAME ─────────────────

// ── X1 · THE DELETE COUNTS THE BOOKS LINES CODED TO THE PLAN (ruling 0.1, HARD GATE 3) ──

test('X1 the routine DELETE counts the Books lines coded to the plan inside the transaction that counts its links — any coded refuses 409 by name before the delete, nothing deleted; the ✕’s line says it in those words', async () => {
  // The words, typed whole — one line, and many.
  assert.equal(ROUTINE_CODED_ON_BOOKS_WORDS(1), 'this plan is coded on 1 line in Books — re-code it there first, or deactivate the plan on Expenses');
  assert.equal(ROUTINE_CODED_ON_BOOKS_WORDS(3), 'this plan is coded on 3 lines in Books — re-code them there first, or deactivate the plan on Expenses');
  assert.equal(routineHoldsLinksWords(2), 'this routine has 2 postings linked in Books — deactivate it instead (every record stays)', 'the links’ words stand');
  assert.match(comments(HOLD), /EDIT-02 \(Alex, 2026-11-28\) — A PLAN CODED ON A BOOKS LINE\./);
  // The route: the gates in their order, then ONE transaction — the lines, the links, the Books lines coded to the routine, the delete.
  const route = code(ROUTINE_ROUTE);
  assert.match(route, /import \{ ROUTINE_CODED_ON_BOOKS_WORDS, routineHoldsLinksWords, routineLinksWhere \} from '@\/lib\/operations\/linkHold';/);
  const del = bodyOf(route, 'DELETE');
  inOrder(del, [
    'const userEmail = await getVerifiedEmail();',
    "if (!userEmail) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });",
    'const existing = await loadAuthorizedRoutine(id, user.id);',
    "if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });",
    'let coded = 0;',
    'const linked = await prisma.$transaction(async (tx) => {',
    'const held = await tx.planned_item_links.count({ where: routineLinksWhere(user.id, id, lineIds) });',
    'if (held > 0) return held;',
    'coded = await tx.ledger_line_links.count({ where: { routine_id: id } });',
    'if (coded > 0) return 0;',
    'await tx.operations_routines.delete({ where: { id } });',
    'return 0;',
    '});',
    'if (linked > 0) return NextResponse.json({ error: routineHoldsLinksWords(linked) }, { status: 409 });',
    'if (coded > 0) return NextResponse.json({ error: ROUTINE_CODED_ON_BOOKS_WORDS(coded) }, { status: 409 });',
    'await writeAuditLog({',
  ], 'the routine DELETE');
  // Nothing deleted: the count and its return stand inside the transaction, before the one delete; the audit and the answer come after both refusals.
  const tx = del.slice(del.indexOf('const linked = await prisma.$transaction(async (tx) => {'), del.indexOf('if (linked > 0) return'));
  assert.ok(tx.indexOf('if (coded > 0) return 0;') < tx.indexOf('await tx.operations_routines.delete({ where: { id } });'), 'refused before the delete, in the same transaction');
  assert.equal((route.match(/operations_routines\.delete\(/g) ?? []).length, 1, 'one delete, inside the transaction');
  assert.equal((route.match(/ledger_line_links\./g) ?? []).length, 1, 'the Books lines are counted — and nothing else is done with them');
  assert.doesNotMatch(route, /ledger_line_links\.(delete|deleteMany|update|updateMany|create|upsert)\(/, 'never written here');
  // The ✕'s line: the route's refusal read the writers' one way — said in its words, nothing else sent.
  const run = await standIn([[409, { error: ROUTINE_CODED_ON_BOOKS_WORDS(2) }]], () => deleteRow({ kind: 'routine', routineId: 'lunch', question: 'delete this row — Lunch on 2027-03-04, with its record and its vendor?' }));
  assert.deepEqual([run.result, ...run.sent], [{ ok: false, words: ROUTINE_CODED_ON_BOOKS_WORDS(2) }, { url: '/api/operations/routines/lunch', method: 'DELETE', body: null }]);
});
