'use client';

import { useMemo, useState } from 'react';
import { Card, Button } from '@/components/ui';

interface Transaction {
  id: string;
  date: string;
  name: string;
  amount: number;
  accountCode: string | null;
  subAccount: string | null;
}

interface CoaOption {
  code: string;
  name: string;
  accountType: string;
}

interface Budget {
  accountCode: string;
  year: number;
  jan: number | null; feb: number | null; mar: number | null; apr: number | null;
  may: number | null; jun: number | null; jul: number | null; aug: number | null;
  sep: number | null; oct: number | null; nov: number | null; dec: number | null;
}

interface BudgetBuilderProps {
  transactions: Transaction[];
  coaOptions: CoaOption[];
  budgets: Budget[];
  selectedYear: number;
  onSaveBudget: (accountCode: string, year: number, months: Record<string, number | null>) => Promise<void>;
}

const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
const MONTH_LABELS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export default function BudgetBuilder({ transactions, coaOptions, budgets, selectedYear }: BudgetBuilderProps) {
  const [drilldown, setDrilldown] = useState<{ code: string } | null>(null);

  // YTD actuals from transactions
  const ytdByAccount = useMemo(() => {
    const result: Record<string, number> = {};
    transactions.filter(t => new Date(t.date).getFullYear() === selectedYear).forEach(t => {
      if (t.accountCode) result[t.accountCode] = (result[t.accountCode] || 0) + Math.abs(t.amount);
    });
    return result;
  }, [transactions, selectedYear]);

  const monthsWithData = useMemo(() => {
    const months = new Set<number>();
    transactions.filter(t => new Date(t.date).getFullYear() === selectedYear).forEach(t => months.add(new Date(t.date).getMonth()));
    return Math.max(months.size, 1);
  }, [transactions, selectedYear]);

  // Budget values by account
  const budgetsByAccount = useMemo(() => {
    const result: Record<string, Record<string, number | null>> = {};
    budgets.forEach(b => {
      result[b.accountCode] = {
        jan: b.jan, feb: b.feb, mar: b.mar, apr: b.apr,
        may: b.may, jun: b.jun, jul: b.jul, aug: b.aug,
        sep: b.sep, oct: b.oct, nov: b.nov, dec: b.dec
      };
    });
    return result;
  }, [budgets]);

  // Only show accounts with committed budgets
  const usedAccounts = useMemo(() => {
    const codes = new Set<string>();
    budgets.forEach(b => { if (b.accountCode) codes.add(b.accountCode); });
    return Array.from(codes).map(code => coaOptions.find(c => c.code === code)).filter(Boolean) as CoaOption[];
  }, [coaOptions, budgets]);

  const revenueCodes = usedAccounts.filter(a => a.accountType === 'revenue');
  const expenseCodes = usedAccounts.filter(a => a.accountType === 'expense');

  const getBudgetValue = (code: string, month: string): number | null => budgetsByAccount[code]?.[month] ?? null;
  const getAnnualBudget = (code: string): number => MONTHS.reduce((sum, m) => sum + (Number(budgetsByAccount[code]?.[m]) || 0), 0);
  const formatMoney = (n: number | null) => n === null || n === 0 ? '-' : `$${Math.abs(n).toLocaleString()}`;

  const drilldownTxns = useMemo(() => {
    if (!drilldown) return [];
    return transactions.filter(t => t.accountCode === drilldown.code && new Date(t.date).getFullYear() === selectedYear)
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [drilldown, transactions, selectedYear]);

  // Mobile Card - Read Only
  const renderCard = (account: CoaOption) => {
    const ytd = ytdByAccount[account.code] || 0;
    const avg = Math.round(ytd / monthsWithData);
    const annual = getAnnualBudget(account.code);

    return (
      <div key={account.code} className="bg-white rounded-xl border border-gray-200 overflow-hidden p-4">
        <div className="flex justify-between items-start mb-3">
          <div>
            <div className="font-semibold text-gray-900">{account.name}</div>
            <div className="text-xs text-gray-400 font-mono">{account.code}</div>
          </div>
        </div>
        <div className="grid grid-cols-3 gap-4 mb-3">
          <div>
            <div className="text-xs text-gray-400">YTD</div>
            <button onClick={() => setDrilldown({ code: account.code })} className="font-semibold text-blue-600 hover:underline">
              {formatMoney(ytd)}
            </button>
          </div>
          <div><div className="text-xs text-gray-400">Avg/Mo</div><div className="font-semibold text-gray-900">{formatMoney(avg)}</div></div>
          <div><div className="text-xs text-gray-400">Budget</div><div className="font-semibold text-gray-900">{formatMoney(annual)}</div></div>
        </div>
        <div className="grid grid-cols-6 gap-1 text-center text-xs">
          {MONTH_LABELS.map((label, i) => (
            <div key={label}>
              <div className="text-gray-400">{label}</div>
              <div className="font-medium text-gray-700">{formatMoney(getBudgetValue(account.code, MONTHS[i]))}</div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  // Desktop Table Row - Read Only
  const renderRow = (account: CoaOption) => {
    const ytd = ytdByAccount[account.code] || 0;
    const avg = Math.round(ytd / monthsWithData);

    return (
      <tr key={account.code} className="border-b border-gray-100 hover:bg-gray-50/50">
        <td className="px-4 py-3 sticky left-0 bg-white z-10 min-w-[200px] border-r border-gray-100">
          <div className="font-medium text-gray-900 text-sm">{account.name}</div>
          <div className="text-xs text-gray-400 font-mono">{account.code}</div>
        </td>
        <td className="px-3 py-3 text-right cursor-pointer hover:bg-blue-50" onClick={() => setDrilldown({ code: account.code })}>
          <span className="text-blue-600 font-medium text-sm">{formatMoney(ytd)}</span>
        </td>
        <td className="px-3 py-3 text-right text-sm text-gray-600">{formatMoney(avg)}</td>
        {MONTHS.map(month => (
          <td key={month} className="px-2 py-3 text-center text-sm text-gray-700">
            {formatMoney(getBudgetValue(account.code, month))}
          </td>
        ))}
        <td className="px-3 py-3 text-right font-bold text-sm bg-gray-50 sticky right-0 border-l border-gray-200">
          {formatMoney(getAnnualBudget(account.code))}
        </td>
      </tr>
    );
  };

  const renderSectionHeader = (title: string, isRevenue: boolean) => (
    <tr className={isRevenue ? 'bg-green-50' : 'bg-red-50'}>
      <td colSpan={16} className={`px-4 py-2 font-bold text-sm sticky left-0 ${isRevenue ? 'text-green-800 bg-green-50' : 'text-red-800 bg-red-50'}`}>{title}</td>
    </tr>
  );

  const getSectionTotal = (accounts: CoaOption[], month: string): number => 
    accounts.reduce((sum, a) => sum + (Number(getBudgetValue(a.code, month)) || 0), 0);

  const renderSectionTotal = (title: string, accounts: CoaOption[], isRevenue: boolean) => (
    <tr className={isRevenue ? 'bg-green-100' : 'bg-red-100'}>
      <td className={`px-4 py-3 font-bold text-sm sticky left-0 ${isRevenue ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>Total {title}</td>
      <td className="px-3 py-3 text-right font-bold text-sm">{formatMoney(accounts.reduce((sum, a) => sum + (ytdByAccount[a.code] || 0), 0))}</td>
      <td className="px-3 py-3 text-right font-bold text-sm">{formatMoney(Math.round(accounts.reduce((sum, a) => sum + (ytdByAccount[a.code] || 0), 0) / monthsWithData))}</td>
      {MONTHS.map(month => <td key={month} className="px-2 py-3 text-center text-sm font-bold">{formatMoney(getSectionTotal(accounts, month))}</td>)}
      <td className="px-3 py-3 text-right font-bold text-sm bg-gray-100 sticky right-0">{formatMoney(accounts.reduce((sum, a) => sum + getAnnualBudget(a.code), 0))}</td>
    </tr>
  );

  return (
    <>
      {/* Mobile View - Cards */}
      <div className="block lg:hidden space-y-4">
        {revenueCodes.length > 0 && (
          <div>
            <h3 className="text-sm font-bold text-green-700 uppercase tracking-wider mb-3">Revenue</h3>
            <div className="space-y-3">{revenueCodes.map(a => renderCard(a))}</div>
          </div>
        )}
        {expenseCodes.length > 0 && (
          <div className="mt-6">
            <h3 className="text-sm font-bold text-red-700 uppercase tracking-wider mb-3">Expenses</h3>
            <div className="space-y-3">{expenseCodes.map(a => renderCard(a))}</div>
          </div>
        )}
        {usedAccounts.length === 0 && (
          <Card className="text-center py-8">
            <div className="text-4xl mb-3">📊</div>
            <p className="text-gray-600 font-medium">No budgets committed yet</p>
            <p className="text-sm text-gray-400 mt-1">Commit a trip to start building your budget</p>
          </Card>
        )}
      </div>

      {/* Desktop View - Table */}
      <Card noPadding className="hidden lg:block">
        <div className="px-6 py-4 border-b border-gray-100">
          <h3 className="font-bold text-gray-900">Budget Review</h3>
          <p className="text-sm text-gray-500">Committed budgets vs actual spending • Use Trips to add budget</p>
        </div>
        {usedAccounts.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm" style={{ minWidth: '1000px' }}>
              <thead className="bg-[#2d1b4e] text-white">
                <tr>
                  <th className="px-4 py-3 text-left font-semibold sticky left-0 bg-[#2d1b4e] z-20 min-w-[200px]">Account</th>
                  <th className="px-3 py-3 text-right font-semibold">YTD</th>
                  <th className="px-3 py-3 text-right font-semibold">Avg</th>
                  {MONTH_LABELS.map(m => <th key={m} className="px-2 py-3 text-center font-semibold">{m}</th>)}
                  <th className="px-3 py-3 text-right font-semibold bg-[#1a0f2e] sticky right-0">Annual</th>
                </tr>
              </thead>
              <tbody>
                {revenueCodes.length > 0 && <>{renderSectionHeader('Revenue', true)}{revenueCodes.map(renderRow)}{renderSectionTotal('Revenue', revenueCodes, true)}</>}
                {expenseCodes.length > 0 && <>{renderSectionHeader('Expenses', false)}{expenseCodes.map(renderRow)}{renderSectionTotal('Expenses', expenseCodes, false)}</>}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="text-center py-12">
            <div className="text-4xl mb-3">📊</div>
            <p className="text-gray-600 font-medium">No budgets committed yet</p>
            <p className="text-sm text-gray-400 mt-1">Commit a trip to start building your budget</p>
          </div>
        )}
      </Card>

      {/* Drilldown Modal */}
      {drilldown && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setDrilldown(null)}>
          <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[80vh] flex flex-col" onClick={e => e.stopPropagation()}>
            <div className="px-6 py-4 border-b flex justify-between items-center">
              <div>
                <h4 className="font-bold text-gray-900">{coaOptions.find(c => c.code === drilldown.code)?.name}</h4>
                <p className="text-sm text-gray-500">{drilldownTxns.length} transactions</p>
              </div>
              <button onClick={() => setDrilldown(null)} className="w-8 h-8 rounded-full hover:bg-gray-100 flex items-center justify-center text-gray-400 hover:text-gray-600 text-xl">×</button>
            </div>
            <div className="flex-1 overflow-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 sticky top-0">
                  <tr>
                    <th className="px-4 py-3 text-left font-semibold">Date</th>
                    <th className="px-4 py-3 text-left font-semibold">Description</th>
                    <th className="px-4 py-3 text-right font-semibold">Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {drilldownTxns.map(txn => (
                    <tr key={txn.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 whitespace-nowrap text-gray-600">{new Date(txn.date).toLocaleDateString()}</td>
                      <td className="px-4 py-3 truncate max-w-[250px] text-gray-900">{txn.name}</td>
                      <td className="px-4 py-3 text-right font-mono font-medium">${Math.abs(txn.amount).toFixed(2)}</td>
                    </tr>
                  ))}
                  {drilldownTxns.length === 0 && (
                    <tr><td colSpan={3} className="px-4 py-8 text-center text-gray-400">No transactions yet</td></tr>
                  )}
                </tbody>
              </table>
            </div>
            <div className="px-6 py-4 border-t bg-gray-50 flex justify-between items-center">
              <span className="font-semibold text-gray-900">Total: ${drilldownTxns.reduce((s, t) => s + Math.abs(t.amount), 0).toLocaleString()}</span>
              <Button variant="ghost" onClick={() => setDrilldown(null)}>Close</Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
