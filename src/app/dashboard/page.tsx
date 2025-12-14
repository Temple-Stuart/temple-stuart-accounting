'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import Script from 'next/script';
import SpendingTab from '@/components/dashboard/SpendingTab';
import InvestmentsTab from '@/components/dashboard/InvestmentsTab';
import BudgetBuilder from '@/components/dashboard/BudgetBuilder';
import GeneralLedger from '@/components/dashboard/GeneralLedger';
import JournalEntryEngine from '@/components/dashboard/JournalEntryEngine';
import BankReconciliation from '@/components/dashboard/BankReconciliation';
import PeriodClose from '@/components/dashboard/PeriodClose';
import CPAExport from '@/components/dashboard/CPAExport';

interface Transaction {
  id: string;
  date: string;
  name: string;
  merchantName: string | null;
  amount: number;
  accountCode: string | null;
  subAccount: string | null;
  plaidAccountId: string;
}

interface Account {
  id: string;
  name: string;
  mask: string | null;
  type: string;
  balance: number;
  institutionName: string;
}

interface CoaOption {
  id: string;
  code: string;
  name: string;
  accountType: string;
  balanceType: string;
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export default function Dashboard() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [coaOptions, setCoaOptions] = useState<CoaOption[]>([]);
  const [investmentTransactions, setInvestmentTransactions] = useState<any[]>([]);
  const [budgets, setBudgets] = useState<any[]>([]);
  const [journalEntries, setJournalEntries] = useState<any[]>([]);
  const [reconciliations, setReconciliations] = useState<any[]>([]);
  const [periodCloses, setPeriodCloses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [linkToken, setLinkToken] = useState<string | null>(null);
  
  // Map to COA tab
  const [mappingTab, setMappingTab] = useState<'spending' | 'investments'>('spending');
  
  // Statement controls
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [activeStatement, setActiveStatement] = useState<'income' | 'balance' | 'cashflow'>('income');
  const [drilldownCell, setDrilldownCell] = useState<{ coaCode: string; month: number } | null>(null);
  const [selectedDrilldownTxns, setSelectedDrilldownTxns] = useState<string[]>([]);
  const [reassignCoa, setReassignCoa] = useState('');
  
  // Transaction filters
  const [filterCoa, setFilterCoa] = useState<string>('all');
  const [filterVendor, setFilterVendor] = useState<string>('all');
  const [filterSearch, setFilterSearch] = useState('');
  const [visibleTxns, setVisibleTxns] = useState(50);
  
  // Bulk assignment
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [assignCoa, setAssignCoa] = useState('');
  const [assignSub, setAssignSub] = useState('');
  const [isAssigning, setIsAssigning] = useState(false);
  
  // Category breakdown

  const loadData = useCallback(async () => {
    try {
      const [txnRes, coaRes, accRes, invRes] = await Promise.all([
        fetch('/api/transactions'),
        fetch('/api/chart-of-accounts'),
        fetch('/api/accounts'),
        fetch('/api/investment-transactions')
      ]);
      
      if (txnRes.ok) {
        const data = await txnRes.json();
        setTransactions(data.transactions || []);
      }
      if (coaRes.ok) {
        const data = await coaRes.json();
        setCoaOptions(data.accounts || []);
      }
      if (accRes.ok) {
        const data = await accRes.json();
        const allAccounts: Account[] = [];
        (data.items || []).forEach((item: any) => {
          (item.accounts || []).forEach((acc: any) => {
            allAccounts.push({
              id: acc.id,
              name: acc.name,
              mask: acc.mask,
              type: acc.type,
              balance: acc.balance || 0,
              institutionName: item.institutionName || 'Unknown'
            });
          });
        });
        setAccounts(allAccounts);
      }
      if (invRes.ok) {
        const data = await invRes.json();
        setInvestmentTransactions(data.transactions || data.investments || data || []);
      }
      
      const budgetRes = await fetch(`/api/budgets?year=${new Date().getFullYear()}`);
      if (budgetRes.ok) {
        const budgetData = await budgetRes.json();
        setBudgets(budgetData.budgets || []);
      }
      
      const jeRes = await fetch('/api/journal-entries');
      if (jeRes.ok) {
        const jeData = await jeRes.json();
        setJournalEntries(jeData.entries || []);
      }

      const reconRes = await fetch("/api/bank-reconciliations");
      if (reconRes.ok) {
        const reconData = await reconRes.json();
        setReconciliations(reconData.reconciliations || []);
      }

      const pcRes = await fetch(`/api/period-closes?year=${new Date().getFullYear()}`);
      if (pcRes.ok) {
        const pcData = await pcRes.json();
        setPeriodCloses(pcData.periods || []);
      }
      
      const linkRes = await fetch("/api/plaid/link-token", {
        method: "POST",
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ entityId: 'personal' })
      });
      if (linkRes.ok) {
        const linkData = await linkRes.json();
        setLinkToken(linkData.link_token);
      }
    } catch (err) {
      console.error('Load error:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  // Helpers
  const getCoaName = (code: string | null) => code ? coaOptions.find(c => c.code === code)?.name || code : null;
  const getCoaType = (code: string) => coaOptions.find(c => c.code === code)?.accountType || '';
  const formatMoney = (n: number, showSign = false) => {
    const abs = Math.abs(n);
    const formatted = abs.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
    if (showSign) return n < 0 ? `-$${formatted}` : `$${formatted}`;
    return `$${formatted}`;
  };

  // Spending/Investment splits
  const uncommittedSpending = transactions.filter(t => !t.accountCode);
  const committedSpending = transactions.filter(t => t.accountCode);
  const uncommittedInvestments = investmentTransactions.filter((t: any) => !t.accountCode);
  const committedInvestments = investmentTransactions.filter((t: any) => t.accountCode);

  // Available years
  const availableYears = useMemo(() => {
    const years = new Set<number>();
    transactions.forEach(t => years.add(new Date(t.date).getFullYear()));
    if (years.size === 0) years.add(new Date().getFullYear());
    return Array.from(years).sort((a, b) => b - a);
  }, [transactions]);

  // Grid data for statements
  const yearTransactions = useMemo(() => {
    return committedSpending.filter(t => new Date(t.date).getFullYear() === selectedYear);
  }, [committedSpending, selectedYear]);

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

  // Statement codes
  const revenueCodes = useMemo(() => Object.keys(gridData).filter(c => getCoaType(c) === 'revenue').sort(), [gridData, coaOptions]);
  const expenseCodes = useMemo(() => Object.keys(gridData).filter(c => getCoaType(c) === 'expense').sort(), [gridData, coaOptions]);
  const assetCodes = useMemo(() => Object.keys(gridData).filter(c => getCoaType(c) === 'asset').sort(), [gridData, coaOptions]);
  const liabilityCodes = useMemo(() => Object.keys(gridData).filter(c => getCoaType(c) === 'liability').sort(), [gridData, coaOptions]);
  const equityCodes = useMemo(() => Object.keys(gridData).filter(c => getCoaType(c) === 'equity').sort(), [gridData, coaOptions]);

  const getMonthTotal = (codes: string[], month: number) => codes.reduce((sum, code) => sum + (gridData[code]?.[month] || 0), 0);
  const getRowTotal = (coaCode: string) => Object.values(gridData[coaCode] || {}).reduce((sum, val) => sum + val, 0);
  const getSectionTotal = (codes: string[]) => codes.reduce((sum, code) => sum + getRowTotal(code), 0);

  // Drilldown transactions
  const drilldownTransactions = useMemo(() => {
    if (!drilldownCell) return [];
    return yearTransactions.filter(t => {
      const month = new Date(t.date).getMonth();
      return t.accountCode === drilldownCell.coaCode && (drilldownCell.month === -1 || month === drilldownCell.month);
    }).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [yearTransactions, drilldownCell]);

  // Transaction filters
  const vendors = useMemo(() => {
    const v: Record<string, number> = {};
    transactions.forEach(t => { if (t.subAccount) v[t.subAccount] = (v[t.subAccount] || 0) + 1; });
    return Object.entries(v).sort((a, b) => b[1] - a[1]);
  }, [transactions]);

  const usedCoas = useMemo(() => {
    const c: Record<string, number> = {};
    transactions.forEach(t => { if (t.accountCode) c[t.accountCode] = (c[t.accountCode] || 0) + 1; });
    return Object.entries(c).map(([code, count]) => ({ code, name: getCoaName(code) || code, count })).sort((a, b) => b.count - a.count);
  }, [transactions, coaOptions]);

  const filtered = useMemo(() => {
    return transactions.filter(t => {
      if (filterCoa === 'uncategorized' && t.accountCode) return false;
      if (filterCoa !== 'all' && filterCoa !== 'uncategorized' && t.accountCode !== filterCoa) return false;
      if (filterVendor === 'none' && t.subAccount) return false;
      if (filterVendor !== 'all' && filterVendor !== 'none' && t.subAccount !== filterVendor) return false;
      if (filterSearch) {
        const s = filterSearch.toLowerCase();
        if (!t.name.toLowerCase().includes(s) && !t.merchantName?.toLowerCase().includes(s) && !t.subAccount?.toLowerCase().includes(s)) return false;
      }
      return true;
    }).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [transactions, filterCoa, filterVendor, filterSearch]);

  // Category metrics

  // COA grouped for selects
  const coaGrouped = useMemo(() => {
    const g: Record<string, CoaOption[]> = {};
    coaOptions.forEach(o => { if (!g[o.accountType]) g[o.accountType] = []; g[o.accountType].push(o); });
    return g;
  }, [coaOptions]);

  // Stats
  const stats = useMemo(() => ({
    total: transactions.length,
    categorized: committedSpending.length,
    uncategorized: uncommittedSpending.length,
    hasVendor: transactions.filter(t => t.subAccount).length,
    noVendor: transactions.filter(t => !t.subAccount).length,
  }), [transactions, committedSpending, uncommittedSpending]);

  // Actions
  const openPlaidLink = useCallback(() => {
    if (!linkToken || !window.Plaid) return;
    window.Plaid.create({
      token: linkToken,
      onSuccess: async (publicToken: string, metadata: any) => {
        await fetch('/api/plaid/exchange-token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ publicToken, institutionId: metadata.institution?.institution_id, institutionName: metadata.institution?.name, entityId: 'personal' })
        });
        loadData();
      },
      onExit: () => {}
    }).open();
  }, [linkToken, loadData]);

  const syncAccounts = async () => {
    setSyncing(true);
    const itemsRes = await fetch('/api/plaid/items');
    const items = await itemsRes.json();
    for (const item of items) {
      await fetch('/api/plaid/sync', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ itemId: item.id }) });
    }
    await loadData();
    setSyncing(false);
  };

  const handleBulkAssign = async () => {
    if (!selectedIds.length || (!assignCoa && !assignSub)) return;
    setIsAssigning(true);
    await fetch('/api/transactions/assign-coa', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ transactionIds: selectedIds, accountCode: assignCoa || undefined, subAccount: assignSub || undefined })
    });
    setSelectedIds([]);
    setAssignCoa('');
    setAssignSub('');
    await loadData();
    setIsAssigning(false);
  };

  const handleDrilldownReassign = async () => {
    if (!reassignCoa || !selectedDrilldownTxns.length) return;
    await fetch('/api/transactions/assign-coa', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ transactionIds: selectedDrilldownTxns, accountCode: reassignCoa })
    });
    setSelectedDrilldownTxns([]);
    setReassignCoa('');
    setDrilldownCell(null);
    await loadData();
  };

  const saveBudget = async (accountCode: string, year: number, months: Record<string, number | null>) => {
    await fetch("/api/budgets", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ accountCode, year, months })
    });
  };


  const handleLedgerUpdate = async (id: string, field: "accountCode" | "subAccount", value: string) => {
    await fetch("/api/transactions/assign-coa", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ transactionIds: [id], [field]: value || null })
    });
    await loadData();
  };
  // Statement table row renderer

  const saveJournalEntry = async (entry: any) => {
    await fetch("/api/journal-entries", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(entry)
    });
  };

  const saveReconciliation = async (data: any) => {
    await fetch("/api/bank-reconciliations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data)
    });
  };


  const closePeriod = async (year: number, month: number, notes?: string) => {
    await fetch("/api/period-closes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ year, month, action: "close", notes })
    });
  };

  const reopenPeriod = async (year: number, month: number) => {
    await fetch("/api/period-closes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ year, month, action: "reopen" })
    });
  };
  // Statement table row renderer
  const renderStatementRow = (code: string) => (
    <tr key={code} className="border-b border-gray-100 hover:bg-gray-50">
      <td className="px-3 py-2 sticky left-0 bg-white z-10 min-w-[180px]">
        <div className="text-sm font-medium truncate">{getCoaName(code)}</div>
        <div className="text-xs text-gray-400 font-mono">{code}</div>
      </td>
      {MONTHS.map((_, m) => {
        const val = gridData[code]?.[m] || 0;
        return (
          <td 
            key={m} 
            onClick={() => val !== 0 && setDrilldownCell({ coaCode: code, month: m })}
            className={`px-2 py-2 text-right text-sm tabular-nums ${val !== 0 ? 'cursor-pointer hover:bg-blue-50 text-gray-900' : 'text-gray-300'}`}
          >
            {val === 0 ? '-' : formatMoney(val)}
          </td>
        );
      })}
      <td 
        onClick={() => setDrilldownCell({ coaCode: code, month: -1 })}
        className="px-2 py-2 text-right text-sm font-semibold bg-gray-50 sticky right-0 cursor-pointer hover:bg-blue-50 tabular-nums"
      >
        {formatMoney(getRowTotal(code))}
      </td>
    </tr>
  );

  const renderSectionHeader = (title: string, bgColor: string, textColor: string) => (
    <tr className={bgColor}>
      <td colSpan={14} className={`px-3 py-2 font-bold text-sm sticky left-0 ${textColor} ${bgColor}`}>{title}</td>
    </tr>
  );

  const renderSectionTotal = (title: string, codes: string[], bgColor: string, textColor: string) => (
    <tr className={`${bgColor} border-b-2`}>
      <td className={`px-3 py-2 font-semibold text-sm sticky left-0 ${bgColor} ${textColor}`}>Total {title}</td>
      {MONTHS.map((_, m) => (
        <td key={m} className={`px-2 py-2 text-right font-semibold text-sm tabular-nums ${textColor}`}>
          {formatMoney(getMonthTotal(codes, m))}
        </td>
      ))}
      <td className={`px-2 py-2 text-right font-bold text-sm bg-gray-100 sticky right-0 tabular-nums ${textColor}`}>
        {formatMoney(getSectionTotal(codes))}
      </td>
    </tr>
  );

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-[#b4b237] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <>
      <Script src="https://cdn.plaid.com/link/v2/stable/link-initialize.js" strategy="lazyOnload" />
      
      <div className="min-h-screen bg-gray-50">
        {/* ═══════════════════════════════════════════════════════════════════
            HEADER
        ═══════════════════════════════════════════════════════════════════ */}
        <header className="bg-white border-b sticky top-0 z-50">
          <div className="max-w-7xl mx-auto px-4 h-14 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 bg-[#b4b237] rounded-lg flex items-center justify-center">
                <span className="text-white font-bold">TS</span>
              </div>
              <div className="hidden sm:block">
                <div className="font-semibold text-gray-900">Temple Stuart</div>
                <div className="text-xs text-gray-400">Financial OS</div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={syncAccounts} disabled={syncing} className="px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100 rounded-lg">
                {syncing ? '⟳ Syncing...' : '🔄 Sync'}
              </button>
              <button onClick={openPlaidLink} disabled={!linkToken} className="px-3 py-1.5 text-sm bg-[#b4b237] text-white rounded-lg font-medium">
                + Add Account
              </button>
            </div>
          </div>
        </header>

        <main className="max-w-7xl mx-auto px-4 py-6 space-y-8">
          
          {/* ═══════════════════════════════════════════════════════════════════
              SECTION 1: CONNECTED ACCOUNTS
          ═══════════════════════════════════════════════════════════════════ */}
          <section>
            <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-4">Connected Accounts</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {accounts.map(acc => (
                <div key={acc.id} className="bg-white rounded-xl border p-4 hover:shadow-md transition-shadow">
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="font-semibold text-gray-900">{acc.institutionName}</div>
                      <div className="text-xs text-gray-400">•••• {acc.mask || '----'}</div>
                    </div>
                    <div className="text-right">
                      <div className="text-lg font-bold text-gray-900">${acc.balance.toLocaleString()}</div>
                      <div className="text-xs text-gray-400 capitalize">{acc.type}</div>
                    </div>
                  </div>
                </div>
              ))}
              {accounts.length === 0 && (
                <div className="col-span-full bg-white rounded-xl border p-8 text-center text-gray-400">
                  No accounts connected. Click "+ Add Account" to link your bank.
                </div>
              )}
            </div>
          </section>

          {/* ═══════════════════════════════════════════════════════════════════
              SECTION 2: MAP TO COA
          ═══════════════════════════════════════════════════════════════════ */}
          <section>
            <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-4">
              Map Transactions to COA
              <span className="ml-2 text-xs font-normal text-amber-600">
                {uncommittedSpending.length + uncommittedInvestments.length} pending
              </span>
            </h2>
            <div className="bg-white rounded-xl border overflow-hidden">
              <div className="flex border-b">
                <button 
                  onClick={() => setMappingTab('spending')}
                  className={`flex-1 px-4 py-3 text-sm font-medium ${mappingTab === 'spending' ? 'border-b-2 border-[#b4b237] text-[#b4b237] bg-white' : 'text-gray-500 bg-gray-50'}`}
                >
                  Spending <span className="text-xs text-gray-400 ml-1">{uncommittedSpending.length} / {transactions.length}</span>
                </button>
                <button 
                  onClick={() => setMappingTab('investments')}
                  className={`flex-1 px-4 py-3 text-sm font-medium ${mappingTab === 'investments' ? 'border-b-2 border-[#b4b237] text-[#b4b237] bg-white' : 'text-gray-500 bg-gray-50'}`}
                >
                  Investments <span className="text-xs text-gray-400 ml-1">{uncommittedInvestments.length} / {investmentTransactions.length}</span>
                </button>
              </div>
              <div className="p-4">
                {mappingTab === 'spending' && (
                  <SpendingTab transactions={uncommittedSpending} committedTransactions={committedSpending} coaOptions={coaOptions} onReload={loadData} />
                )}
                {mappingTab === 'investments' && (
                  <InvestmentsTab investmentTransactions={uncommittedInvestments} committedInvestments={committedInvestments} onReload={loadData} />
                )}
              </div>
            </div>
          </section>

          {/* ═══════════════════════════════════════════════════════════════════
              SECTION 3: FINANCIAL STATEMENTS (12-MONTH TABLES)
          ═══════════════════════════════════════════════════════════════════ */}
          <section>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider">Financial Statements</h2>
              <select 
                value={selectedYear} 
                onChange={(e) => setSelectedYear(Number(e.target.value))}
                className="border rounded-lg px-3 py-1.5 text-sm"
              >
                {availableYears.map(y => <option key={y} value={y}>{y}</option>)}
              </select>
            </div>
            
            <div className="bg-white rounded-xl border overflow-hidden">
              {/* Statement Tabs */}
              <div className="flex border-b overflow-x-auto">
                {[
                  { key: 'income', label: 'Income Statement' },
                  { key: 'balance', label: 'Balance Sheet' },
                  { key: 'cashflow', label: 'Cash Flow' },
                ].map(tab => (
                  <button
                    key={tab.key}
                    onClick={() => setActiveStatement(tab.key as any)}
                    className={`px-4 py-3 text-sm font-medium whitespace-nowrap ${activeStatement === tab.key ? 'border-b-2 border-[#b4b237] text-[#b4b237] bg-white' : 'text-gray-500 bg-gray-50'}`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              {/* Income Statement */}
              {activeStatement === 'income' && (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm min-w-[900px]">
                    <thead className="bg-gray-100">
                      <tr>
                        <th className="px-3 py-3 text-left font-semibold sticky left-0 bg-gray-100 z-10 min-w-[180px]">Account</th>
                        {MONTHS.map((m, i) => <th key={i} className="px-2 py-3 text-right font-semibold w-20">{m}</th>)}
                        <th className="px-2 py-3 text-right font-semibold w-24 bg-gray-200 sticky right-0">YTD</th>
                      </tr>
                    </thead>
                    <tbody>
                      {revenueCodes.length > 0 && (
                        <>
                          {renderSectionHeader('Revenue', 'bg-green-50', 'text-green-800')}
                          {revenueCodes.map(renderStatementRow)}
                          {renderSectionTotal('Revenue', revenueCodes, 'bg-green-100', 'text-green-800')}
                        </>
                      )}
                      {expenseCodes.length > 0 && (
                        <>
                          {renderSectionHeader('Expenses', 'bg-red-50', 'text-red-800')}
                          {expenseCodes.map(renderStatementRow)}
                          {renderSectionTotal('Expenses', expenseCodes, 'bg-red-100', 'text-red-800')}
                        </>
                      )}
                      {/* Net Income */}
                      <tr className="bg-yellow-100 font-bold border-t-2 border-yellow-400">
                        <td className="px-3 py-3 sticky left-0 bg-yellow-100 z-10">Net Income</td>
                        {MONTHS.map((_, m) => {
                          const rev = Math.abs(getMonthTotal(revenueCodes, m));
                          const exp = Math.abs(getMonthTotal(expenseCodes, m));
                          const ni = rev - exp;
                          return (
                            <td key={m} className={`px-2 py-3 text-right tabular-nums ${ni >= 0 ? 'text-green-700' : 'text-red-700'}`}>
                              {ni === 0 ? '-' : formatMoney(ni, true)}
                            </td>
                          );
                        })}
                        <td className={`px-2 py-3 text-right bg-yellow-200 sticky right-0 tabular-nums ${Math.abs(getSectionTotal(revenueCodes)) - Math.abs(getSectionTotal(expenseCodes)) >= 0 ? 'text-green-700' : 'text-red-700'}`}>
                          {formatMoney(Math.abs(getSectionTotal(revenueCodes)) - Math.abs(getSectionTotal(expenseCodes)), true)}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                  {revenueCodes.length === 0 && expenseCodes.length === 0 && (
                    <div className="p-8 text-center text-gray-400">No income/expense data for {selectedYear}</div>
                  )}
                </div>
              )}

              {/* Balance Sheet */}
              {activeStatement === 'balance' && (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm min-w-[900px]">
                    <thead className="bg-gray-100">
                      <tr>
                        <th className="px-3 py-3 text-left font-semibold sticky left-0 bg-gray-100 z-10 min-w-[180px]">Account</th>
                        {MONTHS.map((m, i) => <th key={i} className="px-2 py-3 text-right font-semibold w-20">{m}</th>)}
                        <th className="px-2 py-3 text-right font-semibold w-24 bg-gray-200 sticky right-0">YTD</th>
                      </tr>
                    </thead>
                    <tbody>
                      {assetCodes.length > 0 && (
                        <>
                          {renderSectionHeader('Assets', 'bg-blue-50', 'text-blue-800')}
                          {assetCodes.map(renderStatementRow)}
                          {renderSectionTotal('Assets', assetCodes, 'bg-blue-100', 'text-blue-800')}
                        </>
                      )}
                      {liabilityCodes.length > 0 && (
                        <>
                          {renderSectionHeader('Liabilities', 'bg-orange-50', 'text-orange-800')}
                          {liabilityCodes.map(renderStatementRow)}
                          {renderSectionTotal('Liabilities', liabilityCodes, 'bg-orange-100', 'text-orange-800')}
                        </>
                      )}
                      {equityCodes.length > 0 && (
                        <>
                          {renderSectionHeader('Equity', 'bg-purple-50', 'text-purple-800')}
                          {equityCodes.map(renderStatementRow)}
                          {renderSectionTotal('Equity', equityCodes, 'bg-purple-100', 'text-purple-800')}
                        </>
                      )}
                    </tbody>
                  </table>
                  {assetCodes.length === 0 && liabilityCodes.length === 0 && equityCodes.length === 0 && (
                    <div className="p-8 text-center text-gray-400">No balance sheet data for {selectedYear}</div>
                  )}
                </div>
              )}

              {/* Cash Flow */}
              {activeStatement === 'cashflow' && (
                <div className="p-12 text-center text-gray-400">
                  <p className="text-lg font-medium">Cash Flow Statement</p>
                  <p className="text-sm mt-1">Coming soon — derived from I/S and B/S changes</p>
                </div>
              )}
            </div>
          </section>

          {/* ═══════════════════════════════════════════════════════════════════
              SECTION 4: JOURNAL ENTRIES
          ═══════════════════════════════════════════════════════════════════ */}
          <section>
            <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-4">Journal Entries</h2>
            <JournalEntryEngine
              entries={journalEntries}
              coaOptions={coaOptions}
              onSave={saveJournalEntry}
              onReload={loadData}
            />
          </section>


          {/* ═══════════════════════════════════════════════════════════════════
              SECTION 5: BANK RECONCILIATION
          ═══════════════════════════════════════════════════════════════════ */}
          <section>
            <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-4">Bank Reconciliation</h2>
            <BankReconciliation
              accounts={accounts}
              transactions={transactions}
              reconciliations={reconciliations}
              onSave={saveReconciliation}
              onReload={loadData}
            />
          </section>


          {/* ═══════════════════════════════════════════════════════════════════
              SECTION 6: PERIOD CLOSE
          ═══════════════════════════════════════════════════════════════════ */}
          <section>
            <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-4">Period Close</h2>
            <PeriodClose
              transactions={transactions}
              reconciliations={reconciliations}
              periodCloses={periodCloses}
              selectedYear={selectedYear}
              onClose={closePeriod}
              onReopen={reopenPeriod}
              onReload={loadData}
            />
          </section>


          {/* ═══════════════════════════════════════════════════════════════════
              SECTION 7: CPA EXPORT
          ═══════════════════════════════════════════════════════════════════ */}
          <section>
            <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-4">CPA Export</h2>
            <CPAExport
              transactions={transactions}
              coaOptions={coaOptions}
              selectedYear={selectedYear}
            />
          </section>


          {/* ═══════════════════════════════════════════════════════════════════
              SECTION 8: GENERAL LEDGER
          ═══════════════════════════════════════════════════════════════════ */}
          <section>
            <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-4">General Ledger</h2>
            <GeneralLedger
              transactions={transactions}
              coaOptions={coaOptions}
              onUpdate={handleLedgerUpdate}
            />
          </section>


          {/* ═══════════════════════════════════════════════════════════════════
              SECTION 9: BUDGET BUILDER
          ═══════════════════════════════════════════════════════════════════ */}
          <section>
            <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-4">Budget Builder</h2>
            <BudgetBuilder
              transactions={transactions}
              coaOptions={coaOptions}
              budgets={budgets}
              selectedYear={selectedYear}
              onSaveBudget={saveBudget}
            />
          </section>
          {/* Spacer for bulk actions */}
          {selectedIds.length > 0 && <div className="h-24" />}
        </main>

        {/* ═══════════════════════════════════════════════════════════════════
            BULK ASSIGN BAR (Fixed Bottom)
        ═══════════════════════════════════════════════════════════════════ */}
        {selectedIds.length > 0 && (
          <div className="fixed bottom-0 left-0 right-0 bg-white border-t shadow-lg p-4 z-40">
            <div className="max-w-7xl mx-auto flex flex-wrap items-center gap-3">
              <span className="text-sm font-semibold text-[#b4b237]">{selectedIds.length} selected</span>
              <select value={assignCoa} onChange={(e) => setAssignCoa(e.target.value)} className="flex-1 min-w-[150px] px-3 py-2 border rounded-lg text-sm">
                <option value="">Category...</option>
                {Object.entries(coaGrouped).map(([type, opts]) => (
                  <optgroup key={type} label={type}>
                    {opts.map(o => <option key={o.id} value={o.code}>{o.name}</option>)}
                  </optgroup>
                ))}
              </select>
              <input
                type="text"
                value={assignSub}
                onChange={(e) => setAssignSub(e.target.value)}
                placeholder="Vendor..."
                className="flex-1 min-w-[120px] px-3 py-2 border rounded-lg text-sm"
                list="vendors-list"
              />
              <datalist id="vendors-list">
                {vendors.slice(0, 30).map(([v]) => <option key={v} value={v} />)}
              </datalist>
              <button
                onClick={handleBulkAssign}
                disabled={(!assignCoa && !assignSub) || isAssigning}
                className="px-5 py-2 bg-[#b4b237] text-white rounded-lg text-sm font-medium disabled:opacity-50"
              >
                {isAssigning ? '...' : 'Apply'}
              </button>
              <button onClick={() => setSelectedIds([])} className="text-gray-400 hover:text-gray-600">✕</button>
            </div>
          </div>
        )}

        {/* ═══════════════════════════════════════════════════════════════════
            DRILLDOWN MODAL
        ═══════════════════════════════════════════════════════════════════ */}
        {drilldownCell && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[80vh] flex flex-col">
              <div className="px-4 py-3 border-b flex justify-between items-center">
                <div>
                  <h4 className="font-semibold">{getCoaName(drilldownCell.coaCode)}</h4>
                  <p className="text-sm text-gray-500">
                    {drilldownCell.month === -1 ? 'Full Year' : MONTHS[drilldownCell.month]} {selectedYear} • {drilldownTransactions.length} transactions
                  </p>
                </div>
                <button onClick={() => { setDrilldownCell(null); setSelectedDrilldownTxns([]); }} className="text-gray-400 hover:text-gray-600 text-2xl">×</button>
              </div>

              {selectedDrilldownTxns.length > 0 && (
                <div className="px-4 py-2 bg-yellow-50 border-b flex items-center gap-2">
                  <span className="text-sm">{selectedDrilldownTxns.length} selected</span>
                  <select value={reassignCoa} onChange={(e) => setReassignCoa(e.target.value)} className="flex-1 text-sm border rounded px-2 py-1">
                    <option value="">Move to...</option>
                    {Object.entries(coaGrouped).map(([type, opts]) => (
                      <optgroup key={type} label={type}>
                        {opts.map(o => <option key={o.id} value={o.code}>{o.name}</option>)}
                      </optgroup>
                    ))}
                  </select>
                  <button onClick={handleDrilldownReassign} disabled={!reassignCoa} className="px-3 py-1 bg-[#b4b237] text-white rounded text-sm disabled:opacity-50">Move</button>
                </div>
              )}

              <div className="flex-1 overflow-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 sticky top-0">
                    <tr>
                      <th className="px-3 py-2 w-8">
                        <input
                          type="checkbox"
                          checked={selectedDrilldownTxns.length === drilldownTransactions.length && drilldownTransactions.length > 0}
                          onChange={(e) => setSelectedDrilldownTxns(e.target.checked ? drilldownTransactions.map(t => t.id) : [])}
                        />
                      </th>
                      <th className="px-3 py-2 text-left">Date</th>
                      <th className="px-3 py-2 text-left">Description</th>
                      <th className="px-3 py-2 text-right">Amount</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {drilldownTransactions.map(txn => (
                      <tr key={txn.id} className={`hover:bg-gray-50 ${selectedDrilldownTxns.includes(txn.id) ? 'bg-blue-50' : ''}`}>
                        <td className="px-3 py-2">
                          <input
                            type="checkbox"
                            checked={selectedDrilldownTxns.includes(txn.id)}
                            onChange={(e) => setSelectedDrilldownTxns(e.target.checked ? [...selectedDrilldownTxns, txn.id] : selectedDrilldownTxns.filter(id => id !== txn.id))}
                          />
                        </td>
                        <td className="px-3 py-2 whitespace-nowrap">{new Date(txn.date).toLocaleDateString()}</td>
                        <td className="px-3 py-2 truncate max-w-[200px]">{txn.name}</td>
                        <td className="px-3 py-2 text-right font-mono">${Math.abs(txn.amount).toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="px-4 py-3 border-t bg-gray-50 flex justify-between">
                <span className="text-sm text-gray-600">Total: ${drilldownTransactions.reduce((s, t) => s + Math.abs(t.amount), 0).toLocaleString()}</span>
                <button onClick={() => { setDrilldownCell(null); setSelectedDrilldownTxns([]); }} className="px-4 py-1.5 bg-gray-200 rounded text-sm">Close</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
