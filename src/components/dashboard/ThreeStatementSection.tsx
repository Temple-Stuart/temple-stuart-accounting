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

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const QUARTERS = [
  { label: 'Q1', months: [0, 1, 2], names: ['Jan', 'Feb', 'Mar'] },
  { label: 'Q2', months: [3, 4, 5], names: ['Apr', 'May', 'Jun'] },
  { label: 'Q3', months: [6, 7, 8], names: ['Jul', 'Aug', 'Sep'] },
  { label: 'Q4', months: [9, 10, 11], names: ['Oct', 'Nov', 'Dec'] },
];

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

  const gridData = useMemo(() => {
    const data: Record<string, Record<number, number>> = {};
    yearTransactions.forEach(t => {
      if (!t.accountCode) return;
      const month = new Date(t.date).getMonth();
      if (!data[t.accountCode]) data[t.accountCode] = {};
      if (!data[t.accountCode][month]) data[t.accountCode][month] = 0;
      data[t.accountCode][month] += t.amount;
    });
    return data;
  }, [yearTransactions]);

  const getCoaInfo = (code: string) => coaOptions.find(c => c.code === code);
  const getCoaName = (code: string) => getCoaInfo(code)?.name || code;
  const getCoaType = (code: string) => getCoaInfo(code)?.accountType || '';

  const incomeStatementCodes = useMemo(() => 
    Object.keys(gridData).filter(code => INCOME_STATEMENT_TYPES.includes(getCoaType(code))).sort(),
  [gridData, coaOptions]);

  const balanceSheetCodes = useMemo(() => 
    Object.keys(gridData).filter(code => BALANCE_SHEET_TYPES.includes(getCoaType(code))).sort(),
  [gridData, coaOptions]);

  const revenueCodes = useMemo(() => incomeStatementCodes.filter(c => getCoaType(c) === 'revenue'), [incomeStatementCodes]);
  const expenseCodes = useMemo(() => incomeStatementCodes.filter(c => getCoaType(c) === 'expense'), [incomeStatementCodes]);
  const assetCodes = useMemo(() => balanceSheetCodes.filter(c => getCoaType(c) === 'asset'), [balanceSheetCodes]);
  const liabilityCodes = useMemo(() => balanceSheetCodes.filter(c => getCoaType(c) === 'liability'), [balanceSheetCodes]);
  const equityCodes = useMemo(() => balanceSheetCodes.filter(c => getCoaType(c) === 'equity'), [balanceSheetCodes]);

  const getRowTotal = (coaCode: string) => {
    return Object.values(gridData[coaCode] || {}).reduce((sum, val) => sum + val, 0);
  };

  const getYTDTotal = (coaCode: string) => {
    const months = gridData[coaCode] || {};
    return Object.values(months).reduce((sum, val) => sum + val, 0);
  };

  const getSectionQtrTotal = (codes: string[]) => codes.reduce((sum, code) => sum + getRowTotal(code), 0);
  const getSectionYTD = (codes: string[]) => codes.reduce((sum, code) => sum + getYTDTotal(code), 0);

  const getMonthTotal = (codes: string[], month: number) => {
    return codes.reduce((sum, code) => sum + (gridData[code]?.[month] || 0), 0);
  };

  const getNetIncomeQtr = () => Math.abs(getSectionQtrTotal(revenueCodes)) - Math.abs(getSectionQtrTotal(expenseCodes));
  const getNetIncomeYTD = () => Math.abs(getSectionYTD(revenueCodes)) - Math.abs(getSectionYTD(expenseCodes));

  const drilldownTransactions = useMemo(() => {
    if (!drilldownCell) return [];
    return yearTransactions.filter(t => {
      const month = new Date(t.date).getMonth();
      return t.accountCode === drilldownCell.coaCode && (drilldownCell.month === -1 || month === drilldownCell.month);
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

  const formatAmount = (val: number) => {
    if (val === 0) return '-';
    return `$${Math.abs(val).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
  };

  // Table Section Renderer
  const renderSection = (title: string, codes: string[], bgClass: string, textClass: string) => {
    if (codes.length === 0) return null;
    return (
      <>
        <tr className={bgClass}>
          <td colSpan={14} className={`px-3 py-2 font-bold text-sm ${textClass}`}>{title}</td>
        </tr>
        {codes.map(code => (
          <tr key={code} className="border-b border-gray-100 hover:bg-gray-50">
            <td className="px-3 py-2">
              <span className="font-mono text-xs text-gray-400">{code}</span>
              <span className="ml-2 text-sm">{getCoaName(code)}</span>
            </td>
            {MONTHS.map((_, m) => {
              const val = gridData[code]?.[m] || 0;
              return (
                <td 
                  key={m} 
                  className={`px-3 py-2 text-right text-sm ${val !== 0 ? 'cursor-pointer hover:bg-blue-50 text-blue-600' : 'text-gray-300'}`}
                  onClick={() => val !== 0 && setDrilldownCell({ coaCode: code, month: m })}
                >
                  {formatAmount(val)}
                </td>
              );
            })}
            <td className="px-3 py-2 text-right text-sm font-semibold bg-gray-50 cursor-pointer hover:bg-blue-50" onClick={() => setDrilldownCell({ coaCode: code, month: -1 })}>
              <span className="text-blue-600 hover:underline">{formatAmount(getRowTotal(code))}</span>
            </td>
          </tr>
        ))}
        <tr className={`${bgClass} border-b-2`}>
          <td className={`px-3 py-2 font-semibold text-sm ${textClass}`}>Total {title}</td>
          {MONTHS.map((_, m) => (
            <td key={m} className={`px-3 py-2 text-right font-semibold text-sm ${textClass}`}>
              {formatAmount(getMonthTotal(codes, m))}
            </td>
          ))}
          <td className={`px-3 py-2 text-right font-bold text-sm bg-gray-50 ${textClass}`}>
            {formatAmount(getSectionQtrTotal(codes))}
          </td>
        </tr>
      </>
    );
  };

  return (
    <div className="mt-6 bg-white border rounded-lg overflow-hidden">
      {/* Header Row */}
      <div className="px-4 py-3 bg-gray-50 border-b flex flex-wrap items-center justify-between gap-3">
        <h3 className="text-lg font-semibold">Financial Statements</h3>
        
        <div className="flex items-center gap-4">
          {/* Year Select */}
          <select 
            value={selectedYear} 
            onChange={(e) => setSelectedYear(Number(e.target.value))}
            className="border rounded px-3 py-1.5 text-sm font-medium"
          >
            {availableYears.map(y => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>
      </div>

      {/* Statement Tabs */}
      <div className="flex border-b">
        {[
          { key: 'income', label: 'Income Statement' },
          { key: 'balance', label: 'Balance Sheet' },
          { key: 'cashflow', label: 'Cash Flow' },
        ].map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveStatement(tab.key as any)}
            className={`px-5 py-3 text-sm font-medium transition-colors ${
              activeStatement === tab.key
                ? 'border-b-2 border-[#b4b237] text-[#b4b237] bg-white'
                : 'text-gray-500 hover:text-gray-700 bg-gray-50'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Income Statement Table */}
      {activeStatement === 'income' && (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-100">
              <tr>
                <th className="px-3 py-2 text-left font-semibold min-w-[200px]">Account</th>
                {MONTHS.map((name, i) => (
                  <th key={i} className="px-3 py-2 text-right font-semibold w-24">{name}</th>
                ))}
                <th className="px-3 py-2 text-right font-semibold w-24 bg-gray-100">Total</th>
              </tr>
            </thead>
            <tbody>
              {renderSection('Revenue', revenueCodes, 'bg-green-50', 'text-green-800')}
              {renderSection('Expenses', expenseCodes, 'bg-red-50', 'text-red-800')}
              
              {/* Net Income */}
              <tr className="bg-yellow-100 font-bold border-t-2 border-yellow-400">
                <td className="px-3 py-2">Net Income</td>
                {MONTHS.map((_, m) => {
                  const rev = getMonthTotal(revenueCodes, m);
                  const exp = getMonthTotal(expenseCodes, m);
                  const ni = Math.abs(rev) - Math.abs(exp);
                  return (
                    <td key={m} className={`px-3 py-2 text-right ${ni >= 0 ? 'text-green-700' : 'text-red-700'}`}>
                      {ni < 0 && '('}{formatAmount(Math.abs(ni))}{ni < 0 && ')'}
                    </td>
                  );
                })}
                <td className={`px-3 py-2 text-right bg-yellow-200 ${getNetIncomeQtr() >= 0 ? 'text-green-700' : 'text-red-700'}`}>
                  {getNetIncomeQtr() < 0 && '('}{formatAmount(Math.abs(getNetIncomeQtr()))}{getNetIncomeQtr() < 0 && ')'}
                </td>
              </tr>
            </tbody>
          </table>
          {incomeStatementCodes.length === 0 && (
            <div className="p-8 text-center text-gray-500">No income/expense data for {selectedYear}</div>
          )}
        </div>
      )}

      {/* Balance Sheet Table */}
      {activeStatement === 'balance' && (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-100">
              <tr>
                <th className="px-3 py-2 text-left font-semibold min-w-[200px]">Account</th>
                {MONTHS.map((name, i) => (
                  <th key={i} className="px-3 py-2 text-right font-semibold w-24">{name}</th>
                ))}
                <th className="px-3 py-2 text-right font-semibold w-24 bg-gray-100">Total</th>
              </tr>
            </thead>
            <tbody>
              {renderSection('Assets', assetCodes, 'bg-blue-50', 'text-blue-800')}
              {renderSection('Liabilities', liabilityCodes, 'bg-orange-50', 'text-orange-800')}
              {renderSection('Equity', equityCodes, 'bg-purple-50', 'text-purple-800')}
            </tbody>
          </table>
          {balanceSheetCodes.length === 0 && (
            <div className="p-8 text-center text-gray-500">No balance sheet data for {selectedYear}</div>
          )}
        </div>
      )}

      {/* Cash Flow Placeholder */}
      {activeStatement === 'cashflow' && (
        <div className="p-12 text-center text-gray-500">
          <p className="text-lg font-medium">Cash Flow Statement</p>
          <p className="text-sm mt-1">Coming soon — derived from I/S and B/S changes</p>
        </div>
      )}

      {/* Drilldown Modal */}
      {drilldownCell && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[80vh] flex flex-col">
            <div className="px-4 py-3 border-b flex justify-between items-center">
              <div>
                <p className="font-mono text-xs text-gray-500">{drilldownCell.coaCode}</p>
                <h4 className="font-semibold">{getCoaName(drilldownCell.coaCode)}</h4>
                <p className="text-sm text-gray-500">
                  {drilldownCell.month === -1 ? "YTD" : MONTHS[drilldownCell.month]} {selectedYear} • {drilldownTransactions.length} txns
                </p>
              </div>
              <button onClick={() => { setDrilldownCell(null); setSelectedTxns([]); }} className="text-gray-400 hover:text-gray-600 text-2xl leading-none">&times;</button>
            </div>

            {selectedTxns.length > 0 && (
              <div className="px-4 py-2 bg-yellow-50 border-b flex flex-wrap items-center gap-2">
                <span className="text-sm font-medium">{selectedTxns.length} selected</span>
                <select value={reassignCoa} onChange={(e) => setReassignCoa(e.target.value)} className="text-sm border rounded px-2 py-1 flex-1 min-w-[150px]">
                  <option value="">Move to COA...</option>
                  {Object.entries(coaGrouped).map(([type, opts]) => (
                    <optgroup key={type} label={type}>
                      {opts.map(o => <option key={o.id} value={o.code}>{o.code} - {o.name}</option>)}
                    </optgroup>
                  ))}
                </select>
                <button onClick={handleReassign} disabled={!reassignCoa || isReassigning} className="px-3 py-1 bg-[#b4b237] text-white rounded text-sm disabled:opacity-50">
                  {isReassigning ? '...' : 'Move'}
                </button>
              </div>
            )}

            <div className="flex-1 overflow-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 sticky top-0">
                  <tr>
                    <th className="px-3 py-2 w-8">
                      <input type="checkbox" 
                        checked={selectedTxns.length === drilldownTransactions.length && drilldownTransactions.length > 0}
                        onChange={(e) => setSelectedTxns(e.target.checked ? drilldownTransactions.map(t => t.id) : [])} 
                      />
                    </th>
                    <th className="px-3 py-2 text-left">Date</th>
                    <th className="px-3 py-2 text-left">Description</th>
                    <th className="px-3 py-2 text-right">Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {drilldownTransactions.map(txn => (
                    <tr key={txn.id} className={`hover:bg-gray-50 ${selectedTxns.includes(txn.id) ? 'bg-blue-50' : ''}`}>
                      <td className="px-3 py-2">
                        <input type="checkbox" checked={selectedTxns.includes(txn.id)}
                          onChange={(e) => setSelectedTxns(e.target.checked ? [...selectedTxns, txn.id] : selectedTxns.filter(id => id !== txn.id))} />
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap">{new Date(txn.date).toLocaleDateString()}</td>
                      <td className="px-3 py-2">
                        <div className="truncate max-w-[250px]">{txn.name}</div>
                        {txn.merchantName && <div className="text-xs text-gray-500">{txn.merchantName}</div>}
                      </td>
                      <td className="px-3 py-2 text-right font-medium">${Math.abs(txn.amount).toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="px-4 py-3 border-t bg-gray-50 flex justify-between items-center">
              <span className="text-sm text-gray-600">Total: ${drilldownTransactions.reduce((s, t) => s + Math.abs(t.amount), 0).toLocaleString()}</span>
              <button onClick={() => { setDrilldownCell(null); setSelectedTxns([]); }} className="px-4 py-1.5 bg-gray-200 rounded text-sm">Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
