/**
 * PENDING-02 (Alex, 2026-11-11 12:08: "get bookkeeping full proof" · 16:25: "would be better to get the sync and data
 * issues fixed") — A POSTING WHOSE BANK ROW IS GONE IS LISTED.
 *
 * Part 1 — the list: one pure leaf (src/lib/books/postingsWithNoBankRow.ts), one read
 * (src/lib/books/postingsWithNoBankRowRead.ts), GET /api/journal-entries/no-bank-row, and the panel at the top of the
 * General Ledger (src/components/books/PostingsWithNoBankRow.tsx).
 *
 * Hermetic. The leaf is run. The read is SQL, so it is held BY CONTENT (its five conditions, the same-user account
 * scope, nothing cut) and its fold is driven over the rows a made-up query answers. The route is held by content. The
 * panel's view is drawn over made-up answers and its read is run under a stand-in fetch. No database, no network.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import * as React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
Object.assign(globalThis, { React });
import PostingsWithNoBankRow, { NoBankRowView, readNoBankRow, type NoBankRowRead } from '@/components/books/PostingsWithNoBankRow';
import { code } from '../sourceText';
import { booksLaneImports } from '../books/booksLane';
import { FUNCTIONAL_CURRENCY_WORDS, functionalMoneyWords } from '../books/functionalCurrency';
import {
  BANK_ROW_EXISTS_WORDS, CANCEL_WORDS, COLUMN_WORDS, HIDE_WORDS, NOT_FROM_THAT_BANK_ROW_WORDS, NO_BANK_ROW_ROUTE, REFRESH_WORDS, REVERSAL_PREFIX,
  REVERSAL_SLICE, SHOW_WORDS, WHAT_THEY_ARE_WORDS, countWords, noBankRowAnswerFrom, noBankRowAnswerOf, notADayWords, notJsonWords, questionWords,
  resultWords, reverseWords, slicesOf, type NoBankRowAnswer, type PostingWithNoBankRow,
} from '../books/postingsWithNoBankRow';
import { readPostingsWithNoBankRow } from '../books/postingsWithNoBankRowRead';

const LEAF = 'src/lib/books/postingsWithNoBankRow.ts';
const READ = 'src/lib/books/postingsWithNoBankRowRead.ts';
const ROUTE = 'src/app/api/journal-entries/no-bank-row/route.ts';
const PANEL = 'src/components/books/PostingsWithNoBankRow.tsx';
const GL = 'src/components/dashboard/GeneralLedger.tsx';
const PIPE = 'src/components/home/BooksPipeline.tsx';
const ROOT = process.cwd();

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

const view = (read: NoBankRowRead, open = false): string => renderToStaticMarkup(React.createElement(NoBankRowView, { read, open, onToggle: () => {} }));
const readOf = (postings: PostingWithNoBankRow[]): NoBankRowRead => ({ state: 'read', answer: noBankRowAnswerOf(postings) });

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
  const walk = (dir: string): string[] => readdirSync(dir).flatMap((n) => { const f = join(dir, n); return statSync(f).isDirectory() ? (n === '__tests__' || n === 'node_modules' ? [] : walk(f)) : /\.(ts|tsx)$/.test(n) ? [f] : []; });
  const mounting = walk(resolve(ROOT, 'src')).map((abs) => abs.slice(ROOT.length + 1)).filter((f) => f !== PANEL && /components\/books\/PostingsWithNoBankRow['"]/.test(code(f)));
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
