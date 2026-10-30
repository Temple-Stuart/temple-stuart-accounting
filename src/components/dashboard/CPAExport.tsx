'use client';

import { useState, useEffect, useCallback } from 'react';
import { FUNCTIONAL_CURRENCY_WORDS, functionalMoneyWords } from '@/lib/books/functionalCurrency';


// ═══════════════════════════════════════════════════════════════════
// CPAExport — Generates accountant-ready CSV reports (Trial Balance,
// Income Statement, Balance Sheet, General Ledger) from the GENERAL
// LEDGER via /api/cpa-export. Debit/credit is taken from
// ledger_entries.entry_type ('D'/'C'), NOT from Plaid amount sign.
// ═══════════════════════════════════════════════════════════════════

interface CPAExportProps {
  year: number;
  entityId?: string | null;
}

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

interface CPAExportData {
  period: { year: number; entityId: string | null };
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

function buildTrialBalanceCSV(data: CPAExportData): string {
  const { trialBalance, period } = data;
  const rows: unknown[][] = [
    ['TRIAL BALANCE'],
    [`For the Year Ended December 31, ${period.year}`],
    [FUNCTIONAL_CURRENCY_WORDS],
    period.entityId ? [`Entity: ${period.entityId}`] : [],
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

function buildIncomeStatementCSV(data: CPAExportData): string {
  const { incomeStatement, period } = data;
  const rows: unknown[][] = [
    ['INCOME STATEMENT'],
    [`For the Year Ended December 31, ${period.year}`],
    [FUNCTIONAL_CURRENCY_WORDS],
    period.entityId ? [`Entity: ${period.entityId}`] : [],
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

function buildBalanceSheetCSV(data: CPAExportData): string {
  const { balanceSheet, period } = data;
  const rows: unknown[][] = [
    ['BALANCE SHEET'],
    [`As of December 31, ${period.year}`],
    [FUNCTIONAL_CURRENCY_WORDS],
    period.entityId ? [`Entity: ${period.entityId}`] : [],
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
  rows.push(['', 'Retained Earnings (Net Income)', functionalMoneyWords(balanceSheet.retainedEarnings)]);
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

function buildGeneralLedgerCSV(data: CPAExportData): string {
  const { generalLedger, period } = data;
  const rows: unknown[][] = [
    ['GENERAL LEDGER'],
    [`For the Year ${period.year}`],
    [FUNCTIONAL_CURRENCY_WORDS],
    period.entityId ? [`Entity: ${period.entityId}`] : [],
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

// ─── Component ──────────────────────────────────────────────────────

export default function CPAExport({ year, entityId }: CPAExportProps & { }) {
  const [data, setData] = useState<CPAExportData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [exporting, setExporting] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const qs = new URLSearchParams({ year: String(year) });
      if (entityId) qs.set('entityId', entityId);
      const res = await fetch(`/api/cpa-export?${qs.toString()}`);
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `HTTP ${res.status}`);
      }
      setData(await res.json());
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load CPA export data');
    } finally {
      setLoading(false);
    }
  }, [year, entityId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const exportTrialBalance = () => {
    if (!data) return;
    setExporting('trial-balance');
    downloadCSV(buildTrialBalanceCSV(data), `trial-balance-${year}.csv`);
    setExporting(null);
  };

  const exportIncomeStatement = () => {
    if (!data) return;
    setExporting('income-statement');
    downloadCSV(buildIncomeStatementCSV(data), `income-statement-${year}.csv`);
    setExporting(null);
  };

  const exportBalanceSheet = () => {
    if (!data) return;
    setExporting('balance-sheet');
    downloadCSV(buildBalanceSheetCSV(data), `balance-sheet-${year}.csv`);
    setExporting(null);
  };

  const exportGeneralLedger = () => {
    if (!data) return;
    setExporting('general-ledger');
    downloadCSV(buildGeneralLedgerCSV(data), `general-ledger-${year}.csv`);
    setExporting(null);
  };

  const exportAll = async () => {
    if (!data) return;
    setExporting('all');
    downloadCSV(buildTrialBalanceCSV(data), `trial-balance-${year}.csv`);
    await new Promise((r) => setTimeout(r, 400));
    downloadCSV(buildIncomeStatementCSV(data), `income-statement-${year}.csv`);
    await new Promise((r) => setTimeout(r, 400));
    downloadCSV(buildBalanceSheetCSV(data), `balance-sheet-${year}.csv`);
    await new Promise((r) => setTimeout(r, 400));
    downloadCSV(buildGeneralLedgerCSV(data), `general-ledger-${year}.csv`);
    setExporting(null);
  };

  const stats = data
    ? {
        accounts: data.trialBalance.rows.length,
        ledgerLines: data.generalLedger.length,
        isBalanced: data.trialBalance.totals.isBalanced,
        sheetBalanced: data.balanceSheet.totals.isBalanced,
        netIncome: data.incomeStatement.totals.netIncome,
      }
    : null;

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
      <div className="px-4 py-2 border-b border-border bg-bg-row flex items-center gap-6 text-sm">
        <span className="text-text-secondary">
          Year: <strong>{year}</strong>
        </span>
        {entityId && (
          <span className="text-text-secondary">
            Entity: <strong className="font-mono text-xs">{entityId}</strong>
          </span>
        )}
        {loading && <span className="text-text-muted">Loading ledger...</span>}
        {error && <span className="text-brand-red">Error: {error}</span>}
        {stats && (
          <>
            <span className="text-text-secondary">
              Accounts: <strong>{stats.accounts}</strong>
            </span>
            <span className="text-text-secondary">
              Ledger lines: <strong>{stats.ledgerLines}</strong>
            </span>
            <span
              className={
                stats.isBalanced ? 'text-brand-green' : 'text-brand-red'
              }
            >
              {stats.isBalanced ? 'Trial Balance ✓' : 'Trial Balance ✗'}
            </span>
            <span
              className={
                stats.sheetBalanced ? 'text-brand-green' : 'text-brand-red'
              }
            >
              {stats.sheetBalanced ? 'Balance Sheet ✓' : 'Balance Sheet ✗'}
            </span>
            <span className="text-text-secondary">
              Net Income: <strong>{functionalMoneyWords(stats.netIncome)}</strong> <span className="text-text-faint" data-functional-currency>{FUNCTIONAL_CURRENCY_WORDS}</span>
            </span>
          </>
        )}
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
