'use client';

import { useState, useEffect } from 'react';
import { FUNCTIONAL_CURRENCY_WORDS, functionalMoneyWords } from '@/lib/books/functionalCurrency';
import StatementScopeSelect, { bookWordsOf, readScoped, startingChoiceOf, throughWordsOf, type ScopeChoice, type ScopeProps } from '@/components/dashboard/StatementScopeSelect';

// ═══════════════════════════════════════════════════════════════════
// CPAExport — Generates accountant-ready CSV reports (Trial Balance,
// Income Statement, Balance Sheet, General Ledger) from the GENERAL
// LEDGER via /api/cpa-export. Debit/credit is taken from
// ledger_entries.entry_type ('D'/'C'), NOT from Plaid amount sign.
// ═══════════════════════════════════════════════════════════════════
//
// BOOKS-01 (Alex, 2026-11-11 12:08: "get bookkeeping full proof") — THE EXPORT SAYS ITS BOOK AND YEAR. It was handed
// the current year and the default book and printed the book as an id; now it holds its own choice in the one control
// Financial Statements mounts too (StatementScopeSelect), and every heading names the book by the name the route read
// (`period.entityName`; "All books" when none). Its income statement and balance sheet are the one function's figures
// (src/lib/books/statements.ts, through the route) — the same net income Financial Statements draws for the same book
// and year — and the balance sheet runs through the year's last day with every earlier year in it, which the status
// bar says. The equity line that carried the year's net income as 'Retained Earnings (Net Income)' is what no closing
// entry has moved into equity yet: 'Earnings not yet closed to equity'.

interface TrialBalanceRow {
  accountCode: string;
  accountName: string;
  accountType: string;
  balanceType: 'D' | 'C';
  totalDebits: number;
  totalCredits: number;
  debitBalance: number;
  creditBalance: number;
}

interface StatementLine {
  accountCode: string;
  accountName: string;
  amount: number;
}

interface LedgerLine {
  date: string;
  journalEntryId: string;
  description: string;
  accountCode: string;
  accountName: string;
  accountType: string;
  entryType: 'D' | 'C';
  amount: number;
  sourceType: string;
  sourceId: string | null;
}

export interface CPAExportData {
  period: { year: number; entityId: string | null; through: string; entityName: string | null };
  trialBalance: {
    rows: TrialBalanceRow[];
    totals: {
      totalDebits: number;
      totalCredits: number;
      difference: number;
      isBalanced: boolean;
    };
  };
  incomeStatement: {
    revenue: StatementLine[];
    expenses: StatementLine[];
    totals: { totalRevenue: number; totalExpenses: number; netIncome: number };
  };
  balanceSheet: {
    assets: StatementLine[];
    liabilities: StatementLine[];
    equity: StatementLine[];
    retainedEarnings: number;
    totals: {
      totalAssets: number;
      totalLiabilities: number;
      totalEquity: number;
      difference: number;
      isBalanced: boolean;
    };
  };
  generalLedger: LedgerLine[];
}

// ─── CSV helpers ────────────────────────────────────────────────────

function csvEscape(value: unknown): string {
  const s = value == null ? '' : String(value);
  if (s.includes(',') || s.includes('"') || s.includes('\n')) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

function rowsToCSV(rows: unknown[][]): string {
  return rows.map((r) => r.map(csvEscape).join(',')).join('\n');
}

function downloadCSV(csv: string, filename: string) {
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

// FX-01 (2026-10-30, ruling B): every figure /api/cpa-export hands over is integer CENTS; each is written
// by the books' one formatter (functionalMoneyWords), and every CSV states its unit in a header line
// (FUNCTIONAL_CURRENCY_WORDS). The local toFixed formatter is gone.

// ─── CSV generators (format data → CSV string) ──────────────────────

export function buildTrialBalanceCSV(data: CPAExportData): string {
  const { trialBalance, period } = data;
  const rows: unknown[][] = [
    ['TRIAL BALANCE'],
    [`For the Year Ended December 31, ${period.year}`],
    [FUNCTIONAL_CURRENCY_WORDS],
    [`Entity: ${bookWordsOf(period.entityName)}`],
    [],
    ['Account Code', 'Account Name', 'Account Type', 'Debit Balance', 'Credit Balance'],
  ];

  for (const r of trialBalance.rows) {
    rows.push([
      r.accountCode,
      r.accountName,
      r.accountType,
      r.debitBalance ? functionalMoneyWords(r.debitBalance) : '',
      r.creditBalance ? functionalMoneyWords(r.creditBalance) : '',
    ]);
  }

  rows.push([]);
  rows.push([
    '',
    'TOTALS',
    '',
    functionalMoneyWords(trialBalance.totals.totalDebits),
    functionalMoneyWords(trialBalance.totals.totalCredits),
  ]);
  rows.push([]);
  rows.push([
    '',
    'VERIFICATION',
    '',
    `Difference: ${functionalMoneyWords(trialBalance.totals.difference)}`,
    trialBalance.totals.isBalanced ? 'BALANCED ✓' : 'OUT OF BALANCE ✗',
  ]);

  return rowsToCSV(rows);
}

export function buildIncomeStatementCSV(data: CPAExportData): string {
  const { incomeStatement, period } = data;
  const rows: unknown[][] = [
    ['INCOME STATEMENT'],
    [`For the Year Ended December 31, ${period.year}`],
    [FUNCTIONAL_CURRENCY_WORDS],
    [`Entity: ${bookWordsOf(period.entityName)}`],
    [],
    ['Account Code', 'Account Name', 'Amount'],
    [],
    ['', 'REVENUE', ''],
  ];

  for (const l of incomeStatement.revenue) {
    rows.push([l.accountCode, l.accountName, functionalMoneyWords(l.amount)]);
  }
  rows.push(['', 'Total Revenue', functionalMoneyWords(incomeStatement.totals.totalRevenue)]);
  rows.push([]);
  rows.push(['', 'EXPENSES', '']);
  for (const l of incomeStatement.expenses) {
    rows.push([l.accountCode, l.accountName, functionalMoneyWords(l.amount)]);
  }
  rows.push(['', 'Total Expenses', functionalMoneyWords(incomeStatement.totals.totalExpenses)]);
  rows.push([]);
  rows.push(['', 'NET INCOME', functionalMoneyWords(incomeStatement.totals.netIncome)]);

  return rowsToCSV(rows);
}

export function buildBalanceSheetCSV(data: CPAExportData): string {
  const { balanceSheet, period } = data;
  const rows: unknown[][] = [
    ['BALANCE SHEET'],
    [`As of December 31, ${period.year}`],
    [FUNCTIONAL_CURRENCY_WORDS],
    [`Entity: ${bookWordsOf(period.entityName)}`],
    [],
    ['Account Code', 'Account Name', 'Amount'],
    [],
    ['', 'ASSETS', ''],
  ];

  for (const l of balanceSheet.assets) {
    rows.push([l.accountCode, l.accountName, functionalMoneyWords(l.amount)]);
  }
  rows.push(['', 'Total Assets', functionalMoneyWords(balanceSheet.totals.totalAssets)]);
  rows.push([]);

  rows.push(['', 'LIABILITIES', '']);
  for (const l of balanceSheet.liabilities) {
    rows.push([l.accountCode, l.accountName, functionalMoneyWords(l.amount)]);
  }
  rows.push(['', 'Total Liabilities', functionalMoneyWords(balanceSheet.totals.totalLiabilities)]);
  rows.push([]);

  rows.push(['', 'EQUITY', '']);
  for (const l of balanceSheet.equity) {
    rows.push([l.accountCode, l.accountName, functionalMoneyWords(l.amount)]);
  }
  rows.push(['', 'Earnings not yet closed to equity', functionalMoneyWords(balanceSheet.retainedEarnings)]);
  rows.push(['', 'Total Equity', functionalMoneyWords(balanceSheet.totals.totalEquity)]);
  rows.push([]);

  rows.push([
    '',
    'TOTAL LIABILITIES + EQUITY',
    functionalMoneyWords(
      balanceSheet.totals.totalLiabilities + balanceSheet.totals.totalEquity
    ),
  ]);
  rows.push([]);
  rows.push([
    '',
    'VERIFICATION',
    `Assets: ${functionalMoneyWords(balanceSheet.totals.totalAssets)} | L+E: ${functionalMoneyWords(
      balanceSheet.totals.totalLiabilities + balanceSheet.totals.totalEquity
    )} | Difference: ${functionalMoneyWords(balanceSheet.totals.difference)}`,
  ]);
  rows.push([
    '',
    '',
    balanceSheet.totals.isBalanced ? 'BALANCED ✓' : 'OUT OF BALANCE ✗',
  ]);

  return rowsToCSV(rows);
}

export function buildGeneralLedgerCSV(data: CPAExportData): string {
  const { generalLedger, period } = data;
  const rows: unknown[][] = [
    ['GENERAL LEDGER'],
    [`For the Year ${period.year}`],
    [FUNCTIONAL_CURRENCY_WORDS],
    [`Entity: ${bookWordsOf(period.entityName)}`],
    [],
    [
      'Date',
      'Journal Entry ID',
      'Description',
      'Account Code',
      'Account Name',
      'Debit',
      'Credit',
      'Source Type',
      'Source ID',
    ],
  ];

  let totalDebits = 0;
  let totalCredits = 0;
  for (const e of generalLedger) {
    const debit = e.entryType === 'D' ? e.amount : 0;
    const credit = e.entryType === 'C' ? e.amount : 0;
    totalDebits += debit;
    totalCredits += credit;
    rows.push([
      e.date,
      e.journalEntryId,
      e.description,
      e.accountCode,
      e.accountName,
      debit ? functionalMoneyWords(debit) : '',
      credit ? functionalMoneyWords(credit) : '',
      e.sourceType,
      e.sourceId || '',
    ]);
  }

  rows.push([]);
  rows.push([
    '',
    '',
    '',
    '',
    'TOTALS',
    functionalMoneyWords(totalDebits),
    functionalMoneyWords(totalCredits),
    '',
    '',
  ]);
  rows.push([]);
  rows.push([
    '',
    '',
    '',
    '',
    'VERIFICATION',
    `Difference: ${functionalMoneyWords(totalDebits - totalCredits)}`,
    totalDebits === totalCredits ? 'BALANCED ✓' : 'OUT OF BALANCE ✗',
    '',
    '',
  ]);

  return rowsToCSV(rows);
}

// ─── The answer, read ───────────────────────────────────────────────

const unreadableWords = (what: string): string => `CPA export: the answer carries no readable ${what}`;

/**
 * THE PERIOD, READ: the year, the balance sheet's last day and the book's name are what the headings and the status
 * bar print — a period without them throws by name, and the panel prints the words. Nothing stands in for one.
 */
export function exportAnswerOf(body: unknown): CPAExportData {
  const period = (body as { period?: unknown } | null | undefined)?.period as Partial<CPAExportData['period']> | null | undefined;
  if (typeof period !== 'object' || period === null) throw new Error(unreadableWords('period'));
  if (!Number.isSafeInteger(period.year)) throw new Error(unreadableWords('period.year'));
  if (period.entityName !== null && typeof period.entityName !== 'string') throw new Error(unreadableWords('period.entityName'));
  throughWordsOf(period.through);
  return body as CPAExportData;
}

/** The read: /api/cpa-export for the panel's own book and year. A failure throws the words the panel prints. */
const fetchExport = async (choice: ScopeChoice): Promise<CPAExportData> => exportAnswerOf(await readScoped('/api/cpa-export', choice));

// ─── Component ──────────────────────────────────────────────────────

/**
 * WHAT THE EXPORT HOLDS, in the route's words: the year, the book by its name, the day the balance sheet runs through,
 * then the counts, the two marks and the net income. No state, no fetch.
 */
export function ExportStatus({ data }: { data: CPAExportData }) {
  return (
    <>
      <span className="text-text-secondary">
        Year: <strong>{data.period.year}</strong>
      </span>
      <span className="text-text-secondary">
        Entity: <strong>{bookWordsOf(data.period.entityName)}</strong>
      </span>
      <span className="text-text-secondary" data-export-through>
        {`balance sheet through ${throughWordsOf(data.period.through)}`}
      </span>
      <span className="text-text-secondary">
        Accounts: <strong>{data.trialBalance.rows.length}</strong>
      </span>
      <span className="text-text-secondary">
        Ledger lines: <strong>{data.generalLedger.length}</strong>
      </span>
      <span className={data.trialBalance.totals.isBalanced ? 'text-brand-green' : 'text-brand-red'}>
        {data.trialBalance.totals.isBalanced ? 'Trial Balance ✓' : 'Trial Balance ✗'}
      </span>
      <span className={data.balanceSheet.totals.isBalanced ? 'text-brand-green' : 'text-brand-red'}>
        {data.balanceSheet.totals.isBalanced ? 'Balance Sheet ✓' : 'Balance Sheet ✗'}
      </span>
      <span className="text-text-secondary">
        Net Income: <strong data-net-income>{functionalMoneyWords(data.incomeStatement.totals.netIncome)}</strong> <span className="text-text-faint" data-functional-currency>{FUNCTIONAL_CURRENCY_WORDS}</span>
      </span>
    </>
  );
}

/** What a read came to, and the choice it was read for. */
type Outcome =
  | { readonly choice: ScopeChoice; readonly ok: true; readonly data: CPAExportData }
  | { readonly choice: ScopeChoice; readonly ok: false; readonly reason: string };

export default function CPAExport({ books, defaultBookId, years, currentYear }: ScopeProps) {
  // The panel's OWN choice — it starts on the default book and the current year, and Financial Statements keeps its own.
  const [choice, setChoice] = useState<ScopeChoice>(() => startingChoiceOf(defaultBookId, currentYear));
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  const [exporting, setExporting] = useState<string | null>(null);

  useEffect(() => {
    // Only the newest choice's answer is kept: an earlier read that lands late is dropped.
    let newest = true;
    fetchExport(choice).then(
      (answer) => { if (newest) setOutcome({ choice, ok: true, data: answer }); },
      (failure: unknown) => { if (newest) setOutcome({ choice, ok: false, reason: failure instanceof Error ? failure.message : String(failure) }); },
    );
    return () => { newest = false; };
  }, [choice]);

  // An outcome is used only under the choice it was read for: while another book or year is being read there is NO
  // data — the buttons stand down, so a file is never one scope's figures under another's name.
  const shown = outcome !== null && outcome.choice === choice ? outcome : null;
  const loading = shown === null;
  const error = shown !== null && !shown.ok ? shown.reason : null;
  const data = shown !== null && shown.ok ? shown.data : null;

  // Each file is named by the year its data says it is.
  const exportTrialBalance = () => {
    if (!data) return;
    setExporting('trial-balance');
    downloadCSV(buildTrialBalanceCSV(data), `trial-balance-${data.period.year}.csv`);
    setExporting(null);
  };

  const exportIncomeStatement = () => {
    if (!data) return;
    setExporting('income-statement');
    downloadCSV(buildIncomeStatementCSV(data), `income-statement-${data.period.year}.csv`);
    setExporting(null);
  };

  const exportBalanceSheet = () => {
    if (!data) return;
    setExporting('balance-sheet');
    downloadCSV(buildBalanceSheetCSV(data), `balance-sheet-${data.period.year}.csv`);
    setExporting(null);
  };

  const exportGeneralLedger = () => {
    if (!data) return;
    setExporting('general-ledger');
    downloadCSV(buildGeneralLedgerCSV(data), `general-ledger-${data.period.year}.csv`);
    setExporting(null);
  };

  const exportAll = async () => {
    if (!data) return;
    setExporting('all');
    downloadCSV(buildTrialBalanceCSV(data), `trial-balance-${data.period.year}.csv`);
    await new Promise((r) => setTimeout(r, 400));
    downloadCSV(buildIncomeStatementCSV(data), `income-statement-${data.period.year}.csv`);
    await new Promise((r) => setTimeout(r, 400));
    downloadCSV(buildBalanceSheetCSV(data), `balance-sheet-${data.period.year}.csv`);
    await new Promise((r) => setTimeout(r, 400));
    downloadCSV(buildGeneralLedgerCSV(data), `general-ledger-${data.period.year}.csv`);
    setExporting(null);
  };

  return (
    <div className="bg-white overflow-hidden">
      <div className="px-3 py-2 border-b border-border flex items-center justify-between">
        <span className="text-terminal-sm text-text-muted font-mono">
          Export accountant-ready reports (sourced from the general ledger)
        </span>
        <button
          onClick={exportAll}
          disabled={exporting !== null || !data || loading}
          className="px-4 py-2 text-sm bg-brand-gold hover:bg-brand-gold-bright text-white font-semibold rounded-lg transition-colors disabled:opacity-50"
        >
          {exporting === 'all' ? 'Exporting...' : 'Export All'}
        </button>
      </div>

      {/* Status bar */}
      <div className="px-4 py-2 border-b border-border bg-bg-row flex flex-wrap items-center gap-6 text-sm">
        <StatementScopeSelect books={books} years={years} currentYear={currentYear} choice={choice} onChange={setChoice} />
        {loading && <span className="text-text-muted">Loading ledger...</span>}
        {error !== null && <span role="alert" className="text-brand-red">Error: {error}</span>}
        {data !== null && <ExportStatus data={data} />}
      </div>

      {/* Export options */}
      <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="border rounded p-4 hover:bg-bg-row">
          <div className="flex items-start justify-between">
            <div>
              <h4 className="font-medium">📊 Trial Balance</h4>
              <p className="text-xs text-text-muted mt-1">
                Per-account debit/credit balances from the ledger. Debits must equal credits.
              </p>
            </div>
            <button
              onClick={exportTrialBalance}
              disabled={exporting !== null || !data}
              className="px-3 py-1.5 border rounded text-sm hover:bg-bg-row disabled:opacity-50"
            >
              {exporting === 'trial-balance' ? '...' : 'Export CSV'}
            </button>
          </div>
        </div>

        <div className="border rounded p-4 hover:bg-bg-row">
          <div className="flex items-start justify-between">
            <div>
              <h4 className="font-medium">📈 Income Statement</h4>
              <p className="text-xs text-text-muted mt-1">
                Revenue minus expenses. Revenue nets credits − debits; expenses net debits − credits.
              </p>
            </div>
            <button
              onClick={exportIncomeStatement}
              disabled={exporting !== null || !data}
              className="px-3 py-1.5 border rounded text-sm hover:bg-bg-row disabled:opacity-50"
            >
              {exporting === 'income-statement' ? '...' : 'Export CSV'}
            </button>
          </div>
        </div>

        <div className="border rounded p-4 hover:bg-bg-row">
          <div className="flex items-start justify-between">
            <div>
              <h4 className="font-medium">📋 Balance Sheet</h4>
              <p className="text-xs text-text-muted mt-1">
                Assets = Liabilities + Equity. Retained earnings rolls net income into equity.
              </p>
            </div>
            <button
              onClick={exportBalanceSheet}
              disabled={exporting !== null || !data}
              className="px-3 py-1.5 border rounded text-sm hover:bg-bg-row disabled:opacity-50"
            >
              {exporting === 'balance-sheet' ? '...' : 'Export CSV'}
            </button>
          </div>
        </div>

        <div className="border rounded p-4 hover:bg-bg-row">
          <div className="flex items-start justify-between">
            <div>
              <h4 className="font-medium">📒 General Ledger</h4>
              <p className="text-xs text-text-muted mt-1">
                Every posted ledger entry in chronological order. Full audit trail.
              </p>
            </div>
            <button
              onClick={exportGeneralLedger}
              disabled={exporting !== null || !data}
              className="px-3 py-1.5 border rounded text-sm hover:bg-bg-row disabled:opacity-50"
            >
              {exporting === 'general-ledger' ? '...' : 'Export CSV'}
            </button>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="px-4 py-3 border-t bg-bg-row text-xs text-text-muted">
        💡 Sourced from journal_entries + ledger_entries (reversals excluded). Open CSV files in Excel or Google Sheets.
      </div>
    </div>
  );
}
