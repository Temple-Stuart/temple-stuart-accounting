/**
 * BOOKS-01 (Alex, 2026-11-11 12:08: "get bookkeeping full proof") — THE THREE READS OF THE BOOKS AGREE.
 *
 * Part 1 — one function under every statement (src/lib/books/statements.ts), over one read
 * (src/lib/books/statementsRead.ts), called by /api/statements and /api/cpa-export.
 * Part 2 — the bar's three figures are that function over the trial balance's rows, and its mark is theirs.
 * Part 3 — Financial Statements and the Export say their book and year, through one control, and show the same net
 * income: each panel is drawn here over the answer its route gives for the made-up ledger.
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
import FinancialStatementsTab, { RATIO_NONE_WORDS, StatementsView, ratioWords, statementsAnswerOf } from '@/components/dashboard/FinancialStatementsTab';
import CPAExport, { ExportStatus, buildBalanceSheetCSV, buildGeneralLedgerCSV, buildIncomeStatementCSV, buildTrialBalanceCSV, exportAnswerOf, type CPAExportData } from '@/components/dashboard/CPAExport';
import { ALL_BOOKS_WORDS, bookWordsOf, failedAnswerWords, readScoped, scopeQueryOf, scopeWordsOf, startingChoiceOf, throughWordsOf, yearOptionsOf, type ScopeChoice } from '@/components/dashboard/StatementScopeSelect';
import { code } from '../sourceText';
import { booksLaneImports } from '../books/booksLane';
import { FUNCTIONAL_CURRENCY_WORDS, functionalMoneyWords } from '../books/functionalCurrency';
import { MISSING_ACCOUNTS_WORDS, barFiguresOf, trialBalanceAccountsOf } from '../books/cockpitSums';
import { balanceSheetOf, exportBlocksOf, incomeStatementOf, statementsOf, unclassifiedWords, STATEMENT_TYPES, type StatementRow } from '../books/statements';
import { BOOK_NOT_FOUND_WORDS, type StatementScope } from '../books/statementsRead';
import { BOOKS, CLOSING_ENTRY, UNKNOWN_TYPE_ENTRY, entriesOf, readOf, rowsOf, trialBalanceRowsOf, type BookId } from './booksLedger';

const STATEMENTS = 'src/lib/books/statements.ts';
const BAR = 'src/components/bookkeeping/BookkeepingCockpitBar.tsx';
const LAUNCHER = 'src/components/home/ModuleLauncher.tsx';
const READ = 'src/lib/books/statementsRead.ts';
const STATEMENTS_ROUTE = 'src/app/api/statements/route.ts';
const EXPORT_ROUTE = 'src/app/api/cpa-export/route.ts';
const PIPE = 'src/components/home/BooksPipeline.tsx';
const STATEMENTS_TAB = 'src/components/dashboard/FinancialStatementsTab.tsx';
const EXPORT_TAB = 'src/components/dashboard/CPAExport.tsx';
const CONTROL = 'src/components/dashboard/StatementScopeSelect.tsx';
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

// ─── Part 3 — FINANCIAL STATEMENTS AND EXPORT SAY THEIR BOOK AND YEAR, AND AGREE ────────────────────────────────────
// Each panel is drawn over the answer its route gives. The answers are built here the way the routes build them
// (P1-10 pins the routes' two calls): the one function over the one read's rows — /api/statements hands the function's
// whole answer, /api/cpa-export hands the same answer under the Export's keys.

const bookName = (book: BookId | null): string | null => (book === null ? null : BOOKS.find((b) => b.id === book)!.name);
const scopeOf = (year: number, book: BookId | null): StatementScope => ({ year, through: `${year}-12-31`, entityId: book, entityName: bookName(book) });
/** What /api/statements answers for a year and a book of the made-up ledger. */
const statementsAnswer = (year: number, book: BookId | null, without: readonly string[] = []) =>
  ({ accounts: [], availableYears: [2026, 2025, 2024], scope: scopeOf(year, book), statements: statementsOf(readOf(year, book, without)) });
/** What /api/cpa-export answers for the same: the same function's figures under the Export's keys (its trial balance and ledger are not this part's). */
const exportAnswer = (year: number, book: BookId | null, without: readonly string[] = []): CPAExportData => {
  const statements = statementsOf(readOf(year, book, without));
  return {
    period: { year, entityId: book, through: `${year}-12-31`, entityName: bookName(book) },
    trialBalance: { rows: [], totals: { totalDebits: 0, totalCredits: 0, difference: 0, isBalanced: true } },
    ...exportBlocksOf(statements),
    generalLedger: [],
  };
};
const drawStatements = (year: number, book: BookId | null, without: readonly string[] = []): string =>
  renderToStaticMarkup(React.createElement(StatementsView, statementsAnswerOf(statementsAnswer(year, book, without))));
const drawExportStatus = (year: number, book: BookId | null, without: readonly string[] = []): string =>
  renderToStaticMarkup(React.createElement(ExportStatus, { data: exportAnswerOf(exportAnswer(year, book, without)) }));
/** The net income a drawn panel shows. */
const netIncomeDrawn = (html: string): string => {
  const m = /data-net-income="true"[^>]*>([^<]+)</.exec(html);
  assert.ok(m !== null, 'the panel draws a net income');
  return m![1];
};
/** The books as /api/entities hands them — by name. */
const PANEL_BOOKS = [...BOOKS].sort((a, b) => (a.name < b.name ? -1 : 1)).map((b) => ({ id: b.id, name: b.name }));
const panelProps = (defaultBookId: string | null) => ({ books: PANEL_BOOKS, defaultBookId, years: [2025, 2024], currentYear: 2026 });
/** One figure row of the statements panel: its label, then its figure. */
const figure = (html: string, label: string): string => {
  const m = new RegExp(`>${label.replace(/[+]/g, '\\+')}</span><span[^>]*>([^<]+)<`).exec(html);
  assert.ok(m !== null, `the panel draws ${label}`);
  return m![1];
};
/** Run a read under a fetch that answers once, by what the test hands it. */
async function underFetch<T>(answer: { status: number; json: () => unknown }, run: () => Promise<T>): Promise<{ urls: string[]; result: T | Error }> {
  const g = globalThis as unknown as { fetch: unknown };
  const saved = g.fetch;
  const urls: string[] = [];
  g.fetch = async (url: string) => { urls.push(url); return { ok: answer.status >= 200 && answer.status < 300, status: answer.status, json: async () => answer.json() }; };
  try {
    return { urls, result: await run().catch((e: Error) => e) };
  } finally {
    g.fetch = saved;
  }
}

test('P3-1 for one book and year the two panels show the SAME net income — one figure, from the one function, under both', () => {
  for (const [year, book, words] of [[2026, 'P', '$4,520.00'], [2026, 'B', '$1,200.01'], [2026, null, '$5,720.01'], [2025, null, '$5,050.01'], [2024, 'P', '$3,880.00']] as const) {
    const fromFunction = statementsOf(readOf(year, book)).incomeStatement.netIncome;
    assert.equal(functionalMoneyWords(fromFunction), words, `${year} ${book}: the function's net income`);
    assert.equal(netIncomeDrawn(drawStatements(year, book)), words, `${year} ${book}: Financial Statements draws it`);
    assert.equal(netIncomeDrawn(drawExportStatus(year, book)), words, `${year} ${book}: the Export's status bar draws it`);
    assert.ok(buildIncomeStatementCSV(exportAnswer(year, book)).split('\n').includes(`,NET INCOME,"${words}"`), `${year} ${book}: the Export's income statement CSV carries it`);
  }
  // Two books, one year: a different figure for each — the panels read the book they are asked for.
  assert.notEqual(netIncomeDrawn(drawStatements(2026, 'P')), netIncomeDrawn(drawStatements(2026, 'B')));
  // The same function under both: each panel draws its route's figure as it is, and both routes ask with the one query.
  const tab = code(STATEMENTS_TAB);
  const exp = code(EXPORT_TAB);
  assert.match(tab, /const \{ incomeStatement, balanceSheet \} = statements;/);
  assert.match(tab, /\{functionalMoneyWords\(incomeStatement\.netIncome\)\}/);
  assert.match(exp, /\{functionalMoneyWords\(data\.incomeStatement\.totals\.netIncome\)\}/);
  assert.match(tab, /statementsAnswerOf\(await readScoped\('\/api\/statements', choice\)\)/);
  assert.match(exp, /exportAnswerOf\(await readScoped\('\/api\/cpa-export', choice\)\)/);
  assert.match(code(CONTROL), /const res = await fetch\(`\$\{route\}\?\$\{scopeQueryOf\(choice\)\}`\);/);
  assert.equal(count(tab, /fetch\(/g), 0, 'the panel makes no fetch of its own');
  assert.equal(count(exp, /fetch\(/g), 0, 'the Export makes no fetch of its own');
  // No arithmetic of its own is left under the statements panel's figures — nothing is summed per account, nothing made absolute but the "out by".
  assert.doesNotMatch(tab, /\.reduce\(|for \(const acct|\+= /);
  assert.equal(count(tab, /Math\.abs\(/g), 1);
});

test('P3-2 the selects\' defaults: both panels start on the default book and the current year — each keeps its own choice, and the pipeline hands them its books, its default and its years', () => {
  assert.deepEqual(startingChoiceOf('P', 2026), { bookId: 'P', year: 2026 });
  assert.deepEqual(startingChoiceOf(null, 2026), { bookId: null, year: 2026 });
  // The Year select: the years /api/statements lists plus the current year, each once, newest first.
  assert.deepEqual(yearOptionsOf([2024, 2026, 2025, 2024], 2026), [2026, 2025, 2024]);
  assert.deepEqual(yearOptionsOf([], 2026), [2026], 'a ledger with no entries still offers this year');
  assert.deepEqual(yearOptionsOf([2025, 2027], 2026), [2027, 2026, 2025]);
  // The query both routes take.
  assert.equal(scopeQueryOf({ bookId: 'P', year: 2026 }), 'year=2026&entityId=P');
  assert.equal(scopeQueryOf({ bookId: null, year: 2025 }), 'year=2025', 'all books: no entityId at all');

  for (const [name, panel, loading] of [['Financial Statements', FinancialStatementsTab, 'Loading statements...'], ['Export', CPAExport, 'Loading ledger...']] as const) {
    const html = renderToStaticMarkup(React.createElement(panel, panelProps('P')));
    // Book: each of the user's books by name, then "All books" — the default book chosen.
    assert.match(html, /<select[^>]*data-scope-book="true"[^>]*><option value="B">Business<\/option><option value="P" selected="">Personal<\/option><option value="">All books<\/option><\/select>/, `${name}: the Book select`);
    // Year: this year chosen, then the years the route lists.
    assert.match(html, /<select[^>]*data-scope-year="true"[^>]*><option value="2026" selected="">2026<\/option><option value="2025">2025<\/option><option value="2024">2024<\/option><\/select>/, `${name}: the Year select`);
    assert.equal(count(html, /data-statement-scope="true"/g), 1, `${name} mounts the control once`);
    // Before its read lands a panel says it is loading — it draws no figure.
    assert.ok(html.includes(loading), `${name} says it is loading`);
    assert.doesNotMatch(html, /\$\d/, `${name} draws no figure before its read lands`);
    // No default book: the panel starts on All books.
    assert.match(renderToStaticMarkup(React.createElement(panel, panelProps(null))), /<option value="" selected="">All books<\/option>/, `${name}: all books when the pipeline holds no default`);
  }

  // Each panel keeps its OWN choice; the pipeline holds none and does not mount the control.
  for (const f of [STATEMENTS_TAB, EXPORT_TAB]) {
    const src = code(f);
    assert.match(src, /const \[choice, setChoice\] = useState<ScopeChoice>\(\(\) => startingChoiceOf\(defaultBookId, currentYear\)\);/, `${f} holds its own choice`);
    assert.match(src, /<StatementScopeSelect books=\{books\} years=\{years\} currentYear=\{currentYear\} choice=\{choice\} onChange=\{setChoice\} \/>/);
    assert.match(src, /from '@\/components\/dashboard\/StatementScopeSelect';/);
    // An answer is used only under the choice it was read for, and a late one is dropped.
    assert.match(src, /const shown = outcome !== null && outcome\.choice === choice \? outcome : null;/);
    assert.match(src, /let newest = true;[\s\S]*?return \(\) => \{ newest = false; \};\n\s*\}, \[choice\]\);/);
  }
  const pipe = code(PIPE);
  assert.ok(!booksLaneImports(pipe).some((f) => f.includes('StatementScopeSelect')), 'BooksPipeline does not import the control');
  assert.doesNotMatch(pipe, /ScopeChoice|setChoice|StatementScopeSelect/);
  // The pipeline keeps the books it already fetches — the default by the rule it had — and hands both panels the same four things.
  assert.match(pipe, /const def = entities\.find\(\(e: Row\) => e\.is_default\) \|\| entities\[0\];\n\s*setBooks\(\{ list: entities, defaultId: def\?\.id \?\? null \}\);/);
  assert.match(pipe, /<FinancialStatementsTab books=\{books\.list\} defaultBookId=\{books\.defaultId\} years=\{statementYears\} currentYear=\{year\} \/>/);
  assert.match(pipe, /<CPAExport books=\{books\.list\} defaultBookId=\{books\.defaultId\} years=\{statementYears\} currentYear=\{year\} \/>/);
  // What used the default book before still does: the period close, the reopen and the year-end close.
  assert.equal(count(pipe, /entityId: books\.defaultId,/g), 2);
  assert.match(pipe, /<CloseBooksTab entityId=\{books\.defaultId\} selectedYear=\{year\} \/>/);
  assert.doesNotMatch(pipe, /setEntityId|\[entityId,/);
});

test('P3-3 the scope line and the statements, drawn: the book by its name and the year; the balance sheet through its last day; the mark is the function\'s', () => {
  assert.equal(ALL_BOOKS_WORDS, 'All books');
  assert.equal(bookWordsOf('Personal'), 'Personal');
  assert.equal(bookWordsOf(null), 'All books');
  assert.equal(scopeWordsOf({ entityName: 'Personal', year: 2026 }), 'Personal · 2026');
  assert.equal(scopeWordsOf({ entityName: null, year: 2025 }), 'All books · 2025');
  assert.equal(throughWordsOf('2026-12-31'), 'Dec 31, 2026');
  for (const not of ['2026-13-01', '2026-12-32', 'Dec 31', '', null, undefined, 20261231]) assert.throws(() => throughWordsOf(not), /is not a calendar day/, `${String(not)} is no day — nothing is guessed`);

  // All books, 2026 — with the unknown-type posting in: every figure signed, and the sheet says by how much it is out and why.
  const all = drawStatements(2026, null);
  assert.match(all, /<div[^>]*data-statement-scope-line="true"[^>]*>All books · 2026<\/div>/);
  assert.ok(all.includes(`data-functional-currency="true">${FUNCTIONAL_CURRENCY_WORDS}<`), 'the unit line stays');
  assert.match(all, /<h3[^>]*>Income Statement · 2026<\/h3>/);
  assert.match(all, /<h3[^>]*>Balance Sheet · through Dec 31, 2026<\/h3>/);
  assert.deepEqual(['Revenue', 'Expenses'].map((l) => figure(all, l)), ['$5,700.01', '-$20.00'], 'the refund that outweighs February\'s Travel shows as a negative expense');
  assert.equal(netIncomeDrawn(all), '$5,720.01');
  assert.deepEqual(['Assets', 'Liabilities', 'Equity accounts', 'Earnings not yet closed', 'Liabilities + equity'].map((l) => figure(all, l)),
    ['$19,575.02', '-$50.00', '$8,880.00', '$10,770.02', '$19,600.02']);
  assert.match(all, /<div[^>]*data-balance-mark="true"[^>]*>⚠ Out by \$25\.00<\/div>/);
  assert.match(all, /<div role="alert"[^>]*data-statement-unclassified="true"[^>]*>1 account carries a type the statements do not read: 9000<\/div>/);
  // "Liabilities + equity" is the two totals the function hands, added: liabilities + (equity accounts + earnings not yet closed).
  const sheet = statementsOf(readOf(2026, null)).balanceSheet;
  assert.equal(functionalMoneyWords(sheet.totalLiabilities + sheet.totalEquity), '$19,600.02');
  assert.equal(sheet.totalAssets - (sheet.totalLiabilities + sheet.totalEquity), sheet.difference);

  // The same without that posting: it adds up, the mark says so, and there is no red line.
  const clean = drawStatements(2026, null, [UNKNOWN_TYPE_ENTRY]);
  assert.deepEqual(['Assets', 'Liabilities + equity'].map((l) => figure(clean, l)), ['$19,600.02', '$19,600.02']);
  assert.match(clean, /<div[^>]*data-balance-mark="true"[^>]*>✓ Assets = Liabilities \+ Equity<\/div>/);
  assert.doesNotMatch(clean, /data-statement-unclassified|Out by/);

  // One book on its own: Business, 2026 — its name on the scope line, and it balances (its entry on Personal's Checking rides along).
  const business = drawStatements(2026, 'B');
  assert.match(business, /data-statement-scope-line="true"[^>]*>Business · 2026</);
  assert.deepEqual(['Assets', 'Liabilities', 'Equity accounts', 'Earnings not yet closed', 'Liabilities + equity'].map((l) => figure(business, l)),
    ['$2,050.02', '$0.00', '$0.00', '$2,050.02', '$2,050.02']);
  assert.match(business, /✓ Assets = Liabilities \+ Equity/);
  // A closed year: 2024's balance sheet runs through Dec 31, 2024, and its income statement is the year's real figure.
  const closed = drawStatements(2024, 'P');
  assert.match(closed, /<h3[^>]*>Balance Sheet · through Dec 31, 2024<\/h3>/);
  assert.equal(netIncomeDrawn(closed), '$3,880.00');
  assert.equal(figure(closed, 'Earnings not yet closed'), '$0.00', 'the close moved 2024\'s earnings into the equity accounts');
  assert.equal(figure(closed, 'Equity accounts'), '$8,880.00');
});

test('P3-4 a ratio whose divisor is 0 prints "N/A" — never a 0.0 for a ratio that does not exist; the all-assets-over-all-liabilities tile says what it divides', () => {
  assert.equal(RATIO_NONE_WORDS, 'N/A');
  assert.equal(ratioWords(500, 0, 'percent'), 'N/A');
  assert.equal(ratioWords(0, 0, 'times'), 'N/A');
  assert.equal(ratioWords(0, 500, 'percent'), '0.0%', 'a real zero is a zero');
  assert.equal(ratioWords(572_001, 570_001, 'percent'), '100.4%');
  assert.equal(ratioWords(-150, 600, 'percent'), '-25.0%');
  assert.equal(ratioWords(1_957_502, -5_000, 'times'), '-391.50', 'signed: the quotient of the two figures drawn');
  assert.equal(ratioWords(300, 200, 'times'), '1.50');
  // A book and year with nothing in them: three ratios that do not exist.
  const empty = renderToStaticMarkup(React.createElement(StatementsView, { scope: scopeOf(2023, 'B'), statements: statementsOf({ toDate: [], inPeriod: [] }) }));
  assert.equal(count(empty, /data-ratio="[a-z-]+">N\/A</g), 3);
  assert.doesNotMatch(empty, /0\.0%|>0\.00</);
  assert.match(empty, /✓ Assets = Liabilities \+ Equity/, 'nothing equals nothing');
  // A year with figures: the three ratios of the figures drawn.
  const all = drawStatements(2026, null, [UNKNOWN_TYPE_ENTRY]);
  assert.match(all, /data-ratio="net-income-over-revenue">100\.4%</);
  assert.match(all, /data-ratio="assets-over-liabilities">-392\.00</);
  assert.match(all, /data-ratio="net-income-over-equity">29\.1%</);
  const tab = code(STATEMENTS_TAB);
  assert.match(tab, /if \(divisor === 0\) return RATIO_NONE_WORDS;/);
  assert.match(tab, />Assets ÷ Liabilities</);
  assert.doesNotMatch(tab, /Current Ratio|'0\.0'/);
  assert.equal(count(tab, />Profit Margin</g), 1);
});

test('P3-5 the General Ledger section\'s subtitle is gone — a count nothing counted; the lines cited into BooksPipeline hold what they held', () => {
  const pipe = code(PIPE);
  assert.doesNotMatch(pipe, /committedCount \* 2/);
  assert.match(pipe, /<BookkeepingSection title="General Ledger" pipelineKey="LDG"\s+status=\{committedCount > 0 \? 'complete' : 'pending'\}>/, 'the section opens with its title, its key and its status — no subtitle');
  assert.equal(count(pipe, /`\$\{journalEntries\.length\} entries`/g), 1, 'Journal Entries keeps its count — that one is counted');
  // Every edit in the pipeline was made in place: the three lines other files cite did not move.
  const lines = pipe.split('\n');
  assert.ok(lines[284].includes('const uncommittedSpending = transactions.filter((t) => !t.journalProof);'), 'toolRegistry.ts cites :285');
  assert.equal(lines[327].trim(), ');', 'nav.ts cites :328 — the strip\'s last line');
  assert.ok(lines[326].includes('/>'));
  assert.ok(lines[583].includes('<GeneralLedger coaOptions={coaOptions}'), 'PipelineDeck.tsx cites :584');
});

test('P3-6 a read that fails prints the route\'s own reason; an answer without its figures is refused by name — never a blank, never a zero', async () => {
  assert.equal(failedAnswerWords('/api/statements', 403, { error: 'Tab not unlocked' }), 'Tab not unlocked');
  assert.equal(failedAnswerWords('/api/statements', 500, {}), '/api/statements answered 500 and gave no reason');
  assert.equal(failedAnswerWords('/api/cpa-export', 502, null), '/api/cpa-export answered 502 and gave no reason');
  assert.equal(failedAnswerWords('/api/cpa-export', 500, { error: '' }), '/api/cpa-export answered 500 and gave no reason');

  const choice: ScopeChoice = { bookId: 'P', year: 2026 };
  // The route's refusal is what the read throws — and the read asks with the book and the year.
  const refused = await underFetch({ status: 404, json: () => ({ error: 'Entity not found' }) }, () => readScoped('/api/statements', choice));
  assert.deepEqual(refused.urls, ['/api/statements?year=2026&entityId=P']);
  assert.ok(refused.result instanceof Error && refused.result.message === 'Entity not found');
  const notJson = await underFetch({ status: 504, json: () => { throw new SyntaxError('Unexpected token <'); } }, () => readScoped('/api/cpa-export', { bookId: null, year: 2025 }));
  assert.deepEqual(notJson.urls, ['/api/cpa-export?year=2025']);
  assert.ok(notJson.result instanceof Error && notJson.result.message === '/api/cpa-export answered 504 and its answer was not JSON');
  // A good answer comes back as it is.
  const good = await underFetch({ status: 200, json: () => statementsAnswer(2026, 'P') }, () => readScoped('/api/statements', choice));
  assert.deepEqual(statementsAnswerOf(good.result).statements.incomeStatement.netIncome, 452_000);

  // An answer that is 200 and lacks what the panel draws is refused by name.
  const answer = statementsAnswer(2026, 'P');
  assert.throws(() => statementsAnswerOf({ accounts: [], availableYears: [] }), { message: 'statements: the answer carries no readable scope' });
  assert.throws(() => statementsAnswerOf({ scope: answer.scope }), { message: 'statements: the answer carries no readable statements' });
  assert.throws(() => statementsAnswerOf(null), { message: 'statements: the answer carries no readable scope' });
  assert.throws(() => statementsAnswerOf({ ...answer, scope: { ...answer.scope, year: '2026' } }), { message: 'statements: the answer carries no readable scope.year' });
  assert.throws(() => statementsAnswerOf({ ...answer, scope: { ...answer.scope, entityName: undefined } }), { message: 'statements: the answer carries no readable scope.entityName' });
  assert.throws(() => statementsAnswerOf({ ...answer, scope: { ...answer.scope, through: '2026' } }), /is not a calendar day/);
  const without = (block: 'incomeStatement' | 'balanceSheet', name: string) => ({ ...answer, statements: { ...answer.statements, [block]: { ...answer.statements[block], [name]: undefined } } });
  assert.throws(() => statementsAnswerOf(without('balanceSheet', 'totalAssets')), { message: 'statements: the answer carries no readable balanceSheet.totalAssets' });
  assert.throws(() => statementsAnswerOf(without('incomeStatement', 'netIncome')), { message: 'statements: the answer carries no readable incomeStatement.netIncome' });
  assert.throws(() => statementsAnswerOf(without('balanceSheet', 'isBalanced')), { message: 'statements: the answer carries no readable balanceSheet.isBalanced' });
  assert.throws(() => statementsAnswerOf({ ...answer, statements: { ...answer.statements, balanceSheet: { ...answer.statements.balanceSheet, difference: 0.5 } } }), { message: 'statements: the answer carries no readable balanceSheet.difference' });
  assert.throws(() => statementsAnswerOf({ ...answer, statements: { ...answer.statements, unclassified: undefined } }), { message: 'statements: the answer carries no readable unclassified' });
  // The Export's period the same: its year, its last day and the book's name are read, or the answer is refused.
  const exported = exportAnswer(2026, 'P');
  assert.equal(exportAnswerOf(exported), exported);
  assert.throws(() => exportAnswerOf({}), { message: 'CPA export: the answer carries no readable period' });
  assert.throws(() => exportAnswerOf({ ...exported, period: { year: 2026, entityId: 'P' } }), { message: 'CPA export: the answer carries no readable period.entityName' });
  assert.throws(() => exportAnswerOf({ ...exported, period: { ...exported.period, through: undefined } }), /is not a calendar day/);

  // The panels print the reason in place, in red — and draw a statement only over an answer that was read.
  const tab = code(STATEMENTS_TAB);
  assert.match(tab, /\{shown !== null && !shown\.ok && <div role="alert" className="p-8 text-center text-brand-red" data-statements-failed>\{shown\.reason\}<\/div>\}/);
  assert.match(tab, /\{shown !== null && shown\.ok && <StatementsView scope=\{shown\.answer\.scope\} statements=\{shown\.answer\.statements\} \/>\}/);
  assert.match(tab, /\{shown === null && <div className="p-8 text-center">Loading statements\.\.\.<\/div>\}/);
  assert.doesNotMatch(tab, /Failed to load statements|\|\| 0\b|\?\? 0\b|console\.error/, 'no blank, no zero, no swallowed failure');
  const exp = code(EXPORT_TAB);
  assert.match(exp, /\{error !== null && <span role="alert" className="text-brand-red">Error: \{error\}<\/span>\}/);
  assert.match(exp, /const data = shown !== null && shown\.ok \? shown\.data : null;/);
  assert.doesNotMatch(exp, /\.catch\(\(\) => \(\{\}\)\)|\|\| `HTTP/, 'the swallowed body and the stand-in reason are gone');
});

test('P3-7 the Export names the book by its name — the status bar and the four CSV headings — says the day its balance sheet runs through, and calls the equity line what it is', () => {
  const personal = exportAnswer(2026, 'P');
  const everyBook = exportAnswer(2026, null);
  // The status bar: the year, the book by name, the balance sheet's last day.
  const status = drawExportStatus(2026, 'P');
  assert.match(status, /Year: <strong>2026<\/strong>/);
  assert.match(status, /Entity: <strong>Personal<\/strong>/);
  assert.match(status, /<span[^>]*data-export-through="true"[^>]*>balance sheet through Dec 31, 2026<\/span>/);
  assert.match(drawExportStatus(2025, null), /Entity: <strong>All books<\/strong>/);
  assert.match(drawExportStatus(2025, null), /balance sheet through Dec 31, 2025/);
  // The sheet's own mark: out by the unknown type with it in, balanced with it set aside.
  assert.match(drawExportStatus(2026, null), /Balance Sheet ✗/);
  assert.match(drawExportStatus(2026, null, [UNKNOWN_TYPE_ENTRY]), /Balance Sheet ✓/);
  // The four CSVs: the fourth line names the book — never an id, never an empty line.
  const csvs = [buildTrialBalanceCSV, buildIncomeStatementCSV, buildBalanceSheetCSV, buildGeneralLedgerCSV];
  for (const build of csvs) {
    assert.equal(build(personal).split('\n')[3], 'Entity: Personal', `${build.name}: the book by name`);
    assert.equal(build(everyBook).split('\n')[3], 'Entity: All books', `${build.name}: all books, said`);
    assert.equal(build(personal).split('\n')[2], FUNCTIONAL_CURRENCY_WORDS, `${build.name}: the unit line stays third`);
    assert.doesNotMatch(build(personal), /Entity: P\b/);
  }
  assert.deepEqual(buildTrialBalanceCSV(personal).split('\n').slice(0, 3), ['TRIAL BALANCE', '"For the Year Ended December 31, 2026"', FUNCTIONAL_CURRENCY_WORDS]);
  // The balance sheet CSV (the unknown-type posting set aside): every earlier year is in it, and the equity line is what no closing entry has moved yet.
  const sheet = buildBalanceSheetCSV(exportAnswer(2026, 'P', [UNKNOWN_TYPE_ENTRY])).split('\n');
  assert.ok(sheet.includes('3900,Retained Earnings,"$3,880.00"'), 'the 2024 close is in the 2026 balance sheet');
  assert.ok(sheet.includes(',Earnings not yet closed to equity,"$8,720.00"'), '2025 and 2026, not yet closed');
  assert.ok(sheet.includes(',Total Equity,"$17,600.00"'));
  assert.ok(sheet.includes(',Total Assets,"$17,550.00"'));
  assert.ok(sheet.includes(',TOTAL LIABILITIES + EQUITY,"$17,550.00"'));
  assert.ok(sheet.includes(',,BALANCED ✓'));
  assert.doesNotMatch(sheet.join('\n'), /Retained Earnings \(Net Income\)/);
  // With that posting in, the same sheet says it is out, and by how much — the function's own difference.
  const out = buildBalanceSheetCSV(personal).split('\n');
  assert.ok(out.includes(',Total Assets,"$17,525.00"'));
  assert.ok(out.includes(',TOTAL LIABILITIES + EQUITY,"$17,550.00"'));
  assert.ok(out.includes(',,OUT OF BALANCE ✗'));
  assert.ok(out.some((line) => line.includes('Difference: -$25.00')));
  const exp = code(EXPORT_TAB);
  assert.equal(count(exp, /\[`Entity: \$\{bookWordsOf\(period\.entityName\)\}`\],/g), 4);
  assert.doesNotMatch(exp, /period\.entityId \?|\{entityId\}|Retained Earnings \(Net Income\)/);
  assert.equal(count(exp, /\[FUNCTIONAL_CURRENCY_WORDS\],/g), 4);
  // A file is named by the year its data says it is — never by a select that has moved on.
  assert.equal(count(exp, /-\$\{data\.period\.year\}\.csv`/g), 8);
});

