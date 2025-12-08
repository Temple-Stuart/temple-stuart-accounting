'use client';

import { useState, useMemo } from 'react';

interface Transaction {
  id: string;
  date: string;
  name: string;
  merchantName: string | null;
  amount: number;
  accountCode: string;
  subAccount: string | null;
}

interface CoaOption {
  id: string;
  code: string;
  name: string;
  accountType: string;
}

interface ThreeStatementSectionProps {
  committedTransactions: Transaction[];
  coaOptions: CoaOption[];
  onReassign: (transactionIds: string[], newCoaCode: string, newSubAccount: string | null) => Promise<void>;
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

// Map account types to statements
const INCOME_STATEMENT_TYPES = ['revenue', 'expense'];
const BALANCE_SHEET_TYPES = ['asset', 'liability', 'equity'];

export default function ThreeStatementSection({ 
  committedTransactions, 
  coaOptions,
  onReassign 
}: ThreeStatementSectionProps) {
  const [selectedYear, setSelectedYear] = useState(2025);
  const [activeStatement, setActiveStatement] = useState<'income' | 'balance' | 'cashflow'>('income');
  const [drilldownCell, setDrilldownCell] = useState<{ coaCode: string; month: number } | null>(null);
  const [selectedTxns, setSelectedTxns] = useState<string[]>([]);
  const [reassignCoa, setReassignCoa] = useState('');
  const [reassignSub, setReassignSub] = useState('');
  const [isReassigning, setIsReassigning] = useState(false);

  const availableYears = useMemo(() => {
    const years = new Set<number>();
    committedTransactions.forEach(t => years.add(new Date(t.date).getFullYear()));
    return Array.from(years).sort((a, b) => b - a);
  }, [committedTransactions]);

  const yearTransactions = useMemo(() => {
    return committedTransactions.filter(t => new Date(t.date).getFullYear() === selectedYear);
  }, [committedTransactions, selectedYear]);

  // Build grid data: { coaCode: { month: amount } }
  const gridData = useMemo(() => {
    const data: Record<string, Record<number, number>> = {};
    yearTransactions.forEach(t => {
      if (!t.accountCode) return;
      const month = new Date(t.date).getMonth();
      if (!data[t.accountCode]) data[t.accountCode] = {};
      if (!data[t.accountCode][month]) data[t.accountCode][month] = 0;
      data[t.accountCode][month] += t.amount; // Keep sign for proper accounting
    });
    return data;
  }, [yearTransactions]);

  // Get COA info helper
  const getCoaInfo = (code: string) => coaOptions.find(c => c.code === code);
  const getCoaName = (code: string) => getCoaInfo(code)?.name || code;
  const getCoaType = (code: string) => getCoaInfo(code)?.accountType || '';

  // Filter COAs by statement type
  const incomeStatementCodes = useMemo(() => 
    Object.keys(gridData).filter(code => INCOME_STATEMENT_TYPES.includes(getCoaType(code))).sort(),
  [gridData, coaOptions]);

  const balanceSheetCodes = useMemo(() => 
    Object.keys(gridData).filter(code => BALANCE_SHEET_TYPES.includes(getCoaType(code))).sort(),
  [gridData, coaOptions]);

  // Revenue codes and expense codes for I/S
  const revenueCodes = useMemo(() => incomeStatementCodes.filter(c => getCoaType(c) === 'revenue'), [incomeStatementCodes]);
  const expenseCodes = useMemo(() => incomeStatementCodes.filter(c => getCoaType(c) === 'expense'), [incomeStatementCodes]);

  // B/S breakdown
  const assetCodes = useMemo(() => balanceSheetCodes.filter(c => getCoaType(c) === 'asset'), [balanceSheetCodes]);
  const liabilityCodes = useMemo(() => balanceSheetCodes.filter(c => getCoaType(c) === 'liability'), [balanceSheetCodes]);
  const equityCodes = useMemo(() => balanceSheetCodes.filter(c => getCoaType(c) === 'equity'), [balanceSheetCodes]);

  // Calculate totals
  const getRowTotal = (coaCode: string) => {
    const months = gridData[coaCode] || {};
    return Object.values(months).reduce((sum, val) => sum + val, 0);
  };

  const getMonthTotal = (codes: string[], month: number) => {
    return codes.reduce((sum, code) => sum + (gridData[code]?.[month] || 0), 0);
  };

  const getSectionTotal = (codes: string[]) => {
    return codes.reduce((sum, code) => sum + getRowTotal(code), 0);
  };

  // Net Income calculation (Revenue - Expenses)
  const getNetIncomeForMonth = (month: number) => {
    const revenue = getMonthTotal(revenueCodes, month);
    const expenses = getMonthTotal(expenseCodes, month);
    return Math.abs(revenue) - Math.abs(expenses);
  };

  const getTotalNetIncome = () => {
    return Math.abs(getSectionTotal(revenueCodes)) - Math.abs(getSectionTotal(expenseCodes));
  };

  // Drilldown logic
  const drilldownTransactions = useMemo(() => {
    if (!drilldownCell) return [];
    return yearTransactions.filter(t => {
      const month = new Date(t.date).getMonth();
      return t.accountCode === drilldownCell.coaCode && month === drilldownCell.month;
    }).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [yearTransactions, drilldownCell]);

  const coaGrouped = useMemo(() => {
    const grouped: Record<string, CoaOption[]> = {};
    coaOptions.forEach(opt => {
      if (!grouped[opt.accountType]) grouped[opt.accountType] = [];
      grouped[opt.accountType].push(opt);
    });
    return grouped;
  }, [coaOptions]);

  const handleReassign = async () => {
    if (!reassignCoa || selectedTxns.length === 0) return;
    setIsReassigning(true);
    try {
      await onReassign(selectedTxns, reassignCoa, reassignSub || null);
      setSelectedTxns([]);
      setReassignCoa('');
      setReassignSub('');
      setDrilldownCell(null);
    } catch (error) {
      console.error('Reassign error:', error);
      alert('Failed to reassign transactions');
    }
    setIsReassigning(false);
  };

  // Render a section of accounts
  const renderAccountSection = (title: string, codes: string[], bgColor: string, textColor: string) => {
    if (codes.length === 0) return null;
    return (
      <>
        <tr className={`${bgColor}`}>
          <td colSpan={14} className={`px-3 py-2 font-bold ${textColor} text-sm`}>{title}</td>
        </tr>
        {codes.map(coaCode => (
          <tr key={coaCode} className="hover:bg-gray-50 border-b">
            <td className="px-3 py-2 border-r">
              <div className="font-medium text-xs">{coaCode}</div>
              <div className="text-gray-500 text-xs truncate max-w-[180px]">{getCoaName(coaCode)}</div>
            </td>
            {MONTHS.map((_, monthIdx) => {
              const value = gridData[coaCode]?.[monthIdx] || 0;
              const hasData = value !== 0;
              return (
                <td 
                  key={monthIdx} 
                  className={`px-2 py-2 text-right text-xs ${hasData ? 'cursor-pointer hover:bg-blue-50' : ''}`}
                  onClick={() => hasData && setDrilldownCell({ coaCode, month: monthIdx })}
                >
                  {hasData ? (
                    <span className="text-blue-600 hover:underline">${Math.abs(value).toFixed(0)}</span>
                  ) : (
                    <span className="text-gray-300">-</span>
                  )}
                </td>
              );
            })}
            <td className="px-3 py-2 text-right bg-gray-50 font-semibold text-xs">
              ${Math.abs(getRowTotal(coaCode)).toFixed(0)}
            </td>
          </tr>
        ))}
        <tr className={`${bgColor} border-b-2`}>
          <td className="px-3 py-1 font-semibold text-xs border-r">Total {title}</td>
          {MONTHS.map((_, monthIdx) => (
            <td key={monthIdx} className="px-2 py-1 text-right font-semibold text-xs">
              ${Math.abs(getMonthTotal(codes, monthIdx)).toFixed(0)}
            </td>
          ))}
          <td className="px-3 py-1 text-right font-bold text-xs bg-gray-100">
            ${Math.abs(getSectionTotal(codes)).toFixed(0)}
          </td>
        </tr>
      </>
    );
  };

  return (
    <div className="mt-6 bg-white border rounded-xl">
      {/* Header */}
      <div className="px-4 py-3 border-b flex justify-between items-center">
        <h3 className="text-lg font-medium">3-Statement Financial Model</h3>
        <div className="flex gap-2">
          {availableYears.map(year => (
            <button
              key={year}
              onClick={() => setSelectedYear(year)}
              className={`px-4 py-1 rounded text-sm font-medium ${
                selectedYear === year ? 'bg-[#b4b237] text-white' : 'bg-gray-100 hover:bg-gray-200'
              }`}
            >
              {year}
            </button>
          ))}
        </div>
      </div>

      {/* Statement Tabs */}
      <div className="flex border-b">
        <button
          onClick={() => setActiveStatement('income')}
          className={`px-6 py-3 text-sm font-medium ${activeStatement === 'income' ? 'border-b-2 border-green-600 text-green-600' : 'text-gray-600'}`}
        >
          Income Statement
        </button>
        <button
          onClick={() => setActiveStatement('balance')}
          className={`px-6 py-3 text-sm font-medium ${activeStatement === 'balance' ? 'border-b-2 border-blue-600 text-blue-600' : 'text-gray-600'}`}
        >
          Balance Sheet
        </button>
        <button
          onClick={() => setActiveStatement('cashflow')}
          className={`px-6 py-3 text-sm font-medium ${activeStatement === 'cashflow' ? 'border-b-2 border-purple-600 text-purple-600' : 'text-gray-600'}`}
        >
          Cash Flow
        </button>
      </div>

      {/* Income Statement */}
      {activeStatement === 'income' && (
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="bg-gray-50 sticky top-0">
              <tr>
                <th className="px-3 py-2 text-left font-semibold border-r min-w-[200px]">Account</th>
                {MONTHS.map(month => (
                  <th key={month} className="px-2 py-2 text-right font-semibold min-w-[70px]">{month}</th>
                ))}
                <th className="px-3 py-2 text-right font-semibold bg-gray-100 min-w-[90px]">YTD</th>
              </tr>
            </thead>
            <tbody>
              {renderAccountSection('Revenue', revenueCodes, 'bg-green-50', 'text-green-800')}
              {renderAccountSection('Expenses', expenseCodes, 'bg-red-50', 'text-red-800')}
              
              {/* Net Income Row */}
              <tr className="bg-yellow-100 font-bold border-t-2 border-yellow-400">
                <td className="px-3 py-2 border-r">Net Income</td>
                {MONTHS.map((_, monthIdx) => {
                  const ni = getNetIncomeForMonth(monthIdx);
                  return (
                    <td key={monthIdx} className={`px-2 py-2 text-right ${ni >= 0 ? 'text-green-700' : 'text-red-700'}`}>
                      {ni >= 0 ? '' : '('}${Math.abs(ni).toFixed(0)}{ni < 0 ? ')' : ''}
                    </td>
                  );
                })}
                <td className={`px-3 py-2 text-right bg-yellow-200 ${getTotalNetIncome() >= 0 ? 'text-green-700' : 'text-red-700'}`}>
                  {getTotalNetIncome() >= 0 ? '' : '('}${Math.abs(getTotalNetIncome()).toFixed(0)}{getTotalNetIncome() < 0 ? ')' : ''}
                </td>
              </tr>
            </tbody>
          </table>
          {incomeStatementCodes.length === 0 && (
            <div className="p-8 text-center text-gray-500">No income/expense transactions for {selectedYear}</div>
          )}
        </div>
      )}

      {/* Balance Sheet */}
      {activeStatement === 'balance' && (
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="bg-gray-50 sticky top-0">
              <tr>
                <th className="px-3 py-2 text-left font-semibold border-r min-w-[200px]">Account</th>
                {MONTHS.map(month => (
                  <th key={month} className="px-2 py-2 text-right font-semibold min-w-[70px]">{month}</th>
                ))}
                <th className="px-3 py-2 text-right font-semibold bg-gray-100 min-w-[90px]">YTD</th>
              </tr>
            </thead>
            <tbody>
              {renderAccountSection('Assets', assetCodes, 'bg-blue-50', 'text-blue-800')}
              {renderAccountSection('Liabilities', liabilityCodes, 'bg-orange-50', 'text-orange-800')}
              {renderAccountSection('Equity', equityCodes, 'bg-purple-50', 'text-purple-800')}
              
              {/* Balance Check Row */}
              <tr className="bg-gray-200 font-bold border-t-2">
                <td className="px-3 py-2 border-r">Assets - (Liab + Equity)</td>
                {MONTHS.map((_, monthIdx) => {
                  const assets = getMonthTotal(assetCodes, monthIdx);
                  const liabEquity = getMonthTotal(liabilityCodes, monthIdx) + getMonthTotal(equityCodes, monthIdx);
                  const diff = Math.abs(assets) - Math.abs(liabEquity);
                  return (
                    <td key={monthIdx} className={`px-2 py-2 text-right ${Math.abs(diff) < 1 ? 'text-green-700' : 'text-red-700'}`}>
                      ${diff.toFixed(0)}
                    </td>
                  );
                })}
                <td className="px-3 py-2 text-right bg-gray-300">
                  ${(Math.abs(getSectionTotal(assetCodes)) - Math.abs(getSectionTotal(liabilityCodes)) - Math.abs(getSectionTotal(equityCodes))).toFixed(0)}
                </td>
              </tr>
            </tbody>
          </table>
          {balanceSheetCodes.length === 0 && (
            <div className="p-8 text-center text-gray-500">No asset/liability/equity transactions for {selectedYear}</div>
          )}
        </div>
      )}

      {/* Cash Flow Statement */}
      {activeStatement === 'cashflow' && (
        <div className="p-8 text-center text-gray-500">
          <div className="text-lg font-medium mb-2">Cash Flow Statement</div>
          <p>Coming soon - will derive from I/S and B/S changes</p>
          <div className="mt-4 text-sm">
            <div>Operating: Net Income ± Working Capital Changes</div>
            <div>Investing: Asset Purchases/Sales</div>
            <div>Financing: Debt/Equity Changes</div>
          </div>
        </div>
      )}

      {/* Drilldown Modal */}
      {drilldownCell && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full mx-4 max-h-[80vh] flex flex-col">
            <div className="px-4 py-3 border-b flex justify-between items-center">
              <div>
                <h4 className="font-semibold">{drilldownCell.coaCode} - {getCoaName(drilldownCell.coaCode)}</h4>
                <p className="text-sm text-gray-500">{MONTHS[drilldownCell.month]} {selectedYear} • {drilldownTransactions.length} transactions</p>
              </div>
              <button onClick={() => { setDrilldownCell(null); setSelectedTxns([]); }} className="text-gray-500 hover:text-gray-700 text-xl">×</button>
            </div>

            {selectedTxns.length > 0 && (
              <div className="px-4 py-3 bg-yellow-50 border-b flex items-center gap-3">
                <span className="text-sm font-medium">{selectedTxns.length} selected</span>
                <select value={reassignCoa} onChange={(e) => setReassignCoa(e.target.value)} className="text-sm border rounded px-2 py-1 flex-1">
                  <option value="">Move to COA...</option>
                  {Object.entries(coaGrouped).map(([type, options]) => (
                    <optgroup key={type} label={type}>
                      {options.map(opt => (
                        <option key={opt.id} value={opt.code}>{opt.code} - {opt.name}</option>
                      ))}
                    </optgroup>
                  ))}
                </select>
                <input type="text" placeholder="Sub-Account" value={reassignSub} onChange={(e) => setReassignSub(e.target.value)} className="text-sm border rounded px-2 py-1 w-32" />
                <button onClick={handleReassign} disabled={!reassignCoa || isReassigning} className="px-4 py-1 bg-blue-600 text-white rounded text-sm disabled:bg-gray-400">
                  {isReassigning ? '...' : 'Move'}
                </button>
                <button onClick={() => setSelectedTxns([])} className="px-3 py-1 border rounded text-sm">Clear</button>
              </div>
            )}

            <div className="overflow-auto flex-1">
              <table className="w-full text-xs">
                <thead className="bg-gray-50 sticky top-0">
                  <tr>
                    <th className="px-3 py-2 w-8">
                      <input type="checkbox" checked={selectedTxns.length === drilldownTransactions.length && drilldownTransactions.length > 0}
                        onChange={(e) => setSelectedTxns(e.target.checked ? drilldownTransactions.map(t => t.id) : [])} />
                    </th>
                    <th className="px-3 py-2 text-left">Date</th>
                    <th className="px-3 py-2 text-left">Name</th>
                    <th className="px-3 py-2 text-left">Merchant</th>
                    <th className="px-3 py-2 text-right">Amount</th>
                    <th className="px-3 py-2 text-left">Sub</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {drilldownTransactions.map(txn => (
                    <tr key={txn.id} className={`hover:bg-gray-50 ${selectedTxns.includes(txn.id) ? 'bg-blue-50' : ''}`}>
                      <td className="px-3 py-2 text-center">
                        <input type="checkbox" checked={selectedTxns.includes(txn.id)}
                          onChange={(e) => setSelectedTxns(e.target.checked ? [...selectedTxns, txn.id] : selectedTxns.filter(id => id !== txn.id))} />
                      </td>
                      <td className="px-3 py-2">{new Date(txn.date).toLocaleDateString()}</td>
                      <td className="px-3 py-2 max-w-[200px] truncate">{txn.name}</td>
                      <td className="px-3 py-2">{txn.merchantName || '-'}</td>
                      <td className="px-3 py-2 text-right font-medium">${Math.abs(txn.amount).toFixed(2)}</td>
                      <td className="px-3 py-2 text-gray-500">{txn.subAccount || '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="px-4 py-3 border-t bg-gray-50 flex justify-between">
              <span className="text-sm">Total: ${drilldownTransactions.reduce((sum, t) => sum + Math.abs(t.amount), 0).toFixed(2)}</span>
              <button onClick={() => { setDrilldownCell(null); setSelectedTxns([]); }} className="px-4 py-1 bg-gray-200 rounded text-sm">Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
