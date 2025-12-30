'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useSession } from 'next-auth/react';
import Script from 'next/script';
import { AppLayout, Card, Button, Badge, PageHeader, ResponsiveTable } from '@/components/ui';
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
  const [mappingTab, setMappingTab] = useState<'spending' | 'investments'>('spending');
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [activeStatement, setActiveStatement] = useState<'income' | 'balance' | 'cashflow'>('income');
  const [drilldownCell, setDrilldownCell] = useState<{ coaCode: string; month: number } | null>(null);
  const [selectedDrilldownTxns, setSelectedDrilldownTxns] = useState<string[]>([]);
  const [reassignCoa, setReassignCoa] = useState('');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [assignCoa, setAssignCoa] = useState('');
  const [assignSub, setAssignSub] = useState('');
  const [isAssigning, setIsAssigning] = useState(false);

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
    } catch (err) { console.error('Load error:', err); }
    finally { setLoading(false); }
  }, []);

  // Load data on mount - don't gate on session since APIs use cookie auth
  useEffect(() => {
    loadData();
  }, [loadData]);

  const getCoaName = (code: string | null) => code ? coaOptions.find(c => c.code === code)?.name || code : null;
  const getCoaType = (code: string) => coaOptions.find(c => c.code === code)?.accountType || '';
  const formatMoney = (n: number, showSign = false) => {
    const formatted = Math.abs(n).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
    if (showSign) return n < 0 ? `-$${formatted}` : `$${formatted}`;
    return `$${formatted}`;
  };

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
    if (!selectedIds.length || (!assignCoa && !assignSub)) return;
    setIsAssigning(true);
    await fetch('/api/transactions/assign-coa', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ transactionIds: selectedIds, accountCode: assignCoa || undefined, subAccount: assignSub || undefined })
    });
    setSelectedIds([]); setAssignCoa(''); setAssignSub('');
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

  const renderStatementRow = (code: string) => (
    <tr key={code} className="border-b border-gray-100 hover:bg-gray-50/50">
      <td className="px-3 py-2.5 sticky left-0 bg-white z-10 min-w-[140px] sm:min-w-[180px] border-r border-gray-100 shadow-[2px_0_4px_-2px_rgba(0,0,0,0.1)]">
        <div className="font-medium text-gray-900 text-xs sm:text-sm truncate">{getCoaName(code)}</div>
        <div className="text-[10px] sm:text-xs text-gray-400 font-mono">{code}</div>
      </td>
      {MONTHS.map((_, m) => {
        const val = gridData[code]?.[m] || 0;
        return (
          <td key={m} onClick={() => val !== 0 && setDrilldownCell({ coaCode: code, month: m })}
            className={`px-1.5 sm:px-2 py-2.5 text-right text-xs sm:text-sm tabular-nums whitespace-nowrap ${val !== 0 ? 'cursor-pointer hover:bg-blue-50 text-gray-900' : 'text-gray-300'}`}>
            {val === 0 ? '-' : formatMoney(val)}
          </td>
        );
      })}
      <td onClick={() => setDrilldownCell({ coaCode: code, month: -1 })}
        className="px-2 sm:px-3 py-2.5 text-right text-xs sm:text-sm font-bold bg-gray-50 sticky right-0 cursor-pointer hover:bg-blue-50 tabular-nums whitespace-nowrap border-l border-gray-200 shadow-[-2px_0_4px_-2px_rgba(0,0,0,0.1)]">
        {formatMoney(getRowTotal(code))}
      </td>
    </tr>
  );

  const renderSectionHeader = (title: string, isRevenue: boolean) => (
    <tr className={isRevenue ? 'bg-green-50' : 'bg-red-50'}>
      <td colSpan={14} className={`px-3 py-2 font-bold text-xs sm:text-sm sticky left-0 ${isRevenue ? 'text-green-800 bg-green-50' : 'text-red-800 bg-red-50'}`}>{title}</td>
    </tr>
  );

  const renderSectionTotal = (title: string, codes: string[], isRevenue: boolean) => (
    <tr className={isRevenue ? 'bg-green-100' : 'bg-red-100'}>
      <td className={`px-3 py-2.5 font-bold text-xs sm:text-sm sticky left-0 shadow-[2px_0_4px_-2px_rgba(0,0,0,0.1)] ${isRevenue ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>Total {title}</td>
      {MONTHS.map((_, m) => (
        <td key={m} className={`px-1.5 sm:px-2 py-2.5 text-right font-bold text-xs sm:text-sm tabular-nums whitespace-nowrap ${isRevenue ? 'text-green-800' : 'text-red-800'}`}>
          {formatMoney(getMonthTotal(codes, m))}
        </td>
      ))}
      <td className={`px-2 sm:px-3 py-2.5 text-right font-bold text-xs sm:text-sm bg-gray-100 sticky right-0 tabular-nums whitespace-nowrap shadow-[-2px_0_4px_-2px_rgba(0,0,0,0.1)] ${isRevenue ? 'text-green-800' : 'text-red-800'}`}>
        {formatMoney(getSectionTotal(codes))}
      </td>
    </tr>
  );

  if (loading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center py-20">
          <div className="w-8 h-8 border-3 border-[#b4b237] border-t-transparent rounded-full animate-spin" />
        </div>
      </AppLayout>
    );
  }

  return (
    <>
      <Script src="https://cdn.plaid.com/link/v2/stable/link-initialize.js" strategy="lazyOnload" />
      <AppLayout>
        <PageHeader
          title="Bookkeeping"
          subtitle={`${transactions.length.toLocaleString()} transactions • ${accounts.length} accounts`}
          backHref="/hub"
          actions={
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="sm" onClick={syncAccounts} loading={syncing}>{syncing ? '...' : '🔄'}</Button>
              <Button size="sm" onClick={openPlaidLink} disabled={!linkToken}>+ Account</Button>
            </div>
          }
        />

        <div className="px-3 sm:px-4 lg:px-8 py-6 sm:py-8 space-y-6 sm:space-y-8">
          {/* Section 1: Connected Accounts */}
          <section>
            <h2 className="text-xs sm:text-sm font-bold text-gray-500 uppercase tracking-wider mb-3 sm:mb-4">Connected Accounts</h2>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-4">
              {accounts.map(acc => (
                <Card key={acc.id} className="hover:shadow-md transition-shadow !p-3 sm:!p-4">
                  <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-1 sm:gap-2">
                    <div className="min-w-0">
                      <div className="font-semibold text-gray-900 text-sm truncate">{acc.institutionName}</div>
                      <div className="text-[10px] sm:text-xs text-gray-400">•••• {acc.mask || '----'}</div>
                    </div>
                    <div className="sm:text-right">
                      <div className="text-base sm:text-xl font-bold text-gray-900">${acc.balance.toLocaleString()}</div>
                      <Badge variant="default" size="sm">{acc.type}</Badge>
                    </div>
                  </div>
                </Card>
              ))}
              {accounts.length === 0 && (
                <Card className="col-span-full text-center py-6 sm:py-8 text-gray-400 text-sm">
                  No accounts connected. Tap "+ Account" to link your bank.
                </Card>
              )}
            </div>
          </section>

          {/* Section 2: Map to COA */}
          <section>
            <h2 className="text-xs sm:text-sm font-bold text-gray-500 uppercase tracking-wider mb-3 sm:mb-4 flex items-center flex-wrap gap-2">
              Map to COA
              {(uncommittedSpending.length + uncommittedInvestments.length) > 0 && (
                <Badge variant="warning" size="sm">{uncommittedSpending.length + uncommittedInvestments.length} pending</Badge>
              )}
            </h2>
            <Card noPadding>
              <div className="flex border-b">
                <button onClick={() => setMappingTab('spending')}
                  className={`flex-1 px-3 sm:px-4 py-2.5 sm:py-3 text-xs sm:text-sm font-medium transition-colors ${mappingTab === 'spending' ? 'border-b-2 border-[#b4b237] text-[#b4b237] bg-white' : 'text-gray-500 bg-gray-50'}`}>
                  Spending <span className="text-[10px] sm:text-xs text-gray-400 ml-1">{uncommittedSpending.length}</span>
                </button>
                <button onClick={() => setMappingTab('investments')}
                  className={`flex-1 px-3 sm:px-4 py-2.5 sm:py-3 text-xs sm:text-sm font-medium transition-colors ${mappingTab === 'investments' ? 'border-b-2 border-[#b4b237] text-[#b4b237] bg-white' : 'text-gray-500 bg-gray-50'}`}>
                  Invest <span className="text-[10px] sm:text-xs text-gray-400 ml-1">{uncommittedInvestments.length}</span>
                </button>
              </div>
              <div className="p-3 sm:p-4">
                {mappingTab === 'spending' && <SpendingTab transactions={uncommittedSpending} committedTransactions={committedSpending} coaOptions={coaOptions} onReload={loadData} />}
                {mappingTab === 'investments' && <InvestmentsTab investmentTransactions={uncommittedInvestments} committedInvestments={committedInvestments} onReload={loadData} />}
              </div>
            </Card>
          </section>

          {/* Section 3: Financial Statements */}
          <section>
            <div className="flex items-center justify-between mb-3 sm:mb-4">
              <h2 className="text-xs sm:text-sm font-bold text-gray-500 uppercase tracking-wider">Financial Statements</h2>
              <select value={selectedYear} onChange={(e) => setSelectedYear(Number(e.target.value))}
                className="border border-gray-200 rounded-lg px-2 sm:px-3 py-1 sm:py-1.5 text-xs sm:text-sm">
                {availableYears.map(y => <option key={y} value={y}>{y}</option>)}
              </select>
            </div>
            <Card noPadding>
              <div className="flex border-b overflow-x-auto">
                {[{ key: 'income', label: 'Income' }, { key: 'balance', label: 'Balance' }, { key: 'cashflow', label: 'Cash Flow' }].map(tab => (
                  <button key={tab.key} onClick={() => setActiveStatement(tab.key as any)}
                    className={`px-3 sm:px-4 py-2.5 sm:py-3 text-xs sm:text-sm font-medium whitespace-nowrap transition-colors ${activeStatement === tab.key ? 'border-b-2 border-[#b4b237] text-[#b4b237] bg-white' : 'text-gray-500 bg-gray-50'}`}>
                    {tab.label}
                  </button>
                ))}
              </div>

              {activeStatement === 'income' && (
                <ResponsiveTable minWidth="900px">
                  <table className="w-full text-sm border-collapse">
                    <thead className="bg-gray-900 text-white">
                      <tr>
                        <th className="px-3 py-2.5 text-left font-semibold text-xs sm:text-sm sticky left-0 bg-gray-900 z-20 min-w-[140px] sm:min-w-[180px]">Account</th>
                        {MONTHS.map((m, i) => <th key={i} className="px-1.5 sm:px-2 py-2.5 text-right font-semibold text-[10px] sm:text-xs">{m}</th>)}
                        <th className="px-2 sm:px-3 py-2.5 text-right font-semibold text-xs sm:text-sm bg-gray-800 sticky right-0">YTD</th>
                      </tr>
                    </thead>
                    <tbody>
                      {revenueCodes.length > 0 && <>{renderSectionHeader('Revenue', true)}{revenueCodes.map(renderStatementRow)}{renderSectionTotal('Revenue', revenueCodes, true)}</>}
                      {expenseCodes.length > 0 && <>{renderSectionHeader('Expenses', false)}{expenseCodes.map(renderStatementRow)}{renderSectionTotal('Expenses', expenseCodes, false)}</>}
                      <tr className="bg-[#b4b237]/10 font-bold border-t-2 border-[#b4b237]">
                        <td className="px-3 py-2.5 sticky left-0 bg-[#b4b237]/10 z-10 text-gray-900 text-xs sm:text-sm shadow-[2px_0_4px_-2px_rgba(0,0,0,0.1)]">Net Income</td>
                        {MONTHS.map((_, m) => {
                          const ni = Math.abs(getMonthTotal(revenueCodes, m)) - Math.abs(getMonthTotal(expenseCodes, m));
                          return <td key={m} className={`px-1.5 sm:px-2 py-2.5 text-right tabular-nums text-xs sm:text-sm whitespace-nowrap ${ni >= 0 ? 'text-green-700' : 'text-red-700'}`}>{ni === 0 ? '-' : formatMoney(ni, true)}</td>;
                        })}
                        <td className={`px-2 sm:px-3 py-2.5 text-right bg-[#b4b237]/20 sticky right-0 tabular-nums font-bold text-xs sm:text-sm whitespace-nowrap shadow-[-2px_0_4px_-2px_rgba(0,0,0,0.1)] ${Math.abs(getSectionTotal(revenueCodes)) - Math.abs(getSectionTotal(expenseCodes)) >= 0 ? 'text-green-700' : 'text-red-700'}`}>
                          {formatMoney(Math.abs(getSectionTotal(revenueCodes)) - Math.abs(getSectionTotal(expenseCodes)), true)}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                  {revenueCodes.length === 0 && expenseCodes.length === 0 && <div className="p-8 sm:p-12 text-center text-gray-400 text-sm">No data for {selectedYear}</div>}
                </ResponsiveTable>
              )}

              {activeStatement === 'balance' && (
                <ResponsiveTable minWidth="900px">
                  <table className="w-full text-sm border-collapse">
                    <thead className="bg-gray-900 text-white">
                      <tr>
                        <th className="px-3 py-2.5 text-left font-semibold text-xs sm:text-sm sticky left-0 bg-gray-900 z-20 min-w-[140px] sm:min-w-[180px]">Account</th>
                        {MONTHS.map((m, i) => <th key={i} className="px-1.5 sm:px-2 py-2.5 text-right font-semibold text-[10px] sm:text-xs">{m}</th>)}
                        <th className="px-2 sm:px-3 py-2.5 text-right font-semibold text-xs sm:text-sm bg-gray-800 sticky right-0">YTD</th>
                      </tr>
                    </thead>
                    <tbody>
                      {assetCodes.length > 0 && <>{renderSectionHeader('Assets', true)}{assetCodes.map(renderStatementRow)}{renderSectionTotal('Assets', assetCodes, true)}</>}
                      {liabilityCodes.length > 0 && <>{renderSectionHeader('Liabilities', false)}{liabilityCodes.map(renderStatementRow)}{renderSectionTotal('Liabilities', liabilityCodes, false)}</>}
                      {equityCodes.length > 0 && <>{renderSectionHeader('Equity', true)}{equityCodes.map(renderStatementRow)}{renderSectionTotal('Equity', equityCodes, true)}</>}
                    </tbody>
                  </table>
                  {assetCodes.length === 0 && liabilityCodes.length === 0 && equityCodes.length === 0 && <div className="p-8 sm:p-12 text-center text-gray-400 text-sm">No data for {selectedYear}</div>}
                </ResponsiveTable>
              )}

              {activeStatement === 'cashflow' && (
                <div className="p-8 sm:p-12 text-center text-gray-400">
                  <div className="text-3xl sm:text-4xl mb-3">📊</div>
                  <p className="text-sm sm:text-base font-medium">Cash Flow Statement</p>
                  <p className="text-xs sm:text-sm mt-1">Coming soon</p>
                </div>
              )}
            </Card>
          </section>

          {/* Section 4: General Ledger */}
          <section>
            <h2 className="text-xs sm:text-sm font-bold text-gray-500 uppercase tracking-wider mb-3 sm:mb-4">General Ledger</h2>
            <GeneralLedger transactions={transactions} coaOptions={coaOptions} onUpdate={handleLedgerUpdate} />
          </section>

          {/* Section 5: Journal Entries */}
          <section>
            <h2 className="text-xs sm:text-sm font-bold text-gray-500 uppercase tracking-wider mb-3 sm:mb-4">Journal Entries</h2>
            <JournalEntryEngine entries={journalEntries} coaOptions={coaOptions} onSave={saveJournalEntry} onReload={loadData} />
          </section>

          {/* Section 6: Bank Reconciliation */}
          <section>
            <h2 className="text-xs sm:text-sm font-bold text-gray-500 uppercase tracking-wider mb-3 sm:mb-4">Bank Reconciliation</h2>
            <BankReconciliation accounts={accounts} transactions={transactions} reconciliations={reconciliations} onSave={saveReconciliation} onReload={loadData} />
          </section>

          {/* Section 7: Period Close */}
          <section>
            <h2 className="text-xs sm:text-sm font-bold text-gray-500 uppercase tracking-wider mb-3 sm:mb-4">Period Close</h2>
            <PeriodClose transactions={transactions} reconciliations={reconciliations} periodCloses={periodCloses} selectedYear={selectedYear} onClose={closePeriod} onReopen={reopenPeriod} onReload={loadData} />
          </section>

          {/* Section 8: CPA Export */}
          <section>
            <h2 className="text-xs sm:text-sm font-bold text-gray-500 uppercase tracking-wider mb-3 sm:mb-4">CPA Export</h2>
            <CPAExport transactions={transactions} coaOptions={coaOptions} selectedYear={selectedYear} />
          </section>

          {selectedIds.length > 0 && <div className="h-20" />}
        </div>

        {/* Bulk Assign Bar */}
        {selectedIds.length > 0 && (
          <div className="fixed bottom-0 left-0 right-0 bg-white border-t shadow-lg p-3 sm:p-4 z-40">
            <div className="max-w-7xl mx-auto flex flex-wrap items-center gap-2 sm:gap-3">
              <Badge variant="gold">{selectedIds.length}</Badge>
              <select value={assignCoa} onChange={(e) => setAssignCoa(e.target.value)} className="flex-1 min-w-[100px] px-2 sm:px-3 py-1.5 sm:py-2 border rounded-lg text-xs sm:text-sm">
                <option value="">Category...</option>
                {Object.entries(coaGrouped).map(([type, opts]) => (
                  <optgroup key={type} label={type}>{opts.map(o => <option key={o.id} value={o.code}>{o.name}</option>)}</optgroup>
                ))}
              </select>
              <input type="text" value={assignSub} onChange={(e) => setAssignSub(e.target.value)} placeholder="Vendor" className="flex-1 min-w-[80px] px-2 sm:px-3 py-1.5 sm:py-2 border rounded-lg text-xs sm:text-sm" />
              <Button size="sm" onClick={handleBulkAssign} disabled={(!assignCoa && !assignSub) || isAssigning} loading={isAssigning}>Go</Button>
              <button onClick={() => setSelectedIds([])} className="text-gray-400 hover:text-gray-600 text-lg">×</button>
            </div>
          </div>
        )}

        {/* Drilldown Modal */}
        {drilldownCell && (
          <div className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center z-50 p-0 sm:p-4" onClick={() => { setDrilldownCell(null); setSelectedDrilldownTxns([]); }}>
            <div className="bg-white rounded-t-xl sm:rounded-xl shadow-xl w-full sm:max-w-2xl max-h-[85vh] sm:max-h-[80vh] flex flex-col" onClick={e => e.stopPropagation()}>
              <div className="px-4 sm:px-6 py-3 sm:py-4 border-b flex justify-between items-center">
                <div className="min-w-0 flex-1">
                  <h4 className="font-bold text-gray-900 text-sm sm:text-base truncate">{getCoaName(drilldownCell.coaCode)}</h4>
                  <p className="text-xs sm:text-sm text-gray-500">{drilldownCell.month === -1 ? 'Year' : MONTHS[drilldownCell.month]} {selectedYear} • {drilldownTransactions.length} txns</p>
                </div>
                <button onClick={() => { setDrilldownCell(null); setSelectedDrilldownTxns([]); }} className="w-8 h-8 rounded-full hover:bg-gray-100 flex items-center justify-center text-gray-400 text-xl ml-2">×</button>
              </div>

              {selectedDrilldownTxns.length > 0 && (
                <div className="px-4 sm:px-6 py-2 sm:py-3 bg-[#b4b237]/10 border-b flex items-center gap-2">
                  <Badge variant="gold" size="sm">{selectedDrilldownTxns.length}</Badge>
                  <select value={reassignCoa} onChange={(e) => setReassignCoa(e.target.value)} className="flex-1 text-xs sm:text-sm border rounded-lg px-2 py-1">
                    <option value="">Move to...</option>
                    {Object.entries(coaGrouped).map(([type, opts]) => (
                      <optgroup key={type} label={type}>{opts.map(o => <option key={o.id} value={o.code}>{o.name}</option>)}</optgroup>
                    ))}
                  </select>
                  <Button size="sm" onClick={handleDrilldownReassign} disabled={!reassignCoa}>Move</Button>
                </div>
              )}

              <div className="flex-1 overflow-auto">
                <table className="w-full text-xs sm:text-sm">
                  <thead className="bg-gray-50 sticky top-0">
                    <tr>
                      <th className="px-3 sm:px-4 py-2 sm:py-3 w-8 sm:w-10">
                        <input type="checkbox" checked={selectedDrilldownTxns.length === drilldownTransactions.length && drilldownTransactions.length > 0}
                          onChange={(e) => setSelectedDrilldownTxns(e.target.checked ? drilldownTransactions.map(t => t.id) : [])}
                          className="w-3.5 h-3.5 sm:w-4 sm:h-4 rounded" />
                      </th>
                      <th className="px-2 sm:px-4 py-2 sm:py-3 text-left font-semibold">Date</th>
                      <th className="px-2 sm:px-4 py-2 sm:py-3 text-left font-semibold">Description</th>
                      <th className="px-2 sm:px-4 py-2 sm:py-3 text-right font-semibold">Amount</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {drilldownTransactions.map(txn => (
                      <tr key={txn.id} className={`hover:bg-gray-50 ${selectedDrilldownTxns.includes(txn.id) ? 'bg-[#b4b237]/5' : ''}`}>
                        <td className="px-3 sm:px-4 py-2 sm:py-3">
                          <input type="checkbox" checked={selectedDrilldownTxns.includes(txn.id)}
                            onChange={(e) => setSelectedDrilldownTxns(e.target.checked ? [...selectedDrilldownTxns, txn.id] : selectedDrilldownTxns.filter(id => id !== txn.id))}
                            className="w-3.5 h-3.5 sm:w-4 sm:h-4 rounded" />
                        </td>
                        <td className="px-2 sm:px-4 py-2 sm:py-3 whitespace-nowrap text-gray-600">{new Date(txn.date).toLocaleDateString()}</td>
                        <td className="px-2 sm:px-4 py-2 sm:py-3 truncate max-w-[120px] sm:max-w-[250px] text-gray-900">{txn.name}</td>
                        <td className="px-2 sm:px-4 py-2 sm:py-3 text-right font-mono font-medium whitespace-nowrap">${Math.abs(txn.amount).toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="px-4 sm:px-6 py-3 sm:py-4 border-t bg-gray-50 flex justify-between items-center">
                <span className="font-semibold text-gray-900 text-xs sm:text-sm">Total: ${drilldownTransactions.reduce((s, t) => s + Math.abs(t.amount), 0).toLocaleString()}</span>
                <Button variant="ghost" size="sm" onClick={() => { setDrilldownCell(null); setSelectedDrilldownTxns([]); }}>Close</Button>
              </div>
            </div>
          </div>
        )}
      </AppLayout>
    </>
  );
}
