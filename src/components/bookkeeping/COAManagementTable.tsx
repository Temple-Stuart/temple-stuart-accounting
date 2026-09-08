'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { deriveAccountString } from '@/lib/accountString';
import { FAMILIES, FAMILY_RULES, letterFor, schemeHint, type Family } from '@/lib/coa/scheme';
import { seedSetsFor, type SeedPlanRow } from '@/lib/coa/seedSets';

/**
 * COA-01 — the chart of accounts is extendable in the product. One table per
 * entity: add (the scheme's family + code, validated server-side and hinted
 * here), rename, retire / restore (never delete — history stays and shows
 * under "retired"), reclassify (a new journal entry with a memo moving a
 * balance to another account of the same family), and the ruled seed sets
 * (preview every row's fate, then apply — only the absent rows are written).
 * Every failure renders inline with the server's own words; nothing is
 * swallowed.
 */

interface COAManagementTableProps {
  entityId: string;
  entityName: string;
  /** entities.entity_type — personal | sole_prop | trading; drives the code letter and the scheme hint. */
  entityType: string;
}

interface COAAccount {
  id: string;
  code: string;
  name: string;
  accountType: string;
  balanceType: string;
  /** DIM-2: the dimensional S segment (chart_of_accounts.sub_type, nullable). */
  subType: string | null;
  settledBalance: string;
  pendingBalance: string;
  entityId: string;
  entityType: string;
  is_archived: boolean;
}

interface DrilldownTxn {
  id: string;
  date: string;
  merchantName: string | null;
  name: string;
  amount: number;
  accountCode: string | null;
}

interface SeedResult {
  applied: boolean;
  set: { key: string; label: string; why: string };
  plan: SeedPlanRow[];
  created: string[];
  counts: { create: number; exists: number; collision: number; retired: number };
}

const ACCOUNT_TYPE_ORDER = [...FAMILIES];
const ACCOUNT_TYPE_LABELS: Record<string, string> = Object.fromEntries(FAMILIES.map((f) => [f, FAMILY_RULES[f].label]));

function formatCurrency(cents: string | number): string {
  const val = typeof cents === 'string' ? parseInt(cents, 10) : cents;
  if (isNaN(val)) return '$0.00';
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(val / 100);
}

function formatAmount(dollars: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(Math.abs(dollars));
}

function formatDate(d: string): string {
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

/** The server's own words from a failed response — the error line, its field when named, else the status. */
async function failureText(res: Response, fallback: string): Promise<string> {
  const data = await res.json().catch(() => ({}));
  const line = typeof data?.error === 'string' ? data.error : typeof data?.message === 'string' ? data.message : `${fallback} (HTTP ${res.status})`;
  return data?.field ? `${data.field}: ${line}` : line;
}

const today = () => new Date().toISOString().slice(0, 10);

const messageOf = (err: unknown): string => (err instanceof Error ? err.message : String(err));

export default function COAManagementTable({ entityId, entityName, entityType }: COAManagementTableProps) {
  const [accounts, setAccounts] = useState<COAAccount[]>([]);
  const [allCoaOptions, setAllCoaOptions] = useState<COAAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showZeroBalances, setShowZeroBalances] = useState(false);
  const [showRetired, setShowRetired] = useState(false);

  // Inline edit state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({ code: '', name: '', subType: '' });
  const [editSaving, setEditSaving] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);
  // Retire / restore action state — every failure surfaces inline, never swallowed.
  const [archiving, setArchiving] = useState<string | null>(null);
  const [archiveError, setArchiveError] = useState<string | null>(null);

  // Add new account state — COA-01: the family drives the scheme hint.
  const [showAddForm, setShowAddForm] = useState(false);
  const [addForm, setAddForm] = useState<{ code: string; name: string; family: Family; subType: string }>({ code: '', name: '', family: 'expense', subType: '' });
  const [addSaving, setAddSaving] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);

  // Reclassify state — one open form at a time, keyed by the source account.
  const [reclassId, setReclassId] = useState<string | null>(null);
  const [reclassForm, setReclassForm] = useState({ toCode: '', amount: '', memo: '', date: today() });
  const [reclassSaving, setReclassSaving] = useState(false);
  const [reclassError, setReclassError] = useState<string | null>(null);
  const [reclassDone, setReclassDone] = useState<string | null>(null);

  // Seed sets state — preview first, apply second.
  const seedSets = useMemo(() => seedSetsFor(entityType), [entityType]);
  const [seedKey, setSeedKey] = useState<string>('');
  const [seedResult, setSeedResult] = useState<SeedResult | null>(null);
  const [seedBusy, setSeedBusy] = useState(false);
  const [seedError, setSeedError] = useState<string | null>(null);

  // Drill-down state
  const [expandedCode, setExpandedCode] = useState<string | null>(null);
  const [drilldownTxns, setDrilldownTxns] = useState<DrilldownTxn[]>([]);
  const [drilldownLoading, setDrilldownLoading] = useState(false);
  const [drilldownError, setDrilldownError] = useState<string | null>(null);
  const [reassigning, setReassigning] = useState<string | null>(null);
  const [reassignError, setReassignError] = useState<string | null>(null);

  const letter = letterFor(entityType);

  const fetchAccounts = useCallback(async () => {
    try {
      setError(null);
      const res = await fetch(`/api/chart-of-accounts/balances?entityId=${encodeURIComponent(entityId)}&include_archived=true`);
      if (!res.ok) throw new Error(await failureText(res, 'Failed to fetch accounts'));
      const data = await res.json();
      setAccounts(data.accounts || []);
    } catch (err) {
      setError(messageOf(err));
    } finally {
      setLoading(false);
    }
  }, [entityId]);

  // The categorization list — ACTIVE accounts only (the route hides retired ones).
  const fetchAllCoa = useCallback(async () => {
    try {
      const res = await fetch(`/api/chart-of-accounts?entity_id=${encodeURIComponent(entityId)}`);
      if (!res.ok) throw new Error(await failureText(res, 'Failed to fetch the account list'));
      const data = await res.json();
      setAllCoaOptions(data.accounts || []);
    } catch (err) {
      setError(messageOf(err));
    }
  }, [entityId]);

  useEffect(() => { fetchAccounts(); fetchAllCoa(); }, [fetchAccounts, fetchAllCoa]);

  const active = accounts.filter((a) => !a.is_archived);
  const retired = accounts.filter((a) => a.is_archived);
  const nonZeroAccounts = active.filter(a => parseInt(a.settledBalance, 10) !== 0);
  const zeroCount = active.length - nonZeroAccounts.length;
  const displayAccounts = [...(showZeroBalances ? active : nonZeroAccounts), ...(showRetired ? retired : [])];

  const grouped = ACCOUNT_TYPE_ORDER.reduce<Record<string, COAAccount[]>>((acc, type) => {
    const items = displayAccounts.filter(a => a.accountType === type);
    if (items.length > 0) acc[type] = items;
    return acc;
  }, {});

  const startEdit = (account: COAAccount) => {
    setEditingId(account.id);
    setEditForm({ code: account.code, name: account.name, subType: account.subType ?? '' });
    setEditError(null);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditError(null);
  };

  const saveEdit = async (id: string) => {
    setEditSaving(true);
    setEditError(null);
    try {
      const res = await fetch(`/api/chart-of-accounts/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code: editForm.code,
          name: editForm.name,
          subType: editForm.subType.trim() ? editForm.subType.trim() : null,
        }),
      });
      if (!res.ok) throw new Error(await failureText(res, 'Failed to update'));
      setEditingId(null);
      await fetchAccounts();
      await fetchAllCoa();
    } catch (err) {
      setEditError(messageOf(err));
    } finally {
      setEditSaving(false);
    }
  };

  const addAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    setAddSaving(true);
    setAddError(null);
    try {
      const res = await fetch('/api/chart-of-accounts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code: addForm.code,
          name: addForm.name,
          family: addForm.family,
          ...(addForm.subType.trim() ? { subType: addForm.subType.trim() } : {}),
          entityId,
        }),
      });
      if (!res.ok) throw new Error(await failureText(res, 'Failed to create account'));
      setShowAddForm(false);
      setAddForm({ code: '', name: '', family: 'expense', subType: '' });
      await fetchAccounts();
      await fetchAllCoa();
    } catch (err) {
      setAddError(messageOf(err));
    } finally {
      setAddSaving(false);
    }
  };

  // Retire / restore — accounts are NEVER deleted (posted history is a
  // permanent financial record; the server PATCH enforces ownership + gate).
  const setRetired = async (id: string, archived: boolean) => {
    setArchiving(id);
    setArchiveError(null);
    try {
      const res = await fetch(`/api/chart-of-accounts/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ archived }),
      });
      if (!res.ok) throw new Error(await failureText(res, archived ? 'Failed to retire account' : 'Failed to restore account'));
      if (archived) setShowRetired(true);
      await fetchAccounts();
      await fetchAllCoa();
    } catch (err) {
      setArchiveError(messageOf(err));
    } finally {
      setArchiving(null);
    }
  };

  const openReclass = (account: COAAccount) => {
    const cents = Math.abs(parseInt(account.settledBalance, 10) || 0);
    setReclassId(account.id);
    setReclassForm({ toCode: '', amount: (cents / 100).toFixed(2), memo: '', date: today() });
    setReclassError(null);
    setReclassDone(null);
  };

  const submitReclass = async (account: COAAccount) => {
    setReclassSaving(true);
    setReclassError(null);
    try {
      const dollars = Number(reclassForm.amount);
      if (!Number.isFinite(dollars)) throw new Error('amount: enter dollars, e.g. 120.00');
      const res = await fetch('/api/chart-of-accounts/reclassify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          entityId,
          fromCode: account.code,
          toCode: reclassForm.toCode,
          amountCents: Math.round(dollars * 100),
          memo: reclassForm.memo,
          date: reclassForm.date,
        }),
      });
      if (!res.ok) throw new Error(await failureText(res, 'Failed to post the reclassification'));
      const data = await res.json();
      setReclassDone(`Posted ${data.description} — journal entry ${data.journalEntryId}`);
      setReclassId(null);
      await fetchAccounts();
    } catch (err) {
      setReclassError(messageOf(err));
    } finally {
      setReclassSaving(false);
    }
  };

  const runSeed = async (apply: boolean) => {
    if (!seedKey) { setSeedError('pick a set first'); return; }
    setSeedBusy(true);
    setSeedError(null);
    try {
      const res = await fetch('/api/chart-of-accounts/seed', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ entityId, setKey: seedKey, apply }),
      });
      if (!res.ok) throw new Error(await failureText(res, apply ? 'Failed to apply the set' : 'Failed to preview the set'));
      const data: SeedResult = await res.json();
      setSeedResult(data);
      if (apply) { await fetchAccounts(); await fetchAllCoa(); }
    } catch (err) {
      setSeedError(messageOf(err));
    } finally {
      setSeedBusy(false);
    }
  };

  const toggleDrilldown = async (code: string) => {
    if (expandedCode === code) {
      setExpandedCode(null);
      setDrilldownTxns([]);
      return;
    }
    setExpandedCode(code);
    setDrilldownLoading(true);
    setDrilldownError(null);
    try {
      const res = await fetch(`/api/transactions?accountCode=${encodeURIComponent(code)}&entityId=${encodeURIComponent(entityId)}`);
      if (!res.ok) throw new Error(await failureText(res, 'Failed to load transactions'));
      const data = await res.json();
      setDrilldownTxns(data.transactions || []);
    } catch (err) {
      setDrilldownError(messageOf(err));
    } finally { setDrilldownLoading(false); }
  };

  const reassignTransaction = async (txnId: string, newCode: string) => {
    setReassigning(txnId);
    setReassignError(null);
    try {
      const res = await fetch('/api/transactions/assign-coa', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ transactionIds: [txnId], accountCode: newCode }),
      });
      if (!res.ok) throw new Error(await failureText(res, 'Failed to reassign'));
      // Refresh drilldown and balances
      if (expandedCode) await toggleDrilldown(expandedCode);
      await fetchAccounts();
    } catch (err) {
      setReassignError(messageOf(err));
    } finally { setReassigning(null); }
  };

  const balanceColor = (type: string) => {
    if (type === 'asset' || type === 'revenue') return 'text-emerald-600';
    if (type === 'liability' || type === 'expense') return 'text-red-600';
    return 'text-text-primary';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="w-5 h-5 border-2 border-brand-purple-deep border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-8 text-sm text-red-500" role="alert">
        Failed to load chart of accounts: {error}
      </div>
    );
  }

  const addHint = schemeHint(entityType, addForm.family);

  return (
    <div className="space-y-2" data-coa-table={entityId} data-entity-type={entityType}>
      <div className="border border-gray-200/50 rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50">
              <th className="text-left px-3 py-2 text-xs font-semibold text-text-secondary">Code</th>
              <th className="text-left px-3 py-2 text-xs font-semibold text-text-secondary">Account Name</th>
              <th className="text-right px-3 py-2 text-xs font-semibold text-text-secondary">Balance</th>
              <th className="text-right px-3 py-2 text-xs font-semibold text-text-secondary w-[190px]">Actions</th>
            </tr>
          </thead>
          <tbody>
            {Object.entries(grouped).map(([type, items]) =>
              items.map((account, i) => {
                const isEditing = editingId === account.id;
                const isFirst = i === 0;
                const isExpanded = expandedCode === account.code;
                return (
                  <GroupedRow
                    key={account.id}
                    account={account}
                    entityType={entityType}
                    isFirst={isFirst}
                    type={type}
                    isEditing={isEditing}
                    isExpanded={isExpanded}
                    isReclassifying={reclassId === account.id}
                    reclassTargets={active.filter((a) => a.accountType === account.accountType && a.id !== account.id)}
                    reclassForm={reclassForm}
                    reclassSaving={reclassSaving}
                    reclassError={reclassError}
                    editForm={editForm}
                    editSaving={editSaving}
                    editError={editError}
                    balanceColor={balanceColor}
                    rowIndex={i}
                    drilldownLoading={drilldownLoading}
                    drilldownError={drilldownError}
                    drilldownTxns={drilldownTxns}
                    allCoaOptions={allCoaOptions}
                    reassigning={reassigning}
                    reassignError={reassignError}
                    archiving={archiving}
                    onEditFormChange={setEditForm}
                    onStartEdit={startEdit}
                    onCancelEdit={cancelEdit}
                    onSaveEdit={saveEdit}
                    onToggleDrilldown={toggleDrilldown}
                    onReassign={reassignTransaction}
                    onRetire={(id) => setRetired(id, true)}
                    onRestore={(id) => setRetired(id, false)}
                    onOpenReclass={openReclass}
                    onReclassFormChange={setReclassForm}
                    onCancelReclass={() => { setReclassId(null); setReclassError(null); }}
                    onSubmitReclass={submitReclass}
                  />
                );
              })
            )}
            {displayAccounts.length === 0 && (
              <tr>
                <td colSpan={4} className="text-center py-6 text-xs text-text-muted">
                  No accounts found for this entity. Add one below.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
        {/* Zero balance toggle */}
        {zeroCount > 0 && (
          <button
            onClick={() => setShowZeroBalances(v => !v)}
            className="text-[11px] text-text-muted hover:text-brand-purple-deep"
          >
            {showZeroBalances
              ? `Hide ${zeroCount} account${zeroCount !== 1 ? 's' : ''} with $0 balance`
              : `${zeroCount} account${zeroCount !== 1 ? 's' : ''} with $0 balance hidden — show`}
          </button>
        )}
        {/* COA-01: retired accounts stay — their balances and history are one click away. */}
        {retired.length > 0 && (
          <button
            onClick={() => setShowRetired(v => !v)}
            className="text-[11px] text-text-muted hover:text-brand-purple-deep"
            data-retired-toggle
          >
            {showRetired
              ? `Hide ${retired.length} retired account${retired.length !== 1 ? 's' : ''}`
              : `${retired.length} retired account${retired.length !== 1 ? 's' : ''} hidden — show`}
          </button>
        )}
      </div>

      {archiveError && <div className="text-xs text-red-500" role="alert">{archiveError}</div>}
      {reclassDone && <div className="text-xs text-emerald-700" data-reclass-done>{reclassDone}</div>}

      {/* Add Account Form — COA-01: the family sets the range; the code carries the entity letter. */}
      {showAddForm ? (
        <form onSubmit={addAccount} className="border border-gray-200/50 rounded-lg p-3 bg-white space-y-3" data-add-form>
          <div className="text-xs font-semibold text-text-primary mb-1">New account in {entityName}</div>
          <div className="grid grid-cols-4 gap-2">
            <div>
              <label className="text-[10px] text-text-muted uppercase tracking-wider block mb-1">Family</label>
              <select
                value={addForm.family}
                onChange={e => setAddForm(f => ({ ...f, family: e.target.value as Family }))}
                className="w-full px-2 py-1.5 text-xs border border-gray-200 rounded focus:outline-none focus:ring-1 focus:ring-brand-purple-deep"
                required
              >
                {ACCOUNT_TYPE_ORDER.map(t => (
                  <option key={t} value={t}>{ACCOUNT_TYPE_LABELS[t]} ({FAMILY_RULES[t].balanceType === 'D' ? 'Debit' : 'Credit'}) · {FAMILY_RULES[t].from}–{FAMILY_RULES[t].to}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-[10px] text-text-muted uppercase tracking-wider block mb-1">Code</label>
              <div className="flex items-center">
                {letter && <span className="px-1.5 py-1.5 text-xs font-mono border border-r-0 border-gray-200 rounded-l bg-bg-row text-text-muted" data-code-letter>{letter}-</span>}
                <input
                  type="text"
                  inputMode="numeric"
                  value={addForm.code}
                  onChange={e => setAddForm(f => ({ ...f, code: e.target.value }))}
                  className={`w-full px-2 py-1.5 text-xs border border-gray-200 focus:outline-none focus:ring-1 focus:ring-brand-purple-deep font-mono ${letter ? 'rounded-r' : 'rounded'}`}
                  placeholder={`${FAMILY_RULES[addForm.family].from}–${FAMILY_RULES[addForm.family].to}`}
                  required
                />
              </div>
            </div>
            <div>
              <label className="text-[10px] text-text-muted uppercase tracking-wider block mb-1">Name</label>
              <input
                type="text"
                value={addForm.name}
                onChange={e => setAddForm(f => ({ ...f, name: e.target.value }))}
                className="w-full px-2 py-1.5 text-xs border border-gray-200 rounded focus:outline-none focus:ring-1 focus:ring-brand-purple-deep"
                placeholder="e.g. Finnhub Premium (quarterly plan)"
                required
              />
            </div>
            <div>
              <label className="text-[10px] text-text-muted uppercase tracking-wider block mb-1">Sub (optional)</label>
              <input
                type="text"
                value={addForm.subType}
                onChange={e => setAddForm(f => ({ ...f, subType: e.target.value }))}
                className="w-full px-2 py-1.5 text-xs border border-gray-200 rounded focus:outline-none focus:ring-1 focus:ring-brand-purple-deep font-mono"
                placeholder="e.g. fixed"
              />
            </div>
          </div>
          <p className="text-[11px] text-text-muted font-mono" data-scheme-hint>{addHint}</p>
          {addError && <div className="text-xs text-red-500" role="alert" data-add-error>{addError}</div>}
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={addSaving}
              className="px-3 py-1.5 text-xs font-semibold bg-brand-gold text-white rounded hover:bg-brand-gold/90 disabled:opacity-50"
            >
              {addSaving ? 'Saving...' : 'Save Account'}
            </button>
            <button
              type="button"
              onClick={() => { setShowAddForm(false); setAddError(null); }}
              className="px-3 py-1.5 text-xs font-medium border border-gray-200 text-text-secondary rounded hover:bg-bg-row"
            >
              Cancel
            </button>
          </div>
        </form>
      ) : (
        <button
          onClick={() => setShowAddForm(true)}
          className="px-3 py-1.5 text-xs font-semibold bg-brand-gold text-white rounded hover:bg-brand-gold/90"
          data-add-account
        >
          + Add Account
        </button>
      )}

      {/* COA-01: the ruled seed sets — preview every row's fate, then apply only the absent rows. */}
      {seedSets.length > 0 && (
        <div className="border border-gray-200/50 rounded-lg p-3 bg-white space-y-2" data-seed-panel>
          <div className="text-xs font-semibold text-text-primary">Standard sets for this chart</div>
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={seedKey}
              onChange={e => { setSeedKey(e.target.value); setSeedResult(null); setSeedError(null); }}
              className="px-2 py-1.5 text-xs border border-gray-200 rounded focus:outline-none focus:ring-1 focus:ring-brand-purple-deep"
            >
              <option value="">— pick a set —</option>
              {seedSets.map(s => <option key={s.key} value={s.key}>{s.label}</option>)}
            </select>
            <button type="button" disabled={seedBusy || !seedKey} onClick={() => runSeed(false)} className="px-3 py-1.5 text-xs font-medium border border-gray-200 text-text-secondary rounded hover:bg-bg-row disabled:opacity-50">
              {seedBusy ? '…' : 'Preview'}
            </button>
            <button
              type="button"
              disabled={seedBusy || !seedResult || seedResult.applied || seedResult.counts.create === 0}
              onClick={() => runSeed(true)}
              className="px-3 py-1.5 text-xs font-semibold bg-brand-gold text-white rounded hover:bg-brand-gold/90 disabled:opacity-50"
              title={seedResult && seedResult.counts.create === 0 ? 'Nothing to create — every row exists, collides or is retired' : 'Insert the rows marked create'}
            >
              Apply
            </button>
          </div>
          {seedKey && <p className="text-[11px] text-text-muted">{seedSets.find(s => s.key === seedKey)?.why}</p>}
          {seedError && <div className="text-xs text-red-500" role="alert">{seedError}</div>}
          {seedResult && (
            <div className="space-y-1" data-seed-plan>
              <p className="text-[11px] text-text-secondary">
                {seedResult.applied ? `Applied — created ${seedResult.created.length}.` : 'Preview — nothing written.'}{' '}
                {seedResult.counts.create} to create · {seedResult.counts.exists} already there · {seedResult.counts.collision} collision{seedResult.counts.collision === 1 ? '' : 's'} · {seedResult.counts.retired} retired
              </p>
              <table className="w-full text-[11px]">
                <tbody>
                  {seedResult.plan.map(row => (
                    <tr key={row.code} className="border-t border-gray-200/50" data-seed-row={row.action}>
                      <td className="py-1 font-mono">{deriveAccountString({ entityType, code: row.code, subType: row.subType })}</td>
                      <td className="py-1">{row.name}</td>
                      <td className="py-1">
                        {row.action === 'create' && <span className="text-emerald-700">{seedResult.applied && seedResult.created.includes(row.code) ? 'created' : 'will be created'}</span>}
                        {row.action === 'exists' && <span className="text-text-muted">already there</span>}
                        {row.action === 'retired' && <span className="text-amber-700">retired as &ldquo;{row.existingName}&rdquo; — restore it, it is not re-added</span>}
                        {row.action === 'collision' && <span className="text-red-600">collision — {row.code} is &ldquo;{row.existingName}&rdquo;; not overwritten</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// Individual row with optional group header, the reclassify form and drill-down
function GroupedRow({
  account,
  entityType,
  isFirst,
  type,
  isEditing,
  isExpanded,
  isReclassifying,
  reclassTargets,
  reclassForm,
  reclassSaving,
  reclassError,
  editForm,
  editSaving,
  editError,
  balanceColor,
  rowIndex,
  drilldownLoading,
  drilldownError,
  drilldownTxns,
  allCoaOptions,
  reassigning,
  reassignError,
  archiving,
  onEditFormChange,
  onStartEdit,
  onCancelEdit,
  onSaveEdit,
  onToggleDrilldown,
  onReassign,
  onRetire,
  onRestore,
  onOpenReclass,
  onReclassFormChange,
  onCancelReclass,
  onSubmitReclass,
}: {
  account: COAAccount;
  /** DIM-2: the entity's type (from the parent prop — drives the E segment). */
  entityType: string;
  isFirst: boolean;
  type: string;
  isEditing: boolean;
  isExpanded: boolean;
  isReclassifying: boolean;
  reclassTargets: COAAccount[];
  reclassForm: { toCode: string; amount: string; memo: string; date: string };
  reclassSaving: boolean;
  reclassError: string | null;
  editForm: { code: string; name: string; subType: string };
  editSaving: boolean;
  editError: string | null;
  balanceColor: (type: string) => string;
  rowIndex: number;
  drilldownLoading: boolean;
  drilldownError: string | null;
  drilldownTxns: DrilldownTxn[];
  allCoaOptions: COAAccount[];
  reassigning: string | null;
  reassignError: string | null;
  archiving: string | null;
  onEditFormChange: (f: { code: string; name: string; subType: string }) => void;
  onStartEdit: (account: COAAccount) => void;
  onCancelEdit: () => void;
  onSaveEdit: (id: string) => void;
  onToggleDrilldown: (code: string) => void;
  onReassign: (txnId: string, newCode: string) => void;
  onRetire: (id: string) => void;
  onRestore: (id: string) => void;
  onOpenReclass: (account: COAAccount) => void;
  onReclassFormChange: (f: { toCode: string; amount: string; memo: string; date: string }) => void;
  onCancelReclass: () => void;
  onSubmitReclass: (account: COAAccount) => void;
}) {
  const retired = account.is_archived;
  const hasBalance = (parseInt(account.settledBalance, 10) || 0) !== 0;
  return (
    <>
      {/* Group header */}
      {isFirst && (
        <tr className="bg-bg-row">
          <td colSpan={4} className="px-3 py-1.5">
            <span className="text-[10px] uppercase text-text-muted font-semibold tracking-wider">
              {ACCOUNT_TYPE_LABELS[type] || type}
            </span>
          </td>
        </tr>
      )}
      {/* Account row */}
      <tr className={`${rowIndex % 2 === 0 ? 'bg-white' : 'bg-bg-row/50'}${retired ? ' opacity-70' : ''}`} data-account={account.code} data-retired={retired ? 'true' : undefined}>
        <td className="px-3 py-2 font-mono text-xs">
          {isEditing ? (
            <div>
              <input
                type="text"
                value={editForm.code}
                onChange={e => onEditFormChange({ ...editForm, code: e.target.value })}
                className="w-20 px-1.5 py-1 text-xs border border-gray-200 rounded focus:outline-none focus:ring-1 focus:ring-brand-purple-deep font-mono"
              />
              <div className="text-[9px] text-amber-600 mt-0.5">Changing codes affects categorization mappings</div>
            </div>
          ) : (
            /* DIM-2: the DERIVED dimensional string (E-A-S, from structured
               parts — never stored). Title shows the raw code for clarity. */
            <span title={`code ${account.code}`}>
              {deriveAccountString({ entityType, code: account.code, subType: account.subType })}
            </span>
          )}
        </td>
        <td className="px-3 py-2 text-xs text-text-primary">
          {isEditing ? (
            <div className="space-y-1">
              <input
                type="text"
                value={editForm.name}
                onChange={e => onEditFormChange({ ...editForm, name: e.target.value })}
                className="w-full px-1.5 py-1 text-xs border border-gray-200 rounded focus:outline-none focus:ring-1 focus:ring-brand-purple-deep"
              />
              <input
                type="text"
                value={editForm.subType}
                onChange={e => onEditFormChange({ ...editForm, subType: e.target.value })}
                placeholder="sub (optional, e.g. fixed)"
                className="w-full px-1.5 py-1 text-xs border border-gray-200 rounded focus:outline-none focus:ring-1 focus:ring-brand-purple-deep font-mono"
              />
            </div>
          ) : (
            <>
              {account.name}
              {retired && <span className="ml-2 rounded border border-amber-300 bg-amber-50 px-1.5 py-0.5 text-[9px] font-mono uppercase tracking-wider text-amber-700">retired</span>}
            </>
          )}
        </td>
        <td className={`px-3 py-2 text-right font-mono font-semibold text-xs ${balanceColor(account.accountType)}`}>
          <button
            onClick={() => onToggleDrilldown(account.code)}
            className="cursor-pointer hover:underline hover:text-brand-purple-deep transition-colors"
            title="Click to view transactions"
          >
            {formatCurrency(account.settledBalance)}
          </button>
        </td>
        <td className="px-3 py-2 text-right">
          {isEditing ? (
            <div className="flex items-center justify-end gap-1.5">
              {editError && <span className="text-[10px] text-red-500 mr-1" role="alert">{editError}</span>}
              <button
                onClick={() => onSaveEdit(account.id)}
                disabled={editSaving}
                className="px-2 py-1 text-[10px] font-semibold bg-emerald-500 text-white rounded hover:bg-emerald-600 disabled:opacity-50"
              >
                {editSaving ? '...' : 'Save'}
              </button>
              <button
                onClick={onCancelEdit}
                className="px-2 py-1 text-[10px] font-medium border border-gray-200 text-text-secondary rounded hover:bg-bg-row"
              >
                Cancel
              </button>
            </div>
          ) : retired ? (
            <div className="flex items-center justify-end gap-1.5">
              {hasBalance && (
                <button
                  onClick={() => onOpenReclass(account)}
                  className="px-2 py-1 text-[10px] font-medium border border-gray-200 text-text-secondary rounded hover:bg-bg-row"
                  title="Move this balance to another account with a new journal entry"
                >
                  Reclassify
                </button>
              )}
              <button
                onClick={() => onRestore(account.id)}
                disabled={archiving === account.id}
                className="px-2 py-1 text-[10px] font-medium border border-gray-200 text-text-muted rounded hover:bg-bg-row disabled:opacity-50"
                title="Restore this account to the working chart"
              >
                {archiving === account.id ? '...' : 'Restore'}
              </button>
            </div>
          ) : (
            <div className="flex items-center justify-end gap-1.5">
              <button
                onClick={() => onStartEdit(account)}
                className="px-2 py-1 text-[10px] font-medium border border-gray-200 text-text-secondary rounded hover:bg-bg-row"
              >
                Edit
              </button>
              <button
                onClick={() => onOpenReclass(account)}
                disabled={!hasBalance}
                className="px-2 py-1 text-[10px] font-medium border border-gray-200 text-text-secondary rounded hover:bg-bg-row disabled:opacity-40"
                title={hasBalance ? 'Move this balance to another account with a new journal entry' : 'Nothing to move — zero balance'}
              >
                Reclassify
              </button>
              {/* Retire-only removal — never delete. */}
              <button
                onClick={() => onRetire(account.id)}
                disabled={archiving === account.id}
                className="px-2 py-1 text-[10px] font-medium border border-gray-200 text-text-muted rounded hover:bg-bg-row disabled:opacity-50"
                title="Retire this account — it leaves categorization; its balance and history stay"
              >
                {archiving === account.id ? '...' : 'Retire'}
              </button>
            </div>
          )}
        </td>
      </tr>
      {/* Reclassify form — a NEW journal entry; nothing old is edited. */}
      {isReclassifying && (
        <tr>
          <td colSpan={4} className="p-0">
            <form
              onSubmit={(e) => { e.preventDefault(); onSubmitReclass(account); }}
              className="bg-amber-50/60 border-l-4 border-brand-gold px-4 py-3 space-y-2"
              data-reclass-form={account.code}
            >
              <div className="text-xs font-semibold text-text-primary">
                Reclassify {deriveAccountString({ entityType, code: account.code, subType: account.subType })} — posts a new journal entry with your memo; the old entries stay as they are.
              </div>
              <div className="grid grid-cols-4 gap-2">
                <div>
                  <label className="text-[10px] text-text-muted uppercase tracking-wider block mb-1">To account (same family)</label>
                  <select
                    value={reclassForm.toCode}
                    onChange={e => onReclassFormChange({ ...reclassForm, toCode: e.target.value })}
                    className="w-full px-2 py-1.5 text-xs border border-gray-200 rounded focus:outline-none focus:ring-1 focus:ring-brand-purple-deep"
                    required
                  >
                    <option value="">— pick —</option>
                    {reclassTargets.map(t => (
                      <option key={t.id} value={t.code}>{deriveAccountString({ entityType, code: t.code, subType: t.subType })} — {t.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-[10px] text-text-muted uppercase tracking-wider block mb-1">Amount (USD)</label>
                  <input
                    type="number" step="0.01" min="0.01"
                    value={reclassForm.amount}
                    onChange={e => onReclassFormChange({ ...reclassForm, amount: e.target.value })}
                    className="w-full px-2 py-1.5 text-xs border border-gray-200 rounded focus:outline-none focus:ring-1 focus:ring-brand-purple-deep font-mono"
                    required
                  />
                </div>
                <div>
                  <label className="text-[10px] text-text-muted uppercase tracking-wider block mb-1">Date</label>
                  <input
                    type="date"
                    value={reclassForm.date}
                    onChange={e => onReclassFormChange({ ...reclassForm, date: e.target.value })}
                    className="w-full px-2 py-1.5 text-xs border border-gray-200 rounded focus:outline-none focus:ring-1 focus:ring-brand-purple-deep font-mono"
                    required
                  />
                </div>
                <div>
                  <label className="text-[10px] text-text-muted uppercase tracking-wider block mb-1">Memo</label>
                  <input
                    type="text"
                    value={reclassForm.memo}
                    onChange={e => onReclassFormChange({ ...reclassForm, memo: e.target.value })}
                    placeholder="why the balance moves"
                    className="w-full px-2 py-1.5 text-xs border border-gray-200 rounded focus:outline-none focus:ring-1 focus:ring-brand-purple-deep"
                    required
                  />
                </div>
              </div>
              {reclassError && <div className="text-xs text-red-500" role="alert" data-reclass-error>{reclassError}</div>}
              <div className="flex gap-2">
                <button type="submit" disabled={reclassSaving} className="px-3 py-1.5 text-xs font-semibold bg-brand-gold text-white rounded hover:bg-brand-gold/90 disabled:opacity-50">
                  {reclassSaving ? 'Posting…' : 'Post reclassification'}
                </button>
                <button type="button" onClick={onCancelReclass} className="px-3 py-1.5 text-xs font-medium border border-gray-200 text-text-secondary rounded hover:bg-bg-row">
                  Cancel
                </button>
              </div>
            </form>
          </td>
        </tr>
      )}
      {/* Drill-down panel */}
      {isExpanded && (
        <tr>
          <td colSpan={4} className="p-0">
            <div className="bg-brand-purple/5 border-l-4 border-brand-purple px-4 py-3">
              {drilldownLoading ? (
                <div className="flex items-center gap-2 py-2">
                  <div className="w-4 h-4 border-2 border-brand-purple border-t-transparent rounded-full animate-spin" />
                  <span className="text-xs text-text-muted">Loading transactions...</span>
                </div>
              ) : drilldownError ? (
                <div className="text-xs text-red-500 py-2" role="alert">{drilldownError}</div>
              ) : drilldownTxns.length === 0 ? (
                <div className="text-xs text-text-muted py-2">No transactions assigned to this account.</div>
              ) : (
                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-text-muted">
                      <th className="text-left pb-1.5 font-medium">Date</th>
                      <th className="text-left pb-1.5 font-medium">Merchant</th>
                      <th className="text-left pb-1.5 font-medium">Description</th>
                      <th className="text-right pb-1.5 font-medium">Amount</th>
                      <th className="text-right pb-1.5 font-medium w-[180px]">Reassign COA</th>
                    </tr>
                  </thead>
                  <tbody>
                    {drilldownTxns.map(txn => (
                      <tr key={txn.id} className="border-t border-gray-200/50">
                        <td className="py-1.5 font-mono text-text-secondary">{formatDate(txn.date)}</td>
                        <td className="py-1.5 text-text-primary">{txn.merchantName || '—'}</td>
                        <td className="py-1.5 text-text-muted truncate max-w-[200px]">{txn.name}</td>
                        <td className="py-1.5 text-right font-mono font-semibold">{formatAmount(txn.amount)}</td>
                        <td className="py-1.5 text-right">
                          <select
                            value={txn.accountCode || ''}
                            disabled={reassigning === txn.id}
                            onChange={e => { if (e.target.value && e.target.value !== txn.accountCode) onReassign(txn.id, e.target.value); }}
                            className="text-[10px] border border-gray-200 rounded px-1.5 py-0.5 bg-white focus:outline-none focus:ring-1 focus:ring-brand-purple-deep disabled:opacity-50 max-w-[170px]"
                          >
                            {allCoaOptions.map(opt => (
                              <option key={opt.id} value={opt.code}>{opt.code} - {opt.name}</option>
                            ))}
                          </select>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
              {reassignError && <div className="text-xs text-red-500 pt-2" role="alert">{reassignError}</div>}
            </div>
          </td>
        </tr>
      )}
    </>
  );
}
