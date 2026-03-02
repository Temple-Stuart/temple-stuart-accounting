'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useSession } from 'next-auth/react';
import Script from 'next/script';
import { AppLayout } from '@/components/ui';
import type { LedgerMetrics, EngineMetrics } from '@/components/ui/AppLayout';
import UpgradePrompt from '@/components/UpgradePrompt';
import SpendingTab from '@/components/dashboard/SpendingTab';
import InvestmentsTab from '@/components/dashboard/InvestmentsTab';
import GeneralLedger from '@/components/dashboard/GeneralLedger';
import JournalEntryEngine from '@/components/dashboard/JournalEntryEngine';
import CPAExport from '@/components/dashboard/CPAExport';
import PositionReportTab from '@/components/dashboard/PositionReportTab';
import WashSaleReportTab from '@/components/dashboard/WashSaleReportTab';
import TaxReportTab from '@/components/dashboard/TaxReportTab';
import TaxSettings, { loadTaxSettings } from '@/components/dashboard/TaxSettings';
import type { TaxSettingsValues } from '@/components/dashboard/TaxSettings';
import BankReconciliation from '@/components/dashboard/BankReconciliation';
import PeriodClose from '@/components/dashboard/PeriodClose';


interface Transaction {
  id: string;
  transactionId: string;
  date: string;
  name: string;
  merchantName: string | null;
  amount: number;
  category: string | null;
  pending: boolean;
  authorized_date: string | null;
  payment_channel: string | null;
  personal_finance_category: { primary?: string; detailed?: string } | null;
  personal_finance_category_icon_url: string | null;
  transaction_code: string | null;
  transaction_type: string | null;
  logo_url: string | null;
  website: string | null;
  counterparties: any;
  location: any;
  accountId: string;
  accountName: string | null;
  accountType: string | null;
  entityType: string | null;
  institutionName: string | null;
  accountCode: string | null;
  subAccount: string | null;
  entity_id: string | null;
  predicted_coa_code: string | null;
  prediction_confidence: number | null;
  review_status: string;
  manually_overridden: boolean;
  createdAt: string;
  updatedAt: string;
  journalProof?: any;
}
interface Account {
  id: string;
  name: string;
  mask: string | null;
  type: string;
  balance: number;
  institutionName: string;
  entityType: string | null;
}

interface CoaOption {
  id: string;
  code: string;
  name: string;
  accountType: string;
  balanceType: string;
  entity_id?: string;
  entity_type?: string | null;
}

interface StatementAccount {
  id: string;
  code: string;
  name: string;
  accountType: string;
  entityId: string;
  entityName: string;
  month: number;
  debits: number;
  credits: number;
}

interface Soc2Proof {
  status: 'pass' | 'fail' | 'warn';
  summary: string;
  details?: any[];
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export default function Dashboard() {
  const { data: session } = useSession();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [coaOptions, setCoaOptions] = useState<CoaOption[]>([]);
  const [investmentTransactions, setInvestmentTransactions] = useState<any[]>([]);
  const [journalEntries, setJournalEntries] = useState<any[]>([]);
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
  const [statementData, setStatementData] = useState<StatementAccount[]>([]);
  const [statementYears, setStatementYears] = useState<number[]>([]);
  const [soc2Proofs, setSoc2Proofs] = useState<Record<string, Soc2Proof>>({});
  const [soc2Modal, setSoc2Modal] = useState<string | null>(null);
  const [ledgerMetrics, setLedgerMetrics] = useState<LedgerMetrics | null>(null);
  const [engineMetrics, setEngineMetrics] = useState<EngineMetrics | null>(null);
  const [showTaxSettings, setShowTaxSettings] = useState(false);
  const [reconciliations, setReconciliations] = useState<any[]>([]);
  const [periodCloses, setPeriodCloses] = useState<any[]>([]);
  const [defaultEntityId, setDefaultEntityId] = useState<string | null>(null);

  // Cookie is now HMAC-signed server-side (login/register/nextauth).
  // Client-side writes removed to prevent overwriting signed cookies.

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
            allAccounts.push({ id: acc.id, name: acc.name, mask: acc.mask, type: acc.type, balance: acc.balance || 0, institutionName: item.institutionName || 'Unknown', entityType: acc.entityType || null });
          });
        });
        setAccounts(allAccounts);
      }
      if (invRes.ok) { const data = await invRes.json(); setInvestmentTransactions(data.transactions || data.investments || data || []); }
      
      const jeRes = await fetch('/api/journal-transactions');
      if (jeRes.ok) { const jeData = await jeRes.json(); setJournalEntries(jeData.entries || []); }
      const soc2Res = await fetch('/api/soc2');
      if (soc2Res.ok) { const soc2Data = await soc2Res.json(); setSoc2Proofs(soc2Data.proofs || {}); }
      const metricsRes = await fetch('/api/metrics');
      if (metricsRes.ok) { const md = await metricsRes.json(); setLedgerMetrics(md); }
      try {
        const taxSettings = loadTaxSettings();
        const taxRes = await fetch('/api/tax-estimate', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(taxSettings) });
        if (taxRes.ok) { const td = await taxRes.json(); setEngineMetrics(td); }
      } catch {}
      const linkRes = await fetch("/api/plaid/link-token", { method: "POST", headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ entityId: 'personal' }) });
      if (linkRes.ok) { const linkData = await linkRes.json(); setLinkToken(linkData.link_token); }
      const meRes = await fetch('/api/auth/me');
      if (meRes.ok) { const meData = await meRes.json(); setUserTier(meData.user?.tier || 'free'); }
    } catch (err) { console.error('Load error:', err); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  // Load reconciliations and period closes
  const loadReconciliations = useCallback(async () => {
    try {
      const res = await fetch('/api/bank-reconciliations');
      if (res.ok) {
        const data = await res.json();
        setReconciliations(data.reconciliations || []);
      }
    } catch (err) { console.error('Failed to load reconciliations:', err); }
  }, []);

  const loadPeriodCloses = useCallback(async () => {
    try {
      const res = await fetch('/api/closing-periods');
      if (res.ok) {
        const data = await res.json();
        setPeriodCloses(data.periods || []);
      }
    } catch (err) { console.error('Failed to load period closes:', err); }
  }, []);

  // Fetch default entity for close/recon operations
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/entities');
        if (res.ok) {
          const data = await res.json();
          const entities = data.entities || [];
          const def = entities.find((e: any) => e.is_default) || entities[0];
          if (def) setDefaultEntityId(def.id);
        }
      } catch (err) { console.error('Failed to load entities:', err); }
    })();
  }, []);

  useEffect(() => { loadReconciliations(); }, [loadReconciliations]);
  useEffect(() => { loadPeriodCloses(); }, [loadPeriodCloses]);

  // Fetch statements data when year changes
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`/api/statements?year=${selectedYear}`);
        if (res.ok) {
          const data = await res.json();
          setStatementData(data.accounts || []);
          if (data.availableYears?.length > 0) setStatementYears(data.availableYears);
        }
      } catch (e) { console.error('Statements fetch error:', e); }
    })();
  }, [selectedYear]);

  // On initial load, default selectedYear to the most recent year with ledger data
  useEffect(() => {
    if (statementYears.length > 0 && !statementYears.includes(selectedYear)) {
      setSelectedYear(statementYears[0]);
    }
  }, [statementYears]);

  const getCoaName = (code: string | null) => code ? coaOptions.find(c => c.code === code)?.name || code : null;
  const getCoaType = (code: string) => coaOptions.find(c => c.code === code)?.accountType || '';
  const fmt = (n: number) => '$' + Math.abs(n).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
  const fmtSigned = (n: number) => (n < 0 ? '-' : '') + '$' + Math.abs(n).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 });

  const committedSpending = transactions.filter(t => t.journalProof);
  const uncommittedSpending = transactions.filter(t => !t.journalProof);
  const committedInvestments = investmentTransactions.filter((t: any) => t.journalProof);
  const uncommittedInvestments = investmentTransactions.filter((t: any) => !t.journalProof);


  const availableYears = useMemo(() => {
    if (statementYears.length > 0) return statementYears;
    const years = new Set<number>();
    transactions.forEach(t => years.add(new Date(t.date).getFullYear()));
    if (years.size === 0) years.add(new Date().getFullYear());
    return Array.from(years).sort((a, b) => b - a);
  }, [transactions, statementYears]);

  // Ledger-based gridData: amounts in dollars from ledger entries (cents / 100)
  // For expense/asset accounts (balance_type=D): net = debits - credits
  // For revenue/liability/equity accounts (balance_type=C): net = credits - debits
  interface GridAccount { name: string; entityName: string; accountType: string }
  const gridData = useMemo(() => {
    const data: Record<string, Record<number, number>> = {};
    statementData.forEach(row => {
      const key = row.code;
      if (!data[key]) data[key] = {};
      // month from API is 1-indexed, convert to 0-indexed for display
      const m = row.month - 1;
      const isDebitNormal = row.accountType === 'expense' || row.accountType === 'asset';
      const net = isDebitNormal
        ? (row.debits - row.credits) / 100
        : (row.credits - row.debits) / 100;
      data[key][m] = (data[key][m] || 0) + net;
    });
    return data;
  }, [statementData]);

  // Account metadata from statement data (entity-aware names)
  const gridAccountInfo = useMemo(() => {
    const info: Record<string, GridAccount> = {};
    statementData.forEach(row => {
      if (!info[row.code]) {
        info[row.code] = { name: row.name, entityName: row.entityName, accountType: row.accountType };
      }
    });
    return info;
  }, [statementData]);

  const getGridCoaName = (code: string) => {
    const info = gridAccountInfo[code];
    if (info) return info.name;
    return getCoaName(code) || code;
  };
  const getGridCoaType = (code: string) => {
    const info = gridAccountInfo[code];
    if (info) return info.accountType;
    return getCoaType(code);
  };
  const getGridEntityName = (code: string) => gridAccountInfo[code]?.entityName || '';

  const revenueCodes = useMemo(() => Object.keys(gridData).filter(c => getGridCoaType(c) === 'revenue').sort(), [gridData, statementData]);
  const expenseCodes = useMemo(() => Object.keys(gridData).filter(c => getGridCoaType(c) === 'expense').sort(), [gridData, statementData]);
  const assetCodes = useMemo(() => Object.keys(gridData).filter(c => getGridCoaType(c) === 'asset').sort(), [gridData, statementData]);
  const liabilityCodes = useMemo(() => Object.keys(gridData).filter(c => getGridCoaType(c) === 'liability').sort(), [gridData, statementData]);
  const equityCodes = useMemo(() => Object.keys(gridData).filter(c => getGridCoaType(c) === 'equity').sort(), [gridData, statementData]);

  const getMonthTotal = (codes: string[], month: number) => codes.reduce((sum: number, code: string) => sum + (gridData[code]?.[month] || 0), 0);
  const getRowTotal = (coaCode: string): number => Object.values(gridData[coaCode] || {}).reduce<number>((sum, val) => sum + (val as number), 0);
  const getSectionTotal = (codes: string[]) => codes.reduce((sum: number, code: string) => sum + getRowTotal(code), 0);

  // Drilldown uses committed transactions for detail view
  const yearTransactions = useMemo(() => committedSpending.filter(t => new Date(t.date).getFullYear() === selectedYear), [committedSpending, selectedYear]);
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
    await fetch('/api/transactions/sync-complete', { method: 'POST' });
    await loadData();
    setSyncing(false);
  };

  const updateAccountEntity = async (accountId: string, entityType: string) => {
    const prev = accounts.find(a => a.id === accountId);
    setAccounts(accs => accs.map(a => a.id === accountId ? { ...a, entityType } : a));
    try {
      const res = await fetch('/api/accounts/update-entity', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accountId, entityType }),
      });
      if (!res.ok) throw new Error();
    } catch {
      setAccounts(accs => accs.map(a => a.id === accountId ? { ...a, entityType: prev?.entityType ?? null } : a));
    }
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
  // saveReconciliation, closePeriod, reopenPeriod removed — tables dropped in Phase 0

  const totalBalance = accounts.reduce((s, a) => s + a.balance, 0);
  const pendingCount = uncommittedSpending.length + uncommittedInvestments.length;
  const committedCount = committedSpending.length + committedInvestments.length;

  const handleTaxSettingsSave = async (settings: TaxSettingsValues) => {
    try {
      const res = await fetch('/api/tax-estimate', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(settings) });
      if (res.ok) { const td = await res.json(); setEngineMetrics(td); }
    } catch {}
    setShowTaxSettings(false);
  };
  const pipelineSrc = transactions.length + investmentTransactions.length;
  const pipelineCat = committedCount;
  const pipelineJe = committedCount;
  const pipelineLdg = committedCount * 2;

  const PIPELINE_STEPS = [
    { code: 'SRC', count: pipelineSrc, section: 'accounts' },
    { code: 'CAT', count: pipelineCat, section: 'mapping' },
    { code: 'JE', count: pipelineJe, section: 'journal' },
    { code: 'LDG', count: pipelineLdg, section: 'ledger' },
    { code: 'REC', count: null as number | null, section: 'reconcile' },
    { code: 'STMT', count: statementYears.length > 0 ? statementYears.length : null as number | null, section: 'statements', suffix: statementYears.length > 0 ? 'yr' : '' },
    { code: 'TAX', count: null as number | null, section: 'tax' },
  ];

  const SECONDARY_TABS = [
    { key: 'close', label: 'Period Close' },
    { key: 'positions', label: 'Positions' },
    { key: 'wash-sales', label: 'Wash Sales' },
    { key: 'export', label: 'Export' },
  ];

  const SOC2_CODES = ['BAL', 'AUTH', 'IMMUT', 'CHGMG', 'IDEMP', 'SCOPE', 'TRACE', 'COMPL'] as const;
  const SOC2_LABELS: Record<string, string> = {
    BAL: 'Double-Entry Balance Verification',
    AUTH: 'Attribution',
    IMMUT: 'Immutability',
    CHGMG: 'Change Management',
    IDEMP: 'Idempotency',
    SCOPE: 'Entity Separation',
    TRACE: 'Traceability',
    COMPL: 'Completeness',
  };
  const getSoc2Status = (code: string) => {
    const proof = soc2Proofs[code.toLowerCase()];
    return proof?.status || 'warn';
  };

  if (loading) {
    return (
      <AppLayout ledgerMetrics={ledgerMetrics} engineMetrics={engineMetrics} onOpenTaxSettings={() => setShowTaxSettings(true)}>
        <div className="flex items-center justify-center py-20">
          <div className="w-6 h-6 border-2 border-brand-purple-deep border-t-transparent rounded-full animate-spin" />
        </div>
      {showUpgradeModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setShowUpgradeModal(false)} />
          <div className="relative z-10 bg-white border border-border p-6 max-w-md">
            <div className="text-sm font-medium text-text-primary mb-2">Bank Sync requires Pro</div>
            <div className="text-xs text-text-muted mb-4">Upgrade to Pro ($20/mo) to connect your bank accounts via Plaid.</div>
            <div className="flex gap-2">
              <button onClick={() => window.location.href = "/pricing"} className="flex-1 px-4 py-2 text-xs bg-brand-purple-deep text-white font-medium hover:bg-brand-purple-hover">View Plans</button>
              <button onClick={() => setShowUpgradeModal(false)} className="flex-1 px-4 py-2 text-xs border border-border text-text-secondary font-medium hover:bg-bg-row">Not Now</button>
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
      <AppLayout ledgerMetrics={ledgerMetrics} engineMetrics={engineMetrics} onOpenTaxSettings={() => setShowTaxSettings(true)}>
        <div className="min-h-screen bg-bg-terminal">
          <div className="px-4 lg:px-6 pt-3 max-w-[1600px] mx-auto">

            {/* Unified Pipeline Navigation Bar */}
            <div className="mb-3 flex items-center border border-border bg-white overflow-x-auto" style={{ height: 28 }}>
              {/* Pipeline steps — clickable navigation */}
              <div className="flex items-center h-full px-1.5 gap-0">
                {PIPELINE_STEPS.map((step, i) => {
                  const isActive = activeSection === step.section;
                  const hasData = step.count != null && step.count > 0;
                  return (
                    <div key={step.code} className="flex items-center h-full">
                      {i > 0 && <span className="text-text-faint/30 text-terminal-xs mx-1">{'\u203A'}</span>}
                      <button
                        onClick={() => setActiveSection(step.section)}
                        className={`flex items-center gap-1 px-2 py-0.5 rounded transition-colors h-6 ${
                          isActive
                            ? 'bg-brand-purple text-white'
                            : hasData
                              ? 'hover:bg-bg-row cursor-pointer'
                              : 'hover:bg-bg-row cursor-pointer'
                        }`}
                      >
                        <span className={`text-[7px] font-mono uppercase tracking-wider font-semibold ${isActive ? 'text-white/80' : 'text-text-muted'}`}>{step.code}</span>
                        <span className={`text-terminal-sm font-mono font-bold ${
                          isActive ? 'text-white' : hasData ? 'text-brand-gold' : 'text-text-faint/50'
                        }`}>
                          {step.count != null ? step.count.toLocaleString() + ((step as any).suffix || '') : '\u2014'}
                        </span>
                      </button>
                    </div>
                  );
                })}
              </div>

              {/* Separator */}
              <span className="mx-2 w-px h-4 bg-border" />

              {/* Secondary tabs */}
              <div className="flex items-center h-full gap-0">
                {SECONDARY_TABS.map((tab, i) => {
                  const isActive = activeSection === tab.key;
                  return (
                    <button key={tab.key} onClick={() => setActiveSection(tab.key)}
                      className={`px-2 h-full text-terminal-xs font-mono whitespace-nowrap transition-colors ${
                        i > 0 ? 'border-l border-border-light' : ''
                      } ${isActive
                        ? 'text-brand-purple font-semibold border-b-2 border-brand-purple'
                        : 'text-text-muted hover:text-text-primary hover:bg-bg-row'
                      }`}>
                      {tab.label}
                    </button>
                  );
                })}
              </div>

              {/* Right side: SOC 2 + Sync + Account */}
              <div className="ml-auto flex items-center h-full">
                <div className="flex items-center h-full px-2 bg-brand-purple-wash border-l border-border gap-1.5">
                  <a href="/soc2" className="text-[7px] font-mono uppercase tracking-wider text-text-muted hover:text-brand-purple transition-colors" title="Open SOC 2 Dashboard">SOC2</a>
                  {SOC2_CODES.map(code => {
                    const status = getSoc2Status(code);
                    return (
                      <button key={code} onClick={() => setSoc2Modal(code)} className="flex items-center gap-0.5 hover:bg-brand-purple-deep/10 px-0.5 rounded cursor-pointer" title={SOC2_LABELS[code]}>
                        <span className={`w-1.5 h-1.5 rounded-full ${status === 'pass' ? 'bg-brand-green' : status === 'fail' ? 'bg-brand-red' : 'bg-brand-gold'}`} />
                        <span className="text-[7px] font-mono text-text-muted">{code}</span>
                      </button>
                    );
                  })}
                </div>
                <div className="flex items-center gap-1 px-1.5 border-l border-border h-full">
                  <button onClick={syncAccounts} disabled={syncing}
                    className="px-2 py-0.5 text-terminal-sm font-mono bg-brand-purple-wash text-brand-purple hover:bg-brand-purple hover:text-white transition-colors">
                    {syncing ? 'Syncing...' : 'Sync'}
                  </button>
                  <button onClick={handleAddAccount} disabled={userTier !== "free" && !linkToken}
                    className="px-2 py-0.5 text-terminal-sm font-mono bg-brand-purple-wash text-brand-purple hover:bg-brand-purple hover:text-white transition-colors">
                    + Account
                  </button>
                </div>
              </div>
            </div>

            {/* Section Content */}
            <div className="bg-white border border-border">
              
              {/* Connected Accounts */}
              {activeSection === 'accounts' && (
                <div>
                  <div className="px-3 py-1.5 bg-bg-row border-b border-border">
                    <span className="text-terminal-base font-mono font-semibold text-text-primary">Connected Accounts</span>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead className="bg-brand-purple-hover text-white">
                        <tr>
                          <th className="px-3 py-2 text-left font-medium">Institution</th>
                          <th className="px-3 py-2 text-left font-medium">Account</th>
                          <th className="px-3 py-2 text-left font-medium">Type</th>
                          <th className="px-3 py-2 text-left font-medium">Entity</th>
                          <th className="px-3 py-2 text-right font-medium">Balance</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border">
                        {accounts.map(acc => {
                          const et = acc.entityType;
                          const pillColor = et === 'personal' ? 'bg-blue-100 text-blue-700'
                            : et === 'business' ? 'bg-purple-100 text-purple-700'
                            : et === 'trading' ? 'bg-green-100 text-green-700'
                            : 'bg-orange-100 text-orange-700';
                          return (
                          <tr key={acc.id} className="hover:bg-bg-row">
                            <td className="px-3 py-2 font-medium text-text-primary">{acc.institutionName}</td>
                            <td className="px-3 py-2 text-text-secondary font-mono">•••• {acc.mask || '----'}</td>
                            <td className="px-3 py-2"><span className="px-2 py-0.5 bg-bg-row text-text-secondary text-[10px] uppercase">{acc.type}</span></td>
                            <td className="px-3 py-2">
                              <select
                                value={acc.entityType || ''}
                                onChange={e => updateAccountEntity(acc.id, e.target.value)}
                                className={`px-2 py-0.5 rounded text-[10px] font-semibold uppercase border-0 cursor-pointer ${pillColor}`}
                              >
                                {!acc.entityType && <option value="" disabled>{'\u26A0'} Unassigned</option>}
                                <option value="personal">Personal</option>
                                <option value="business">Business</option>
                                <option value="trading">Trading</option>
                              </select>
                            </td>
                            <td className="px-3 py-2 text-right font-mono font-semibold">{fmt(acc.balance)}</td>
                          </tr>
                          );
                        })}
                        {accounts.length === 0 && (
                          <tr><td colSpan={5} className="px-3 py-8 text-center text-text-faint">No accounts connected</td></tr>
                        )}
                      </tbody>
                      <tfoot className="bg-bg-row border-t border-border">
                        <tr>
                          <td colSpan={4} className="px-3 py-2 font-semibold text-text-primary">Total</td>
                          <td className="px-3 py-2 text-right font-mono font-bold text-text-primary">{fmt(totalBalance)}</td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                </div>
              )}

              {/* Map to COA */}
              {activeSection === 'mapping' && (
                <div>
                  <div className="flex items-center justify-between px-3 py-1.5 bg-bg-row border-b border-border">
                    <div className="flex items-center gap-3">
                      <span className="text-terminal-base font-mono font-semibold text-text-primary">Map Transactions → COA</span>
                      <div className="flex items-center border border-border bg-white">
                        <button onClick={() => setMappingTab('spending')}
                          className={`px-2 py-0.5 text-[10px] font-mono font-medium transition-colors ${
                            mappingTab === 'spending' ? 'bg-brand-purple-wash text-brand-purple' : 'text-text-muted hover:text-text-primary'
                          }`}>
                          Spending <span className="font-bold text-brand-gold">{uncommittedSpending.length}</span>
                        </button>
                        <button onClick={() => setMappingTab('investments')}
                          className={`px-2 py-0.5 text-[10px] font-mono font-medium border-l border-border transition-colors ${
                            mappingTab === 'investments' ? 'bg-brand-purple-wash text-brand-purple' : 'text-text-muted hover:text-text-primary'
                          }`}>
                          Investments <span className="font-bold text-brand-gold">{uncommittedInvestments.length}</span>
                        </button>
                      </div>
                    </div>
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
                  <div className="flex items-center justify-between px-3 py-1.5 bg-bg-row border-b border-border">
                    <div className="flex items-center gap-3">
                      <span className="text-terminal-base font-mono font-semibold text-text-primary">Financial Statements</span>
                      <div className="flex items-center border border-border bg-white">
                        {[{ key: 'income', label: 'Income' }, { key: 'balance', label: 'Balance' }, { key: 'cashflow', label: 'Cash Flow' }].map((tab, i) => (
                          <button key={tab.key} onClick={() => setActiveStatement(tab.key as any)}
                            className={`px-2 py-0.5 text-[10px] font-mono font-medium transition-colors ${i > 0 ? 'border-l border-border' : ''} ${
                              activeStatement === tab.key ? 'bg-brand-purple-wash text-brand-purple' : 'text-text-muted hover:text-text-primary'
                            }`}>
                            {tab.label}
                          </button>
                        ))}
                      </div>
                    </div>
                    <select value={selectedYear} onChange={(e) => setSelectedYear(Number(e.target.value))}
                      className="bg-white border border-border text-text-primary text-[10px] font-mono px-1.5 py-0.5">
                      {availableYears.map(y => <option key={y} value={y}>{y}</option>)}
                    </select>
                  </div>

                  {activeStatement === 'income' && (
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs border-collapse">
                        <thead className="bg-brand-purple-deep text-white">
                          <tr>
                            <th className="px-3 py-2 text-left font-medium sticky left-0 bg-brand-purple-deep z-10 min-w-[160px]">Account</th>
                            {MONTHS.map((m, i) => <th key={i} className="px-2 py-2 text-right font-medium w-16">{m}</th>)}
                            <th className="px-3 py-2 text-right font-medium bg-brand-purple-deep sticky right-0 w-20">YTD</th>
                          </tr>
                        </thead>
                        <tbody>
                          {revenueCodes.length > 0 && (
                            <>
                              <tr className="bg-emerald-50">
                                <td colSpan={14} className="px-3 py-1.5 font-bold text-emerald-800 sticky left-0 bg-emerald-50">Revenue</td>
                              </tr>
                              {revenueCodes.map(code => (
                                <tr key={code} className="border-b border-border-light hover:bg-bg-row">
                                  <td className="px-3 py-2 sticky left-0 bg-white z-10">
                                    <div className="font-medium text-text-primary truncate">{getGridCoaName(code)}{getGridEntityName(code) ? <span className="text-text-faint ml-1 text-[10px]">({getGridEntityName(code)})</span> : null}</div>
                                    <div className="text-[10px] text-text-faint font-mono">{code}</div>
                                  </td>
                                  {MONTHS.map((_, m) => {
                                    const val = gridData[code]?.[m] || 0;
                                    return (
                                      <td key={m} onClick={() => val !== 0 && setDrilldownCell({ coaCode: code, month: m })}
                                        className={`px-2 py-2 text-right font-mono ${val !== 0 ? 'cursor-pointer hover:bg-emerald-50 text-text-primary' : 'text-text-faint'}`}>
                                        {val === 0 ? '—' : fmt(val)}
                                      </td>
                                    );
                                  })}
                                  <td onClick={() => setDrilldownCell({ coaCode: code, month: -1 })}
                                    className="px-3 py-2 text-right font-mono font-semibold bg-bg-row sticky right-0 cursor-pointer hover:bg-emerald-50">
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
                                <tr key={code} className="border-b border-border-light hover:bg-bg-row">
                                  <td className="px-3 py-2 sticky left-0 bg-white z-10">
                                    <div className="font-medium text-text-primary truncate">{getGridCoaName(code)}{getGridEntityName(code) ? <span className="text-text-faint ml-1 text-[10px]">({getGridEntityName(code)})</span> : null}</div>
                                    <div className="text-[10px] text-text-faint font-mono">{code}</div>
                                  </td>
                                  {MONTHS.map((_, m) => {
                                    const val = gridData[code]?.[m] || 0;
                                    return (
                                      <td key={m} onClick={() => val !== 0 && setDrilldownCell({ coaCode: code, month: m })}
                                        className={`px-2 py-2 text-right font-mono ${val !== 0 ? 'cursor-pointer hover:bg-red-50 text-text-primary' : 'text-text-faint'}`}>
                                        {val === 0 ? '—' : fmt(val)}
                                      </td>
                                    );
                                  })}
                                  <td onClick={() => setDrilldownCell({ coaCode: code, month: -1 })}
                                    className="px-3 py-2 text-right font-mono font-semibold bg-bg-row sticky right-0 cursor-pointer hover:bg-red-50">
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
                          <tr className="bg-brand-purple-deep/10 border-t-2 border-brand-purple-deep">
                            <td className="px-3 py-2 font-bold text-text-primary sticky left-0 bg-brand-purple-deep/10">Net Income</td>
                            {MONTHS.map((_, m) => {
                              const ni = Math.abs(getMonthTotal(revenueCodes, m)) - Math.abs(getMonthTotal(expenseCodes, m));
                              return <td key={m} className={`px-2 py-2 text-right font-mono font-bold ${ni >= 0 ? 'text-emerald-700' : 'text-brand-red'}`}>{ni === 0 ? '—' : fmtSigned(ni)}</td>;
                            })}
                            <td className={`px-3 py-2 text-right font-mono font-bold sticky right-0 bg-brand-purple-deep/20 ${Math.abs(getSectionTotal(revenueCodes)) - Math.abs(getSectionTotal(expenseCodes)) >= 0 ? 'text-emerald-700' : 'text-brand-red'}`}>
                              {fmtSigned(Math.abs(getSectionTotal(revenueCodes)) - Math.abs(getSectionTotal(expenseCodes)))}
                            </td>
                          </tr>
                        </tbody>
                      </table>
                      {revenueCodes.length === 0 && expenseCodes.length === 0 && <div className="p-8 text-center text-text-faint">No data for {selectedYear}</div>}
                    </div>
                  )}

                  {activeStatement === 'balance' && (
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs border-collapse">
                        <thead className="bg-brand-purple-deep text-white">
                          <tr>
                            <th className="px-3 py-2 text-left font-medium sticky left-0 bg-brand-purple-deep z-10 min-w-[160px]">Account</th>
                            {MONTHS.map((m, i) => <th key={i} className="px-2 py-2 text-right font-medium w-16">{m}</th>)}
                            <th className="px-3 py-2 text-right font-medium bg-brand-purple-deep sticky right-0 w-20">YTD</th>
                          </tr>
                        </thead>
                        <tbody>
                          {assetCodes.length > 0 && (
                            <>
                              <tr className="bg-brand-purple-wash"><td colSpan={14} className="px-3 py-1.5 font-bold text-blue-800 sticky left-0 bg-brand-purple-wash">Assets</td></tr>
                              {assetCodes.map(code => (
                                <tr key={code} className="border-b border-border-light hover:bg-bg-row">
                                  <td className="px-3 py-2 sticky left-0 bg-white z-10">
                                    <div className="font-medium text-text-primary truncate">{getGridCoaName(code)}{getGridEntityName(code) ? <span className="text-text-faint ml-1 text-[10px]">({getGridEntityName(code)})</span> : null}</div>
                                    <div className="text-[10px] text-text-faint font-mono">{code}</div>
                                  </td>
                                  {MONTHS.map((_, m) => {
                                    const val = gridData[code]?.[m] || 0;
                                    return <td key={m} className={`px-2 py-2 text-right font-mono ${val !== 0 ? 'text-text-primary' : 'text-text-faint'}`}>{val === 0 ? '—' : fmt(val)}</td>;
                                  })}
                                  <td className="px-3 py-2 text-right font-mono font-semibold bg-bg-row sticky right-0">{fmt(getRowTotal(code))}</td>
                                </tr>
                              ))}
                            </>
                          )}
                          {liabilityCodes.length > 0 && (
                            <>
                              <tr className="bg-orange-50"><td colSpan={14} className="px-3 py-1.5 font-bold text-orange-800 sticky left-0 bg-orange-50">Liabilities</td></tr>
                              {liabilityCodes.map(code => (
                                <tr key={code} className="border-b border-border-light hover:bg-bg-row">
                                  <td className="px-3 py-2 sticky left-0 bg-white z-10">
                                    <div className="font-medium text-text-primary truncate">{getGridCoaName(code)}{getGridEntityName(code) ? <span className="text-text-faint ml-1 text-[10px]">({getGridEntityName(code)})</span> : null}</div>
                                    <div className="text-[10px] text-text-faint font-mono">{code}</div>
                                  </td>
                                  {MONTHS.map((_, m) => {
                                    const val = gridData[code]?.[m] || 0;
                                    return <td key={m} className={`px-2 py-2 text-right font-mono ${val !== 0 ? 'text-text-primary' : 'text-text-faint'}`}>{val === 0 ? '—' : fmt(val)}</td>;
                                  })}
                                  <td className="px-3 py-2 text-right font-mono font-semibold bg-bg-row sticky right-0">{fmt(getRowTotal(code))}</td>
                                </tr>
                              ))}
                            </>
                          )}
                          {equityCodes.length > 0 && (
                            <>
                              <tr className="bg-purple-50"><td colSpan={14} className="px-3 py-1.5 font-bold text-purple-800 sticky left-0 bg-purple-50">Equity</td></tr>
                              {equityCodes.map(code => (
                                <tr key={code} className="border-b border-border-light hover:bg-bg-row">
                                  <td className="px-3 py-2 sticky left-0 bg-white z-10">
                                    <div className="font-medium text-text-primary truncate">{getGridCoaName(code)}{getGridEntityName(code) ? <span className="text-text-faint ml-1 text-[10px]">({getGridEntityName(code)})</span> : null}</div>
                                    <div className="text-[10px] text-text-faint font-mono">{code}</div>
                                  </td>
                                  {MONTHS.map((_, m) => {
                                    const val = gridData[code]?.[m] || 0;
                                    return <td key={m} className={`px-2 py-2 text-right font-mono ${val !== 0 ? 'text-text-primary' : 'text-text-faint'}`}>{val === 0 ? '—' : fmt(val)}</td>;
                                  })}
                                  <td className="px-3 py-2 text-right font-mono font-semibold bg-bg-row sticky right-0">{fmt(getRowTotal(code))}</td>
                                </tr>
                              ))}
                            </>
                          )}
                        </tbody>
                      </table>
                      {assetCodes.length === 0 && liabilityCodes.length === 0 && equityCodes.length === 0 && <div className="p-8 text-center text-text-faint">No data for {selectedYear}</div>}
                    </div>
                  )}

                  {activeStatement === 'cashflow' && (
                    <div className="p-8 text-center text-text-faint">
                      <p className="text-sm font-medium">Cash Flow Statement</p>
                      <p className="text-xs mt-1">Coming soon</p>
                    </div>
                  )}
                </div>
              )}

              {/* General Ledger */}
              {activeSection === 'ledger' && (
                <div className="p-4">
                  <GeneralLedger coaOptions={coaOptions} onReload={loadData} />
                </div>
              )}

              {/* Journal Entries */}
              {activeSection === 'journal' && (
                <div className="p-4">
                  <JournalEntryEngine journalTransactions={journalEntries} coaOptions={coaOptions} onSave={saveJournalEntry} onReload={loadData} />
                </div>
              )}

              {/* Bank Reconciliation */}
              {activeSection === 'reconcile' && (
                <div>
                  <div className="px-3 py-1.5 bg-bg-row border-b border-border"><span className="text-terminal-base font-mono font-semibold text-text-primary">Bank Reconciliation</span></div>
                  <div className="p-2">
                    <BankReconciliation
                      accounts={accounts}
                      transactions={transactions}
                      reconciliations={reconciliations}
                      onSave={async (data) => {
                        const res = await fetch('/api/bank-reconciliations', {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify(data),
                        });
                        if (!res.ok) {
                          const err = await res.json();
                          alert(err.error || 'Failed to save reconciliation');
                        }
                      }}
                      onReload={loadReconciliations}
                    />
                  </div>
                </div>
              )}

              {/* Period Close */}
              {activeSection === 'close' && (
                <div>
                  <div className="px-3 py-1.5 bg-bg-row border-b border-border"><span className="text-terminal-base font-mono font-semibold text-text-primary">Period Close</span></div>
                  <div className="p-2">
                    <PeriodClose
                      transactions={transactions}
                      reconciliations={reconciliations}
                      periodCloses={periodCloses}
                      selectedYear={selectedYear}
                      onClose={async (year, month, notes) => {
                        if (!defaultEntityId) { alert('No entity found. Create an entity first.'); return; }
                        const res = await fetch('/api/closing-periods/close', {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ entityId: defaultEntityId, year, month }),
                        });
                        if (!res.ok) {
                          const err = await res.json();
                          alert(err.error || 'Failed to close period');
                        }
                      }}
                      onReopen={async (year, month) => {
                        if (!defaultEntityId) { alert('No entity found.'); return; }
                        const reason = prompt('Reason for reopening (required for audit trail):');
                        if (!reason || !reason.trim()) { alert('A reason is required to reopen a period.'); return; }
                        const res = await fetch('/api/closing-periods/reopen', {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ entityId: defaultEntityId, year, month, notes: reason }),
                        });
                        if (!res.ok) {
                          const err = await res.json();
                          alert(err.error || 'Failed to reopen period');
                        }
                      }}
                      onReload={() => { loadPeriodCloses(); loadReconciliations(); }}
                    />
                  </div>
                </div>
              )}

              {/* Position Report */}
              {activeSection === 'positions' && (
                <PositionReportTab />
              )}

              {/* Wash Sale Report */}
              {activeSection === 'wash-sales' && (
                <WashSaleReportTab />
              )}

              {/* Tax Forms (Schedule D + Form 8949) */}
              {activeSection === 'tax' && (
                <TaxReportTab />
              )}

              {/* CPA Export */}
              {activeSection === 'export' && (
                <div>
                  <div className="px-3 py-1.5 bg-bg-row border-b border-border"><span className="text-terminal-base font-mono font-semibold text-text-primary">CPA Export</span></div>
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
          <div className="fixed bottom-0 left-0 right-0 bg-brand-purple-deep text-white p-3 z-40">
            <div className="max-w-7xl mx-auto flex items-center gap-3">
              <span className="px-2 py-1 bg-white/20 text-xs font-mono">{selectedIds.length}</span>
              <select value={assignCoa} onChange={(e) => setAssignCoa(e.target.value)} className="flex-1 bg-brand-purple-hover text-white border-0 px-3 py-1.5 text-xs">
                <option value="">Select COA...</option>
                {Object.entries(coaGrouped).map(([type, opts]) => (
                  <optgroup key={type} label={type}>{opts.map(o => <option key={o.id} value={o.code}>{o.name}</option>)}</optgroup>
                ))}
              </select>
              <button onClick={handleBulkAssign} disabled={!assignCoa || isAssigning} className="px-4 py-1.5 bg-white text-brand-purple-deep text-xs font-medium disabled:opacity-50">
                {isAssigning ? '...' : 'Assign'}
              </button>
              <button onClick={() => setSelectedIds([])} className="text-white/60 hover:text-white text-terminal-lg">×</button>
            </div>
          </div>
        )}

        {/* Drilldown Modal */}
        {drilldownCell && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => { setDrilldownCell(null); setSelectedDrilldownTxns([]); }}>
            <div className="bg-white w-full max-w-2xl max-h-[80vh] flex flex-col" onClick={e => e.stopPropagation()}>
              <div className="bg-brand-purple-deep text-white px-4 py-3 flex justify-between items-center">
                <div>
                  <h4 className="font-semibold text-sm">{getCoaName(drilldownCell.coaCode)}</h4>
                  <p className="text-xs text-text-faint font-mono">{drilldownCell.month === -1 ? 'Full Year' : MONTHS[drilldownCell.month]} {selectedYear} · {drilldownTransactions.length} transactions</p>
                </div>
                <button onClick={() => { setDrilldownCell(null); setSelectedDrilldownTxns([]); }} className="text-white/60 hover:text-white text-sm">×</button>
              </div>

              {selectedDrilldownTxns.length > 0 && (
                <div className="bg-brand-purple-hover text-white px-4 py-2 flex items-center gap-2">
                  <span className="px-2 py-0.5 bg-white/20 text-xs font-mono">{selectedDrilldownTxns.length}</span>
                  <select value={reassignCoa} onChange={(e) => setReassignCoa(e.target.value)} className="flex-1 bg-brand-purple-deep text-white border-0 text-xs px-2 py-1">
                    <option value="">Move to...</option>
                    {Object.entries(coaGrouped).map(([type, opts]) => (
                      <optgroup key={type} label={type}>{opts.map(o => <option key={o.id} value={o.code}>{o.name}</option>)}</optgroup>
                    ))}
                  </select>
                  <button onClick={handleDrilldownReassign} disabled={!reassignCoa} className="px-3 py-1 bg-white text-brand-purple-deep text-xs font-medium disabled:opacity-50">Move</button>
                </div>
              )}

              <div className="flex-1 overflow-auto">
                <table className="w-full text-xs">
                  <thead className="bg-bg-row sticky top-0">
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
                  <tbody className="divide-y divide-border">
                    {drilldownTransactions.map(txn => (
                      <tr key={txn.id} className={`hover:bg-bg-row ${selectedDrilldownTxns.includes(txn.id) ? 'bg-brand-purple-deep/5' : ''}`}>
                        <td className="px-3 py-2">
                          <input type="checkbox" checked={selectedDrilldownTxns.includes(txn.id)}
                            onChange={(e) => setSelectedDrilldownTxns(e.target.checked ? [...selectedDrilldownTxns, txn.id] : selectedDrilldownTxns.filter(id => id !== txn.id))}
                            className="w-3 h-3" />
                        </td>
                        <td className="px-2 py-2 text-text-secondary font-mono">{new Date(txn.date).toLocaleDateString()}</td>
                        <td className="px-2 py-2 text-text-primary truncate max-w-[200px]">{txn.name}</td>
                        <td className="px-2 py-2 text-right font-mono font-medium">{fmt(Math.abs(txn.amount))}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="bg-bg-row px-4 py-3 flex justify-between items-center border-t">
                <span className="font-semibold text-text-primary text-xs">Total: {fmt(drilldownTransactions.reduce((s, t) => s + Math.abs(t.amount), 0))}</span>
                <button onClick={() => { setDrilldownCell(null); setSelectedDrilldownTxns([]); }} className="px-4 py-1.5 bg-bg-row text-text-secondary text-xs font-medium hover:bg-border">Close</button>
              </div>
            </div>
          </div>
        )}
      {showUpgradeModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setShowUpgradeModal(false)} />
          <div className="relative z-10 bg-white border border-border p-6 max-w-md">
            <div className="text-sm font-medium text-text-primary mb-2">Bank Sync requires Pro</div>
            <div className="text-xs text-text-muted mb-4">Upgrade to Pro ($20/mo) to connect your bank accounts via Plaid.</div>
            <div className="flex gap-2">
              <button onClick={() => window.location.href = "/pricing"} className="flex-1 px-4 py-2 text-xs bg-brand-purple-deep text-white font-medium hover:bg-brand-purple-hover">View Plans</button>
              <button onClick={() => setShowUpgradeModal(false)} className="flex-1 px-4 py-2 text-xs border border-border text-text-secondary font-medium hover:bg-bg-row">Not Now</button>
            </div>
          </div>
        </div>
      )}

      {/* SOC 2 Proof Modal */}
      {soc2Modal && (() => {
        const code = soc2Modal;
        const proof = soc2Proofs[code.toLowerCase()];
        return (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setSoc2Modal(null)}>
            <div className="bg-white w-full max-w-lg max-h-[80vh] flex flex-col" onClick={e => e.stopPropagation()}>
              <div className="bg-brand-purple-deep text-white px-4 py-3 flex justify-between items-center">
                <div>
                  <h4 className="font-semibold text-sm font-mono">{code}: {SOC2_LABELS[code]}</h4>
                  <div className="flex items-center gap-2 mt-1">
                    <span className={`px-2 py-0.5 text-[10px] font-mono font-bold rounded ${
                      proof?.status === 'pass' ? 'bg-green-500/20 text-green-300' :
                      proof?.status === 'fail' ? 'bg-red-500/20 text-red-300' :
                      'bg-yellow-500/20 text-yellow-300'
                    }`}>{proof?.status?.toUpperCase() || 'LOADING'}</span>
                  </div>
                </div>
                <button onClick={() => setSoc2Modal(null)} className="text-white/60 hover:text-white text-sm">×</button>
              </div>
              <div className="flex-1 overflow-auto p-4">
                <p className="text-sm font-mono text-text-primary mb-3">{proof?.summary || 'Loading...'}</p>
                {proof?.details && proof.details.length > 0 && (
                  <div className="border border-border">
                    <table className="w-full text-xs font-mono">
                      <thead className="bg-bg-row">
                        <tr>
                          {Object.keys(proof.details[0]).map(k => (
                            <th key={k} className="px-2 py-1.5 text-left text-text-muted font-medium uppercase text-[9px] tracking-wider">{k}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border-light">
                        {proof.details.map((row: any, i: number) => (
                          <tr key={i} className="hover:bg-bg-row">
                            {Object.values(row).map((v: any, j: number) => (
                              <td key={j} className="px-2 py-1.5 text-text-secondary truncate max-w-[200px]">
                                {typeof v === 'string' && v.startsWith('http') ? <a href={v} target="_blank" rel="noopener noreferrer" className="text-brand-purple hover:underline">Link</a> : String(v)}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
                {proof?.details && proof.details.length === 0 && (
                  <p className="text-xs text-text-faint font-mono">No issues found.</p>
                )}
              </div>
              <div className="border-t border-border px-4 py-2 flex justify-end">
                <button onClick={() => setSoc2Modal(null)} className="px-4 py-1.5 bg-bg-row text-text-secondary text-xs font-medium hover:bg-border">Close</button>
              </div>
            </div>
          </div>
        );
      })()}
      {showTaxSettings && (
        <TaxSettings onClose={() => setShowTaxSettings(false)} onSave={handleTaxSettingsSave} />
      )}
      </AppLayout>
    </>
  );
}
