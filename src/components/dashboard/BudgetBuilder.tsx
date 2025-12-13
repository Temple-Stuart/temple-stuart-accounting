'use client';

import { useState, useMemo } from 'react';

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
  jan: number | null;
  feb: number | null;
  mar: number | null;
  apr: number | null;
  may: number | null;
  jun: number | null;
  jul: number | null;
  aug: number | null;
  sep: number | null;
  oct: number | null;
  nov: number | null;
  dec: number | null;
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

export default function BudgetBuilder({ transactions, coaOptions, budgets, selectedYear, onSaveBudget }: BudgetBuilderProps) {
  const [editingCell, setEditingCell] = useState<{ code: string; field: string } | null>(null);
  const [editValue, setEditValue] = useState('');
  const [applyMode, setApplyMode] = useState<Record<string, string>>({});
  const [drilldown, setDrilldown] = useState<{ code: string; type: 'ytd' | 'avg' } | null>(null);
  const [localBudgets, setLocalBudgets] = useState<Record<string, Record<string, number | null>>>({});

  // Initialize local budgets from props
  useMemo(() => {
    const initial: Record<string, Record<string, number | null>> = {};
    budgets.forEach(b => {
      initial[b.accountCode] = {
        jan: b.jan, feb: b.feb, mar: b.mar, apr: b.apr,
        may: b.may, jun: b.jun, jul: b.jul, aug: b.aug,
        sep: b.sep, oct: b.oct, nov: b.nov, dec: b.dec
      };
    });
    setLocalBudgets(initial);
  }, [budgets]);

  // Calculate YTD actuals per account
  const ytdByAccount = useMemo(() => {
    const result: Record<string, number> = {};
    const yearTxns = transactions.filter(t => new Date(t.date).getFullYear() === selectedYear);
    yearTxns.forEach(t => {
      if (!t.accountCode) return;
      result[t.accountCode] = (result[t.accountCode] || 0) + Math.abs(t.amount);
    });
    return result;
  }, [transactions, selectedYear]);

  // Calculate months with data for averaging
  const monthsWithData = useMemo(() => {
    const months = new Set<number>();
    transactions
      .filter(t => new Date(t.date).getFullYear() === selectedYear)
      .forEach(t => months.add(new Date(t.date).getMonth()));
    return Math.max(months.size, 1);
  }, [transactions, selectedYear]);

  // Get accounts used in transactions
  const usedAccounts = useMemo(() => {
    const codes = new Set<string>();
    transactions.forEach(t => { if (t.accountCode) codes.add(t.accountCode); });
    return Array.from(codes)
      .map(code => coaOptions.find(c => c.code === code))
      .filter(Boolean) as CoaOption[];
  }, [transactions, coaOptions]);

  const revenueCodes = usedAccounts.filter(a => a.accountType === 'revenue');
  const expenseCodes = usedAccounts.filter(a => a.accountType === 'expense');

  const getBudgetValue = (code: string, month: string): number | null => {
    return localBudgets[code]?.[month] ?? null;
  };

  const getAnnualBudget = (code: string): number => {
    const b = localBudgets[code];
    if (!b) return 0;
    return MONTHS.reduce((sum, m) => sum + (b[m] || 0), 0);
  };

  const handleBudgetInput = (code: string) => {
    const value = parseFloat(editValue) || 0;
    const mode = applyMode[code] || 'all';
    
    const newMonths: Record<string, number | null> = { ...localBudgets[code] };
    
    if (mode === 'all') {
      MONTHS.forEach(m => { newMonths[m] = value; });
    } else {
      newMonths[mode] = value;
    }
    
    setLocalBudgets(prev => ({ ...prev, [code]: newMonths }));
    onSaveBudget(code, selectedYear, newMonths);
    setEditingCell(null);
    setEditValue('');
  };

  const handleMonthEdit = (code: string, month: string, value: string) => {
    const numValue = value === '' ? null : parseFloat(value) || 0;
    const newMonths = { ...localBudgets[code], [month]: numValue };
    setLocalBudgets(prev => ({ ...prev, [code]: newMonths }));
    onSaveBudget(code, selectedYear, newMonths);
  };

  const formatMoney = (n: number | null) => {
    if (n === null || n === 0) return '-';
    return `$${Math.abs(n).toLocaleString()}`;
  };

  const drilldownTxns = useMemo(() => {
    if (!drilldown) return [];
    return transactions
      .filter(t => t.accountCode === drilldown.code && new Date(t.date).getFullYear() === selectedYear)
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [drilldown, transactions, selectedYear]);

  const renderRow = (account: CoaOption) => {
    const ytd = ytdByAccount[account.code] || 0;
    const avg = Math.round(ytd / monthsWithData);
    const isEditing = editingCell?.code === account.code && editingCell?.field === 'budget';

    return (
      <tr key={account.code} className="border-b border-gray-100 hover:bg-gray-50">
        {/* Account Name */}
        <td className="px-3 py-2 sticky left-0 bg-white z-10 min-w-[180px]">
          <div className="font-medium text-sm">{account.name}</div>
          <div className="text-xs text-gray-400 font-mono">{account.code}</div>
        </td>
        
        {/* YTD Actual - Clickable */}
        <td 
          className="px-2 py-2 text-right text-sm cursor-pointer hover:bg-blue-50 text-blue-600"
          onClick={() => setDrilldown({ code: account.code, type: 'ytd' })}
        >
          {formatMoney(ytd)}
        </td>
        
        {/* Monthly Avg - Clickable */}
        <td 
          className="px-2 py-2 text-right text-sm cursor-pointer hover:bg-blue-50 text-blue-600"
          onClick={() => setDrilldown({ code: account.code, type: 'avg' })}
        >
          {formatMoney(avg)}
        </td>
        
        {/* Budget Input */}
        <td className="px-2 py-2 text-right">
          {isEditing ? (
            <input
              type="number"
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              onBlur={() => handleBudgetInput(account.code)}
              onKeyDown={(e) => e.key === 'Enter' && handleBudgetInput(account.code)}
              className="w-20 px-2 py-1 border rounded text-right text-sm"
              autoFocus
            />
          ) : (
            <button
              onClick={() => { setEditingCell({ code: account.code, field: 'budget' }); setEditValue(''); }}
              className="w-20 px-2 py-1 border border-dashed border-gray-300 rounded text-sm text-gray-400 hover:border-[#b4b237] hover:text-[#b4b237]"
            >
              {localBudgets[account.code] ? formatMoney(getBudgetValue(account.code, 'jan')) : 'Set'}
            </button>
          )}
        </td>
        
        {/* Apply To */}
        <td className="px-2 py-2">
          <select
            value={applyMode[account.code] || 'all'}
            onChange={(e) => setApplyMode(prev => ({ ...prev, [account.code]: e.target.value }))}
            className="text-xs border rounded px-1 py-1 w-20"
          >
            <option value="all">All</option>
            {MONTH_LABELS.map((m, i) => <option key={m} value={MONTHS[i]}>{m}</option>)}
          </select>
        </td>
        
        {/* Jan - Dec */}
        {MONTHS.map((month, i) => {
          const val = getBudgetValue(account.code, month);
          return (
            <td key={month} className="px-1 py-2 text-right text-xs">
              <input
                type="number"
                value={val ?? ''}
                onChange={(e) => handleMonthEdit(account.code, month, e.target.value)}
                className="w-14 px-1 py-0.5 border rounded text-right text-xs"
                placeholder="-"
              />
            </td>
          );
        })}
        
        {/* Annual Total */}
        <td className="px-2 py-2 text-right text-sm font-semibold bg-gray-50 sticky right-0">
          {formatMoney(getAnnualBudget(account.code))}
        </td>
      </tr>
    );
  };

  const renderSectionHeader = (title: string, bgColor: string, textColor: string) => (
    <tr className={bgColor}>
      <td colSpan={17} className={`px-3 py-2 font-bold text-sm sticky left-0 ${textColor} ${bgColor}`}>{title}</td>
    </tr>
  );

  const getSectionBudgetTotal = (accounts: CoaOption[], month: string): number => {
    return accounts.reduce((sum, a) => sum + (getBudgetValue(a.code, month) || 0), 0);
  };

  const renderSectionTotal = (title: string, accounts: CoaOption[], bgColor: string, textColor: string) => (
    <tr className={`${bgColor} border-b-2`}>
      <td className={`px-3 py-2 font-semibold text-sm sticky left-0 ${bgColor} ${textColor}`}>Total {title}</td>
      <td className={`px-2 py-2 text-right font-semibold text-sm ${textColor}`}>
        {formatMoney(accounts.reduce((sum, a) => sum + (ytdByAccount[a.code] || 0), 0))}
      </td>
      <td className={`px-2 py-2 text-right font-semibold text-sm ${textColor}`}>
        {formatMoney(Math.round(accounts.reduce((sum, a) => sum + (ytdByAccount[a.code] || 0), 0) / monthsWithData))}
      </td>
      <td colSpan={2}></td>
      {MONTHS.map(month => (
        <td key={month} className={`px-1 py-2 text-right text-xs font-semibold ${textColor}`}>
          {formatMoney(getSectionBudgetTotal(accounts, month))}
        </td>
      ))}
      <td className={`px-2 py-2 text-right font-bold text-sm bg-gray-100 sticky right-0 ${textColor}`}>
        {formatMoney(accounts.reduce((sum, a) => sum + getAnnualBudget(a.code), 0))}
      </td>
    </tr>
  );

  return (
    <div className="bg-white rounded-xl border overflow-hidden">
      <div className="px-4 py-3 bg-gray-50 border-b">
        <h3 className="font-semibold">Budget Builder</h3>
        <p className="text-xs text-gray-500">Click YTD/Avg to see transactions. Set budget and choose apply mode.</p>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm min-w-[1200px]">
          <thead className="bg-gray-100">
            <tr>
              <th className="px-3 py-2 text-left font-semibold sticky left-0 bg-gray-100 z-10 min-w-[180px]">Account</th>
              <th className="px-2 py-2 text-right font-semibold w-20">YTD</th>
              <th className="px-2 py-2 text-right font-semibold w-20">Avg</th>
              <th className="px-2 py-2 text-right font-semibold w-20">Budget</th>
              <th className="px-2 py-2 text-center font-semibold w-20">Apply</th>
              {MONTH_LABELS.map(m => <th key={m} className="px-1 py-2 text-right font-semibold w-14">{m}</th>)}
              <th className="px-2 py-2 text-right font-semibold w-20 bg-gray-200 sticky right-0">Annual</th>
            </tr>
          </thead>
          <tbody>
            {revenueCodes.length > 0 && (
              <>
                {renderSectionHeader('Revenue', 'bg-green-50', 'text-green-800')}
                {revenueCodes.map(renderRow)}
                {renderSectionTotal('Revenue', revenueCodes, 'bg-green-100', 'text-green-800')}
              </>
            )}
            {expenseCodes.length > 0 && (
              <>
                {renderSectionHeader('Expenses', 'bg-red-50', 'text-red-800')}
                {expenseCodes.map(renderRow)}
                {renderSectionTotal('Expenses', expenseCodes, 'bg-red-100', 'text-red-800')}
              </>
            )}
          </tbody>
        </table>
      </div>

      {/* Drilldown Modal */}
      {drilldown && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[80vh] flex flex-col">
            <div className="px-4 py-3 border-b flex justify-between items-center">
              <div>
                <h4 className="font-semibold">{coaOptions.find(c => c.code === drilldown.code)?.name}</h4>
                <p className="text-sm text-gray-500">
                  {drilldown.type === 'ytd' ? 'Year to Date' : 'Monthly Average'} • {drilldownTxns.length} transactions
                </p>
              </div>
              <button onClick={() => setDrilldown(null)} className="text-gray-400 hover:text-gray-600 text-2xl">×</button>
            </div>
            <div className="flex-1 overflow-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 sticky top-0">
                  <tr>
                    <th className="px-3 py-2 text-left">Date</th>
                    <th className="px-3 py-2 text-left">Description</th>
                    <th className="px-3 py-2 text-right">Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {drilldownTxns.map(txn => (
                    <tr key={txn.id} className="hover:bg-gray-50">
                      <td className="px-3 py-2 whitespace-nowrap">{new Date(txn.date).toLocaleDateString()}</td>
                      <td className="px-3 py-2 truncate max-w-[300px]">{txn.name}</td>
                      <td className="px-3 py-2 text-right font-mono">${Math.abs(txn.amount).toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="px-4 py-3 border-t bg-gray-50 flex justify-between">
              <span className="text-sm text-gray-600">
                Total: ${drilldownTxns.reduce((s, t) => s + Math.abs(t.amount), 0).toLocaleString()}
              </span>
              <button onClick={() => setDrilldown(null)} className="px-4 py-1.5 bg-gray-200 rounded text-sm">Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
