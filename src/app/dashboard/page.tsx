'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useSession } from 'next-auth/react';
import Script from 'next/script';
import { AppLayout, ResponsiveTable } from '@/components/ui';
import UpgradePrompt from '@/components/UpgradePrompt';
import SpendingTab from '@/components/dashboard/SpendingTab';
import InvestmentsTab from '@/components/dashboard/InvestmentsTab';
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
  const { data: session } = useSession();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [coaOptions, setCoaOptions] = useState<CoaOption[]>([]);
  const [investmentTransactions, setInvestmentTransactions] = useState<any[]>([]);
  const [journalEntries, setJournalEntries] = useState<any[]>([]);
  const [reconciliations, setReconciliations] = useState<any[]>([]);
  const [periodCloses, setPeriodCloses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [linkToken, setLinkToken] = useState<string | null>(null);
  const [userTier, setUserTier] = useState<string>('free');
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [mappingTab, setMappingTab] = useState<'spending' | 'investments'>('spending');
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [activeStatement, setActiveStatement] = useState<'income' | 'balance' | 'cashflow'>('income');
  const [drilldownCell, setDrilldownCell] = useState<{ coaCode: string; month: number } | null>(null);
  const [selectedDrilldownTxns, setSelectedDrilldownTxns] = useState<string[]>([]);
  const [reassignCoa, setReassignCoa] = useState('');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [assignCoa, setAssignCoa] = useState('');
  const [isAssigning, setIsAssigning] = useState(false);
  const [activeSection, setActiveSection] = useState<string>('accounts');

  useEffect(() => {
    if (session?.user?.email) {
      document.cookie = `userEmail=${session.user.email}; path=/; max-age=${60 * 60 * 24 * 30}; samesite=lax`;
    }
  }, [session]);

  const loadData = useCallback(async () => {
    try {
      const [txnRes, coaRes, accRes, invRes] = await Promise.all([
        fetch('/api/transactions'), fetch('/api/chart-of-accounts'), fetch('/api/accounts'), fetch('/api/investment-transactions')
      ]);
      if (txnRes.ok) { const data = await txnRes.json(); setTransactions(data.transactions || []); }
      if (coaRes.ok) { const data = await coaRes.json(); setCoaOptions(data.accounts || []); }
      if (accRes.ok) {
        const data = await accRes.json();
        const allAccounts: Account[] = [];
        (data.items || []).forEach((item: any) => {
          (item.accounts || []).forEach((acc: any) => {
            allAccounts.push({ id: acc.id, name: acc.name, mask: acc.mask, type: acc.type, balance: acc.balance || 0, institutionName: item.institutionName || 'Unknown' });
          });
        });
        setAccounts(allAccounts);
      }
      if (invRes.ok) { const data = await invRes.json(); setInvestmentTransactions(data.transactions || data.investments || data || []); }
      
      const jeRes = await fetch('/api/journal-entries');
      if (jeRes.ok) { const jeData = await jeRes.json(); setJournalEntries(jeData.entries || []); }
      const reconRes = await fetch("/api/bank-reconciliations");
      if (reconRes.ok) { const reconData = await reconRes.json(); setReconciliations(reconData.reconciliations || []); }
      const pcRes = await fetch(`/api/period-closes?year=${new Date().getFullYear()}`);
      if (pcRes.ok) { const pcData = await pcRes.json(); setPeriodCloses(pcData.periods || []); }
      const linkRes = await fetch("/api/plaid/link-token", { method: "POST", headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ entityId: 'personal' }) });
      if (linkRes.ok) { const linkData = await linkRes.json(); setLinkToken(linkData.link_token); }
      const meRes = await fetch('/api/auth/me');
      if (meRes.ok) { const meData = await meRes.json(); setUserTier(meData.user?.tier || 'free'); }
    } catch (err) { console.error('Load error:', err); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const getCoaName = (code: string | null) => code ? coaOptions.find(c => c.code === code)?.name || code : null;
  const getCoaType = (code: string) => coaOptions.find(c => c.code === code)?.accountType || '';
  const fmt = (n: number) => '$' + Math.abs(n).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
  const fmtSigned = (n: number) => (n < 0 ? '-' : '') + '$' + Math.abs(n).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 });

  const uncommittedSpending = transactions.filter(t => !t.accountCode);
  const committedSpending = transactions.filter(t => t.accountCode);
  const uncommittedInvestments = investmentTransactions.filter((t: any) => !t.accountCode);
  const committedInvestments = investmentTransactions.filter((t: any) => t.accountCode);

  const availableYears = useMemo(() => {
    const years = new Set<number>();
    transactions.forEach(t => years.add(new Date(t.date).getFullYear()));
    if (years.size === 0) years.add(new Date().getFullYear());
    return Array.from(years).sort((a, b) => b - a);
  }, [transactions]);

  const yearTransactions = useMemo(() => committedSpending.filter(t => new Date(t.date).getFullYear() === selectedYear), [committedSpending, selectedYear]);

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

  const revenueCodes = useMemo(() => Object.keys(gridData).filter(c => getCoaType(c) === 'revenue').sort(), [gridData, coaOptions]);
  const expenseCodes = useMemo(() => Object.keys(gridData).filter(c => getCoaType(c) === 'expense').sort(), [gridData, coaOptions]);
  const assetCodes = useMemo(() => Object.keys(gridData).filter(c => getCoaType(c) === 'asset').sort(), [gridData, coaOptions]);
  const liabilityCodes = useMemo(() => Object.keys(gridData).filter(c => getCoaType(c) === 'liability').sort(), [gridData, coaOptions]);
  const equityCodes = useMemo(() => Object.keys(gridData).filter(c => getCoaType(c) === 'equity').sort(), [gridData, coaOptions]);

  const getMonthTotal = (codes: string[], month: number) => codes.reduce((sum, code) => sum + (gridData[code]?.[month] || 0), 0);
  const getRowTotal = (coaCode: string) => Object.values(gridData[coaCode] || {}).reduce((sum, val) => sum + val, 0);
  const getSectionTotal = (codes: string[]) => codes.reduce((sum, code) => sum + getRowTotal(code), 0);

  const drilldownTransactions = useMemo(() => {
    if (!drilldownCell) return [];
    return yearTransactions.filter(t => {
      const month = new Date(t.date).getMonth();
      return t.accountCode === drilldownCell.coaCode && (drilldownCell.month === -1 || month === drilldownCell.month);
    }).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [yearTransactions, drilldownCell]);

  const coaGrouped = useMemo(() => {
    const g: Record<string, CoaOption[]> = {};
    coaOptions.forEach(o => { if (!g[o.accountType]) g[o.accountType] = []; g[o.accountType].push(o); });
    return g;
  }, [coaOptions]);

  const handleAddAccount = () => {
    if (userTier === 'free') {
      setShowUpgradeModal(true);
      return;
    }
    openPlaidLink();
  };

  const openPlaidLink = useCallback(() => {
    if (!linkToken || !(window as any).Plaid) return;
    (window as any).Plaid.create({
      token: linkToken,
      onSuccess: async (publicToken: string, metadata: any) => {
        await fetch('/api/plaid/exchange-token', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
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
    if (!selectedIds.length || !assignCoa) return;
    setIsAssigning(true);
    await fetch('/api/transactions/assign-coa', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ transactionIds: selectedIds, accountCode: assignCoa })
    });
    setSelectedIds([]); setAssignCoa('');
    await loadData();
    setIsAssigning(false);
  };

  const handleDrilldownReassign = async () => {
    if (!reassignCoa || !selectedDrilldownTxns.length) return;
    await fetch('/api/transactions/assign-coa', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ transactionIds: selectedDrilldownTxns, accountCode: reassignCoa })
    });
    setSelectedDrilldownTxns([]); setReassignCoa(''); setDrilldownCell(null);
    await loadData();
  };

  const handleLedgerUpdate = async (id: string, field: "accountCode" | "subAccount", value: string) => {
    await fetch("/api/transactions/assign-coa", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ transactionIds: [id], [field]: value || null }) });
    await loadData();
  };

  const saveJournalEntry = async (entry: any) => { await fetch("/api/journal-entries", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(entry) }); };
  const saveReconciliation = async (data: any) => { await fetch("/api/bank-reconciliations", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) }); };
  const closePeriod = async (year: number, month: number, notes?: string) => { await fetch("/api/period-closes", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ year, month, action: "close", notes }) }); };
  const reopenPeriod = async (year: number, month: number) => { await fetch("/api/period-closes", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ year, month, action: "reopen" }) }); };

  const totalBalance = accounts.reduce((s, a) => s + a.balance, 0);
  const pendingCount = uncommittedSpending.length + uncommittedInvestments.length;

  if (loading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center py-20">
          <div className="w-6 h-6 border-2 border-[#2d1b4e] border-t-transparent rounded-full animate-spin" />
        </div>
      {showUpgradeModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setShowUpgradeModal(false)} />
          <div className="relative z-10 bg-white border border-gray-200 p-6 max-w-md">
            <div className="text-sm font-medium text-gray-900 mb-2">Bank Sync requires Pro</div>
            <div className="text-xs text-gray-500 mb-4">Upgrade to Pro ($19/mo) to connect your bank accounts via Plaid.</div>
            <div className="flex gap-2">
              <button onClick={() => window.location.href = "/pricing"} className="flex-1 px-4 py-2 text-xs bg-[#2d1b4e] text-white font-medium hover:bg-[#3d2b5e]">View Plans</button>
              <button onClick={() => setShowUpgradeModal(false)} className="flex-1 px-4 py-2 text-xs border border-gray-300 text-gray-700 font-medium hover:bg-gray-50">Not Now</button>
            </div>
          </div>
        </div>
      )}
      </AppLayout>
    );
  }

  return (
    <>
      <Script src="https://cdn.plaid.com/link/v2/stable/link-initialize.js" strategy="lazyOnload" />
      <AppLayout>
        <div className="min-h-screen bg-[#f5f5f5]">
          <div className="p-4 lg:p-6 max-w-[1600px] mx-auto">
            
            {/* Header - Wall Street Style */}
            <div className="mb-4 bg-[#2d1b4e] text-white p-4">
              <div className="flex items-center justify-between">
                <div>
                  <h1 className="text-lg font-semibold tracking-tight">Bookkeeping</h1>
                  <p className="text-gray-300 text-xs font-mono">{transactions.length.toLocaleString()} transactions · {accounts.length} accounts · FY {selectedYear}</p>
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={syncAccounts} disabled={syncing} className="px-3 py-1.5 text-xs bg-white/10 hover:bg-white/20 transition-colors">
                    {syncing ? 'Syncing...' : 'Sync'}
                  </button>
                  <button onClick={handleAddAccount} disabled={userTier !== "free" && !linkToken} className="px-3 py-1.5 text-xs bg-white/20 hover:bg-white/30 transition-colors">
                    + Account
                  </button>
                </div>
              </div>
            </div>

            {/* Quick Stats Row */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
              <div className="bg-white border border-gray-200 p-3">
                <div className="text-[10px] text-gray-500 uppercase tracking-wider">Total Balance</div>
                <div className="text-xl font-bold font-mono text-gray-900">{fmt(totalBalance)}</div>
              </div>
              <div className="bg-white border border-gray-200 p-3">
                <div className="text-[10px] text-gray-500 uppercase tracking-wider">Pending Review</div>
                <div className="text-xl font-bold font-mono text-gray-900">{pendingCount}</div>
              </div>
              <div className="bg-white border border-gray-200 p-3">
                <div className="text-[10px] text-gray-500 uppercase tracking-wider">YTD Revenue</div>
                <div className="text-xl font-bold font-mono text-emerald-700">{fmt(Math.abs(getSectionTotal(revenueCodes)))}</div>
              </div>
              <div className="bg-white border border-gray-200 p-3">
                <div className="text-[10px] text-gray-500 uppercase tracking-wider">YTD Expenses</div>
                <div className="text-xl font-bold font-mono text-red-700">{fmt(Math.abs(getSectionTotal(expenseCodes)))}</div>
              </div>
            </div>

            {/* Section Tabs */}
            <div className="flex gap-1 mb-4 overflow-x-auto bg-white border border-gray-200">
              {[
                { key: 'accounts', label: 'Accounts' },
                { key: 'mapping', label: `Map COA${pendingCount > 0 ? ` (${pendingCount})` : ''}` },
                { key: 'statements', label: 'Statements' },
                { key: 'ledger', label: 'Ledger' },
                { key: 'journal', label: 'Journal' },
                { key: 'reconcile', label: 'Reconcile' },
                { key: 'close', label: 'Period Close' },
                { key: 'export', label: 'Export' },
              ].map(tab => (
                <button key={tab.key} onClick={() => setActiveSection(tab.key)}
                  className={`px-4 py-2 text-xs font-medium whitespace-nowrap transition-colors ${activeSection === tab.key ? 'bg-[#2d1b4e] text-white' : 'text-gray-600 hover:bg-gray-100'}`}>
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Section Content */}
            <div className="bg-white border border-gray-200">
              
              {/* Connected Accounts */}
              {activeSection === 'accounts' && (
                <div>
                  <div className="bg-[#2d1b4e] text-white px-4 py-2 text-sm font-semibold">
                    Connected Accounts
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead className="bg-[#3d2b5e] text-white">
                        <tr>
                          <th className="px-3 py-2 text-left font-medium">Institution</th>
                          <th className="px-3 py-2 text-left font-medium">Account</th>
                          <th className="px-3 py-2 text-left font-medium">Type</th>
                          <th className="px-3 py-2 text-right font-medium">Balance</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {accounts.map(acc => (
                          <tr key={acc.id} className="hover:bg-gray-50">
                            <td className="px-3 py-2 font-medium text-gray-900">{acc.institutionName}</td>
                            <td className="px-3 py-2 text-gray-600 font-mono">•••• {acc.mask || '----'}</td>
                            <td className="px-3 py-2"><span className="px-2 py-0.5 bg-gray-100 text-gray-600 text-[10px] uppercase">{acc.type}</span></td>
                            <td className="px-3 py-2 text-right font-mono font-semibold">{fmt(acc.balance)}</td>
                          </tr>
                        ))}
                        {accounts.length === 0 && (
                          <tr><td colSpan={4} className="px-3 py-8 text-center text-gray-400">No accounts connected</td></tr>
                        )}
                      </tbody>
                      <tfoot className="bg-gray-50 border-t border-gray-200">
                        <tr>
                          <td colSpan={3} className="px-3 py-2 font-semibold text-gray-900">Total</td>
                          <td className="px-3 py-2 text-right font-mono font-bold text-gray-900">{fmt(totalBalance)}</td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                </div>
              )}

              {/* Map to COA */}
              {activeSection === 'mapping' && (
                <div>
                  <div className="bg-[#2d1b4e] text-white px-4 py-2 flex items-center justify-between">
                    <span className="text-sm font-semibold">Map Transactions to Chart of Accounts</span>
                    {pendingCount > 0 && <span className="px-2 py-0.5 bg-amber-500 text-white text-[10px] font-medium">{pendingCount} pending</span>}
                  </div>
                  <div className="flex border-b border-gray-200">
                    <button onClick={() => setMappingTab('spending')}
                      className={`flex-1 px-4 py-2 text-xs font-medium ${mappingTab === 'spending' ? 'bg-[#2d1b4e] text-white' : 'bg-gray-50 text-gray-600'}`}>
                      Spending ({uncommittedSpending.length})
                    </button>
                    <button onClick={() => setMappingTab('investments')}
                      className={`flex-1 px-4 py-2 text-xs font-medium ${mappingTab === 'investments' ? 'bg-[#2d1b4e] text-white' : 'bg-gray-50 text-gray-600'}`}>
                      Investments ({uncommittedInvestments.length})
                    </button>
                  </div>
                  <div className="p-4">
                    {mappingTab === 'spending' && <SpendingTab transactions={uncommittedSpending} committedTransactions={committedSpending} coaOptions={coaOptions} onReload={loadData} />}
                    {mappingTab === 'investments' && <InvestmentsTab investmentTransactions={uncommittedInvestments} committedInvestments={committedInvestments} onReload={loadData} />}
                  </div>
                </div>
              )}

              {/* Financial Statements */}
              {activeSection === 'statements' && (
                <div>
                  <div className="bg-[#2d1b4e] text-white px-4 py-2 flex items-center justify-between">
                    <span className="text-sm font-semibold">Financial Statements</span>
                    <select value={selectedYear} onChange={(e) => setSelectedYear(Number(e.target.value))}
                      className="bg-[#3d2b5e] text-white border-0 text-xs px-2 py-1">
                      {availableYears.map(y => <option key={y} value={y}>{y}</option>)}
                    </select>
                  </div>
                  <div className="flex border-b border-gray-200">
                    {[{ key: 'income', label: 'Income Statement' }, { key: 'balance', label: 'Balance Sheet' }, { key: 'cashflow', label: 'Cash Flow' }].map(tab => (
                      <button key={tab.key} onClick={() => setActiveStatement(tab.key as any)}
                        className={`px-4 py-2 text-xs font-medium ${activeStatement === tab.key ? 'bg-[#2d1b4e] text-white' : 'bg-gray-50 text-gray-600'}`}>
                        {tab.label}
                      </button>
                    ))}
                  </div>

                  {activeStatement === 'income' && (
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs border-collapse">
                        <thead className="bg-[#2d1b4e] text-white">
                          <tr>
                            <th className="px-3 py-2 text-left font-medium sticky left-0 bg-[#2d1b4e] z-10 min-w-[160px]">Account</th>
                            {MONTHS.map((m, i) => <th key={i} className="px-2 py-2 text-right font-medium w-16">{m}</th>)}
                            <th className="px-3 py-2 text-right font-medium bg-[#1a0f2e] sticky right-0 w-20">YTD</th>
                          </tr>
                        </thead>
                        <tbody>
                          {revenueCodes.length > 0 && (
                            <>
                              <tr className="bg-emerald-50">
                                <td colSpan={14} className="px-3 py-1.5 font-bold text-emerald-800 sticky left-0 bg-emerald-50">Revenue</td>
                              </tr>
                              {revenueCodes.map(code => (
                                <tr key={code} className="border-b border-gray-100 hover:bg-gray-50">
                                  <td className="px-3 py-2 sticky left-0 bg-white z-10">
                                    <div className="font-medium text-gray-900 truncate">{getCoaName(code)}</div>
                                    <div className="text-[10px] text-gray-400 font-mono">{code}</div>
                                  </td>
                                  {MONTHS.map((_, m) => {
                                    const val = gridData[code]?.[m] || 0;
                                    return (
                                      <td key={m} onClick={() => val !== 0 && setDrilldownCell({ coaCode: code, month: m })}
                                        className={`px-2 py-2 text-right font-mono ${val !== 0 ? 'cursor-pointer hover:bg-emerald-50 text-gray-900' : 'text-gray-300'}`}>
                                        {val === 0 ? '—' : fmt(val)}
                                      </td>
                                    );
                                  })}
                                  <td onClick={() => setDrilldownCell({ coaCode: code, month: -1 })}
                                    className="px-3 py-2 text-right font-mono font-semibold bg-gray-50 sticky right-0 cursor-pointer hover:bg-emerald-50">
                                    {fmt(getRowTotal(code))}
                                  </td>
                                </tr>
                              ))}
                              <tr className="bg-emerald-100">
                                <td className="px-3 py-2 font-bold text-emerald-800 sticky left-0 bg-emerald-100">Total Revenue</td>
                                {MONTHS.map((_, m) => (
                                  <td key={m} className="px-2 py-2 text-right font-mono font-bold text-emerald-800">{fmt(getMonthTotal(revenueCodes, m))}</td>
                                ))}
                                <td className="px-3 py-2 text-right font-mono font-bold text-emerald-800 bg-emerald-100 sticky right-0">{fmt(getSectionTotal(revenueCodes))}</td>
                              </tr>
                            </>
                          )}
                          {expenseCodes.length > 0 && (
                            <>
                              <tr className="bg-red-50">
                                <td colSpan={14} className="px-3 py-1.5 font-bold text-red-800 sticky left-0 bg-red-50">Expenses</td>
                              </tr>
                              {expenseCodes.map(code => (
                                <tr key={code} className="border-b border-gray-100 hover:bg-gray-50">
                                  <td className="px-3 py-2 sticky left-0 bg-white z-10">
                                    <div className="font-medium text-gray-900 truncate">{getCoaName(code)}</div>
                                    <div className="text-[10px] text-gray-400 font-mono">{code}</div>
                                  </td>
                                  {MONTHS.map((_, m) => {
                                    const val = gridData[code]?.[m] || 0;
                                    return (
                                      <td key={m} onClick={() => val !== 0 && setDrilldownCell({ coaCode: code, month: m })}
                                        className={`px-2 py-2 text-right font-mono ${val !== 0 ? 'cursor-pointer hover:bg-red-50 text-gray-900' : 'text-gray-300'}`}>
                                        {val === 0 ? '—' : fmt(val)}
                                      </td>
                                    );
                                  })}
                                  <td onClick={() => setDrilldownCell({ coaCode: code, month: -1 })}
                                    className="px-3 py-2 text-right font-mono font-semibold bg-gray-50 sticky right-0 cursor-pointer hover:bg-red-50">
                                    {fmt(getRowTotal(code))}
                                  </td>
                                </tr>
                              ))}
                              <tr className="bg-red-100">
                                <td className="px-3 py-2 font-bold text-red-800 sticky left-0 bg-red-100">Total Expenses</td>
                                {MONTHS.map((_, m) => (
                                  <td key={m} className="px-2 py-2 text-right font-mono font-bold text-red-800">{fmt(getMonthTotal(expenseCodes, m))}</td>
                                ))}
                                <td className="px-3 py-2 text-right font-mono font-bold text-red-800 bg-red-100 sticky right-0">{fmt(getSectionTotal(expenseCodes))}</td>
                              </tr>
                            </>
                          )}
                          <tr className="bg-[#2d1b4e]/10 border-t-2 border-[#2d1b4e]">
                            <td className="px-3 py-2 font-bold text-gray-900 sticky left-0 bg-[#2d1b4e]/10">Net Income</td>
                            {MONTHS.map((_, m) => {
                              const ni = Math.abs(getMonthTotal(revenueCodes, m)) - Math.abs(getMonthTotal(expenseCodes, m));
                              return <td key={m} className={`px-2 py-2 text-right font-mono font-bold ${ni >= 0 ? 'text-emerald-700' : 'text-red-700'}`}>{ni === 0 ? '—' : fmtSigned(ni)}</td>;
                            })}
                            <td className={`px-3 py-2 text-right font-mono font-bold sticky right-0 bg-[#2d1b4e]/20 ${Math.abs(getSectionTotal(revenueCodes)) - Math.abs(getSectionTotal(expenseCodes)) >= 0 ? 'text-emerald-700' : 'text-red-700'}`}>
                              {fmtSigned(Math.abs(getSectionTotal(revenueCodes)) - Math.abs(getSectionTotal(expenseCodes)))}
                            </td>
                          </tr>
                        </tbody>
                      </table>
                      {revenueCodes.length === 0 && expenseCodes.length === 0 && <div className="p-8 text-center text-gray-400">No data for {selectedYear}</div>}
                    </div>
                  )}

                  {activeStatement === 'balance' && (
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs border-collapse">
                        <thead className="bg-[#2d1b4e] text-white">
                          <tr>
                            <th className="px-3 py-2 text-left font-medium sticky left-0 bg-[#2d1b4e] z-10 min-w-[160px]">Account</th>
                            {MONTHS.map((m, i) => <th key={i} className="px-2 py-2 text-right font-medium w-16">{m}</th>)}
                            <th className="px-3 py-2 text-right font-medium bg-[#1a0f2e] sticky right-0 w-20">YTD</th>
                          </tr>
                        </thead>
                        <tbody>
                          {assetCodes.length > 0 && (
                            <>
                              <tr className="bg-blue-50"><td colSpan={14} className="px-3 py-1.5 font-bold text-blue-800 sticky left-0 bg-blue-50">Assets</td></tr>
                              {assetCodes.map(code => (
                                <tr key={code} className="border-b border-gray-100 hover:bg-gray-50">
                                  <td className="px-3 py-2 sticky left-0 bg-white z-10">
                                    <div className="font-medium text-gray-900 truncate">{getCoaName(code)}</div>
                                    <div className="text-[10px] text-gray-400 font-mono">{code}</div>
                                  </td>
                                  {MONTHS.map((_, m) => {
                                    const val = gridData[code]?.[m] || 0;
                                    return <td key={m} className={`px-2 py-2 text-right font-mono ${val !== 0 ? 'text-gray-900' : 'text-gray-300'}`}>{val === 0 ? '—' : fmt(val)}</td>;
                                  })}
                                  <td className="px-3 py-2 text-right font-mono font-semibold bg-gray-50 sticky right-0">{fmt(getRowTotal(code))}</td>
                                </tr>
                              ))}
                            </>
                          )}
                          {liabilityCodes.length > 0 && (
                            <>
                              <tr className="bg-orange-50"><td colSpan={14} className="px-3 py-1.5 font-bold text-orange-800 sticky left-0 bg-orange-50">Liabilities</td></tr>
                              {liabilityCodes.map(code => (
                                <tr key={code} className="border-b border-gray-100 hover:bg-gray-50">
                                  <td className="px-3 py-2 sticky left-0 bg-white z-10">
                                    <div className="font-medium text-gray-900 truncate">{getCoaName(code)}</div>
                                    <div className="text-[10px] text-gray-400 font-mono">{code}</div>
                                  </td>
                                  {MONTHS.map((_, m) => {
                                    const val = gridData[code]?.[m] || 0;
                                    return <td key={m} className={`px-2 py-2 text-right font-mono ${val !== 0 ? 'text-gray-900' : 'text-gray-300'}`}>{val === 0 ? '—' : fmt(val)}</td>;
                                  })}
                                  <td className="px-3 py-2 text-right font-mono font-semibold bg-gray-50 sticky right-0">{fmt(getRowTotal(code))}</td>
                                </tr>
                              ))}
                            </>
                          )}
                          {equityCodes.length > 0 && (
                            <>
                              <tr className="bg-purple-50"><td colSpan={14} className="px-3 py-1.5 font-bold text-purple-800 sticky left-0 bg-purple-50">Equity</td></tr>
                              {equityCodes.map(code => (
                                <tr key={code} className="border-b border-gray-100 hover:bg-gray-50">
                                  <td className="px-3 py-2 sticky left-0 bg-white z-10">
                                    <div className="font-medium text-gray-900 truncate">{getCoaName(code)}</div>
                                    <div className="text-[10px] text-gray-400 font-mono">{code}</div>
                                  </td>
                                  {MONTHS.map((_, m) => {
                                    const val = gridData[code]?.[m] || 0;
                                    return <td key={m} className={`px-2 py-2 text-right font-mono ${val !== 0 ? 'text-gray-900' : 'text-gray-300'}`}>{val === 0 ? '—' : fmt(val)}</td>;
                                  })}
                                  <td className="px-3 py-2 text-right font-mono font-semibold bg-gray-50 sticky right-0">{fmt(getRowTotal(code))}</td>
                                </tr>
                              ))}
                            </>
                          )}
                        </tbody>
                      </table>
                      {assetCodes.length === 0 && liabilityCodes.length === 0 && equityCodes.length === 0 && <div className="p-8 text-center text-gray-400">No data for {selectedYear}</div>}
                    </div>
                  )}

                  {activeStatement === 'cashflow' && (
                    <div className="p-8 text-center text-gray-400">
                      <p className="text-sm font-medium">Cash Flow Statement</p>
                      <p className="text-xs mt-1">Coming soon</p>
                    </div>
                  )}
                </div>
              )}

              {/* General Ledger */}
              {activeSection === 'ledger' && (
                <div>
                  <div className="bg-[#2d1b4e] text-white px-4 py-2 text-sm font-semibold">General Ledger</div>
                  <div className="p-4">
                    <GeneralLedger transactions={transactions} coaOptions={coaOptions} onUpdate={handleLedgerUpdate} />
                  </div>
                </div>
              )}

              {/* Journal Entries */}
              {activeSection === 'journal' && (
                <div>
                  <div className="bg-[#2d1b4e] text-white px-4 py-2 text-sm font-semibold">Journal Entries</div>
                  <div className="p-4">
                    <JournalEntryEngine entries={journalEntries} coaOptions={coaOptions} onSave={saveJournalEntry} onReload={loadData} />
                  </div>
                </div>
              )}

              {/* Bank Reconciliation */}
              {activeSection === 'reconcile' && (
                <div>
                  <div className="bg-[#2d1b4e] text-white px-4 py-2 text-sm font-semibold">Bank Reconciliation</div>
                  <div className="p-4">
                    <BankReconciliation accounts={accounts} transactions={transactions} reconciliations={reconciliations} onSave={saveReconciliation} onReload={loadData} />
                  </div>
                </div>
              )}

              {/* Period Close */}
              {activeSection === 'close' && (
                <div>
                  <div className="bg-[#2d1b4e] text-white px-4 py-2 text-sm font-semibold">Period Close</div>
                  <div className="p-4">
                    <PeriodClose transactions={transactions} reconciliations={reconciliations} periodCloses={periodCloses} selectedYear={selectedYear} onClose={closePeriod} onReopen={reopenPeriod} onReload={loadData} />
                  </div>
                </div>
              )}

              {/* CPA Export */}
              {activeSection === 'export' && (
                <div>
                  <div className="bg-[#2d1b4e] text-white px-4 py-2 text-sm font-semibold">CPA Export</div>
                  <div className="p-4">
                    <CPAExport transactions={transactions} coaOptions={coaOptions} selectedYear={selectedYear} />
                  </div>
                </div>
              )}
            </div>

          </div>
        </div>

        {/* Bulk Assign Bar */}
        {selectedIds.length > 0 && (
          <div className="fixed bottom-0 left-0 right-0 bg-[#2d1b4e] text-white p-3 z-40">
            <div className="max-w-7xl mx-auto flex items-center gap-3">
              <span className="px-2 py-1 bg-white/20 text-xs font-mono">{selectedIds.length}</span>
              <select value={assignCoa} onChange={(e) => setAssignCoa(e.target.value)} className="flex-1 bg-[#3d2b5e] text-white border-0 px-3 py-1.5 text-xs">
                <option value="">Select COA...</option>
                {Object.entries(coaGrouped).map(([type, opts]) => (
                  <optgroup key={type} label={type}>{opts.map(o => <option key={o.id} value={o.code}>{o.name}</option>)}</optgroup>
                ))}
              </select>
              <button onClick={handleBulkAssign} disabled={!assignCoa || isAssigning} className="px-4 py-1.5 bg-white text-[#2d1b4e] text-xs font-medium disabled:opacity-50">
                {isAssigning ? '...' : 'Assign'}
              </button>
              <button onClick={() => setSelectedIds([])} className="text-white/60 hover:text-white text-lg">×</button>
            </div>
          </div>
        )}

        {/* Drilldown Modal */}
        {drilldownCell && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => { setDrilldownCell(null); setSelectedDrilldownTxns([]); }}>
            <div className="bg-white w-full max-w-2xl max-h-[80vh] flex flex-col" onClick={e => e.stopPropagation()}>
              <div className="bg-[#2d1b4e] text-white px-4 py-3 flex justify-between items-center">
                <div>
                  <h4 className="font-semibold text-sm">{getCoaName(drilldownCell.coaCode)}</h4>
                  <p className="text-xs text-gray-300 font-mono">{drilldownCell.month === -1 ? 'Full Year' : MONTHS[drilldownCell.month]} {selectedYear} · {drilldownTransactions.length} transactions</p>
                </div>
                <button onClick={() => { setDrilldownCell(null); setSelectedDrilldownTxns([]); }} className="text-white/60 hover:text-white text-xl">×</button>
              </div>

              {selectedDrilldownTxns.length > 0 && (
                <div className="bg-[#3d2b5e] text-white px-4 py-2 flex items-center gap-2">
                  <span className="px-2 py-0.5 bg-white/20 text-xs font-mono">{selectedDrilldownTxns.length}</span>
                  <select value={reassignCoa} onChange={(e) => setReassignCoa(e.target.value)} className="flex-1 bg-[#2d1b4e] text-white border-0 text-xs px-2 py-1">
                    <option value="">Move to...</option>
                    {Object.entries(coaGrouped).map(([type, opts]) => (
                      <optgroup key={type} label={type}>{opts.map(o => <option key={o.id} value={o.code}>{o.name}</option>)}</optgroup>
                    ))}
                  </select>
                  <button onClick={handleDrilldownReassign} disabled={!reassignCoa} className="px-3 py-1 bg-white text-[#2d1b4e] text-xs font-medium disabled:opacity-50">Move</button>
                </div>
              )}

              <div className="flex-1 overflow-auto">
                <table className="w-full text-xs">
                  <thead className="bg-gray-100 sticky top-0">
                    <tr>
                      <th className="px-3 py-2 w-8">
                        <input type="checkbox" checked={selectedDrilldownTxns.length === drilldownTransactions.length && drilldownTransactions.length > 0}
                          onChange={(e) => setSelectedDrilldownTxns(e.target.checked ? drilldownTransactions.map(t => t.id) : [])}
                          className="w-3 h-3" />
                      </th>
                      <th className="px-2 py-2 text-left font-medium">Date</th>
                      <th className="px-2 py-2 text-left font-medium">Description</th>
                      <th className="px-2 py-2 text-right font-medium">Amount</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {drilldownTransactions.map(txn => (
                      <tr key={txn.id} className={`hover:bg-gray-50 ${selectedDrilldownTxns.includes(txn.id) ? 'bg-[#2d1b4e]/5' : ''}`}>
                        <td className="px-3 py-2">
                          <input type="checkbox" checked={selectedDrilldownTxns.includes(txn.id)}
                            onChange={(e) => setSelectedDrilldownTxns(e.target.checked ? [...selectedDrilldownTxns, txn.id] : selectedDrilldownTxns.filter(id => id !== txn.id))}
                            className="w-3 h-3" />
                        </td>
                        <td className="px-2 py-2 text-gray-600 font-mono">{new Date(txn.date).toLocaleDateString()}</td>
                        <td className="px-2 py-2 text-gray-900 truncate max-w-[200px]">{txn.name}</td>
                        <td className="px-2 py-2 text-right font-mono font-medium">{fmt(Math.abs(txn.amount))}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="bg-gray-100 px-4 py-3 flex justify-between items-center border-t">
                <span className="font-semibold text-gray-900 text-xs">Total: {fmt(drilldownTransactions.reduce((s, t) => s + Math.abs(t.amount), 0))}</span>
                <button onClick={() => { setDrilldownCell(null); setSelectedDrilldownTxns([]); }} className="px-4 py-1.5 bg-gray-200 text-gray-700 text-xs font-medium hover:bg-gray-300">Close</button>
              </div>
            </div>
          </div>
        )}
      {showUpgradeModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setShowUpgradeModal(false)} />
          <div className="relative z-10 bg-white border border-gray-200 p-6 max-w-md">
            <div className="text-sm font-medium text-gray-900 mb-2">Bank Sync requires Pro</div>
            <div className="text-xs text-gray-500 mb-4">Upgrade to Pro ($19/mo) to connect your bank accounts via Plaid.</div>
            <div className="flex gap-2">
              <button onClick={() => window.location.href = "/pricing"} className="flex-1 px-4 py-2 text-xs bg-[#2d1b4e] text-white font-medium hover:bg-[#3d2b5e]">View Plans</button>
              <button onClick={() => setShowUpgradeModal(false)} className="flex-1 px-4 py-2 text-xs border border-gray-300 text-gray-700 font-medium hover:bg-gray-50">Not Now</button>
            </div>
          </div>
        </div>
      )}
      </AppLayout>
    </>
  );
}
