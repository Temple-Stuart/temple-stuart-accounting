'use client';

import { useState, useEffect, useCallback } from 'react';
import BookkeepingSection from '@/components/bookkeeping/BookkeepingSection';
import SpendingTab from '@/components/dashboard/SpendingTab';
import InvestmentsTab from '@/components/dashboard/InvestmentsTab';
import JournalEntryEngine from '@/components/dashboard/JournalEntryEngine';
import GeneralLedger from '@/components/dashboard/GeneralLedger';
import TrialBalanceSection from '@/components/bookkeeping/TrialBalanceSection';
import BankReconciliation from '@/components/dashboard/BankReconciliation';
import AdjustingEntriesTab from '@/components/dashboard/AdjustingEntriesTab';
import FinancialStatementsTab from '@/components/dashboard/FinancialStatementsTab';
import WashSaleReportTab from '@/components/dashboard/WashSaleReportTab';
import PeriodClose from '@/components/dashboard/PeriodClose';
import CloseBooksTab from '@/components/dashboard/CloseBooksTab';
import PositionReportTab from '@/components/dashboard/PositionReportTab';
import CPAExport from '@/components/dashboard/CPAExport';

/**
 * BOOKS-2 — the full bookkeeping PIPE for the homepage Books tab.
 *
 * This owns the dashboard's shared data layer (states + fetches + handlers,
 * reproduced faithfully from src/app/dashboard/page.tsx) and renders the engines
 * in the dashboard's CANONICAL order (cited per section below). All fetches hit
 * existing, already-authed, user-scoped routes — no new routes, nothing added to
 * PUBLIC_PATHS.
 *
 * TRUTH-FIRST: the pipe is a 3-state machine (loading / error / ok). On ANY core
 * fetch failure it shows an explicit error, never engines fed fabricated empty
 * data. The self-fetching drop-ins (Trial Balance, Financial Statements, Adjusting
 * Entries, Wash Sales, Positions) manage their own internal loading/error.
 *
 * Note on account linking: the "+ Account" / Sync affordances live in the cockpit
 * bar directly above this pipe (BOOKS-1). To avoid a second, duplicate Plaid Link
 * flow on the same tab, the Source Accounts section here lists accounts + owns the
 * entity-type assignment (the pipe-unique capability) and defers linking/sync to
 * the cockpit.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Row = any;

const fmt = (n: number) =>
  '$' + Math.abs(n).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 });

export default function BooksPipeline() {
  const [year] = useState(new Date().getFullYear());
  const [state, setState] = useState<'loading' | 'error' | 'ok'>('loading');

  const [transactions, setTransactions] = useState<Row[]>([]);
  const [accounts, setAccounts] = useState<Row[]>([]);
  const [coaOptions, setCoaOptions] = useState<Row[]>([]);
  const [investmentTransactions, setInvestmentTransactions] = useState<Row[]>([]);
  const [journalEntries, setJournalEntries] = useState<Row[]>([]);
  const [reconciliations, setReconciliations] = useState<Row[]>([]);
  const [periodCloses, setPeriodCloses] = useState<Row[]>([]);
  const [entityId, setEntityId] = useState<string | null>(null);
  const [mappingTab, setMappingTab] = useState<'spending' | 'investments'>('spending');

  // Reconciliations + period closes have their own reloaders (mirrors dashboard
  // loadReconciliations :178 / loadPeriodCloses :188). Fail-loud — throw so the
  // parent state machine flips to 'error' rather than showing empty tables.
  const loadReconciliations = useCallback(async () => {
    const res = await fetch('/api/bank-reconciliations');
    if (!res.ok) throw new Error('bank-reconciliations fetch failed');
    const d = await res.json();
    setReconciliations(d.reconciliations || []);
  }, []);

  const loadPeriodCloses = useCallback(async () => {
    const res = await fetch('/api/closing-periods');
    if (!res.ok) throw new Error('closing-periods fetch failed');
    const d = await res.json();
    setPeriodCloses(d.periods || []);
  }, []);

  // Core pipe data (mirrors dashboard loadData :142 + entities effect :199).
  // Fail-loud: any non-OK response throws → 'error' state (no fabricated empty data).
  const loadData = useCallback(async () => {
    const [txnRes, coaRes, accRes, invRes, jeRes, entRes] = await Promise.all([
      fetch('/api/transactions'),
      fetch('/api/chart-of-accounts'),
      fetch('/api/accounts'),
      fetch('/api/investment-transactions'),
      fetch('/api/journal-transactions'),
      fetch('/api/entities'),
    ]);
    if (![txnRes, coaRes, accRes, invRes, jeRes, entRes].every((r) => r.ok)) {
      throw new Error('core books fetch failed');
    }
    const txn = await txnRes.json();
    setTransactions(txn.transactions || []);
    const coa = await coaRes.json();
    setCoaOptions(coa.accounts || []);
    const acc = await accRes.json();
    const flat: Row[] = [];
    (acc.items || []).forEach((item: Row) => {
      (item.accounts || []).forEach((a: Row) => {
        flat.push({
          id: a.id, name: a.name, mask: a.mask, type: a.type,
          balance: a.balance || 0, institutionName: item.institutionName || 'Unknown',
          entityType: a.entityType || null,
        });
      });
    });
    setAccounts(flat);
    const inv = await invRes.json();
    setInvestmentTransactions(inv.transactions || inv.investments || []);
    const je = await jeRes.json();
    setJournalEntries(je.entries || []);
    const ent = await entRes.json();
    const entities = ent.entities || [];
    const def = entities.find((e: Row) => e.is_default) || entities[0];
    setEntityId(def?.id ?? null);
  }, []);

  const reloadAll = useCallback(async () => {
    setState('loading');
    try {
      await Promise.all([loadData(), loadReconciliations(), loadPeriodCloses()]);
      setState('ok');
    } catch {
      setState('error');
    }
  }, [loadData, loadReconciliations, loadPeriodCloses]);

  useEffect(() => { reloadAll(); }, [reloadAll]);

  // Handlers — reproduced verbatim from the dashboard.
  const saveJournalEntry = async (entry: Row) => {
    await fetch('/api/journal-entries', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(entry),
    });
  };

  // Optimistic entity assignment with revert-on-failure (dashboard :355). The revert
  // restores the TRUE prior value — not a fabricated default.
  const updateAccountEntity = async (accountId: string, entityType: string) => {
    const prev = accounts.find((a) => a.id === accountId);
    setAccounts((accs) => accs.map((a) => (a.id === accountId ? { ...a, entityType } : a)));
    try {
      const res = await fetch('/api/accounts/update-entity', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accountId, entityType }),
      });
      if (!res.ok) throw new Error();
    } catch {
      setAccounts((accs) => accs.map((a) => (a.id === accountId ? { ...a, entityType: prev?.entityType ?? null } : a)));
    }
  };

  const committedSpending = transactions.filter((t) => t.journalProof);
  const uncommittedSpending = transactions.filter((t) => !t.journalProof);
  const committedInvestments = investmentTransactions.filter((t) => t.journalProof);
  const uncommittedInvestments = investmentTransactions.filter((t) => !t.journalProof);
  const committedCount = committedSpending.length + committedInvestments.length;
  const totalBalance = accounts.reduce((s, a) => s + (a.balance || 0), 0);

  if (state === 'loading') {
    return (
      <div className="rounded-xl border-2 border-border bg-white px-4 py-3 text-sm text-text-muted">
        Loading your books pipeline…
      </div>
    );
  }
  if (state === 'error') {
    return (
      <div role="alert" className="rounded-xl border-2 border-red-300 bg-red-50 px-4 py-3 text-sm text-red-700 flex items-center justify-between gap-3">
        <span>Couldn&rsquo;t load your books pipeline right now. Nothing is assumed — the engines stay hidden until the data loads.</span>
        <button
          type="button"
          onClick={reloadAll}
          className="shrink-0 rounded-lg border border-red-400 px-3 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-100"
        >
          Retry
        </button>
      </div>
    );
  }

  // Dashboard canonical order (src/app/dashboard/page.tsx): SRC → CAT → JE → LDG →
  // TB → REC → ADJ → STMT → TAX-LOT → CLOSE → CLOSE-YE → POS → EXP.
  return (
    <div className="space-y-3">
      {/* 1. SRC — Source Accounts (dashboard :502). Linking/sync live in the cockpit above. */}
      <BookkeepingSection title="Source Accounts" pipelineKey="SRC"
        subtitle={`${accounts.length} connected`}
        status={accounts.length > 0 ? 'complete' : 'pending'}
        collapsible defaultCollapsed={false}>
        <div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-gray-50 text-text-secondary">
                <tr>
                  <th className="px-3 py-2 text-left font-medium">Institution</th>
                  <th className="px-3 py-2 text-left font-medium">Account</th>
                  <th className="px-3 py-2 text-left font-medium">Type</th>
                  <th className="px-3 py-2 text-left font-medium">Entity</th>
                  <th className="px-3 py-2 text-right font-medium">Balance</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {accounts.map((acc) => {
                  const et = acc.entityType;
                  const pillColor = et === 'personal' ? 'bg-blue-100 text-blue-700'
                    : et === 'business' ? 'bg-purple-100 text-purple-700'
                    : et === 'trading' ? 'bg-green-100 text-green-700'
                    : 'bg-orange-100 text-orange-700';
                  return (
                    <tr key={acc.id} className="hover:bg-bg-row">
                      <td className="px-3 py-2 font-medium text-text-primary">{acc.institutionName}</td>
                      <td className="px-3 py-2 text-text-secondary font-mono">{'••••'} {acc.mask || '----'}</td>
                      <td className="px-3 py-2"><span className="px-2 py-0.5 bg-bg-row text-text-secondary text-[10px] uppercase">{acc.type}</span></td>
                      <td className="px-3 py-2">
                        <select
                          value={acc.entityType || ''}
                          onChange={(e) => updateAccountEntity(acc.id, e.target.value)}
                          className={`px-2 py-0.5 rounded text-[10px] font-semibold uppercase border-0 cursor-pointer ${pillColor}`}
                        >
                          {!acc.entityType && <option value="" disabled>{'⚠'} Unassigned</option>}
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
                  <tr><td colSpan={5} className="px-3 py-8 text-center text-text-faint">No accounts connected — link one from the cockpit above.</td></tr>
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
      </BookkeepingSection>

      {/* 2. CAT — Categorize (dashboard :568): the COA-assignment queue. */}
      <BookkeepingSection title="Categorize Transactions" pipelineKey="CAT"
        subtitle={`${uncommittedSpending.length + uncommittedInvestments.length} pending`}
        status={uncommittedSpending.length + uncommittedInvestments.length > 0 ? 'action-needed' : 'complete'}>
        <div>
          <div className="flex items-center gap-3 px-3 py-1.5 border-b border-border">
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
          <div className="p-4">
            {mappingTab === 'spending' && <SpendingTab transactions={uncommittedSpending} committedTransactions={committedSpending} coaOptions={coaOptions} onReload={reloadAll} />}
            {mappingTab === 'investments' && <InvestmentsTab investmentTransactions={uncommittedInvestments} committedInvestments={committedInvestments} onReload={reloadAll} />}
          </div>
        </div>
      </BookkeepingSection>

      {/* 3. JE — Journal Entries (dashboard :596). */}
      <BookkeepingSection title="Journal Entries" pipelineKey="JE"
        subtitle={`${journalEntries.length} entries`}
        status={journalEntries.length > 0 ? 'complete' : 'pending'}>
        <div className="p-4">
          <JournalEntryEngine journalTransactions={journalEntries} coaOptions={coaOptions} onSave={saveJournalEntry} onReload={reloadAll} />
        </div>
      </BookkeepingSection>

      {/* 4. LDG — General Ledger (dashboard :605). */}
      <BookkeepingSection title="General Ledger" pipelineKey="LDG"
        subtitle={`${committedCount * 2} entries`}
        status={committedCount > 0 ? 'complete' : 'pending'}>
        <div className="p-4">
          <GeneralLedger coaOptions={coaOptions} onReload={reloadAll} />
        </div>
      </BookkeepingSection>

      {/* 5. TB — Trial Balance (dashboard :614, self-fetching). */}
      <BookkeepingSection title="Trial Balance" pipelineKey="TB" status="pending">
        <TrialBalanceSection />
      </BookkeepingSection>

      {/* 6. REC — Bank Reconciliation (dashboard :620). */}
      <BookkeepingSection title="Bank Reconciliation" pipelineKey="REC" status="pending">
        <div className="p-2">
          <BankReconciliation
            accounts={accounts}
            transactions={transactions}
            reconciliations={reconciliations}
            onSave={async (data: Row) => {
              const res = await fetch('/api/bank-reconciliations', {
                method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data),
              });
              if (!res.ok) {
                const err = await res.json();
                alert(err.error || 'Failed to save reconciliation');
              }
            }}
            onReload={loadReconciliations}
          />
        </div>
      </BookkeepingSection>

      {/* 7. ADJ — Adjusting Entries (dashboard :644, self-fetching). */}
      <BookkeepingSection title="Adjusting Entries" pipelineKey="ADJ" status="pending">
        <AdjustingEntriesTab />
      </BookkeepingSection>

      {/* 8. STMT — Financial Statements (dashboard :650, self-fetching). */}
      <BookkeepingSection title="Financial Statements" pipelineKey="STMT" status="pending">
        <FinancialStatementsTab />
      </BookkeepingSection>

      {/* 9. TAX-LOT — Tax Lot Accounting & Wash Sales (dashboard :657, self-fetching). */}
      <BookkeepingSection title="Tax Lot Accounting & Wash Sales" pipelineKey="TAX-LOT" status="pending">
        <WashSaleReportTab />
      </BookkeepingSection>

      {/* 10. CLOSE — Period Close (dashboard :663). */}
      <BookkeepingSection title="Period Close" pipelineKey="CLOSE" status="pending">
        <div className="p-2">
          <PeriodClose
            transactions={transactions}
            reconciliations={reconciliations}
            periodCloses={periodCloses}
            selectedYear={year}
            onClose={async (y: number, month: number) => {
              if (!entityId) { alert('No entity found. Create an entity first.'); return; }
              const res = await fetch('/api/closing-periods/close', {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ entityId, year: y, month }),
              });
              if (!res.ok) {
                const err = await res.json();
                alert(err.error || 'Failed to close period');
              }
            }}
            onReopen={async (y: number, month: number) => {
              if (!entityId) { alert('No entity found.'); return; }
              const reason = prompt('Reason for reopening (required for audit trail):');
              if (!reason || !reason.trim()) { alert('A reason is required to reopen a period.'); return; }
              const res = await fetch('/api/closing-periods/reopen', {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ entityId, year: y, month, notes: reason }),
              });
              if (!res.ok) {
                const err = await res.json();
                alert(err.error || 'Failed to reopen period');
              }
            }}
            onReload={() => { loadPeriodCloses(); loadReconciliations(); }}
          />
        </div>
      </BookkeepingSection>

      {/* 11. CLOSE-YE — Year-End Close (dashboard :703). */}
      <BookkeepingSection title="Year-End Close" pipelineKey="CLOSE-YE" status="pending">
        <div className="p-2">
          <CloseBooksTab entityId={entityId} selectedYear={year} />
        </div>
      </BookkeepingSection>

      {/* 12. POS — Position Report (dashboard :714, self-fetching). */}
      <BookkeepingSection title="Position Report" pipelineKey="POS" status="pending">
        <PositionReportTab />
      </BookkeepingSection>

      {/* 13. EXP — CPA Export (dashboard :745). The dashboard's Tax-forms link (:720) is
          intentionally omitted — Tax is its own homepage tab, not part of this pipe. */}
      <BookkeepingSection title="CPA Export" pipelineKey="EXP" status="pending">
        <div className="p-4">
          <CPAExport year={year} entityId={entityId} />
        </div>
      </BookkeepingSection>
    </div>
  );
}
