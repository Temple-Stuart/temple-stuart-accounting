/**
 * PENDING-02 (Alex, 2026-11-11 12:08: "get bookkeeping full proof" · 16:25: "would be better to get the sync and data
 * issues fixed") — A POSTING WHOSE BANK ROW IS GONE IS LISTED, AND CAN BE REVERSED.
 *
 * Part 1 — the list: one pure leaf (src/lib/books/postingsWithNoBankRow.ts), one read
 * (src/lib/books/postingsWithNoBankRowRead.ts), GET /api/journal-entries/no-bank-row, and the panel at the top of the
 * General Ledger (src/components/books/PostingsWithNoBankRow.tsx).
 * Part 2 — the reversal: ONE named mode of the one reversal writer (src/lib/journal-entry-service.ts
 * reversePlaidTransaction, bankRowGone), POST /api/journal-entries/no-bank-row, and the panel's ticks, its one
 * question, its slices of 25 and its result.
 *
 * Hermetic. The leaf is run. The read is SQL, so it is held BY CONTENT (its five conditions, the same-user account
 * scope, nothing cut) and its fold is driven over the rows a made-up query answers. The writer is RUN over an
 * in-memory client built here (post01.test.ts's double is the model): it rolls a transaction back on a throw, the way
 * Postgres does, and keeps every write it was asked for. The route is held by content. The panel's view is drawn and
 * pressed over made-up answers; its read and its send are run under a stand-in fetch. No database, no network.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import * as React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
Object.assign(globalThis, { React });
import type { PrismaClient } from '@prisma/client';
import PostingsWithNoBankRow, { NoBankRowView, readNoBankRow, sendReversals, type NoBankRowRead, type NoBankRowViewProps, type ReversalOutcome } from '@/components/books/PostingsWithNoBankRow';
import { code, comments } from '../sourceText';
import { booksLaneImports } from '../books/booksLane';
import { FUNCTIONAL_CURRENCY_WORDS, functionalMoneyWords } from '../books/functionalCurrency';
import {
  BANK_ROW_EXISTS_WORDS, CANCEL_WORDS, COLUMN_WORDS, ENTRY_IDS_WORDS, HIDE_WORDS, NOT_FOUND_WORDS, NOT_FROM_THAT_BANK_ROW_WORDS, NO_BANK_ROW_ROUTE,
  REFRESH_WORDS, REVERSAL_FAILED_WORDS, REVERSAL_PREFIX, REVERSAL_SLICE, SHOW_WORDS, TICK_ALL_WORDS, WHAT_THEY_ARE_WORDS, countWords, entryIdsOf,
  noBankRowAnswerFrom, noBankRowAnswerOf, notADayWords, notAllAnsweredWords, notAskedWords, notJsonWords, questionWords, resultWords, reversalAnswerFrom,
  reverseWords, slicesOf, type NoBankRowAnswer, type PostingWithNoBankRow,
} from '../books/postingsWithNoBankRow';
import { readPostingsWithNoBankRow } from '../books/postingsWithNoBankRowRead';
import { ValidationError } from '../errors/ValidationError';
import { reversePlaidTransaction } from '../journal-entry-service';
import { PeriodClosedError } from '../period-close-guard';

const LEAF = 'src/lib/books/postingsWithNoBankRow.ts';
const READ = 'src/lib/books/postingsWithNoBankRowRead.ts';
const ROUTE = 'src/app/api/journal-entries/no-bank-row/route.ts';
const PANEL = 'src/components/books/PostingsWithNoBankRow.tsx';
const GL = 'src/components/dashboard/GeneralLedger.tsx';
const PIPE = 'src/components/home/BooksPipeline.tsx';
const WRITER = 'src/lib/journal-entry-service.ts';
const UNCOMMIT = 'src/app/api/transactions/uncommit/route.ts';
const TOOLS = 'src/lib/toolRegistry.ts';
const ROOT = process.cwd();

/** Every .ts / .tsx file under src, tests aside — repo-relative. */
const walk = (dir: string): string[] => readdirSync(dir).flatMap((n) => { const f = join(dir, n); return statSync(f).isDirectory() ? (n === '__tests__' || n === 'node_modules' ? [] : walk(f)) : /\.(ts|tsx)$/.test(n) ? [f] : []; });
const srcFiles = (): string[] => walk(resolve(ROOT, 'src')).map((abs) => abs.slice(ROOT.length + 1));

const count = (s: string, re: RegExp): number => (s.match(re) ?? []).length;

/** Any Prisma write, a raw statement that writes, or a transaction — what a read-only handler may not hold. */
const WRITES = /\.(create|createMany|update|updateMany|upsert|delete|deleteMany)\s*\(|\$executeRaw|\$transaction|\bINSERT\s+INTO\b|\bDELETE\s+FROM\b/;

/** One exported handler's own text, from its `export async function <METHOD>(` to its closing brace. */
function handlerOf(src: string, method: string): string {
  const at = src.indexOf(`export async function ${method}(`);
  assert.ok(at >= 0, `${method} is exported`);
  const open = src.indexOf('{', src.indexOf(')', at));
  let depth = 0;
  for (let i = open; i < src.length; i += 1) {
    if (src[i] === '{') depth += 1;
    else if (src[i] === '}') { depth -= 1; if (depth === 0) return src.slice(at, i + 1); }
  }
  throw new Error(`${method} never closes`);
}

/** The text a drawn panel shows: every text node, in order, tags and the renderer's own markers aside. */
const drawnWords = (html: string): string[] => html.replace(/<[^>]*>/g, '\n').split('\n').map((t) => t.trim()).filter((t) => t !== '');

const posting = (over: Partial<PostingWithNoBankRow> = {}): PostingWithNoBankRow => ({
  id: 'je_1', day: '2026-11-03', description: 'UBER TRIP', bankTransactionId: 'plaid_gone_1', book: 'Personal',
  debits: [{ code: 'P-6100', name: 'Transport' }], credits: [{ code: 'P-1000', name: 'Checking' }], cents: 1250, ...over,
});

/** Alex's psql of 2026-11-11, in shape: 46 postings that sum to 119137 cents. */
const FORTY_SIX: PostingWithNoBankRow[] = Array.from({ length: 46 }, (_, i) => posting({ id: `je_${i + 1}`, bankTransactionId: `plaid_gone_${i + 1}`, cents: i === 45 ? 2587 : 2590 }));

// ─── the leaf ────────────────────────────────────────────────────────────────

test('P1 the leaf: every word as the ruling wrote it, singular and plural; the slice is 25; a number that is not a count is refused by name; the file is pure', () => {
  assert.equal(countWords(1), '1 posting has no bank row');
  assert.equal(countWords(2), '2 postings have no bank row');
  assert.equal(countWords(46), '46 postings have no bank row');
  assert.equal(WHAT_THEY_ARE_WORDS, 'Each was posted from a bank row that is no longer in your account — most often a pending charge the bank replaced with its posted copy. Reverse one when its charge is posted from another row, or never went through.');
  assert.equal(SHOW_WORDS, 'Show them');
  assert.equal(HIDE_WORDS, 'Hide them');
  assert.equal(reverseWords(1), 'Reverse 1');
  assert.equal(reverseWords(46), 'Reverse 46');
  assert.equal(questionWords(1), 'Post 1 reversing entry dated today?');
  assert.equal(questionWords(2), 'Post 2 reversing entries dated today?');
  assert.equal(questionWords(46), 'Post 46 reversing entries dated today?');
  assert.equal(CANCEL_WORDS, 'Cancel');
  assert.equal(resultWords(46, 46), 'Reversed 46 of 46');
  assert.equal(resultWords(44, 46), 'Reversed 44 of 46');
  assert.equal(resultWords(0, 1), 'Reversed 0 of 1');
  assert.equal(REFRESH_WORDS, 'Refresh the books');
  assert.equal(REVERSAL_PREFIX, 'REVERSAL (no bank row): ');
  assert.equal(NOT_FROM_THAT_BANK_ROW_WORDS, 'this entry was not posted from that bank row — nothing was reversed');
  assert.equal(BANK_ROW_EXISTS_WORDS, 'this posting\'s bank row exists — uncommit it on the committed table');
  assert.deepEqual([...COLUMN_WORDS], ['Date', 'Description', 'Debit', 'Credit', 'Amount', 'Book']);
  assert.equal(NO_BANK_ROW_ROUTE, '/api/journal-entries/no-bank-row');
  assert.equal(`src/app${NO_BANK_ROW_ROUTE}/route.ts`, ROUTE, 'the route the panel reads is the route file this PR adds');
  assert.equal(notJsonWords(504), '/api/journal-entries/no-bank-row answered 504 and its answer was not JSON');
  assert.equal(notADayWords('je_9', '2026-02-31'), 'postings with no bank row: entry je_9\'s day "2026-02-31" is not a calendar day');

  // The slice: 25, in the order given, the last one holding what is left.
  assert.equal(REVERSAL_SLICE, 25);
  const ids = Array.from({ length: 60 }, (_, i) => `e${i}`);
  assert.deepEqual(slicesOf(ids).map((s) => s.length), [25, 25, 10]);
  assert.deepEqual(slicesOf(ids).flat(), ids, 'every id once, in order');
  assert.deepEqual(slicesOf(ids.slice(0, 25)).map((s) => s.length), [25]);
  assert.deepEqual(slicesOf(ids.slice(0, 26)).map((s) => s.length), [25, 1]);
  assert.deepEqual(slicesOf([]), []);

  // A number that is not a count is the caller's bug — refused by name, never printed.
  for (const bad of [1.5, -1, Number.NaN, Number.POSITIVE_INFINITY]) {
    assert.throws(() => countWords(bad), /postings with no bank row: the count .* is not a count/, `countWords(${bad})`);
    assert.throws(() => reverseWords(bad), /is not a count/);
    assert.throws(() => questionWords(bad), /is not a count/);
    assert.throws(() => resultWords(bad, 1), /is not a count/);
    assert.throws(() => resultWords(1, bad), /is not a count/);
  }

  // Pure: no import at all, no fetch, no clock, no environment, no database, no React.
  const l = code(LEAF);
  assert.doesNotMatch(l, /^\s*import\s/m, 'the leaf imports nothing');
  for (const impure of [/\bfetch\s*\(/, /process\.env/, /new Date\s*\(|Date\.now\s*\(/, /prisma|PrismaClient/, /from 'react'|from "react"/]) assert.doesNotMatch(l, impure, `the leaf is pure (${impure})`);
});

test('P1 the answer: the postings, their count and the sum of their cents — counted, never typed; an answer read back states every field or is refused by the field\'s name', () => {
  const two = [posting(), posting({ id: 'je_2', cents: 4999 })];
  assert.deepEqual(noBankRowAnswerOf(two), { postings: two, count: 2, sumCents: 6249 });
  assert.deepEqual(noBankRowAnswerOf([]), { postings: [], count: 0, sumCents: 0 });
  const all = noBankRowAnswerOf(FORTY_SIX);
  assert.equal(all.count, 46);
  assert.equal(all.sumCents, 119137);
  assert.equal(functionalMoneyWords(all.sumCents), '$1,191.37');
  // A figure that is not integer cents is a fault by name — never rounded.
  assert.throws(() => noBankRowAnswerOf([posting({ cents: 12.5 })]), { message: 'postings with no bank row: the amount of entry je_1 12.5 is not an integer number of cents' });
  assert.throws(() => noBankRowAnswerOf([posting({ cents: Number.NaN })]), /the amount of entry je_1 null is not an integer number of cents/);
  assert.throws(() => noBankRowAnswerOf([posting({ cents: Number.MAX_SAFE_INTEGER }), posting({ id: 'je_2', cents: 1 })]), /the sum .* is not an integer number of cents/);

  // Read back by the panel: the wire's own JSON, every field, or a fault that names what is missing.
  const wire: unknown = JSON.parse(JSON.stringify(noBankRowAnswerOf(two)));
  assert.deepEqual(noBankRowAnswerFrom(wire), noBankRowAnswerOf(two));
  const good = noBankRowAnswerOf(two);
  const row = (over: Record<string, unknown>) => ({ ...good, postings: [{ ...two[0], ...over }, two[1]] });
  assert.throws(() => noBankRowAnswerFrom(null), { message: 'postings with no bank row: the answer states no postings' });
  assert.throws(() => noBankRowAnswerFrom({ count: 0, sumCents: 0 }), { message: 'postings with no bank row: the answer states no postings' });
  assert.throws(() => noBankRowAnswerFrom(row({ id: undefined })), { message: 'postings with no bank row: the answer states no entry id' });
  assert.throws(() => noBankRowAnswerFrom(row({ day: undefined })), { message: 'postings with no bank row: the answer states no day for entry je_1' });
  assert.throws(() => noBankRowAnswerFrom(row({ description: undefined })), { message: 'postings with no bank row: the answer states no description for entry je_1' });
  assert.throws(() => noBankRowAnswerFrom(row({ bankTransactionId: '' })), { message: 'postings with no bank row: the answer states no bank transaction id for entry je_1' });
  assert.throws(() => noBankRowAnswerFrom(row({ book: null })), { message: 'postings with no bank row: the answer states no book for entry je_1' });
  assert.throws(() => noBankRowAnswerFrom(row({ debits: undefined })), { message: 'postings with no bank row: the answer states no debit accounts of entry je_1' });
  assert.throws(() => noBankRowAnswerFrom(row({ credits: [{ code: 'P-1000' }] })), { message: 'postings with no bank row: the answer states no account name among the credit accounts of entry je_1' });
  assert.throws(() => noBankRowAnswerFrom(row({ cents: '1250' })), { message: 'postings with no bank row: the amount of entry je_1 "1250" is not an integer number of cents' });
  // An entry's own description may be empty — it is the entry's text, stated; it is not refused.
  assert.equal(noBankRowAnswerFrom(row({ description: '' })).postings[0].description, '');
  // A count or a sum that disagrees with the rows it came with is refused: the panel prints what was counted.
  assert.throws(() => noBankRowAnswerFrom({ ...good, count: 3 }), { message: 'postings with no bank row: the answer counts 3 and carries 2' });
  assert.throws(() => noBankRowAnswerFrom({ ...good, sumCents: 6250 }), { message: 'postings with no bank row: the answer sums to 6250 cents and its rows to 6249' });
  assert.throws(() => noBankRowAnswerFrom({ postings: two }), /the answer's count undefined is not a count/);
});

// ─── the read ────────────────────────────────────────────────────────────────

type Line = { entry_id: string; day: string; description: string; bank_transaction_id: string; book: string; entry_type: string | null; cents: string | null; account_code: string | null; account_name: string | null };
const line = (over: Partial<Line> = {}): Line => ({
  entry_id: 'je_new', day: '2026-11-03', description: 'UBER TRIP', bank_transaction_id: 'plaid_gone_1', book: 'Personal',
  entry_type: 'D', cents: '1250', account_code: 'P-6100', account_name: 'Transport', ...over,
});
const OLD = { entry_id: 'je_old', day: '2026-10-20', description: 'COSTCO', bank_transaction_id: 'plaid_gone_2', book: 'Business' };

/** A stand-in for the database: it answers the one query with the lines it is given, and keeps what it was asked. */
function fakeDb(lines: Line[]) {
  const asked: Array<{ sql: string; values: unknown[] }> = [];
  const db = { $queryRaw: async (strings: TemplateStringsArray, ...values: unknown[]) => { asked.push({ sql: strings.join('?'), values }); return lines; } };
  return { asked, db: db as unknown as Parameters<typeof readPostingsWithNoBankRow>[0] };
}

test('P1 the read, by content: ONE query — the five conditions, and no bank row with that id on an account of the same user; the entry\'s book; nothing cut; it writes nothing', () => {
  const r = code(READ);
  // The caller's LIVE bank postings — the five conditions, as written.
  for (const condition of [
    'WHERE je."userId" = ${userId}',
    "AND je.source_type = 'plaid_txn'",
    'AND je.source_id IS NOT NULL',
    'AND je.is_reversal = false',
    'AND je.reversed_by_entry_id IS NULL',
  ]) assert.ok(r.includes(condition), `the read holds: ${condition}`);
  // …for which NO transactions row with that transactionId sits on an account of the same user.
  assert.match(r, /AND NOT EXISTS \(\s*SELECT 1\s+FROM transactions t\s+JOIN accounts a ON a\.id = t\."accountId"\s+WHERE t\."transactionId" = je\.source_id\s+AND a\."userId" = \$\{userId\}\s*\)/);
  assert.equal(count(r, /\$\{userId\}/g), 2, 'the caller, twice: the entries\' owner and the accounts\' owner (the driven test below shows the query takes no other value)');
  // One query, nothing fetched per row, never cut.
  assert.equal(count(r, /db\.\$queryRaw</g), 1, 'one query');
  assert.doesNotMatch(r, /\bLIMIT\b|\bOFFSET\b|\bFETCH\s+FIRST\b/i, 'the list is never cut');
  assert.doesNotMatch(r, /findMany|findFirst|findUnique/, 'nothing is fetched beside the one query');
  // What each row carries: the entry, its day as the date column\'s own text, the row it points at, the ENTRY\'s book, each line.
  assert.match(r, /to_char\(je\.date, 'YYYY-MM-DD'\) AS day/);
  assert.match(r, /je\.source_id AS bank_transaction_id/);
  assert.match(r, /e\.name AS book,[\s\S]*JOIN entities e ON e\.id = je\.entity_id/, 'the book is the ENTRY\'s');
  assert.match(r, /le\.amount::text AS cents/, 'bigint cents arrive as text');
  assert.match(r, /LEFT JOIN ledger_entries le ON le\.journal_entry_id = je\.id\s+LEFT JOIN chart_of_accounts coa ON coa\.id = le\.account_id/, 'an entry with no line is still listed');
  // Newest first.
  assert.match(r, /ORDER BY je\.date DESC, je\.created_at DESC, je\.id DESC,/);
  // It writes nothing.
  assert.doesNotMatch(r, WRITES);
  assert.doesNotMatch(r, /\bUPDATE\s+"?\w+"?\s+SET\b/i);
});

test('P1 the read, driven: the caller\'s id is the query\'s only value; the lines fold into one row per entry in the order the query gave them — debit and credit accounts, the sum of the debit lines; a line that is not what it says is a fault by name', async () => {
  const { asked, db } = fakeDb([
    line(),
    line({ entry_type: 'C', account_code: 'P-1000', account_name: 'Checking' }),
    // one entry split over two debit lines
    line({ ...OLD, cents: '4000', account_code: 'B-6200', account_name: 'Supplies' }),
    line({ ...OLD, cents: '999', account_code: 'B-6300', account_name: 'Meals' }),
    line({ ...OLD, entry_type: 'C', cents: '4999', account_code: 'B-1000', account_name: 'Business Checking' }),
    // an entry with no line at all — the LEFT join's one empty row
    line({ entry_id: 'je_bare', day: '2026-09-01', description: 'NO LINES', bank_transaction_id: 'plaid_gone_3', entry_type: null, cents: null, account_code: null, account_name: null }),
  ]);
  const rows = await readPostingsWithNoBankRow(db, 'u_1');
  assert.equal(asked.length, 1, 'one query');
  assert.deepEqual(asked[0].values, ['u_1', 'u_1'], 'the caller\'s id and nothing else: the entries\' owner, the accounts\' owner');
  assert.match(asked[0].sql, /WHERE je\."userId" = \?\s+AND je\.source_type = 'plaid_txn'/);
  assert.match(asked[0].sql, /AND a\."userId" = \?/);
  assert.deepEqual(rows, [
    { id: 'je_new', day: '2026-11-03', description: 'UBER TRIP', bankTransactionId: 'plaid_gone_1', book: 'Personal', debits: [{ code: 'P-6100', name: 'Transport' }], credits: [{ code: 'P-1000', name: 'Checking' }], cents: 1250 },
    { id: 'je_old', day: '2026-10-20', description: 'COSTCO', bankTransactionId: 'plaid_gone_2', book: 'Business', debits: [{ code: 'B-6200', name: 'Supplies' }, { code: 'B-6300', name: 'Meals' }], credits: [{ code: 'B-1000', name: 'Business Checking' }], cents: 4999 },
    { id: 'je_bare', day: '2026-09-01', description: 'NO LINES', bankTransactionId: 'plaid_gone_3', book: 'Personal', debits: [], credits: [], cents: 0 },
  ]);
  assert.deepEqual(noBankRowAnswerOf(rows).sumCents, 6249);
  // None: an empty list, not a fault.
  assert.deepEqual(await readPostingsWithNoBankRow(fakeDb([]).db, 'u_1'), []);
  // A line that is not what it says it is — a fault that names the entry; nothing is rounded, guessed or dropped.
  await assert.rejects(readPostingsWithNoBankRow(fakeDb([line({ entry_type: 'X' })]).db, 'u_1'), { message: 'postings with no bank row: entry je_new has a line whose side is "X", neither D nor C' });
  await assert.rejects(readPostingsWithNoBankRow(fakeDb([line({ cents: '12.5' })]).db, 'u_1'), { message: 'postings with no bank row: entry je_new has a line whose amount "12.5" is not an integer number of cents' });
  await assert.rejects(readPostingsWithNoBankRow(fakeDb([line({ cents: null })]).db, 'u_1'), { message: 'postings with no bank row: entry je_new has a line whose amount null is not an integer number of cents' });
  await assert.rejects(readPostingsWithNoBankRow(fakeDb([line({ cents: '9007199254740993' })]).db, 'u_1'), /is not an integer number of cents/);
  await assert.rejects(readPostingsWithNoBankRow(fakeDb([line({ cents: '' })]).db, 'u_1'), { message: 'postings with no bank row: entry je_new has a line whose amount "" is not an integer number of cents' });
  await assert.rejects(readPostingsWithNoBankRow(fakeDb([line({ cents: '1e3' })]).db, 'u_1'), /is not an integer number of cents/);
  await assert.rejects(readPostingsWithNoBankRow(fakeDb([line({ account_code: null })]).db, 'u_1'), { message: 'postings with no bank row: entry je_new has a line with no account' });
});

// ─── the route ───────────────────────────────────────────────────────────────

test('P1 the route: GET stands behind the house gate — the cookie, the user, the books tab, in that order — and only then the read, for user.id; it writes nothing and calls nothing outside', () => {
  const get = handlerOf(code(ROUTE), 'GET');
  let at = -1;
  for (const piece of [
    'const userEmail = await getVerifiedEmail();',
    'return NextResponse.json({ error: \'Unauthorized\' }, { status: 401 });',
    'const user = await prisma.users.findFirst({',
    'where: { email: { equals: userEmail, mode: \'insensitive\' } },',
    'return NextResponse.json({ error: \'User not found\' }, { status: 404 });',
    'const tabGate = await requireTabAccess(user.id, \'tab:books\');',
    'if (tabGate) return tabGate;',
    'return NextResponse.json(noBankRowAnswerOf(await readPostingsWithNoBankRow(prisma, user.id)));',
  ]) {
    const next = get.indexOf(piece, at + 1);
    assert.ok(next > at, `in the house order: ${piece}`);
    at = next;
  }
  assert.equal(count(get, /readPostingsWithNoBankRow\(/g), 1, 'the one read, once');
  assert.equal(count(get, /\bprisma\.\w+\.\w+\(/g), 1, 'the handler\'s only query of its own is the user\'s row');
  assert.doesNotMatch(get, WRITES, 'GET holds no write');
  assert.doesNotMatch(get, /\bfetch\s*\(/, 'no call outside');
  assert.match(get, /catch \(error: unknown\) \{\s*return failClosedResponse\('Postings with no bank row', 'The postings with no bank row could not be read', error\);/, 'a fault answers the fixed line');
  assert.doesNotMatch(get, /error\.message/, 'a thrown message never reaches the body');
});

// ─── the panel ───────────────────────────────────────────────────────────────

const readOf = (postings: PostingWithNoBankRow[]): NoBankRowRead => ({ state: 'read', answer: noBankRowAnswerOf(postings) });
const nothing = (): void => {};
/** The view's props: a list just read, the table closed, nothing ticked, no question, nothing running, no result. */
const viewProps = (over: Partial<NoBankRowViewProps> = {}): NoBankRowViewProps => ({
  read: readOf([]), open: false, ticked: new Set<string>(), asking: false, running: false, outcome: null,
  onToggle: nothing, onTick: nothing, onTickAll: nothing, onAsk: nothing, onCancel: nothing, onConfirm: nothing, onRefresh: nothing, ...over,
});
const draw = (over: Partial<NoBankRowViewProps>): string => renderToStaticMarkup(React.createElement(NoBankRowView, viewProps(over)));
const view = (read: NoBankRowRead, open = false): string => draw({ read, open });

test('P1 the panel, drawn: none → nothing; some → the count line with the sum, the unit line, the line under it and the button; opened → the table, a day through the one day formatter and every figure through the one formatter; failed → the reason in red, never an empty list', () => {
  // None, and not yet read: nothing is drawn — not a heading, not a zero.
  assert.equal(view(readOf([])), '');
  assert.equal(view({ state: 'reading' }), '');
  assert.equal(view(readOf([]), true), '');

  // Alex's 46: the count, their sum, the unit, the button — and the line under it. Closed: no table.
  const closed = view(readOf(FORTY_SIX));
  assert.deepEqual(drawnWords(closed), ['46 postings have no bank row', '$1,191.37', FUNCTIONAL_CURRENCY_WORDS, 'Show them', WHAT_THEY_ARE_WORDS]);
  assert.doesNotMatch(closed, /<table/);
  assert.match(closed, /<span class="[^"]*" data-functional-currency="true">All figures in USD<\/span>/, 'the unit line, as its siblings carry it');
  assert.match(closed, /<button type="button" aria-expanded="false"[^>]*>Show them<\/button>/);
  assert.deepEqual(drawnWords(view(readOf([posting()]))).slice(0, 2), ['1 posting has no bank row', '$12.50'], 'one: singular');

  // Opened: Date · Description · Debit · Credit · Amount · Book, then a row per posting.
  const two = [posting(), posting({ id: 'je_2', day: '2026-10-20', description: 'COSTCO', book: 'Business', cents: 4999, debits: [{ code: 'B-6200', name: 'Supplies' }, { code: 'B-6300', name: 'Meals' }], credits: [{ code: 'B-1000', name: 'Business Checking' }] })];
  const open = view(readOf(two), true);
  assert.deepEqual(drawnWords(open), [
    '2 postings have no bank row', '$62.49', FUNCTIONAL_CURRENCY_WORDS, 'Hide them', WHAT_THEY_ARE_WORDS,
    'Reverse 0',
    'Date', 'Description', 'Debit', 'Credit', 'Amount', 'Book',
    'Nov 3, 2026', 'UBER TRIP', 'P-6100', '- Transport', 'P-1000', '- Checking', '$12.50', 'Personal',
    'Oct 20, 2026', 'COSTCO', 'B-6200', '- Supplies', 'B-6300', '- Meals', 'B-1000', '- Business Checking', '$49.99', 'Business',
  ]);
  assert.equal(count(open, /<tr[^>]* data-no-bank-row-entry="/g), 2, 'a row per posting');
  assert.match(open, /<button type="button" aria-expanded="true"[^>]*>Hide them<\/button>/);
  assert.equal(count(view(readOf(FORTY_SIX), true), /<tr[^>]* data-no-bank-row-entry="/g), 46, 'the list is never cut');

  // A read that failed: the reason, in red, as an alert — and nothing that could pass for an empty list.
  const failed = view({ state: 'failed', reason: 'Tab not unlocked' }, true);
  assert.deepEqual(drawnWords(failed), ['Tab not unlocked']);
  assert.match(failed, /^<div class="[^"]*\btext-brand-red\b[^"]*" role="alert"[^>]*>Tab not unlocked<\/div>$/);

  // The panel itself draws nothing until its read comes back (the read is an effect: the first paint is empty).
  assert.equal(renderToStaticMarkup(React.createElement(PostingsWithNoBankRow, { onReload: () => {} })), '');
});

test('P1 the panel, by content: every word from the leaf, every figure through the formatter, none of the books currency law\'s eight shapes, React state only', () => {
  const p = code(PANEL);
  assert.match(p, /from '@\/lib\/books\/postingsWithNoBankRow';/, 'the words are the leaf\'s');
  for (const name of ['countWords(answer.count)', 'WHAT_THEY_ARE_WORDS', 'SHOW_WORDS', 'HIDE_WORDS', 'COLUMN_WORDS', 'NO_BANK_ROW_ROUTE']) assert.ok(p.includes(name), `the panel reads ${name}`);
  // No string the panel holds carries a word the leaf owns: the leaf is the one place they are written.
  const owned = [
    'has no bank row', 'have no bank row', WHAT_THEY_ARE_WORDS, SHOW_WORDS, HIDE_WORDS, 'Reverse', 'reversing entr', CANCEL_WORDS, REFRESH_WORDS,
    REVERSAL_PREFIX.trim(), NOT_FROM_THAT_BANK_ROW_WORDS, BANK_ROW_EXISTS_WORDS, NO_BANK_ROW_ROUTE, 'is not a calendar day', 'was not JSON', ...COLUMN_WORDS,
    TICK_ALL_WORDS, ENTRY_IDS_WORDS, NOT_FOUND_WORDS, REVERSAL_FAILED_WORDS, 'which was not asked', 'accounts for',
  ];
  const literals = [...p.matchAll(/(['"`])((?:\\.|(?!\1)[^\\])*)\1/g)].map((m) => m[2]);
  assert.ok(literals.length > 20, 'the panel\'s strings were read');
  for (const literal of literals) for (const word of owned) assert.ok(!literal.includes(word), `the panel types "${word}" (in ${JSON.stringify(literal.slice(0, 60))}) — the leaf writes it`);
  // The route's own reason on a failed read — the statements' idiom, imported, not rewritten.
  assert.match(p, /import \{ failedAnswerWords \} from '@\/components\/dashboard\/StatementScopeSelect';/);
  assert.match(p, /if \(!res\.ok\) throw new Error\(failedAnswerWords\(NO_BANK_ROW_ROUTE, res\.status, body\)\);/);
  // Every figure through the one formatter, with the unit line; a day through the one day formatter.
  assert.match(p, /import \{ FUNCTIONAL_CURRENCY_WORDS, functionalMoneyWords \} from '@\/lib\/books\/functionalCurrency';/);
  assert.match(p, /\{functionalMoneyWords\(answer\.sumCents\)\}/);
  assert.match(p, /\{functionalMoneyWords\(posting\.cents\)\}/);
  assert.match(p, /data-functional-currency>\{FUNCTIONAL_CURRENCY_WORDS\}</);
  assert.match(p, /import \{ calendarDay \} from '@\/lib\/plaid\/failLoud';/);
  assert.match(p, /const words = calendarDay\(posting\.day\);\s*if \(words === null\) throw new Error\(notADayWords\(posting\.id, posting\.day\)\);/, 'a day the formatter will not print is a fault by name');
  assert.doesNotMatch(p, /\/\s*100\b|\*\s*100\b|\.toFixed\(|toLocaleString|Math\.round\(/, 'no figure is divided, fixed or rounded here');
  // The law's eight shapes, verbatim (scripts/assert-tool-registry.ts FX_SHAPES) — the lane does not reach a component GeneralLedger imports, so this holds it.
  const SHAPES: ReadonlyArray<{ name: string; re: RegExp }> = [
    { name: '$${', re: /\$\$\{/ },
    { name: "'$' +", re: /['"]\$['"]\s*\+/ },
    { name: '>$<', re: />\$</ },
    { name: 'JSX text $ {', re: />\s*\$\s*\{/ },
    { name: "currency: 'USD'", re: /currency:\s*['"]USD['"]/ },
    { name: "'USD' literal", re: /['"]USD['"]/ },
    { name: 'Intl.NumberFormat', re: /Intl\.NumberFormat/ },
    { name: 'fmt*/format*Money|Dollars|Cents', re: /\b(?:fmt|format)\w*(?:Money|Dollars|Cents)\b/ },
  ];
  const law = code('scripts/assert-tool-registry.ts');
  for (const s of SHAPES) assert.ok(law.includes(`re: ${String(s.re)}`), `the law still holds the shape ${s.name} as written here`);
  assert.equal(count(law.slice(law.indexOf('const FX_SHAPES:'), law.indexOf('const FX_ALLOW:')), /\bre: \//g), SHAPES.length, 'the law holds eight shapes, and these are the eight');
  const hits: string[] = [];
  for (const [i, text] of p.split('\n').entries()) for (const s of SHAPES) if (s.re.test(text)) hits.push(`${PANEL}:${i + 1} ${s.name}: ${text.trim().slice(0, 80)}`);
  assert.deepEqual(hits, [], 'the panel holds none of the eight');
  // React state only.
  assert.doesNotMatch(p, /localStorage|sessionStorage|document\.cookie|indexedDB/);
});

test('P1 the panel\'s read, under a stand-in fetch: one GET of the route; the route\'s refusal is the reason; an answer that is not JSON, lacks a figure or carries a day that is no day is refused by name', async () => {
  const under = async (answer: { status: number; json: () => unknown }): Promise<{ urls: string[]; result: NoBankRowAnswer | Error }> => {
    const g = globalThis as unknown as { fetch: unknown };
    const saved = g.fetch;
    const urls: string[] = [];
    g.fetch = async (url: string) => { urls.push(url); return { ok: answer.status >= 200 && answer.status < 300, status: answer.status, json: async () => answer.json() }; };
    try { return { urls, result: await readNoBankRow().catch((e: Error) => e) }; } finally { g.fetch = saved; }
  };
  const two = [posting(), posting({ id: 'je_2', cents: 4999 })];
  const good = await under({ status: 200, json: () => JSON.parse(JSON.stringify(noBankRowAnswerOf(two))) });
  assert.deepEqual(good.urls, ['/api/journal-entries/no-bank-row'], 'one GET');
  assert.deepEqual(good.result, noBankRowAnswerOf(two));
  const none = await under({ status: 200, json: () => ({ postings: [], count: 0, sumCents: 0 }) });
  assert.deepEqual(none.result, { postings: [], count: 0, sumCents: 0 });

  const reason = (r: { result: NoBankRowAnswer | Error }): string => { assert.ok(r.result instanceof Error, 'the read threw'); return r.result.message; };
  assert.equal(reason(await under({ status: 403, json: () => ({ error: 'Tab not unlocked', tab: 'tab:books' }) })), 'Tab not unlocked');
  assert.equal(reason(await under({ status: 401, json: () => ({ error: 'Unauthorized' }) })), 'Unauthorized');
  assert.equal(reason(await under({ status: 500, json: () => ({ ok: false, stage: 'Postings with no bank row', error: 'The postings with no bank row could not be read' }) })), 'The postings with no bank row could not be read');
  assert.equal(reason(await under({ status: 500, json: () => ({}) })), '/api/journal-entries/no-bank-row answered 500 and gave no reason');
  assert.equal(reason(await under({ status: 504, json: () => { throw new SyntaxError('Unexpected token <'); } })), '/api/journal-entries/no-bank-row answered 504 and its answer was not JSON');
  assert.equal(reason(await under({ status: 200, json: () => ({ postings: [{ ...posting(), cents: undefined }], count: 1, sumCents: 1250 }) })), 'postings with no bank row: the amount of entry je_1 undefined is not an integer number of cents');
  assert.equal(reason(await under({ status: 200, json: () => noBankRowAnswerOf([posting({ day: '2026-02-31' })]) })), 'postings with no bank row: entry je_1\'s day "2026-02-31" is not a calendar day');
});

// ─── the mount ───────────────────────────────────────────────────────────────

test('P1 the mount: once, in GeneralLedger, as the first thing it draws, handed its own onReload; the import took a blank line, so the line PipelineDeck cites did not move; nothing else under src mounts it', () => {
  const g = code(GL);
  assert.equal(count(g, /<PostingsWithNoBankRow\b/g), 1, 'mounted once');
  assert.match(g, /return \(\s*<div className="bg-white overflow-hidden">\s*(?:\{\s*\}\s*)?<PostingsWithNoBankRow onReload=\{onReload\} \/>/, 'the first thing GeneralLedger draws, with its own onReload');
  assert.match(g, /export default function GeneralLedger\(\{ coaOptions, onReload, link, onLinkUsed \}: GeneralLedgerProps\)/, 'onReload is GeneralLedger\'s own prop');
  const lines = g.split('\n');
  assert.ok(lines[12].startsWith('import PostingsWithNoBankRow from \'@/components/books/PostingsWithNoBankRow\';'), 'the import sits on :13 — one of the two blank lines');
  assert.equal(lines[13].trim(), '', ':14 is still blank');
  assert.ok(lines[204].includes('const url = qs ? `/api/ledger?${qs}` : \'/api/ledger\';'), 'PipelineDeck.tsx cites :205 — unmoved');
  assert.ok(code('src/components/landing/PipelineDeck.tsx').includes('s12: '), 'the deck\'s s12 line stands');

  // Nothing else under src mounts or imports the panel.
  const mounting = srcFiles().filter((f) => f !== PANEL && /components\/books\/PostingsWithNoBankRow['"]/.test(code(f)));
  assert.deepEqual(mounting, [GL], 'GeneralLedger alone');
});

test('P1 BooksPipeline is not edited: its \'@/components/…\' imports are the twenty-one they were, in order — the panel is GeneralLedger\'s, not the pipeline\'s', () => {
  assert.deepEqual(booksLaneImports(code(PIPE)), [
    'src/components/bookkeeping/BookkeepingSection', 'src/components/dashboard/BankReconciliation', 'src/components/books/EntitySetup',
    'src/components/dashboard/SpendingTab', 'src/components/dashboard/InvestmentsTab', 'src/components/dashboard/JournalEntryEngine',
    'src/components/dashboard/GeneralLedger', 'src/components/shell/RoomLock', 'src/components/bookkeeping/TrialBalanceSection',
    'src/components/dashboard/AdjustingEntriesTab', 'src/components/dashboard/FinancialStatementsTab', 'src/components/dashboard/WashSaleReportTab',
    'src/components/dashboard/PeriodClose', 'src/components/dashboard/CloseBooksTab', 'src/components/dashboard/PositionReportTab',
    'src/components/dashboard/CPAExport', 'src/components/ui/StageStrip', 'src/components/bank/useBankConnection',
    'src/components/ui/SectionHeader', 'src/components/ui/ProofStrip', 'src/components/ManualTransactionForm',
  ]);
  const pipe = code(PIPE);
  assert.doesNotMatch(pipe, /PostingsWithNoBankRow|no-bank-row/, 'the pipeline names neither the panel nor its route');
  assert.match(pipe, /<GeneralLedger coaOptions=\{coaOptions\} onReload=\{reloadAll\} link=\{ledgerLink\} onLinkUsed=\{ledgerLinkUsed\} \/>/, 'it hands GeneralLedger its own reload, as it did');
});

// ═══ PART 2 — THE REVERSAL ═══════════════════════════════════════════════════

// ─── the writer, over an in-memory client ────────────────────────────────────

type Row = Record<string, unknown>;
interface Tables { journal_entries: Row[]; ledger_entries: Row[]; chart_of_accounts: Row[]; transactions: Row[]; closing_periods: Row[] }

/** The books, in memory. A transaction that throws is rolled back whole; every write that was asked for is kept by name. */
class Books {
  t: Tables = { journal_entries: [], ledger_entries: [], chart_of_accounts: [], transactions: [], closing_periods: [] };
  seq = 0;
  /** '<table>.<operation>' for every write the client was asked for, in order — rolled back or not. */
  writes: string[] = [];
  /** Every call on the bank rows' table, read or write. */
  bankCalls: string[] = [];
  client(): PrismaClient { return clientOf(this); }
}

function clientOf(db: Books): PrismaClient {
  const journal_entries = {
    async findUnique(args: Row) {
      const found = db.t.journal_entries.find((e) => e.id === (args.where as Row).id);
      if (!found) return null;
      if (!(args.include as Row | undefined)?.ledger_entries) return { ...found };
      return { ...found, ledger_entries: db.t.ledger_entries.filter((l) => l.journal_entry_id === found.id).map((l) => ({ ...l, account: db.t.chart_of_accounts.find((a) => a.id === l.account_id) })) };
    },
    // The port's read-back, after the commit: the entries it posted, by id.
    async findMany(args: Row) {
      const ids = ((args.where as Row).id as Row).in as unknown[];
      return db.t.journal_entries.filter((e) => ids.includes(e.id)).map((e) => ({ id: e.id }));
    },
    async create(args: Row) {
      db.writes.push('journal_entries.create');
      db.seq += 1;
      const row: Row = { ...(args.data as Row), id: `je_new_${db.seq}`, reversed_by_entry_id: null };
      db.t.journal_entries.push(row);
      return { id: row.id };
    },
    async update(args: Row) {
      db.writes.push('journal_entries.update');
      const row = db.t.journal_entries.find((e) => e.id === (args.where as Row).id);
      if (!row) throw new Error('journal entry not found');
      Object.assign(row, args.data as Row);
      return { ...row };
    },
  };
  const ledger_entries = {
    async createMany(args: Row) {
      db.writes.push('ledger_entries.createMany');
      for (const d of args.data as Row[]) db.t.ledger_entries.push({ ...d });
      return { count: (args.data as Row[]).length };
    },
  };
  const chart_of_accounts = {
    async update(args: Row) {
      db.writes.push('chart_of_accounts.update');
      const row = db.t.chart_of_accounts.find((a) => a.id === (args.where as Row).id);
      if (!row) throw new Error('account not found');
      row.settled_balance = (row.settled_balance as bigint) + (((args.data as Row).settled_balance as Row).increment as bigint);
      row.version = (row.version as number) + 1;
      return { ...row };
    },
  };
  const transactions = {
    async findUnique(args: Row) {
      db.bankCalls.push('findUnique');
      const row = db.t.transactions.find((x) => x.transactionId === (args.where as Row).transactionId);
      return row ? { id: row.id } : null;
    },
    async update(args: Row) {
      db.bankCalls.push('update');
      db.writes.push('transactions.update');
      const row = db.t.transactions.find((x) => x.transactionId === (args.where as Row).transactionId);
      // Prisma answers P2025 for an update whose row does not exist: it throws.
      if (!row) throw new Error('transaction not found');
      Object.assign(row, args.data as Row);
      return { ...row };
    },
  };
  const closing_periods = {
    async findFirst(args: Row) {
      const found = db.t.closing_periods.find((c) => Object.entries(args.where as Row).every(([k, v]) => c[k] === v));
      return found === undefined ? null : { ...found };
    },
  };
  const entities = { async findFirst() { return { name: 'Personal' }; } };
  const tx = { journal_entries, ledger_entries, chart_of_accounts, transactions, closing_periods, entities, async $executeRawUnsafe() { return 0; } };
  const client = {
    ...tx,
    async $transaction<T>(fn: (t: unknown) => Promise<T>): Promise<T> {
      const before = structuredClone(db.t);
      try { return await fn(tx); } catch (e) { db.t = before; throw e; }
    },
  };
  return client as unknown as PrismaClient;
}

const USER = 'u_1';
const ENTITY = 'e_1';
const BY = 'alex@x.test';

/** One posted bank charge — split over two expense lines, paid from checking — whose source_id is 'plaid_gone'. No bank row, unless one is given. */
function books(over: { entry?: Row; bankRow?: Row } = {}): Books {
  const db = new Books();
  db.t.chart_of_accounts.push(
    { id: 'acct_bank', userId: USER, entity_id: ENTITY, code: 'P-1000', balance_type: 'D', settled_balance: BigInt(-4999), version: 3 },
    { id: 'acct_supplies', userId: USER, entity_id: ENTITY, code: 'P-6200', balance_type: 'D', settled_balance: BigInt(4000), version: 1 },
    { id: 'acct_meals', userId: USER, entity_id: ENTITY, code: 'P-6300', balance_type: 'D', settled_balance: BigInt(999), version: 1 },
  );
  db.t.journal_entries.push({
    id: 'je_orig', userId: USER, entity_id: ENTITY, date: new Date('2026-10-20'), description: 'COSTCO', source_type: 'plaid_txn', source_id: 'plaid_gone',
    status: 'posted', is_reversal: false, reverses_entry_id: null, reversed_by_entry_id: null, request_id: 'b0-plaid_gone', created_by: BY, ...over.entry,
  });
  db.t.ledger_entries.push(
    { id: 'le_1', journal_entry_id: 'je_orig', account_id: 'acct_supplies', entry_type: 'D', amount: BigInt(4000) },
    { id: 'le_2', journal_entry_id: 'je_orig', account_id: 'acct_meals', entry_type: 'D', amount: BigInt(999) },
    { id: 'le_3', journal_entry_id: 'je_orig', account_id: 'acct_bank', entry_type: 'C', amount: BigInt(4999) },
  );
  if (over.bankRow) db.t.transactions.push(over.bankRow);
  return db;
}

const linesOf = (db: Books, entryId: unknown) => db.t.ledger_entries.filter((l) => l.journal_entry_id === entryId).map((l) => [l.account_id, l.entry_type, l.amount]);
const OPPOSITE_LINES = [['acct_supplies', 'C', BigInt(4000)], ['acct_meals', 'C', BigInt(999)], ['acct_bank', 'D', BigInt(4999)]];
const POSTED_WRITES = ['journal_entries.create', 'ledger_entries.createMany', 'chart_of_accounts.update', 'chart_of_accounts.update', 'chart_of_accounts.update', 'journal_entries.update'];

test('P2 the writer, bankRowGone: a posting with no bank row is reversed — ONE reversal with the opposite line for each line, source_type reversal, is_reversal true, reverses_entry_id set, the description prefixed, dated today; the original reversed and pointing at it; no transactions write', async () => {
  const db = books();
  const r = await reversePlaidTransaction(db.client(), { userId: USER, journalEntryId: 'je_orig', transactionId: 'plaid_gone', bankRowGone: true, requestId: 'b1-plaid_gone', createdBy: BY });
  assert.equal(r.originalId, 'je_orig');
  const reversals = db.t.journal_entries.filter((e) => e.id !== 'je_orig');
  assert.equal(reversals.length, 1, 'one reversal');
  const rev = reversals[0];
  assert.equal(rev.id, r.reversalId);
  assert.equal(rev.source_type, 'reversal');
  assert.equal(rev.source_id, null);
  assert.equal(rev.is_reversal, true);
  assert.equal(rev.reverses_entry_id, 'je_orig');
  assert.equal(rev.description, 'REVERSAL (no bank row): COSTCO', 'the leaf\'s prefix, then the original\'s description');
  assert.equal(rev.description, `${REVERSAL_PREFIX}COSTCO`);
  assert.equal(rev.status, 'posted');
  assert.equal(rev.userId, USER);
  assert.equal(rev.entity_id, ENTITY, 'in the original\'s book');
  assert.equal(rev.request_id, 'b1-plaid_gone');
  assert.equal(rev.created_by, BY);
  assert.equal(rev.document_reservation_id, null, 'the reversal carries no document');
  assert.equal(rev.document_money_event_id, null);
  assert.ok(rev.date instanceof Date && Math.abs(rev.date.getTime() - Date.now()) < 60_000, 'dated today');
  // The opposite line for each line, and the balances moved back by the same rule.
  assert.deepEqual(linesOf(db, rev.id), OPPOSITE_LINES);
  assert.deepEqual(db.t.chart_of_accounts.map((a) => [a.id, a.settled_balance]), [['acct_bank', BigInt(0)], ['acct_supplies', BigInt(0)], ['acct_meals', BigInt(0)]]);
  // The original: reversed, pointing at its reversal — and otherwise what it was. Nothing is deleted or edited.
  const orig = db.t.journal_entries.find((e) => e.id === 'je_orig');
  assert.ok(orig);
  assert.equal(orig.status, 'reversed');
  assert.equal(orig.reversed_by_entry_id, rev.id);
  assert.equal(orig.description, 'COSTCO');
  assert.equal(orig.source_type, 'plaid_txn');
  assert.equal(orig.source_id, 'plaid_gone');
  assert.deepEqual(linesOf(db, 'je_orig'), [['acct_supplies', 'D', BigInt(4000)], ['acct_meals', 'D', BigInt(999)], ['acct_bank', 'C', BigInt(4999)]], 'the original\'s lines stand');
  // No transactions write: the bank rows are read once — rule (ii) — and never written.
  assert.deepEqual(db.bankCalls, ['findUnique']);
  assert.deepEqual(db.writes, POSTED_WRITES, 'the reversal, its lines, the three balances, the original\'s mark — and no bank row');
  assert.deepEqual(db.t.transactions, []);
});

test('P2 the writer, bankRowGone, refused with nothing written: a bank row with that id exists · source_id is not the id handed in · the entry is not a plaid_txn · already reversed · a reversal · another user\'s entry · an unknown entry · a closed period', async () => {
  type Params = Parameters<typeof reversePlaidTransaction>[1];
  const MODE: Params = { userId: USER, journalEntryId: 'je_orig', transactionId: 'plaid_gone', bankRowGone: true, requestId: 'b1-plaid_gone', createdBy: BY };
  /** The call is refused as `check` says, and the books are what they were — no write was even asked for. */
  const refused = async (db: Books, params: Params, check: (err: unknown) => boolean): Promise<void> => {
    const before = structuredClone(db.t);
    await assert.rejects(reversePlaidTransaction(db.client(), params), (err: unknown) => { assert.ok(check(err), `refused as expected, got ${String(err)}`); return true; });
    assert.deepEqual(db.t, before, 'nothing was written');
    assert.deepEqual(db.writes, [], 'no write was asked for');
  };
  const validation = (message: string, status = 400) => (err: unknown): boolean => err instanceof ValidationError && err.message === message && err.status === status;

  // (ii) a bank row with that id exists — it is uncommitted on the committed table, where the reversal resets it.
  const here = books({ bankRow: { id: 't_1', transactionId: 'plaid_gone', accountCode: 'P-6200', review_status: 'committed' } });
  await refused(here, MODE, validation('this posting\'s bank row exists — uncommit it on the committed table'));
  assert.deepEqual(here.bankCalls, ['findUnique'], 'read, not written');
  assert.deepEqual(here.t.transactions, [{ id: 't_1', transactionId: 'plaid_gone', accountCode: 'P-6200', review_status: 'committed' }], 'the row is as it was');

  // (i) source_id is not the id handed in — refused before the bank rows are even read.
  const other = books();
  await refused(other, { ...MODE, transactionId: 'plaid_other' }, validation('this entry was not posted from that bank row — nothing was reversed'));
  assert.deepEqual(other.bankCalls, []);
  // (i) the entry is not a plaid_txn — a hand entry, an investment posting — though it carries that id.
  for (const source_type of ['manual', 'investment_txn', 'reclass']) {
    const notBank = books({ entry: { source_type } });
    await refused(notBank, MODE, validation(NOT_FROM_THAT_BANK_ROW_WORDS));
    assert.deepEqual(notBank.bankCalls, []);
  }
  // (i) an entry that points at nothing.
  await refused(books({ entry: { source_id: null } }), MODE, validation(NOT_FROM_THAT_BANK_ROW_WORDS));

  // The four that stand as they are, in both modes — each in its own words, each before the mode's two.
  const already = books({ entry: { status: 'reversed', reversed_by_entry_id: 'je_earlier' } });
  await refused(already, MODE, validation('Journal entry has already been reversed'));
  assert.deepEqual(already.bankCalls, []);
  const aReversal = books({ entry: { source_type: 'reversal', source_id: null, is_reversal: true, reverses_entry_id: 'je_0' } });
  await refused(aReversal, { ...MODE, transactionId: 'plaid_gone' }, validation('Cannot reverse a reversal entry'));
  assert.deepEqual(aReversal.bankCalls, []);
  await refused(books(), { ...MODE, userId: 'u_2' }, (err) => err instanceof Error && !(err instanceof ValidationError) && err.message === 'Journal entry does not belong to this user');
  await refused(books(), { ...MODE, journalEntryId: 'je_missing' }, validation('Journal entry not found: je_missing', 404));
  // The period check: a reversal is dated today, and today's period is closed for the entry's book.
  const closed = books();
  const today = new Date();
  closed.t.closing_periods.push({ userId: USER, entity_id: ENTITY, year: today.getFullYear(), month: today.getMonth() + 1, status: 'closed' });
  await refused(closed, MODE, (err) => err instanceof PeriodClosedError && /^Cannot post to closed period: .* for Personal\. Reopen the period first\.$/.test(err.message));
});

test('P2 the writer, without the mode: NOTHING changed — a posting whose bank row exists is reversed as "REVERSAL: …" and its row reset, the bank rows never read; a posting whose row is gone still cannot be reversed that way (the reset throws and everything rolls back)', async () => {
  const db = books({ entry: { source_id: 'plaid_here' }, bankRow: { id: 't_1', transactionId: 'plaid_here', accountCode: 'P-6200', review_status: 'committed' } });
  const r = await reversePlaidTransaction(db.client(), { userId: USER, journalEntryId: 'je_orig', transactionId: 'plaid_here', requestId: 'b1-plaid_here', createdBy: BY });
  const rev = db.t.journal_entries.find((e) => e.id === r.reversalId);
  const orig = db.t.journal_entries.find((e) => e.id === 'je_orig');
  assert.ok(rev && orig);
  assert.equal(rev.description, 'REVERSAL: COSTCO', 'the description it always had');
  assert.equal(rev.source_type, 'reversal');
  assert.equal(rev.source_id, null);
  assert.equal(rev.is_reversal, true);
  assert.equal(rev.reverses_entry_id, 'je_orig');
  assert.deepEqual(linesOf(db, rev.id), OPPOSITE_LINES);
  assert.equal(orig.status, 'reversed');
  assert.equal(orig.reversed_by_entry_id, rev.id);
  // The bank row reset — exactly as before — and no read of the bank rows: the mode's check does not run.
  assert.deepEqual(db.t.transactions, [{ id: 't_1', transactionId: 'plaid_here', accountCode: null, review_status: 'pending_review' }]);
  assert.deepEqual(db.bankCalls, ['update']);
  assert.deepEqual(db.writes, [...POSTED_WRITES, 'transactions.update']);

  // FIRST (c), shown: with no bank row and no mode, the reset throws and the whole reversal rolls back.
  const gone = books();
  const before = structuredClone(gone.t);
  await assert.rejects(reversePlaidTransaction(gone.client(), { userId: USER, journalEntryId: 'je_orig', transactionId: 'plaid_gone', requestId: 'b1-plaid_gone', createdBy: BY }), /transaction not found/);
  assert.deepEqual(gone.t, before, 'rolled back whole: no reversal, the original still live');
  assert.deepEqual(gone.bankCalls, ['update']);
});

test('P2 the writer, by content: ONE mode named on its params; its two refusals after the four standing checks and before the period check and the posting; the one port call — no second copy of the reversal\'s body, no new poster; the description by the mode; the reset not run in it; the registry\'s four lines re-cited', () => {
  const w = code(WRITER);
  assert.match(w, /import \{ BANK_ROW_EXISTS_WORDS, NOT_FROM_THAT_BANK_ROW_WORDS, REVERSAL_PREFIX \} from '@\/lib\/books\/postingsWithNoBankRow';/, 'the prefix and the two refusals are the leaf\'s');
  assert.match(w, /interface ReversePlaidTransactionParams \{\s*userId: string;\s*journalEntryId: string;\s*transactionId: string;\s*requestId\?: string;\s*createdBy\?: string;\s*bankRowGone\?: true;\s*\}/, 'one mode, named, on the params');
  const body = w.slice(w.indexOf('export async function reversePlaidTransaction('));
  // In order: the four that stand as they are · the mode's (i) and (ii) · the period check · the posting · the original's mark · the reset.
  let at = -1;
  for (const piece of [
    'const { userId, journalEntryId, transactionId, requestId, createdBy, bankRowGone } = params;',
    'const { result } = await postJournal(prisma, async (tx, post) => {',
    'throw new ValidationError(`Journal entry not found: ${journalEntryId}`, { status: 404 });',
    'if (original.userId !== userId) {',
    'throw new Error(\'Journal entry does not belong to this user\');',
    'if (original.reversed_by_entry_id) {',
    'throw new ValidationError(\'Journal entry has already been reversed\');',
    'if (original.is_reversal) {',
    'throw new ValidationError(\'Cannot reverse a reversal entry\');',
    'if (bankRowGone) {',
    'if (original.source_type !== \'plaid_txn\' || original.source_id !== transactionId) {',
    'throw new ValidationError(NOT_FROM_THAT_BANK_ROW_WORDS);',
    'const bankRow = await tx.transactions.findUnique({ where: { transactionId }, select: { id: true } });',
    'if (bankRow) {',
    'throw new ValidationError(BANK_ROW_EXISTS_WORDS);',
    'const reversalDate = new Date();',
    'await assertPeriodOpen(tx, userId, original.entity_id, reversalDate);',
    'const reversal = await post({',
    'description: bankRowGone ? `${REVERSAL_PREFIX}${original.description}` : `REVERSAL: ${original.description}`,',
    'source_type: \'reversal\',',
    'source_id: null,',
    'is_reversal: true,',
    'reverses_entry_id: original.id,',
    'await tx.journal_entries.update({',
    'reversed_by_entry_id: reversal.id,',
    'if (!bankRowGone) {',
    'await tx.transactions.update({',
    'review_status: \'pending_review\',',
    'return { originalId: original.id, reversalId: reversal.id };',
  ]) {
    const next = body.indexOf(piece, at + 1);
    assert.ok(next > at, `in order: ${piece}`);
    at = next;
  }
  // No second copy of the reversal's body, and no new poster: one transaction through the port, one post, one mark, one reset.
  assert.equal(count(body, /postJournal\(/g), 1);
  assert.equal(count(body, /await post\(\{/g), 1);
  assert.equal(count(body, /tx\.journal_entries\.update\(/g), 1);
  assert.equal(count(body, /tx\.transactions\.update\(/g), 1);
  assert.equal(count(body, /tx\.transactions\.findUnique\(/g), 1);
  assert.equal(count(body, /\bbankRowGone\b/g), 4, 'the mode is read four times: taken off the params, its two refusals, the description, the reset');
  assert.doesNotMatch(body, /document_(reservation|money_event)_id\s*:/, 'the reversal carries no document');
  assert.equal(count(w, /export async function /g), 2, 'the service exports the two writers it had — no new one');

  // Under src (tests aside) the mode is named in two files: the writer, and the one route that sets it.
  assert.deepEqual(srcFiles().filter((f) => /\bbankRowGone\b/.test(code(f))).sort(), [ROUTE, WRITER].sort());
  assert.doesNotMatch(code(UNCOMMIT), /bankRowGone/, 'the normal Uncommit does not set it');
  assert.match(code(UNCOMMIT), /transactionId: txn\.transactionId,\s*requestId: `\$\{batchId\}-\$\{txn\.transactionId\}`,\s*createdBy: userEmail,\s*\}\);/, 'and calls the writer as it did');

  // toolRegistry.ts:527 cites four lines of the writer; eleven lines were added above them, and each still names what it named.
  const lines = w.split('\n');
  assert.ok(lines[252].includes('const entry = await post({'), ':253 — the journal entry');
  assert.ok(lines[268].includes('{ account_id: debitAccount.id, entry_type: \'D\','), ':269 — its debit line');
  assert.ok(lines[269].includes('{ account_id: creditAccount.id, entry_type: \'C\','), ':270 — its credit line');
  assert.ok(lines[297].includes('await tx.transactions.update({') && lines[301].includes('review_status: \'committed\',') && lines[303].trim() === '});', ':298-304 — the transaction\'s update');
  const registry = code(TOOLS).split('\n')[526];
  assert.ok(registry.includes('src/lib/journal-entry-service.ts:253, :298-304 · :269, :270\','), 'toolRegistry.ts:527 cites them where they stand');
  assert.match(comments(TOOLS).split('\n')[526], /PENDING-02 \(2026-11-11\): re-cited again, what each names unchanged — .*:242 → :253, .*:258, :259 → :269, :270, .*:287-293 → :298-304$/, 'with its dated note');
});

// ─── the route's POST ────────────────────────────────────────────────────────

test('P2 the body\'s bounds: { entryIds } — 1 to 25 distinct non-empty strings, or the route answers 400 in the leaf\'s words', () => {
  assert.equal(ENTRY_IDS_WORDS, 'entryIds must be 1 to 25 distinct entry ids');
  assert.equal(NOT_FOUND_WORDS, 'Not found');
  assert.equal(REVERSAL_FAILED_WORDS, 'Reversal failed');
  const ids = Array.from({ length: 26 }, (_, i) => `e${i}`);
  assert.deepEqual(entryIdsOf({ entryIds: ['a'] }), ['a']);
  assert.deepEqual(entryIdsOf({ entryIds: ids.slice(0, 25) }), ids.slice(0, 25), 'twenty-five: the slice');
  assert.deepEqual(entryIdsOf({ entryIds: ['b', 'a'], other: 1 }), ['b', 'a'], 'the ids as given, in the order given');
  for (const [bad, why] of [
    [{ entryIds: [] }, 'none'],
    [{ entryIds: ids }, 'twenty-six'],
    [{ entryIds: ['a', 'a'] }, 'the same id twice'],
    [{ entryIds: ['a', ''] }, 'an empty id'],
    [{ entryIds: ['a', 7] }, 'an id that is not a string'],
    [{ entryIds: ['a', null] }, 'a null id'],
    [{ entryIds: 'a' }, 'not a list'],
    [{ entryIds: { 0: 'a', length: 1 } }, 'a list-like object'],
    [{}, 'no entryIds'],
    [{ transactionIds: ['a'] }, 'another key'],
    [null, 'null'],
    ['a', 'a string'],
    [['a'], 'a bare list'],
    [undefined, 'nothing'],
  ] as const) assert.equal(entryIdsOf(bad), null, `refused: ${why}`);
});

test('P2 the route\'s POST, by content: the gate first; then the body\'s bounds (400); then every id read by { id, userId } and the 404 before any reversal; then the writer, once per entry, with bankRowGone true and the entry\'s own source_id — never for an entry with none; refusals join errors and the loop goes on; no prisma write in the handler', () => {
  const r = code(ROUTE);
  const post = handlerOf(r, 'POST');
  let at = -1;
  for (const piece of [
    // the house gate — the same order as GET's
    'const userEmail = await getVerifiedEmail();',
    'return NextResponse.json({ error: \'Unauthorized\' }, { status: 401 });',
    'const user = await prisma.users.findFirst({',
    'where: { email: { equals: userEmail, mode: \'insensitive\' } },',
    'return NextResponse.json({ error: \'User not found\' }, { status: 404 });',
    'const tabGate = await requireTabAccess(user.id, \'tab:books\');',
    'if (tabGate) return tabGate;',
    // the body's bounds
    'try { body = await request.json(); } catch { return NextResponse.json({ error: ENTRY_IDS_WORDS }, { status: 400 }); }',
    'const entryIds = entryIdsOf(body);',
    'if (entryIds === null) {',
    'return NextResponse.json({ error: ENTRY_IDS_WORDS }, { status: 400 });',
    // the owner-scoped read, and the one 404 for the whole request
    'const owned = await prisma.journal_entries.findMany({',
    'where: { id: { in: entryIds }, userId: user.id },',
    'select: { id: true, source_id: true },',
    'if (owned.length !== entryIds.length) {',
    'return NextResponse.json({ error: NOT_FOUND_WORDS }, { status: 404 });',
    // one entry at a time
    'const batchId = randomUUID();',
    'for (const entry of owned) {',
    'if (entry.source_id === null) {',
    'errors.push({ entryId: entry.id, error: NOT_FROM_THAT_BANK_ROW_WORDS });',
    'continue;',
    'const result = await reversePlaidTransaction(prisma, {',
    'userId: user.id,',
    'journalEntryId: entry.id,',
    'transactionId: entry.source_id,',
    'bankRowGone: true,',
    'requestId: `${batchId}-${entry.source_id}`,',
    'createdBy: userEmail,',
    'results.push({ entryId: entry.id, reversalId: result.reversalId });',
    // a refusal joins the errors in its own words; a fault is logged and joins as the fixed line
    'if (error instanceof PeriodClosedError) {',
    'errors.push({ entryId: entry.id, error: error.message });',
    'continue;',
    'if (!(error instanceof ValidationError)) console.error(\'[No bank row] reversal failed:\', entry.id, summarizeError(error));',
    'errors.push({ entryId: entry.id, error: userFacingMessage(error, REVERSAL_FAILED_WORDS) });',
    // the answer
    'const answer: ReversalAnswer = { reversed: results.length, errorCount: errors.length, results, errors };',
    'return NextResponse.json(answer);',
  ]) {
    const next = post.indexOf(piece, at + 1);
    assert.ok(next > at, `in order: ${piece}`);
    at = next;
  }
  assert.equal(count(post, /reversePlaidTransaction\(/g), 1, 'the one writer, in one place');
  assert.equal(count(post, /\bprisma\.\w+\.\w+\(/g), 2, 'the handler\'s two queries of its own: the user\'s row, and the owner-scoped read');
  assert.doesNotMatch(post, /prisma\.journal_entries\.find(?:First|Unique)\(/, 'no entry is read any other way');
  assert.doesNotMatch(post, WRITES, 'POST holds no write of its own');
  assert.doesNotMatch(r, WRITES, 'nor does the file');
  assert.doesNotMatch(r, /postJournal|\$queryRaw|\$executeRaw/, 'it posts nothing itself and runs no raw statement: no poster is added');
  assert.doesNotMatch(post, /\bfetch\s*\(/, 'no call outside');
  assert.doesNotMatch(post, /status: 403/, 'another user\'s entry is a 404, never a 403 that would confirm it exists');
  assert.equal(count(post, /status: 404/g), 2, 'the user\'s row, and the one defensive 404');
  assert.match(post, /catch \(error: unknown\) \{\s*return failClosedResponse\('Postings with no bank row', 'The reversal could not be run', error\);/);
  assert.deepEqual([...r.matchAll(/export async function (\w+)\(/g)].map((m) => m[1]), ['GET', 'POST'], 'the route exports the read and the reversal, nothing else');
});

// ─── the panel's reverse flow ────────────────────────────────────────────────

type El = React.ReactElement<Record<string, unknown>>;
/** Every host element the view draws, in order — a function component is run, as React would. */
function elementsOf(node: unknown, out: El[] = []): El[] {
  if (Array.isArray(node)) { for (const child of node) elementsOf(child, out); return out; }
  if (!React.isValidElement(node)) return out;
  const el = node as El;
  if (typeof el.type === 'function') return elementsOf((el.type as (props: unknown) => unknown)(el.props), out);
  out.push(el);
  return elementsOf(el.props.children, out);
}
const having = (els: El[], attr: string): El[] => els.filter((e) => e.props[attr] !== undefined);
const TWO = [posting(), posting({ id: 'je_2', description: 'COSTCO', cents: 4999 })];

test('P2 the panel, drawn: a tick box on each row and one for all; Reverse <n> for the ticked rows; the first press shows the one question with Reverse <n> and Cancel; while a press runs every button and box stands down; then the result line, each refusal beside its row\'s description, and Refresh the books', () => {
  const open = (over: Partial<NoBankRowViewProps>): string => draw({ read: readOf(TWO), open: true, ...over });
  // Nothing ticked: a box per row, one for all, and a Reverse that cannot be pressed.
  const none = open({});
  assert.equal(count(none, /<input type="checkbox"[^>]* data-no-bank-row-tick="/g), 2, 'a tick box on each row');
  assert.equal(count(none, /<input type="checkbox" aria-label="All"[^>]* data-no-bank-row-tick-all="true"/g), 1, 'and one for all');
  assert.match(none, /<button type="button" disabled=""[^>]* data-no-bank-row-ask="true">Reverse 0<\/button>/);
  assert.doesNotMatch(none, /checked=""/);
  assert.doesNotMatch(none, /data-no-bank-row-question|data-no-bank-row-confirm|data-no-bank-row-cancel|data-no-bank-row-result/);
  // One ticked: Reverse 1 — and still no question. Nothing has been asked, nothing can be sent.
  const one = open({ ticked: new Set(['je_2']) });
  assert.match(one, /<button type="button" class="[^"]*" data-no-bank-row-ask="true">Reverse 1<\/button>/);
  assert.equal(count(one, /checked=""/g), 1, 'the row\'s box, and not the one for all');
  assert.doesNotMatch(one, /data-no-bank-row-question|data-no-bank-row-confirm/);
  // Both ticked: the one for all is ticked too.
  const both = open({ ticked: new Set(['je_1', 'je_2']) });
  assert.equal(count(both, /checked=""/g), 3);
  assert.match(both, /data-no-bank-row-ask="true">Reverse 2<\/button>/);
  // After the first press: the one question, Reverse <n> and Cancel — and the first button is gone.
  const asking = open({ ticked: new Set(['je_1', 'je_2']), asking: true });
  assert.deepEqual(drawnWords(asking).slice(5, 8), ['Post 2 reversing entries dated today?', 'Reverse 2', 'Cancel']);
  assert.match(asking, /<span data-no-bank-row-question="true">Post 2 reversing entries dated today\?<\/span><button type="button" class="[^"]*" data-no-bank-row-confirm="true">Reverse 2<\/button><button type="button" class="[^"]*" data-no-bank-row-cancel="true">Cancel<\/button>/);
  assert.doesNotMatch(asking, /data-no-bank-row-ask/);
  assert.deepEqual(drawnWords(open({ ticked: new Set(['je_1']), asking: true })).slice(5, 8), ['Post 1 reversing entry dated today?', 'Reverse 1', 'Cancel'], 'one: singular');
  // While a press is running: every button and every box stands down.
  const running = open({ ticked: new Set(['je_1']), running: true, outcome: { asked: 1, reversed: 1, refusals: [], stopped: null } });
  const controls = [...running.matchAll(/<(?:button|input)\b[^>]*>/g)].map((m) => m[0]);
  assert.equal(controls.length, 6, 'refresh, show/hide, reverse, the one for all, two rows');
  for (const control of controls) assert.match(control, / disabled=""/, `stands down: ${control.slice(0, 80)}`);

  // The result: the line, each refusal beside its row's description, the reason a request was not OK — and Refresh the books.
  const outcome: ReversalOutcome = {
    asked: 46, reversed: 44, stopped: null,
    refusals: [
      { entryId: 'je_3', description: 'UBER TRIP', error: BANK_ROW_EXISTS_WORDS },
      { entryId: 'je_7', description: 'COSTCO', error: 'Cannot post to closed period: November 2026 for Personal. Reopen the period first.' },
    ],
  };
  const result = draw({ read: readOf(TWO), outcome });
  assert.deepEqual(drawnWords(result), [
    'Reversed 44 of 46', 'Refresh the books',
    'UBER TRIP', 'this posting&#x27;s bank row exists — uncommit it on the committed table',
    'COSTCO', 'Cannot post to closed period: November 2026 for Personal. Reopen the period first.',
    '2 postings have no bank row', '$62.49', FUNCTIONAL_CURRENCY_WORDS, 'Show them', WHAT_THEY_ARE_WORDS,
  ]);
  assert.equal(count(result, /<li [^>]*data-no-bank-row-refusal="/g), 2);
  // All of them reversed and the list read again as empty: the result stays on screen — it is not swallowed by "none".
  const all = draw({ read: readOf([]), outcome: { asked: 46, reversed: 46, refusals: [], stopped: null } });
  assert.deepEqual(drawnWords(all), ['Reversed 46 of 46', 'Refresh the books']);
  // A request that was not OK: its reason, in red, as an alert — beside what was reversed before it.
  const stopped = draw({ read: readOf(TWO), outcome: { asked: 60, reversed: 25, refusals: [], stopped: 'Not found' } });
  assert.deepEqual(drawnWords(stopped).slice(0, 3), ['Reversed 25 of 60', 'Refresh the books', 'Not found']);
  assert.match(stopped, /<div class="[^"]*\btext-brand-red\b[^"]*" role="alert" data-no-bank-row-stopped="true">Not found<\/div>/);
  // The list could not be read again after a send: the result AND the reason — never an empty list in its place.
  const unread = draw({ read: { state: 'failed', reason: 'Tab not unlocked' }, outcome: { asked: 2, reversed: 2, refusals: [], stopped: null } });
  assert.deepEqual(drawnWords(unread), ['Reversed 2 of 2', 'Refresh the books', 'Tab not unlocked']);
  assert.match(unread, /role="alert" data-no-bank-row-failed="true">Tab not unlocked<\/div>/);
});

test('P2 the panel, pressed: the first Reverse only ASKS — nothing is sent before the second press; Cancel, a tick, the one for all, Show/Hide and Refresh each call their own handler and no other', () => {
  const calls: string[] = [];
  const spies: Partial<NoBankRowViewProps> = {
    onToggle: () => { calls.push('toggle'); }, onTick: (id) => { calls.push(`tick:${id}`); }, onTickAll: () => { calls.push('tickAll'); },
    onAsk: () => { calls.push('ask'); }, onCancel: () => { calls.push('cancel'); }, onConfirm: () => { calls.push('confirm'); }, onRefresh: () => { calls.push('refresh'); },
  };
  const press = (els: El[], attr: string, handler: 'onClick' | 'onChange'): void => {
    const found = having(els, attr);
    assert.equal(found.length, 1, `one ${attr}`);
    (found[0].props[handler] as () => void)();
  };
  // Not yet asked: the only Reverse on screen asks. There is no control that confirms.
  const before = elementsOf(NoBankRowView(viewProps({ ...spies, read: readOf(TWO), open: true, ticked: new Set(['je_1', 'je_2']) })));
  assert.equal(having(before, 'data-no-bank-row-confirm').length, 0, 'nothing on screen can send');
  press(before, 'data-no-bank-row-ask', 'onClick');
  assert.deepEqual(calls, ['ask'], 'the first press asks — it does not confirm');
  // Asked: the second press confirms; Cancel cancels.
  const asked = elementsOf(NoBankRowView(viewProps({ ...spies, read: readOf(TWO), open: true, ticked: new Set(['je_1', 'je_2']), asking: true })));
  assert.equal(having(asked, 'data-no-bank-row-ask').length, 0);
  press(asked, 'data-no-bank-row-cancel', 'onClick');
  press(asked, 'data-no-bank-row-confirm', 'onClick');
  assert.deepEqual(calls, ['ask', 'cancel', 'confirm']);
  // The boxes, the toggle, the refresh.
  calls.length = 0;
  const drawn = elementsOf(NoBankRowView(viewProps({ ...spies, read: readOf(TWO), open: true, outcome: { asked: 1, reversed: 1, refusals: [], stopped: null } })));
  const boxes = having(drawn, 'data-no-bank-row-tick');
  assert.deepEqual(boxes.map((b) => b.props['data-no-bank-row-tick']), ['je_1', 'je_2']);
  assert.deepEqual(boxes.map((b) => b.props['aria-label']), ['UBER TRIP', 'COSTCO'], 'each box is labelled by its row\'s own description');
  (boxes[1].props.onChange as () => void)();
  press(drawn, 'data-no-bank-row-tick-all', 'onChange');
  press(drawn, 'data-no-bank-row-toggle', 'onClick');
  press(drawn, 'data-no-bank-row-refresh', 'onClick');
  assert.deepEqual(calls, ['tick:je_2', 'tickAll', 'toggle', 'refresh']);

  // And by content: the send has ONE caller — the second press — and the first press sets a flag and nothing else.
  const p = code(PANEL);
  assert.equal(count(p, /\bsendReversals\(/g), 2, 'its definition, and one call');
  const confirm = p.slice(p.indexOf('const confirm = (): void => {'), p.indexOf('return (\n    <NoBankRowView'));
  assert.ok(confirm.includes('void sendReversals(sending)'), 'the one call is the second press\'s');
  assert.match(confirm, /const sending = postings\.filter\(\(posting\) => ticked\.has\(posting\.id\)\);\s*if \(running \|\| !asking \|\| sending\.length === 0\) return;/, 'and it sends only when the question was on screen');
  assert.match(confirm, /\.then\(\(sent\) => \{\s*if \(!alive\.current\) return undefined;\s*setOutcome\(sent\);\s*setTicked\(new Set\(\)\);\s*return load\(\);\s*\}\)\s*\.finally\(\(\) => \{ if \(alive\.current\) setRunning\(false\); \}\);/, 'then the result, the ticks cleared, its own list read again');
  assert.match(p, /onAsk=\{\(\) => setAsking\(true\)\}/, 'the first press: a flag');
  assert.match(p, /onCancel=\{\(\) => setAsking\(false\)\}/);
  assert.match(p, /onConfirm=\{confirm\}/);
  assert.match(p, /onRefresh=\{\(\) => \{ setOutcome\(null\); onReload\(\); \}\}/, 'Refresh the books calls GeneralLedger\'s own onReload — the result stays until that press');
  assert.equal(count(p, /\bfetch\(/g), 2, 'two requests in the file: the read\'s GET and the send\'s POST');
  assert.equal(count(p, /method: 'POST'/g), 1);
  assert.equal(count(p, /setOutcome\(null\)/g), 1, 'nothing else clears the result');
});

test('P2 the send, under a stand-in fetch: the ticked ids in slices of 25, ONE REQUEST AT A TIME, stopping at the first request that is not OK and reporting its reason; refusals come back beside their rows\' descriptions; an answer that does not account for what was asked stops it by name', async () => {
  type Answer = { status: number; json: () => unknown };
  const sixty = Array.from({ length: 60 }, (_, i) => posting({ id: `je_${i + 1}`, description: `ROW ${i + 1}` }));
  const allReversed = (ids: string[]): Answer => ({ status: 200, json: () => ({ reversed: ids.length, errorCount: 0, results: ids.map((id) => ({ entryId: id, reversalId: `rev_${id}` })), errors: [] }) });
  const under = async (answerFor: (ids: string[], nth: number) => Answer | Error, ticked: PostingWithNoBankRow[] = sixty) => {
    const g = globalThis as unknown as { fetch: unknown };
    const saved = g.fetch;
    const sent: Array<{ url: string; method: unknown; contentType: unknown; ids: string[] }> = [];
    let inFlight = 0;
    let most = 0;
    g.fetch = async (url: string, init: { method?: string; headers?: Record<string, string>; body: string }) => {
      inFlight += 1;
      most = Math.max(most, inFlight);
      const ids = (JSON.parse(init.body) as { entryIds: string[] }).entryIds;
      sent.push({ url, method: init.method, contentType: init.headers?.['Content-Type'], ids });
      // A turn of the loop: a request sent before this one was answered would show as two in flight.
      await new Promise((turn) => setImmediate(turn));
      const answer = answerFor(ids, sent.length);
      inFlight -= 1;
      if (answer instanceof Error) throw answer;
      return { ok: answer.status >= 200 && answer.status < 300, status: answer.status, json: async () => answer.json() };
    };
    try {
      const outcome = await sendReversals(ticked);
      return { sent, most, outcome };
    } finally { g.fetch = saved; }
  };

  // Sixty ticked, every request OK: three requests of 25, 25 and 10, in the order ticked, one after another.
  const all = await under(allReversed);
  assert.deepEqual(all.sent.map((s) => s.ids.length), [25, 25, 10]);
  assert.deepEqual(all.sent.flatMap((s) => s.ids), sixty.map((p) => p.id), 'every ticked id once, in order');
  assert.ok(all.sent.every((s) => s.url === '/api/journal-entries/no-bank-row' && s.method === 'POST' && s.contentType === 'application/json'));
  assert.equal(all.most, 1, 'never two requests in flight');
  assert.deepEqual(all.outcome, { asked: 60, reversed: 60, refusals: [], stopped: null });
  assert.equal(resultWords(all.outcome.reversed, all.outcome.asked), 'Reversed 60 of 60');

  // The second request is not OK: it stops there — the third is never sent — and prints that reason.
  const second = await under((ids, nth) => (nth === 2 ? { status: 404, json: () => ({ error: 'Not found' }) } : allReversed(ids)));
  assert.deepEqual(second.sent.map((s) => s.ids.length), [25, 25], 'the third slice was not sent');
  assert.deepEqual(second.outcome, { asked: 60, reversed: 25, refusals: [], stopped: 'Not found' });
  // The first is not OK: nothing after it.
  const first = await under(() => ({ status: 403, json: () => ({ error: 'Tab not unlocked' }) }));
  assert.equal(first.sent.length, 1);
  assert.deepEqual(first.outcome, { asked: 60, reversed: 0, refusals: [], stopped: 'Tab not unlocked' });
  // Not JSON, no reason given, a request that never arrived: each stops it, each by name.
  assert.equal((await under(() => ({ status: 502, json: () => { throw new SyntaxError('Unexpected token <'); } }))).outcome.stopped, notJsonWords(502));
  assert.equal((await under(() => ({ status: 500, json: () => ({}) }))).outcome.stopped, '/api/journal-entries/no-bank-row answered 500 and gave no reason');
  const offline = await under((ids, nth) => (nth === 3 ? new TypeError('Failed to fetch') : allReversed(ids)));
  assert.deepEqual(offline.outcome, { asked: 60, reversed: 50, refusals: [], stopped: 'Failed to fetch' });

  // Refusals inside an OK answer: the loop goes on, and each comes back beside its row's description.
  const refusing = await under((ids, nth) => (nth !== 1 ? allReversed(ids) : {
    status: 200,
    json: () => ({
      reversed: 23, errorCount: 2,
      results: ids.filter((id) => id !== 'je_3' && id !== 'je_7').map((id) => ({ entryId: id, reversalId: `rev_${id}` })),
      errors: [{ entryId: 'je_3', error: BANK_ROW_EXISTS_WORDS }, { entryId: 'je_7', error: 'Cannot post to closed period: November 2026 for Personal. Reopen the period first.' }],
    }),
  }));
  assert.equal(refusing.sent.length, 3, 'a refusal does not stop the send');
  assert.deepEqual(refusing.outcome, {
    asked: 60, reversed: 58, stopped: null,
    refusals: [
      { entryId: 'je_3', description: 'ROW 3', error: BANK_ROW_EXISTS_WORDS },
      { entryId: 'je_7', description: 'ROW 7', error: 'Cannot post to closed period: November 2026 for Personal. Reopen the period first.' },
    ],
  });

  // An answer that does not account for what was asked — the result line would be a guess, so it stops by name.
  const short = await under((ids) => ({ status: 200, json: () => ({ reversed: 24, errorCount: 0, results: ids.slice(1).map((id) => ({ entryId: id, reversalId: `rev_${id}` })), errors: [] }) }));
  assert.equal(short.sent.length, 1);
  assert.equal(short.outcome.stopped, notAllAnsweredWords(24, 25));
  assert.equal(short.outcome.stopped, 'postings with no bank row: the reversal\'s answer accounts for 24 of the 25 entries asked');
  const stranger = await under((ids) => ({ status: 200, json: () => ({ reversed: 24, errorCount: 1, results: ids.slice(1).map((id) => ({ entryId: id, reversalId: `rev_${id}` })), errors: [{ entryId: 'je_elsewhere', error: 'x' }] }) }));
  assert.equal(stranger.outcome.stopped, notAskedWords('je_elsewhere'));
  assert.equal(stranger.outcome.stopped, 'postings with no bank row: the reversal\'s answer names entry je_elsewhere, which was not asked');
  const shapeless = await under(() => ({ status: 200, json: () => ({ success: true }) }));
  assert.equal(shapeless.outcome.stopped, 'postings with no bank row: the reversal\'s answer states no results');

  // Nothing ticked: no request at all.
  const empty = await under(allReversed, []);
  assert.equal(empty.sent.length, 0);
  assert.deepEqual(empty.outcome, { asked: 0, reversed: 0, refusals: [], stopped: null });

  // The POST's answer, read back by the leaf: every field, or a fault by name.
  const good = { reversed: 1, errorCount: 1, results: [{ entryId: 'a', reversalId: 'r' }], errors: [{ entryId: 'b', error: 'no' }] };
  assert.deepEqual(reversalAnswerFrom(JSON.parse(JSON.stringify(good))), good);
  assert.throws(() => reversalAnswerFrom({ ...good, errors: undefined }), { message: 'postings with no bank row: the reversal\'s answer states no errors' });
  assert.throws(() => reversalAnswerFrom({ ...good, results: [{ entryId: 'a' }] }), { message: 'postings with no bank row: the answer states no reversalId among the reversal\'s results' });
  assert.throws(() => reversalAnswerFrom({ ...good, errors: [{ entryId: 'b', error: '' }] }), { message: 'postings with no bank row: the answer states no error among the reversal\'s errors' });
  assert.throws(() => reversalAnswerFrom({ ...good, reversed: 2 }), { message: 'postings with no bank row: the reversal\'s answer counts 2 reversed and carries 1' });
  assert.throws(() => reversalAnswerFrom({ ...good, errorCount: 0 }), { message: 'postings with no bank row: the reversal\'s answer counts 0 errors and carries 1' });
});
