/**
 * BOOKS-01 (Alex, 2026-11-11 12:08: "get bookkeeping full proof") — THE THREE READS OF THE BOOKS AGREE.
 *
 * Part 1 — one function under every statement (src/lib/books/statements.ts), over one read
 * (src/lib/books/statementsRead.ts), called by /api/statements and /api/cpa-export.
 *
 * Hermetic: the made-up ledger of booksLedger.ts (2024–2026, two books, balanced) stands in for the database; its
 * rowsOf() is the read's rule in TypeScript. The read itself is SQL, so it is held BY CONTENT (the standing filters,
 * the grouping, where a closing entry is left out) and the routes by content too.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import * as React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
Object.assign(globalThis, { React });
import BookkeepingCockpitBar, { type BookkeepingCockpitBarProps } from '@/components/bookkeeping/BookkeepingCockpitBar';
import { code } from '../sourceText';
import { MISSING_ACCOUNTS_WORDS, barFiguresOf, trialBalanceAccountsOf } from '../books/cockpitSums';
import { balanceSheetOf, exportBlocksOf, incomeStatementOf, statementsOf, unclassifiedWords, STATEMENT_TYPES, type StatementRow } from '../books/statements';
import { BOOK_NOT_FOUND_WORDS } from '../books/statementsRead';
import { CLOSING_ENTRY, UNKNOWN_TYPE_ENTRY, entriesOf, readOf, rowsOf, trialBalanceRowsOf } from './booksLedger';

const STATEMENTS = 'src/lib/books/statements.ts';
const BAR = 'src/components/bookkeeping/BookkeepingCockpitBar.tsx';
const LAUNCHER = 'src/components/home/ModuleLauncher.tsx';
const READ = 'src/lib/books/statementsRead.ts';
const STATEMENTS_ROUTE = 'src/app/api/statements/route.ts';
const EXPORT_ROUTE = 'src/app/api/cpa-export/route.ts';
const count = (text: string, re: RegExp): number => (text.match(re) ?? []).length;

test('P1-0 the made-up ledger balances: every entry\'s debits equal its credits, the reversed pair included', () => {
  for (const entry of entriesOf({ book: null, through: '9999-12-31', closing: 'in' })) {
    const debits = entry.lines.filter(([, side]) => side === 'D').reduce((s, [, , c]) => s + c, 0);
    const credits = entry.lines.filter(([, side]) => side === 'C').reduce((s, [, , c]) => s + c, 0);
    assert.equal(debits, credits, `${entry.id} balances`);
  }
  // The read's rule leaves the reversed entry and its reversal out: 15 live entries of 17.
  assert.equal(entriesOf({ book: null, through: '9999-12-31', closing: 'in' }).length, 15);
});

test('P1-1 the 2026 income statement is SIGNED: a month where a refund outweighs the expense lowers expenses, and the lines carry their sign', () => {
  const is = incomeStatementOf(readOf(2026, null).inPeriod);
  assert.deepEqual(is.revenue, [{ code: '4000', name: 'Salary', amount: 450_000 }, { code: '4100', name: 'Sales', amount: 120_001 }]);
  // Dining 80.00 + 50.00; Travel 300.00 charged and 450.00 refunded in February → −150.00, never +150.00.
  assert.deepEqual(is.expenses, [{ code: '6000', name: 'Dining', amount: 13_000 }, { code: '6100', name: 'Travel', amount: -15_000 }]);
  assert.equal(is.totalRevenue, 570_001);
  assert.equal(is.totalExpenses, -2_000, 'the refund lowers the total — nothing is made absolute');
  assert.equal(is.netIncome, 572_001, 'net income = revenue − expenses');
  assert.equal(is.netIncome, is.totalRevenue - is.totalExpenses);
  // A type stored with a capital ("Revenue") is read as revenue: trimmed and lower-cased.
  assert.ok(is.revenue.some((l) => l.code === '4100'));
  assert.deepEqual(incomeStatementOf([{ code: '4', name: 'x', type: '  REVENUE ', debits: 0, credits: 7 }]).totalRevenue, 7);
  // The unknown type is in no figure of the income statement, and named.
  assert.deepEqual(is.unclassified, [{ code: '9000', name: 'Suspense', type: 'suspense' }]);
});

test('P1-2 a closing entry is left out of its year\'s income statement — 2024 reads its real net income, not zero', () => {
  const closed = incomeStatementOf(readOf(2024, null).inPeriod);
  assert.equal(closed.totalRevenue, 400_000);
  assert.equal(closed.totalExpenses, 12_000);
  assert.equal(closed.netIncome, 388_000);
  // What the year reads WITH its closing entry in the period — what a statement summed from every entry of the year showed.
  const withClosing = incomeStatementOf(rowsOf({ book: null, from: '2024-01-01', through: '2024-12-31', closing: 'in' }));
  assert.equal(withClosing.totalRevenue, 0);
  assert.equal(withClosing.totalExpenses, 0);
  assert.equal(withClosing.netIncome, 0, 'the closing entry zeroes the year it closes');
  // 2026 holds no closing entry: in or out, the same statement.
  assert.deepEqual(incomeStatementOf(rowsOf({ book: null, from: '2026-01-01', through: '2026-12-31', closing: 'in' })), incomeStatementOf(readOf(2026, null).inPeriod));
});

test('P1-3 the balance sheet through Dec 31, 2026: signed, cumulative, earnings not yet closed inside equity — and the unknown type named, in no total', () => {
  const bs = balanceSheetOf(readOf(2026, null).toDate);
  // Two accounts share code 1000 across the books — two lines, by code then name. Venmo's credit balance LOWERS assets.
  assert.deepEqual(bs.assets, [
    { code: '1000', name: 'Business checking', amount: 210_001 },
    { code: '1000', name: 'Checking', amount: 1_752_501 },
    { code: '1050', name: 'Venmo', amount: -5_000 },
  ]);
  assert.equal(bs.totalAssets, 1_957_502);
  // The card was overpaid: a liability with a debit balance lowers liabilities.
  assert.deepEqual(bs.liabilities, [{ code: '2000', name: 'Credit card', amount: -5_000 }]);
  assert.equal(bs.totalLiabilities, -5_000);
  assert.deepEqual(bs.equity, [{ code: '3000', name: 'Owner equity', amount: 500_000 }, { code: '3900', name: 'Retained Earnings', amount: 388_000 }]);
  assert.equal(bs.equityAccounts, 888_000);
  assert.equal(bs.earningsNotClosed, 1_077_002, 'revenue − expenses over the same rows: 2025 and 2026, 2024 having been closed');
  assert.equal(bs.totalEquity, 1_965_002);
  assert.equal(bs.totalEquity, bs.equityAccounts + bs.earningsNotClosed);
  assert.equal(bs.difference, bs.totalAssets - bs.totalLiabilities - bs.totalEquity);
  // The unknown type: named, with its type as stored — and its 25.00 is exactly what the sheet is out by.
  assert.deepEqual(bs.unclassified, [{ code: '9000', name: 'Suspense', type: 'suspense' }]);
  assert.equal(bs.difference, -2_500);
  assert.equal(bs.isBalanced, false);
  for (const line of [...bs.assets, ...bs.liabilities, ...bs.equity]) assert.notEqual(line.code, '9000', 'in no line');
  // Its row changes no total: the same rows without it give the same five totals.
  const withoutRow = balanceSheetOf(readOf(2026, null).toDate.filter((r) => r.code !== '9000'));
  assert.deepEqual(
    [withoutRow.totalAssets, withoutRow.totalLiabilities, withoutRow.equityAccounts, withoutRow.earningsNotClosed, withoutRow.totalEquity, withoutRow.difference],
    [bs.totalAssets, bs.totalLiabilities, bs.equityAccounts, bs.earningsNotClosed, bs.totalEquity, bs.difference],
  );
  // Set the unknown type aside — its entry out of the ledger — and the sheet balances to the cent.
  const aside = balanceSheetOf(readOf(2026, null, [UNKNOWN_TYPE_ENTRY]).toDate);
  assert.equal(aside.difference, 0);
  assert.equal(aside.isBalanced, true);
  assert.deepEqual(aside.unclassified, []);
  assert.equal(aside.totalAssets, 1_960_002);
});

test('P1-4 a single book\'s statements balance on their own — the statement is scoped by the ENTRY\'s book, so the other book\'s account rides along', () => {
  const business = statementsOf(readOf(2026, 'B'));
  // Business's Software was paid from Personal's Checking: that line is on BUSINESS's sheet, a negative asset.
  assert.deepEqual(business.balanceSheet.assets, [{ code: '1000', name: 'Business checking', amount: 210_001 }, { code: '1000', name: 'Checking', amount: -4_999 }]);
  assert.equal(business.balanceSheet.totalAssets, 205_002);
  assert.equal(business.balanceSheet.totalLiabilities, 0);
  assert.equal(business.balanceSheet.equityAccounts, 0);
  assert.equal(business.balanceSheet.earningsNotClosed, 205_002);
  assert.equal(business.balanceSheet.difference, 0);
  assert.equal(business.balanceSheet.isBalanced, true);
  assert.equal(business.incomeStatement.netIncome, 120_001, 'Business, 2026');
  assert.deepEqual(business.unclassified, []);

  const personal = statementsOf(readOf(2026, 'P', [UNKNOWN_TYPE_ENTRY]));
  assert.equal(personal.balanceSheet.totalAssets, 1_755_000);
  assert.equal(personal.balanceSheet.totalLiabilities, -5_000);
  assert.equal(personal.balanceSheet.totalEquity, 1_760_000);
  assert.equal(personal.balanceSheet.difference, 0);
  assert.equal(personal.incomeStatement.netIncome, 452_000, 'Personal, 2026');
  // The two books' net incomes are the whole's: 452,000 + 120,001.
  assert.equal(personal.incomeStatement.netIncome + business.incomeStatement.netIncome, statementsOf(readOf(2026, null)).incomeStatement.netIncome);
  // By the ACCOUNT's book instead, Business would not balance — its entry's credit sits on Personal's account.
  const byAccountBook = balanceSheetOf(readOf(2026, 'B').toDate.filter((r) => !(r.code === '1000' && r.name === 'Checking')));
  assert.equal(byAccountBook.difference, 4_999, 'a set of lines picked by their account does not balance');
});

test('P1-5 closing 2024 moves nothing in total equity: the equity accounts rise and the earnings not yet closed fall by the same figure', () => {
  const closed = balanceSheetOf(readOf(2026, null, [UNKNOWN_TYPE_ENTRY]).toDate);
  const neverClosed = balanceSheetOf(readOf(2026, null, [UNKNOWN_TYPE_ENTRY, CLOSING_ENTRY]).toDate);
  assert.equal(closed.equityAccounts - neverClosed.equityAccounts, 388_000);
  assert.equal(closed.earningsNotClosed - neverClosed.earningsNotClosed, -388_000);
  assert.equal(closed.totalEquity, neverClosed.totalEquity);
  assert.equal(closed.totalAssets, neverClosed.totalAssets);
  assert.equal(closed.difference, 0);
  assert.equal(neverClosed.difference, 0);
  // Through Dec 31, 2024 itself: the year's 3,880.00 is in Retained Earnings, and nothing is left unclosed.
  const at2024 = balanceSheetOf(readOf(2024, null).toDate);
  assert.equal(at2024.earningsNotClosed, 0);
  assert.equal(at2024.equityAccounts, 888_000);
  assert.equal(at2024.difference, 0);
});

test('P1-6 the same rows through the Export\'s path give the same net income — its blocks are the function\'s figures under the Export\'s names', () => {
  for (const [year, book] of [[2026, null], [2026, 'P'], [2026, 'B'], [2025, null], [2024, 'P']] as const) {
    const statements = statementsOf(readOf(year, book));
    const blocks = exportBlocksOf(statements);
    assert.equal(blocks.incomeStatement.totals.netIncome, statements.incomeStatement.netIncome, `${year} ${book}`);
    assert.equal(blocks.incomeStatement.totals.totalRevenue, statements.incomeStatement.totalRevenue);
    assert.equal(blocks.incomeStatement.totals.totalExpenses, statements.incomeStatement.totalExpenses);
    assert.equal(blocks.balanceSheet.retainedEarnings, statements.balanceSheet.earningsNotClosed, 'retainedEarnings carries the earnings not yet closed');
    assert.deepEqual(blocks.balanceSheet.totals, {
      totalAssets: statements.balanceSheet.totalAssets,
      totalLiabilities: statements.balanceSheet.totalLiabilities,
      totalEquity: statements.balanceSheet.totalEquity,
      difference: statements.balanceSheet.difference,
      isBalanced: statements.balanceSheet.isBalanced,
    });
  }
  // The keys the Export has always answered, in their shapes.
  const blocks = exportBlocksOf(statementsOf(readOf(2026, 'B')));
  assert.deepEqual(Object.keys(blocks), ['incomeStatement', 'balanceSheet']);
  assert.deepEqual(Object.keys(blocks.incomeStatement), ['revenue', 'expenses', 'totals']);
  assert.deepEqual(Object.keys(blocks.balanceSheet), ['assets', 'liabilities', 'equity', 'retainedEarnings', 'totals']);
  assert.deepEqual(blocks.incomeStatement.revenue, [{ accountCode: '4100', accountName: 'Sales', amount: 120_001 }]);
  assert.deepEqual(blocks.balanceSheet.assets[1], { accountCode: '1000', accountName: 'Checking', amount: -4_999 });
  // 2025 across both books, to the cent.
  assert.equal(exportBlocksOf(statementsOf(readOf(2025, null))).incomeStatement.totals.netIncome, 505_001);
});

test('P1-7 a figure that is not a whole number of cents throws by name — nothing is rounded, defaulted or skipped', () => {
  const row = (over: Partial<StatementRow>): StatementRow => ({ code: '1000', name: 'Checking', type: 'asset', debits: 100, credits: 0, ...over });
  assert.throws(() => balanceSheetOf([row({ debits: 10.5 })]), { message: 'statements: account 1000 debits 10.5 is not an integer number of cents' });
  assert.throws(() => incomeStatementOf([row({ credits: Number.NaN })]), { message: 'statements: account 1000 credits NaN is not an integer number of cents' });
  assert.throws(() => balanceSheetOf([row({ debits: Number.POSITIVE_INFINITY })]), /is not an integer number of cents/);
  assert.throws(() => balanceSheetOf([row({ debits: 2 ** 53 })]), /is not an integer number of cents/);
  assert.throws(() => balanceSheetOf([row({ debits: '100' as unknown as number })]), { message: 'statements: account 1000 debits 100 is not an integer number of cents' });
  assert.throws(() => balanceSheetOf([row({ credits: undefined as unknown as number })]), /account 1000 credits undefined is not an integer number of cents/);
  // An unclassified row's figures are read too: it is set aside by its type, not by a figure nobody checked.
  assert.throws(() => balanceSheetOf([row({ type: 'suspense', debits: 0.1 })]), /account 1000 debits 0\.1 is not an integer number of cents/);
  // A row with no type at all is refused by name.
  assert.throws(() => balanceSheetOf([row({ type: null as unknown as string })]), { message: 'statements: account 1000 carries no type — nothing is assumed for it' });
  // A total that leaves the safe range is refused the same way.
  assert.throws(() => balanceSheetOf([row({ debits: Number.MAX_SAFE_INTEGER }), row({ code: '1001', debits: Number.MAX_SAFE_INTEGER })]), /statements: total asset \d+ is not an integer number of cents/);
  // The file rounds nothing and makes nothing absolute.
  const src = code(STATEMENTS);
  assert.doesNotMatch(src, /Math\.(abs|round|floor|ceil|trunc)|toFixed|\|\|\s*0|\?\?\s*0|parseFloat|parseInt/);
  assert.doesNotMatch(src, /from '@prisma|from 'react'|Date\.now|new Date|\bfetch\b/, 'pure: no Prisma, no React, no clock, no fetch');
  assert.deepEqual([...STATEMENT_TYPES], ['asset', 'liability', 'equity', 'revenue', 'expense']);
});

test('P1-8 an account that arrives on more than one row is one line, summed; the rules sit at their lines', () => {
  const rows: StatementRow[] = [
    { code: '1000', name: 'Checking', type: 'asset', debits: 1_000, credits: 0 },
    { code: '1000', name: 'Checking', type: 'asset', debits: 0, credits: 400 },
    { code: '2000', name: 'Card', type: 'liability', debits: 100, credits: 700 },
    { code: '2000', name: 'Card', type: ' Liability ', debits: 50, credits: 0 },
  ];
  const bs = balanceSheetOf(rows);
  assert.deepEqual(bs.assets, [{ code: '1000', name: 'Checking', amount: 600 }]);
  assert.deepEqual(bs.liabilities, [{ code: '2000', name: 'Card', amount: 550 }]);
  // Empty rows: every total a real 0, balanced, nothing unclassified.
  const empty = statementsOf({ toDate: [], inPeriod: [] });
  assert.deepEqual([empty.balanceSheet.totalAssets, empty.balanceSheet.totalEquity, empty.balanceSheet.difference, empty.incomeStatement.netIncome], [0, 0, 0, 0]);
  assert.equal(empty.balanceSheet.isBalanced, true);
  assert.deepEqual(empty.unclassified, []);
  // statementsOf names each unclassified account once, whichever statement met it.
  const both = statementsOf(readOf(2026, null));
  assert.deepEqual(both.unclassified, [{ code: '9000', name: 'Suspense', type: 'suspense' }]);
  assert.deepEqual(both.incomeStatement, incomeStatementOf(readOf(2026, null).inPeriod));
  assert.deepEqual(both.balanceSheet, balanceSheetOf(readOf(2026, null).toDate));
  const src = code(STATEMENTS);
  assert.match(src, /const type = row\.type\.trim\(\)\.toLowerCase\(\);/, 'a type is read trimmed and lower-cased');
  assert.match(src, /const amount = type === 'asset' \|\| type === 'expense' \? debits - credits : credits - debits;/, 'asset and expense debits − credits; the other three credits − debits');
  assert.match(src, /const earningsNotClosed = wholeCents\(r\.totals\.revenue - r\.totals\.expense, 'earnings not yet closed'\);/);
  assert.match(src, /const totalEquity = wholeCents\(r\.totals\.equity \+ earningsNotClosed, 'total equity'\);/);
  assert.match(src, /const difference = wholeCents\(r\.totals\.asset - r\.totals\.liability - totalEquity, 'the balance sheet difference'\);/);
  assert.match(src, /isBalanced: difference === 0,/);
});

test('P1-9 the read, by content: the standing filters, grouped by ACCOUNT only, a closing entry out of the period and in to-date', () => {
  const src = code(READ);
  // The standing filters — the caller's live entries, the ENTRY's book when one is asked for.
  assert.match(src, /const standing: Prisma\.Sql\[\] = \[\n\s*Prisma\.sql`je\."userId" = \$\{userId\}`,\n\s*Prisma\.sql`je\.is_reversal = false`,\n\s*Prisma\.sql`je\.reversed_by_entry_id IS NULL`,\n\s*\];\n\s*if \(entityId !== null\) standing\.push\(Prisma\.sql`je\.entity_id = \$\{entityId\}`\);/);
  // ONE query text, grouped by the account — never by month, never by the entry's book.
  assert.equal(count(src, /db\.\$queryRaw</g), 1, 'one query text');
  assert.match(src, /FROM ledger_entries le\n\s*JOIN journal_entries je ON le\.journal_entry_id = je\.id\n\s*JOIN chart_of_accounts coa ON le\.account_id = coa\.id\n\s*WHERE \$\{where\}\n\s*GROUP BY coa\.id, coa\.code, coa\.name, coa\.account_type\n\s*ORDER BY coa\.code ASC, coa\.name ASC/);
  assert.doesNotMatch(src, /EXTRACT\(|GROUP BY[^\n]*je\.entity_id|JOIN entities/);
  // toDate: through the last day. inPeriod: the year, and no closing entry — said once, in the period alone.
  assert.match(src, /summedRows\(db, Prisma\.join\(\[\.\.\.standing, Prisma\.sql`je\.date <= \$\{lastDay\}::date`\], ' AND '\)\),/);
  assert.match(src, /summedRows\(db, Prisma\.join\(\[\n\s*\.\.\.standing,\n\s*Prisma\.sql`je\.date >= \$\{firstDay\}::date`,\n\s*Prisma\.sql`je\.date <= \$\{lastDay\}::date`,\n\s*Prisma\.sql`je\.source_type <> 'year_end_close'`,\n\s*\], ' AND '\)\),/);
  assert.equal(count(src, /year_end_close/g), 1, 'the closing entry is named once — in the period');
  assert.match(src, /const firstDay = `\$\{year\}-01-01`;\n\s*const lastDay = `\$\{year\}-12-31`;/);
  assert.match(src, /scope: \{ year, through: lastDay, entityId, entityName \},/);
  // The book's name is read by id AND the caller; a book that is not the caller's is a fault by name, never an empty statement.
  assert.match(src, /const book = await db\.entities\.findFirst\(\{ where: \{ id: entityId, userId \}, select: \{ name: true \} \}\);\n\s*if \(book === null\) throw new Error\(BOOK_NOT_FOUND_WORDS\);/);
  assert.equal(BOOK_NOT_FOUND_WORDS, 'statements: the book asked for is not one of the caller\'s books');
  // It writes nothing.
  assert.doesNotMatch(src, /\.(create|createMany|update|updateMany|upsert|delete|deleteMany)\s*\(|\$executeRaw|\$transaction/);
});

test('P1-10 both routes call the ONE read and the ONE function, after their gates — and /api/statements still answers `accounts` and `availableYears` as it did', () => {
  for (const [route, gate] of [[STATEMENTS_ROUTE, "requireTabAccess(user.id, 'tab:books')"], [EXPORT_ROUTE, "requireTabAccess(user.id, 'tab:tax')"]] as const) {
    const src = code(route);
    assert.ok(src.includes("import { readStatements } from '@/lib/books/statementsRead';"), `${route} imports the read`);
    assert.equal(count(src, /readStatements\(/g), 1, `${route} calls it once`);
    assert.match(src, /const read = await readStatements\(prisma, \{ userId: user\.id, entityId: entityId \? entityId : null, year \}\);\n\s*const statements = statementsOf\(\{ toDate: read\.toDate, inPeriod: read\.inPeriod \}\);/, `${route}: the one read, then the one function`);
    // No gate moved: the tab gate, then the book-belongs-to-the-user check, then the read.
    const gateAt = src.indexOf(gate);
    const bookAt = src.indexOf('const entity = await prisma.entities.findFirst({\n        where: { id: entityId, userId: user.id },');
    const readAt = src.indexOf('readStatements(prisma');
    assert.ok(gateAt > 0 && bookAt > gateAt && readAt > bookAt, `${route}: gate → the book check → the read`);
    assert.match(src, /if \(!entity\) \{\n\s*return NextResponse\.json\(\{ error: 'Entity not found' \}, \{ status: 404 \}\);/);
    // The year: an integer from 2000 to 2100, else 400 — the same check in both.
    assert.match(src, /if \(isNaN\(year\) \|\| year < 2000 \|\| year > 2100\) \{\n\s*return NextResponse\.json\(\{ error: 'Invalid year parameter' \}, \{ status: 400 \}\);/, `${route} checks the year`);
    assert.doesNotMatch(src, /\.(create|createMany|update|updateMany|upsert|delete|deleteMany)\s*\(|\$executeRaw|\$transaction/, `${route} writes nothing`);
  }

  // /api/statements: `accounts` and `availableYears` — the read between the conditions and availableYears is the text
  // main 7ec6b1e held, to the character (comments aside); the answer gains scope and statements after them.
  const s = code(STATEMENTS_ROUTE);
  const from = s.indexOf('const conditions: Prisma.Sql[] = [');
  const untilText = 'const availableYears = yearRows.map(r => Number(r.year));';
  const until = s.indexOf(untilText) + untilText.length;
  assert.ok(from > 0 && until > from);
  assert.equal(createHash('sha256').update(s.slice(from, until)).digest('hex'), 'f343791d7e0a9daffc7d138a830b855925caa0f55926a054abc817286fa08cd9', 'the per-account-per-month read and its two maps are untouched');
  assert.match(s, /return NextResponse\.json\(\{ accounts, availableYears, scope: read\.scope, statements \}\);/);
  assert.match(s, /const yearParam = searchParams\.get\('year'\);\n\s*const year = yearParam \? parseInt\(yearParam, 10\) : new Date\(\)\.getFullYear\(\);/);

  // /api/cpa-export: its two statements are the function's blocks; its period says through and the book's name; its
  // trial balance and general ledger are the year's activity, and it keeps its own wholeCents for them.
  const e = code(EXPORT_ROUTE);
  assert.match(e, /const \{ incomeStatement, balanceSheet \} = exportBlocksOf\(statements\);/);
  assert.match(e, /period: \{ year, entityId: entityId \|\| null, through: read\.scope\.through, entityName: read\.scope\.entityName \},/);
  assert.match(e, /incomeStatement,\n\s*balanceSheet,\n\s*unclassified: statements\.unclassified,\n\s*generalLedger,/);
  assert.match(e, /Prisma\.sql`EXTRACT\(YEAR FROM je\.date\) = \$\{year\}`,/, 'the trial balance and the ledger stay the year\'s');
  assert.match(e, /const tbDifference = wholeCents\(tbTotalDebits - tbTotalCredits\);/);
  assert.doesNotMatch(e, /const totalEquityExcludingRetained|retainedEarnings: netIncome|const revenueAccounts = /, 'the year-only balance sheet is gone');
});

// ─── Part 2 — THE BAR ADDS UP ───────────────────────────────────────────────────────────────────────────────────────
// The bar's three figures are balanceSheetOf over the trial balance's own rows (src/lib/books/cockpitSums.ts
// barFiguresOf); its mark is computed from the three figures it draws.

const barProps = (over: Partial<BookkeepingCockpitBarProps>): BookkeepingCockpitBarProps => ({
  totalAssets: 0, totalLiabilities: 0, totalEquity: 0, earningsNotClosed: 0, unclassified: [], hasActivity: true,
  connectedAccounts: 2, periodLabel: 'November 2026', periodStatus: 'open', onSync: () => {}, syncing: false, onLinkAccount: () => {},
  ...over,
});
const drawBar = (over: Partial<BookkeepingCockpitBarProps>): string => renderToStaticMarkup(React.createElement(BookkeepingCockpitBar, barProps(over)));
/** The bar as the panel hands it a balance sheet. */
const barOf = (sheet: ReturnType<typeof barFiguresOf>): string => drawBar({
  totalAssets: sheet.totalAssets, totalLiabilities: sheet.totalLiabilities, totalEquity: sheet.totalEquity,
  earningsNotClosed: sheet.earningsNotClosed, unclassified: sheet.unclassified.map((u) => u.code),
});

test('P2-1 the made-up ledger as trial-balance rows: the three figures add up and the mark is Balanced — and they are the statements\' own', () => {
  const rows = trialBalanceRowsOf([UNKNOWN_TYPE_ENTRY]);
  // The trial balance answers one row per account per entry-book: Personal's Checking arrives twice.
  assert.equal(rows.filter((r) => r.accountCode === '1000' && r.accountName === 'Checking').length, 2);
  const sheet = barFiguresOf(rows);
  assert.equal(sheet.totalAssets, 1_960_002);
  assert.equal(sheet.totalLiabilities, -5_000);
  assert.equal(sheet.totalEquity, 1_965_002);
  assert.equal(sheet.earningsNotClosed, 1_077_002);
  assert.equal(sheet.totalAssets - (sheet.totalLiabilities + sheet.totalEquity), 0);
  // The same three totals the statements give through the far future, all books — one function under both.
  const statements = balanceSheetOf(rowsOf({ book: null, through: '9999-12-31', closing: 'in', without: [UNKNOWN_TYPE_ENTRY] }));
  assert.deepEqual([sheet.totalAssets, sheet.totalLiabilities, sheet.totalEquity, sheet.earningsNotClosed], [statements.totalAssets, statements.totalLiabilities, statements.totalEquity, statements.earningsNotClosed]);
  const html = barOf(sheet);
  assert.match(html, /A = L \+ E ✓ Balanced/);
  assert.doesNotMatch(html, /Unbalanced/);
  assert.match(html, /Assets<\/span><span[^>]*>\$19,600\.02</);
  assert.match(html, /Liabilities<\/span><span[^>]*>-\$50\.00</);
  assert.match(html, /Equity<\/span><span[^>]*>\$19,650\.02</);
  assert.match(html, /<div[^>]*data-bar-scope="true"[^>]*>All books · all time · Equity includes earnings not yet closed: <span[^>]*>\$10,770\.02<\/span><\/div>/);
  assert.doesNotMatch(html, /data-bar-unclassified/);
});

test('P2-2 an account with a negative balance LOWERS its type\'s figure — the old sum raised it; revenue and expense are inside Equity now', () => {
  const rows = trialBalanceRowsOf([UNKNOWN_TYPE_ENTRY]);
  const sheet = barFiguresOf(rows);
  // What stood until BOOKS-01: Σ |normalBalance| over a type's rows.
  const oldSum = (type: string) => rows.filter((r) => r.accountType === type).reduce((s, r) => s + Math.abs(r.normalBalance), 0);
  assert.equal(oldSum('asset'), 1_980_000, 'Venmo\'s −50.00 and the cross-book −49.99 were ADDED');
  assert.equal(sheet.totalAssets, 1_960_002, 'now they are subtracted');
  assert.equal(oldSum('asset') - sheet.totalAssets, 2 * (5_000 + 4_999), 'twice each negative row');
  assert.equal(oldSum('liability'), 5_000, 'the overpaid card read as money owed');
  assert.equal(sheet.totalLiabilities, -5_000);
  assert.equal(oldSum('equity'), 888_000, 'the equity accounts alone — net income in no figure');
  assert.equal(sheet.totalEquity, 888_000 + 1_077_002);
  assert.notEqual(oldSum('asset') - (oldSum('liability') + oldSum('equity')), 0, 'the old three did not add up');
});

test('P2-3 a type the statements do not read is named in red and is in no figure; the bar then says by how much it is out', () => {
  const sheet = barFiguresOf(trialBalanceRowsOf());
  assert.deepEqual(sheet.unclassified.map((u) => u.code), ['9000']);
  assert.equal(sheet.totalAssets - (sheet.totalLiabilities + sheet.totalEquity), -2_500);
  const html = barOf(sheet);
  assert.match(html, /✗ Unbalanced by \$25\.00/);
  assert.doesNotMatch(html, /Balanced<\/span>/);
  assert.match(html, /<div role="alert"[^>]*data-bar-unclassified="true"[^>]*>1 account carries a type the statements do not read: 9000<\/div>/);
  assert.equal(unclassifiedWords(['9000']), '1 account carries a type the statements do not read: 9000');
  assert.equal(unclassifiedWords(['9000', '9100', '9000']), '2 accounts carry a type the statements do not read: 9000, 9100', 'each code once');
  assert.throws(() => unclassifiedWords([]), /asked with no account/);
});

test('P2-4 the mark is computed from the three figures drawn; "No activity yet" stays; the trial balance\'s words for a missing list stay', () => {
  // Balanced or not is the figures' own difference — nothing else is asked.
  assert.match(drawBar({ totalAssets: 500, totalLiabilities: 200, totalEquity: 300 }), /A = L \+ E ✓ Balanced/);
  assert.match(drawBar({ totalAssets: 500, totalLiabilities: 200, totalEquity: 299 }), /✗ Unbalanced by \$0\.01/);
  assert.match(drawBar({ totalAssets: 100, totalLiabilities: 200, totalEquity: 300 }), /✗ Unbalanced by \$4\.00/);
  // No posted activity: the neutral chip, as it was — never a green mark over an empty ledger.
  const empty = drawBar({ hasActivity: false });
  assert.match(empty, /No activity yet — nothing posted/);
  assert.doesNotMatch(empty, /Balanced/);
  const bar = code(BAR);
  assert.match(bar, /const imbalance = totalAssets - \(totalLiabilities \+ totalEquity\);/);
  assert.match(bar, /\{!hasActivity \? \([\s\S]*?\) : imbalance === 0 \? \(/);
  assert.doesNotMatch(bar, /isBalanced/, 'the borrowed mark is gone from the bar');
  assert.match(bar, /Equity includes earnings not yet closed: <span className="font-mono">\{functionalMoneyWords\(earningsNotClosed\)\}<\/span>/);
  assert.match(bar, /\{unclassified\.length > 0 && \(/);
  // The panel hands the two new figures; the trial balance without its accounts throws the same words.
  assert.match(code(LAUNCHER), /earningsNotClosed=\{booksData\.earningsNotClosed\} unclassified=\{booksData\.unclassified\}/);
  assert.equal(MISSING_ACCOUNTS_WORDS, 'trial balance came back without its accounts');
  assert.throws(() => trialBalanceAccountsOf({ totals: {} } as never), { message: MISSING_ACCOUNTS_WORDS });
  assert.throws(() => barFiguresOf([{ accountCode: '1000', accountType: 'asset', totalDebits: 'x', totalCredits: 0 }]), { message: 'trial balance account 1000 has no readable totalDebits' });
});
