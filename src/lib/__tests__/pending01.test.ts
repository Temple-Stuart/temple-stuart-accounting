/**
 * PENDING-01 (Alex, 2026-11-11 12:40: "my bank trannies were not pulling … we need to get this working 100% today" ·
 * 16:25: "would be better to get the sync and data issues fixed") — A PENDING BANK ROW IS NEVER A POSTING'S SOURCE.
 *
 * Part 1 — a row the bank still lists as pending is marked and cannot be committed: one leaf
 * (src/lib/books/bankPending.ts) holds the rule and every word; the commit route refuses such a row by name; the
 * Categorize screen draws no tick box and no account select for one in the queue, marks it in both tables, and counts
 * the committed ones above the committed table.
 *
 * Hermetic. The leaf is driven directly. The route and the screen are read BY CONTENT, through code() — comments
 * stripped, so a sentence in a note can never satisfy a check: neither can be run here (the route needs a session and
 * a database, the screen a browser).
 *
 *   P1 the rule: pending at the bank ⇔ `pending` is true; which rows and which ids of a set may be committed, in order;
 *   P2 the words, as written — the chip, the queue's cell, the committed table's line, its button, the refusal;
 *   P3 the leaf is pure: it imports nothing, reads no clock and no environment;
 *   P4 the commit route refuses such a row per row — after the row is loaded, before the currency rule — pushes to
 *      errors and continues; it reads `pending` and types the words nowhere but through the leaf;
 *   P5 the screen takes every word from the leaf; in the queue such a row gets no tick box and no account select;
 *   P6 select-all, the batch bar's count and sum, the batch commit and the row commit never include one;
 *   P7 both tables carry the chip; the committed table's line counts them, its button shows only them and all again;
 *      a committed one stays tickable and Uncommit is as it was.
 *
 * Part 2 (the sync clears a pending row only when Plaid names it, and never a committed one) is proven where the
 * sync's tests live: arrivalsLand.test.ts, prismaDomainPlan.test.ts, syncLines01.test.ts.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  PENDING_AT_BANK_CELL, PENDING_AT_BANK_CHIP, SHOW_ALL_COMMITTED, SHOW_ONLY_PENDING_AT_BANK,
  committableIds, committableRows, committedStillPendingWords, isPendingAtBank, pendingCommitRefusal, rowsPendingAtBank,
} from '../books/bankPending';
import { code } from '../sourceText';

const LEAF = 'src/lib/books/bankPending.ts';
const ROUTE = 'src/app/api/transactions/commit-to-ledger/route.ts';
const SCREEN = 'src/components/dashboard/SpendingTab.tsx';

/** A bank row as the screen holds it — the two fields the rule reads. */
const row = (id: string, pending: boolean) => ({ id, pending, name: `Coffee ${id}` });
const QUEUE = [row('a', false), row('b', true), row('c', false), row('d', true)];

const count = (text: string, needle: string): number => text.split(needle).length - 1;
/** Where each needle sits in a text — every one present, and in the order given. */
function inOrder(text: string, needles: readonly string[], what: string): void {
  const at = needles.map((needle) => { const i = text.indexOf(needle); assert.ok(i > -1, `${what} holds ${JSON.stringify(needle)}`); return i; });
  assert.deepEqual(at, [...at].sort((x, y) => x - y), `${what}: in this order — ${needles.join(' → ')}`);
}

// ── P1 ───────────────────────────────────────────────────────────────────────

test('P1 the rule: a row is pending at the bank when its `pending` is true; the rows and the ids of a set that may be committed are the others, in the set\'s own order', () => {
  assert.equal(isPendingAtBank({ pending: true }), true);
  assert.equal(isPendingAtBank({ pending: false }), false);
  assert.deepEqual(committableRows(QUEUE).map((r) => r.id), ['a', 'c'], 'the rows the bank has posted');
  assert.deepEqual(rowsPendingAtBank(QUEUE).map((r) => r.id), ['b', 'd'], 'the rows the bank still lists as pending');
  assert.deepEqual([...committableRows(QUEUE), ...rowsPendingAtBank(QUEUE)].length, QUEUE.length, 'every row is one or the other');
  assert.equal(committableRows(QUEUE)[0], QUEUE[0], 'the rows themselves, not copies');
  // a selection: every id but a pending row's, in the selection's order
  assert.deepEqual(committableIds(['d', 'c', 'b', 'a'], QUEUE), ['c', 'a']);
  assert.deepEqual(committableIds(['b', 'd'], QUEUE), [], 'a selection of pending rows alone leaves nothing to commit');
  assert.deepEqual(committableIds(['a', 'gone'], QUEUE), ['a', 'gone'], 'an id the set holds no row for is not this rule\'s to judge — the commit route judges every row again');
  assert.deepEqual(committableIds([], QUEUE), []);
  // nothing pending: nothing is held back
  const posted = [row('x', false), row('y', false)];
  assert.deepEqual(committableRows(posted), posted);
  assert.deepEqual(rowsPendingAtBank(posted), []);
  assert.deepEqual(committableIds(['y', 'x'], posted), ['y', 'x']);
});

// ── P2 ───────────────────────────────────────────────────────────────────────

test('P2 the words, as written: the chip, the queue\'s cell, the committed table\'s line and its button, the refusal', () => {
  assert.equal(PENDING_AT_BANK_CHIP, 'PENDING AT BANK');
  assert.equal(PENDING_AT_BANK_CELL, 'pending at the bank — commit it once it posts');
  assert.equal(committedStillPendingWords(62), '62 committed rows are still pending at the bank');
  assert.equal(committedStillPendingWords(2), '2 committed rows are still pending at the bank');
  assert.equal(committedStillPendingWords(1), '1 committed row is still pending at the bank', 'one row is one row');
  assert.equal(SHOW_ONLY_PENDING_AT_BANK, 'Show only these');
  assert.equal(SHOW_ALL_COMMITTED, 'Show all');
  assert.equal(pendingCommitRefusal('STARBUCKS STORE 01234'), '"STARBUCKS STORE 01234" is still pending at the bank — commit it once the bank has posted it');
  assert.equal(pendingCommitRefusal(''), '"" is still pending at the bank — commit it once the bank has posted it', 'the row\'s own description, whatever it is');
});

// ── P3 ───────────────────────────────────────────────────────────────────────

test('P3 the leaf is pure: it imports nothing, reads no clock and no environment, and writes no figure', () => {
  const leaf = code(LEAF);
  assert.equal(/\bimport\b|\brequire\s*\(/.test(leaf), false, 'no import');
  assert.equal(/\bfetch\s*\(|process\.env|Date\.now\(|new Date\(|prisma|useState|useMemo/.test(leaf), false, 'no fetch, no env, no clock, no Prisma, no React');
  assert.equal(/\?\?\s*0|\|\|\s*0/.test(leaf), false, 'no figure is defaulted');
});

// ── P4 ───────────────────────────────────────────────────────────────────────

test('P4 the commit route refuses a row still pending at the bank by name, per row: after the row is loaded and before the currency rule; it pushes to errors and continues, and nothing posts for that row', () => {
  const route = code(ROUTE);
  assert.match(route, /import \{ isPendingAtBank, pendingCommitRefusal \} from '@\/lib\/books\/bankPending';/);
  inOrder(route, [
    'const plaidTxn = await prisma.transactions.findUnique({',
    "errors.push({ txnId, error: 'Transaction not found' });",
    'if (isPendingAtBank(plaidTxn)) {',
    'errors.push({ txnId, error: pendingCommitRefusal(plaidTxn.name) });',
    'const linkedAccount = plaidTxn.accounts;',
    'const currency = postingCurrencyRule(linkedAccount,',
    'const bankAccountCode = linkedAccount.accountCode;',
    'commitPlaidTransaction(prisma, {',
  ], 'the commit route');
  // the refusal as a whole: the leaf's rule, the leaf's words over the row's own description, into errors, on to the next row
  assert.match(route, /if \(isPendingAtBank\(plaidTxn\)\) \{\n\s+errors\.push\(\{ txnId, error: pendingCommitRefusal\(plaidTxn\.name\) \}\);\n\s+continue;\n\s+\}/);
  assert.ok(route.includes('description: plaidTxn.name,'), 'the description the refusal names is the one the posting would have carried');
  // it sits inside the per-row loop and its try — a refused row is one error among the batch's, like its siblings
  inOrder(route, ['for (const txnId of transactionIds) {', 'if (isPendingAtBank(plaidTxn)) {', "errors.push({ txnId, error: 'Transaction already committed' });", 'const status = errors.length > 0 && results.length === 0 ? 409 : 200;'], 'the commit route');
  // the rule and the words are the leaf's: the route reads `pending` nowhere itself and types no sentence of its own
  assert.equal(count(route, 'isPendingAtBank('), 1, 'asked once');
  assert.equal(/\.pending\b/.test(route), false, 'the route reads the flag through the leaf only');
  assert.equal(/pending at the bank|PENDING AT BANK|has posted it/.test(route), false, 'no word of the refusal is typed in the route');
});

// ── P5 ───────────────────────────────────────────────────────────────────────

test('P5 the screen takes every word from the leaf; in the queue a row still pending at the bank gets no tick box and no account select — the cell says so', () => {
  const screen = code(SCREEN);
  assert.match(screen, /import \{\n\s+PENDING_AT_BANK_CELL, PENDING_AT_BANK_CHIP, SHOW_ALL_COMMITTED, SHOW_ONLY_PENDING_AT_BANK,\n\s+committableIds, committableRows, committedStillPendingWords, isPendingAtBank, rowsPendingAtBank,\n\} from '@\/lib\/books\/bankPending';/);
  for (const words of [PENDING_AT_BANK_CHIP, PENDING_AT_BANK_CELL, 'still pending at the bank', SHOW_ONLY_PENDING_AT_BANK, SHOW_ALL_COMMITTED, 'has posted it']) {
    assert.equal(screen.includes(words), false, `the screen types ${JSON.stringify(words)} nowhere — it reads the leaf`);
  }
  // the row asks the leaf once, and reads the bank's flag nowhere itself
  assert.equal(count(screen, 'const pendingAtBank = isPendingAtBank(txn);'), 1);
  assert.equal(/\btxn\.pending\b|\bt\.pending\b|\br\.pending\b/.test(screen), false, 'the flag is read through the leaf only');
  // the tick box: the ONE row checkbox, not drawn in the queue for such a row
  assert.equal(count(screen, 'onChange={() => toggleOne(txn.id)}'), 1, 'one row tick box');
  assert.match(screen, /\{!\(variant === 'pending' && pendingAtBank\) && \(\n\s+<input type="checkbox" checked=\{isSelected\} onChange=\{\(\) => toggleOne\(txn\.id\)\} className="w-3 h-3 rounded" \/>\n\s+\)\}/);
  // the account select: the leaf's words stand where it would be; every other queue row keeps its select
  assert.match(screen, /\{variant === 'pending' && pendingAtBank \? \(\n\s+<span data-pending-at-bank-cell [^>]*>\{PENDING_AT_BANK_CELL\}<\/span>\n\s+\) : variant === 'pending' \? \(\n\s+<select\n/);
  assert.equal(count(screen, '{PENDING_AT_BANK_CELL}'), 1);
});

// ── P6 ───────────────────────────────────────────────────────────────────────

test('P6 select-all, the batch bar\'s count and sum, the batch commit and the row commit never include a row still pending at the bank', () => {
  const screen = code(SCREEN);
  // select-all: over the rows that can be ticked — in the queue, the leaf's committable rows
  assert.ok(screen.includes("const tickable = variant === 'pending' ? committableRows(rows) : rows;"));
  assert.ok(screen.includes('const allSelected = tickable.length > 0 && tickable.every(r => selected.has(r.id));'));
  assert.ok(screen.includes('tickable.forEach(r => next.add(r.id));') && screen.includes('tickable.forEach(r => next.delete(r.id));'));
  assert.equal(/\brows\.(forEach|every)\(/.test(screen), false, 'select-all walks no other list');
  // what the leaf gives the screen for that list: a queue of posted a, pending b, posted c, pending d
  assert.deepEqual(committableRows(QUEUE).map((r) => r.id), ['a', 'c'], 'select-all ticks a and c');

  // the batch: its selection is read through the leaf, once, and everything the batch states or sends reads that
  assert.match(screen, /const selectedToCommit = useMemo\(\n\s+\(\) => new Set\(committableIds\(Array\.from\(selectedPending\), transactions\)\),\n\s+\[selectedPending, transactions\],\n\s+\);/);
  assert.equal(count(screen, 'Array.from(selectedPending)'), 1, 'the raw selection is read in one place — the leaf\'s input');
  assert.ok(screen.includes("{selectedToCommit.size > 0 && activeTable === 'pending' && ("), 'the bar is drawn for a selection that may be committed');
  assert.ok(screen.includes("{selectedToCommit.size} txn{selectedToCommit.size !== 1 ? 's' : ''}"), 'the bar\'s count');
  assert.ok(screen.includes('if (!selectedToCommit.has(t.id)) continue;'), 'the bar\'s sum');
  const batch = screen.slice(screen.indexOf('const handleBatchCommit = async () => {'), screen.indexOf('const handleRowCommit = async () => {'));
  inOrder(batch, ['const ids = Array.from(selectedToCommit);', 'if (ids.length === 0) return;', "fetch('/api/transactions/commit-to-ledger', {", 'transactionIds: ids,'], 'the batch commit');
  assert.equal(/selectedPending\b/.test(batch.replace(/setSelectedPending/g, '')), false, 'the batch commit never reads the raw selection');
  // were a pending row's id ever in the selection, the leaf drops it
  assert.deepEqual(committableIds(['a', 'b', 'c'], QUEUE), ['a', 'c']);

  // the row commit: the per-row choices are read through the leaf too — the button's count and what is sent
  assert.match(screen, /const rowEntriesToCommit = useMemo\(\(\) => \{\n\s+const chosen = Object\.entries\(rowChanges\)\.filter\(\(\[, c\]\) => c\.coa && c\.coa !== '__NEW__'\);\n\s+const allowed = new Set\(committableIds\(chosen\.map\(\(\[id\]\) => id\), transactions\)\);\n\s+return chosen\.filter\(\(\[id\]\) => allowed\.has\(id\)\);\n\s+\}, \[rowChanges, transactions\]\);/);
  const rowCommit = screen.slice(screen.indexOf('const handleRowCommit = async () => {'), screen.indexOf('const handleUncommit = async () => {'));
  inOrder(rowCommit, ['const entries = rowEntriesToCommit;', 'if (entries.length === 0) return;', 'for (const [id, change] of entries) {', "fetch('/api/transactions/commit-to-ledger', {"], 'the row commit');
  assert.ok(screen.includes('const rowsWithCoa = rowEntriesToCommit.length;'), 'the button counts what would be sent');
  assert.equal(count(screen, 'Object.entries(rowChanges)'), 2, 'the per-row choices are read for the leaf, and by the new-category watcher — nowhere else');
  // both commit paths post to the one route, and only from those two handlers
  assert.equal(count(screen, "fetch('/api/transactions/commit-to-ledger', {"), 2);
});

// ── P7 ───────────────────────────────────────────────────────────────────────

test('P7 both tables carry the chip beside the description; above the committed table a line counts the committed rows still pending at the bank, with a button that shows only them and all again; they stay tickable and Uncommit is as it was', () => {
  const screen = code(SCREEN);
  // the chip: drawn for such a row whatever the table, before the description
  assert.match(screen, /\{pendingAtBank && \(\n\s+<span data-pending-at-bank-chip [^>]*>\{PENDING_AT_BANK_CHIP\}<\/span>\n\s+\)\}\n\s+\{txn\.name\}/);
  assert.equal(count(screen, '{PENDING_AT_BANK_CHIP}'), 1, 'one chip, in the row both tables draw');
  // the committed table's line
  assert.ok(screen.includes('const committedPendingAtBank = useMemo(() => rowsPendingAtBank(committedTransactions), [committedTransactions]);'), 'counted over every committed row, whatever the filters');
  assert.ok(screen.includes('const showingOnlyPendingAtBank = onlyPendingAtBank && committedPendingAtBank.length > 0;'), 'with none left the table shows all again');
  inOrder(screen, [
    "{activeTable === 'committed' && (",
    '{committedPendingAtBank.length > 0 && (',
    '<span>{committedStillPendingWords(committedPendingAtBank.length)}</span>',
    'onClick={() => setOnlyPendingAtBank(only => !only)}',
    '{showingOnlyPendingAtBank ? SHOW_ALL_COMMITTED : SHOW_ONLY_PENDING_AT_BANK}',
    'rows={committedRows}',
    'variant="committed"',
  ], 'the committed table');
  assert.ok(screen.includes('let filtered = applyFilters(showingOnlyPendingAtBank ? committedPendingAtBank : committedTransactions, committedFilters);'), 'the button narrows the table to those rows; the filters and the sort still apply');
  // what the leaf gives the line: two of four committed rows are still pending
  assert.equal(committedStillPendingWords(rowsPendingAtBank(QUEUE).length), '2 committed rows are still pending at the bank');
  // they stay tickable there (the committed table ticks every row), and Uncommit is as it was
  assert.ok(screen.includes("const tickable = variant === 'pending' ? committableRows(rows) : rows;"), 'in the committed table every row can be ticked');
  const uncommit = screen.slice(screen.indexOf('const handleUncommit = async () => {'), screen.indexOf('const handleCoaCreated = '));
  inOrder(uncommit, ['const ids = Array.from(selectedCommitted);', "fetch('/api/transactions/uncommit', {", 'body: JSON.stringify({ transactionIds: ids })'], 'Uncommit');
  assert.equal(/isPendingAtBank|committable|PendingAtBank/.test(uncommit), false, 'Uncommit asks nothing of the rule');
});
