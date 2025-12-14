'use client';

import { useState } from 'react';

interface Transaction {
  id: string;
  date: string;
  name: string;
  amount: number;
  accountCode: string | null;
  subAccount: string | null;
}

interface CoaOption {
  id: string;
  code: string;
  name: string;
  accountType: string;
}

interface CPAExportProps {
  transactions: Transaction[];
  coaOptions: CoaOption[];
  selectedYear: number;
}

export default function CPAExport({ transactions, coaOptions, selectedYear }: CPAExportProps) {
  const [exporting, setExporting] = useState<string | null>(null);

  const getCoaName = (code: string) => coaOptions.find(c => c.code === code)?.name || code;
  const getCoaType = (code: string) => coaOptions.find(c => c.code === code)?.accountType || '';

  const yearTxns = transactions.filter(t => new Date(t.date).getFullYear() === selectedYear);

  // Build account totals
  const accountTotals: Record<string, number> = {};
  yearTxns.forEach(t => {
    if (t.accountCode) {
      accountTotals[t.accountCode] = (accountTotals[t.accountCode] || 0) + t.amount;
    }
  });

  const generateCSV = (data: string[][], filename: string) => {
    const csv = data.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  const exportTrialBalance = () => {
    setExporting('trial-balance');
    
    const rows: string[][] = [
      ['TRIAL BALANCE'],
      [`As of December 31, ${selectedYear}`],
      [''],
      ['Account Code', 'Account Name', 'Account Type', 'Debit', 'Credit']
    ];

    let totalDebits = 0;
    let totalCredits = 0;

    Object.entries(accountTotals)
      .sort((a, b) => a[0].localeCompare(b[0]))
      .forEach(([code, total]) => {
        const debit = total > 0 ? total : 0;
        const credit = total < 0 ? Math.abs(total) : 0;
        totalDebits += debit;
        totalCredits += credit;
        rows.push([
          code,
          getCoaName(code),
          getCoaType(code),
          debit ? debit.toFixed(2) : '',
          credit ? credit.toFixed(2) : ''
        ]);
      });

    rows.push(['']);
    rows.push(['', 'TOTALS', '', totalDebits.toFixed(2), totalCredits.toFixed(2)]);
    rows.push(['']);
    rows.push(['', 'Difference', '', (totalDebits - totalCredits).toFixed(2), '']);

    generateCSV(rows, `trial-balance-${selectedYear}.csv`);
    setExporting(null);
  };

  const exportIncomeStatement = () => {
    setExporting('income-statement');

    const rows: string[][] = [
      ['INCOME STATEMENT'],
      [`For the Year Ended December 31, ${selectedYear}`],
      [''],
      ['Account Code', 'Account Name', 'Amount']
    ];

    // Revenue
    rows.push(['', 'REVENUE', '']);
    let totalRevenue = 0;
    Object.entries(accountTotals)
      .filter(([code]) => getCoaType(code) === 'revenue')
      .sort((a, b) => a[0].localeCompare(b[0]))
      .forEach(([code, total]) => {
        const amount = Math.abs(total);
        totalRevenue += amount;
        rows.push([code, getCoaName(code), amount.toFixed(2)]);
      });
    rows.push(['', 'Total Revenue', totalRevenue.toFixed(2)]);
    rows.push(['']);

    // Expenses
    rows.push(['', 'EXPENSES', '']);
    let totalExpenses = 0;
    Object.entries(accountTotals)
      .filter(([code]) => getCoaType(code) === 'expense')
      .sort((a, b) => a[0].localeCompare(b[0]))
      .forEach(([code, total]) => {
        const amount = Math.abs(total);
        totalExpenses += amount;
        rows.push([code, getCoaName(code), amount.toFixed(2)]);
      });
    rows.push(['', 'Total Expenses', totalExpenses.toFixed(2)]);
    rows.push(['']);

    // Net Income
    rows.push(['', 'NET INCOME', (totalRevenue - totalExpenses).toFixed(2)]);

    generateCSV(rows, `income-statement-${selectedYear}.csv`);
    setExporting(null);
  };

  const exportBalanceSheet = () => {
    setExporting('balance-sheet');

    const rows: string[][] = [
      ['BALANCE SHEET'],
      [`As of December 31, ${selectedYear}`],
      [''],
      ['Account Code', 'Account Name', 'Amount']
    ];

    // Assets
    rows.push(['', 'ASSETS', '']);
    let totalAssets = 0;
    Object.entries(accountTotals)
      .filter(([code]) => getCoaType(code) === 'asset')
      .sort((a, b) => a[0].localeCompare(b[0]))
      .forEach(([code, total]) => {
        const amount = Math.abs(total);
        totalAssets += amount;
        rows.push([code, getCoaName(code), amount.toFixed(2)]);
      });
    rows.push(['', 'Total Assets', totalAssets.toFixed(2)]);
    rows.push(['']);

    // Liabilities
    rows.push(['', 'LIABILITIES', '']);
    let totalLiabilities = 0;
    Object.entries(accountTotals)
      .filter(([code]) => getCoaType(code) === 'liability')
      .sort((a, b) => a[0].localeCompare(b[0]))
      .forEach(([code, total]) => {
        const amount = Math.abs(total);
        totalLiabilities += amount;
        rows.push([code, getCoaName(code), amount.toFixed(2)]);
      });
    rows.push(['', 'Total Liabilities', totalLiabilities.toFixed(2)]);
    rows.push(['']);

    // Equity
    rows.push(['', 'EQUITY', '']);
    let totalEquity = 0;
    Object.entries(accountTotals)
      .filter(([code]) => getCoaType(code) === 'equity')
      .sort((a, b) => a[0].localeCompare(b[0]))
      .forEach(([code, total]) => {
        const amount = Math.abs(total);
        totalEquity += amount;
        rows.push([code, getCoaName(code), amount.toFixed(2)]);
      });
    
    // Add retained earnings (net income)
    const totalRevenue = Object.entries(accountTotals)
      .filter(([code]) => getCoaType(code) === 'revenue')
      .reduce((sum, [, total]) => sum + Math.abs(total), 0);
    const totalExpenses = Object.entries(accountTotals)
      .filter(([code]) => getCoaType(code) === 'expense')
      .reduce((sum, [, total]) => sum + Math.abs(total), 0);
    const netIncome = totalRevenue - totalExpenses;
    totalEquity += netIncome;
    rows.push(['', 'Retained Earnings (Net Income)', netIncome.toFixed(2)]);
    rows.push(['', 'Total Equity', totalEquity.toFixed(2)]);
    rows.push(['']);

    rows.push(['', 'TOTAL LIABILITIES + EQUITY', (totalLiabilities + totalEquity).toFixed(2)]);

    generateCSV(rows, `balance-sheet-${selectedYear}.csv`);
    setExporting(null);
  };

  const exportGeneralLedger = () => {
    setExporting('general-ledger');

    const rows: string[][] = [
      ['GENERAL LEDGER'],
      [`For the Year ${selectedYear}`],
      [''],
      ['Date', 'Account Code', 'Account Name', 'Description', 'Vendor', 'Debit', 'Credit']
    ];

    yearTxns
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
      .forEach(t => {
        const debit = t.amount > 0 ? t.amount : 0;
        const credit = t.amount < 0 ? Math.abs(t.amount) : 0;
        rows.push([
          new Date(t.date).toLocaleDateString(),
          t.accountCode || 'UNCATEGORIZED',
          t.accountCode ? getCoaName(t.accountCode) : 'Uncategorized',
          t.name,
          t.subAccount || '',
          debit ? debit.toFixed(2) : '',
          credit ? credit.toFixed(2) : ''
        ]);
      });

    generateCSV(rows, `general-ledger-${selectedYear}.csv`);
    setExporting(null);
  };

  const exportAll = async () => {
    setExporting('all');
    exportTrialBalance();
    await new Promise(r => setTimeout(r, 500));
    exportIncomeStatement();
    await new Promise(r => setTimeout(r, 500));
    exportBalanceSheet();
    await new Promise(r => setTimeout(r, 500));
    exportGeneralLedger();
    setExporting(null);
  };

  const stats = {
    accounts: Object.keys(accountTotals).length,
    transactions: yearTxns.length,
    uncategorized: yearTxns.filter(t => !t.accountCode).length
  };

  return (
    <div className="bg-white rounded-xl border overflow-hidden">
      <div className="px-4 py-3 border-b bg-gray-50">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-semibold">CPA Export Package</h3>
            <p className="text-xs text-gray-500">Export financial reports for your accountant</p>
          </div>
          <button
            onClick={exportAll}
            disabled={exporting !== null}
            className="px-4 py-2 bg-[#b4b237] text-white rounded-lg text-sm font-medium disabled:opacity-50"
          >
            {exporting === 'all' ? 'Exporting...' : '📦 Export All'}
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="px-4 py-3 border-b bg-blue-50 flex items-center gap-6 text-sm">
        <span className="text-gray-600">Year: <strong>{selectedYear}</strong></span>
        <span className="text-gray-600">Accounts: <strong>{stats.accounts}</strong></span>
        <span className="text-gray-600">Transactions: <strong>{stats.transactions}</strong></span>
        {stats.uncategorized > 0 && (
          <span className="text-red-600">⚠️ {stats.uncategorized} uncategorized</span>
        )}
      </div>

      {/* Export Options */}
      <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="border rounded-lg p-4 hover:bg-gray-50">
          <div className="flex items-start justify-between">
            <div>
              <h4 className="font-medium">📊 Trial Balance</h4>
              <p className="text-xs text-gray-500 mt-1">Debits and credits by account - verifies books are balanced</p>
            </div>
            <button
              onClick={exportTrialBalance}
              disabled={exporting !== null}
              className="px-3 py-1.5 border rounded text-sm hover:bg-gray-100 disabled:opacity-50"
            >
              {exporting === 'trial-balance' ? '...' : 'Export CSV'}
            </button>
          </div>
        </div>

        <div className="border rounded-lg p-4 hover:bg-gray-50">
          <div className="flex items-start justify-between">
            <div>
              <h4 className="font-medium">📈 Income Statement</h4>
              <p className="text-xs text-gray-500 mt-1">Revenue minus expenses = Net Income (P&L)</p>
            </div>
            <button
              onClick={exportIncomeStatement}
              disabled={exporting !== null}
              className="px-3 py-1.5 border rounded text-sm hover:bg-gray-100 disabled:opacity-50"
            >
              {exporting === 'income-statement' ? '...' : 'Export CSV'}
            </button>
          </div>
        </div>

        <div className="border rounded-lg p-4 hover:bg-gray-50">
          <div className="flex items-start justify-between">
            <div>
              <h4 className="font-medium">📋 Balance Sheet</h4>
              <p className="text-xs text-gray-500 mt-1">Assets = Liabilities + Equity snapshot</p>
            </div>
            <button
              onClick={exportBalanceSheet}
              disabled={exporting !== null}
              className="px-3 py-1.5 border rounded text-sm hover:bg-gray-100 disabled:opacity-50"
            >
              {exporting === 'balance-sheet' ? '...' : 'Export CSV'}
            </button>
          </div>
        </div>

        <div className="border rounded-lg p-4 hover:bg-gray-50">
          <div className="flex items-start justify-between">
            <div>
              <h4 className="font-medium">📒 General Ledger</h4>
              <p className="text-xs text-gray-500 mt-1">Complete transaction detail by date</p>
            </div>
            <button
              onClick={exportGeneralLedger}
              disabled={exporting !== null}
              className="px-3 py-1.5 border rounded text-sm hover:bg-gray-100 disabled:opacity-50"
            >
              {exporting === 'general-ledger' ? '...' : 'Export CSV'}
            </button>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="px-4 py-3 border-t bg-gray-50 text-xs text-gray-500">
        💡 Tip: Open CSV files in Excel or Google Sheets. Your CPA can import these directly into their tax software.
      </div>
    </div>
  );
}
