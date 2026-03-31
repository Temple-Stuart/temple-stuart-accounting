'use client';

import { useState, useEffect, useCallback } from 'react';

interface COAManagementTableProps {
  entityId: string;
  entityName: string;
  entityType: string;
}

interface COAAccount {
  id: string;
  code: string;
  name: string;
  accountType: string;
  balanceType: string;
  settledBalance: string;
  pendingBalance: string;
  entityId: string;
  entityType: string;
}

interface DrilldownTxn {
  id: string;
  date: string;
  merchantName: string | null;
  name: string;
  amount: number;
  accountCode: string | null;
}

const ACCOUNT_TYPE_ORDER = ['asset', 'liability', 'equity', 'revenue', 'expense'];
const ACCOUNT_TYPE_LABELS: Record<string, string> = {
  asset: 'Assets',
  liability: 'Liabilities',
  equity: 'Equity',
  revenue: 'Revenue',
  expense: 'Expenses',
};

const BALANCE_TYPE_MAP: Record<string, string> = {
  asset: 'D', expense: 'D', liability: 'C', equity: 'C', revenue: 'C',
};

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

export default function COAManagementTable({ entityId, entityName, entityType }: COAManagementTableProps) {
  const [accounts, setAccounts] = useState<COAAccount[]>([]);
  const [allCoaOptions, setAllCoaOptions] = useState<COAAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showZeroBalances, setShowZeroBalances] = useState(false);

  // Inline edit state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({ code: '', name: '' });
  const [editSaving, setEditSaving] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  // Add new account state
  const [showAddForm, setShowAddForm] = useState(false);
  const [addForm, setAddForm] = useState({ code: '', name: '', accountType: 'expense' });
  const [addSaving, setAddSaving] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);

  // Drill-down state
  const [expandedCode, setExpandedCode] = useState<string | null>(null);
  const [drilldownTxns, setDrilldownTxns] = useState<DrilldownTxn[]>([]);
  const [drilldownLoading, setDrilldownLoading] = useState(false);
  const [reassigning, setReassigning] = useState<string | null>(null);

  const fetchAccounts = useCallback(async () => {
    try {
      setError(null);
      const res = await fetch(`/api/chart-of-accounts/balances?entityId=${entityId}`);
      if (!res.ok) throw new Error('Failed to fetch accounts');
      const data = await res.json();
      setAccounts(data.accounts || []);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [entityId]);

  // Fetch all COA options for reassignment dropdown
  const fetchAllCoa = useCallback(async () => {
    try {
      const res = await fetch(`/api/chart-of-accounts?entity_id=${entityId}`);
      if (res.ok) {
        const data = await res.json();
        setAllCoaOptions(data.accounts || []);
      }
    } catch (err) { /* silent */ }
  }, [entityId]);

  useEffect(() => { fetchAccounts(); fetchAllCoa(); }, [fetchAccounts, fetchAllCoa]);

  const nonZeroAccounts = accounts.filter(a => parseInt(a.settledBalance, 10) !== 0);
  const zeroCount = accounts.length - nonZeroAccounts.length;
  const displayAccounts = showZeroBalances ? accounts : nonZeroAccounts;

  const grouped = ACCOUNT_TYPE_ORDER.reduce<Record<string, COAAccount[]>>((acc, type) => {
    const items = displayAccounts.filter(a => a.accountType === type);
    if (items.length > 0) acc[type] = items;
    return acc;
  }, {});

  const startEdit = (account: COAAccount) => {
    setEditingId(account.id);
    setEditForm({ code: account.code, name: account.name });
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
        body: JSON.stringify({ code: editForm.code, name: editForm.name }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to update');
      }
      setEditingId(null);
      await fetchAccounts();
    } catch (err: any) {
      setEditError(err.message);
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
          accountType: addForm.accountType,
          entityId,
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to create account');
      }
      setShowAddForm(false);
      setAddForm({ code: '', name: '', accountType: 'expense' });
      await fetchAccounts();
      await fetchAllCoa();
    } catch (err: any) {
      setAddError(err.message);
    } finally {
      setAddSaving(false);
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
    try {
      const res = await fetch(`/api/transactions?accountCode=${encodeURIComponent(code)}&entityId=${encodeURIComponent(entityId)}`);
      if (res.ok) {
        const data = await res.json();
        setDrilldownTxns(data.transactions || []);
      }
    } catch (err) { /* silent */ }
    finally { setDrilldownLoading(false); }
  };

  const reassignTransaction = async (txnId: string, newCode: string) => {
    setReassigning(txnId);
    try {
      const res = await fetch('/api/transactions/assign-coa', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ transactionIds: [txnId], accountCode: newCode }),
      });
      if (res.ok) {
        // Refresh drilldown and balances
        if (expandedCode) await toggleDrilldown(expandedCode);
        await fetchAccounts();
      }
    } catch (err) { /* silent */ }
    finally { setReassigning(null); }
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
      <div className="text-center py-8 text-sm text-red-500">
        Failed to load chart of accounts: {error}
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="border border-gray-200/50 rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50">
              <th className="text-left px-3 py-2 text-xs font-semibold text-text-secondary">Code</th>
              <th className="text-left px-3 py-2 text-xs font-semibold text-text-secondary">Account Name</th>
              <th className="text-right px-3 py-2 text-xs font-semibold text-text-secondary">Balance</th>
              <th className="text-right px-3 py-2 text-xs font-semibold text-text-secondary w-[100px]">Actions</th>
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
                    isFirst={isFirst}
                    type={type}
                    isEditing={isEditing}
                    isExpanded={isExpanded}
                    editForm={editForm}
                    editSaving={editSaving}
                    editError={editError}
                    balanceColor={balanceColor}
                    rowIndex={i}
                    drilldownLoading={drilldownLoading}
                    drilldownTxns={drilldownTxns}
                    allCoaOptions={allCoaOptions}
                    reassigning={reassigning}
                    onEditFormChange={setEditForm}
                    onStartEdit={startEdit}
                    onCancelEdit={cancelEdit}
                    onSaveEdit={saveEdit}
                    onToggleDrilldown={toggleDrilldown}
                    onReassign={reassignTransaction}
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

      {/* Add Account Form */}
      {showAddForm ? (
        <form onSubmit={addAccount} className="border border-gray-200/50 rounded-lg p-3 bg-white space-y-3">
          <div className="text-xs font-semibold text-text-primary mb-1">New Account</div>
          <div className="grid grid-cols-3 gap-2">
            <div>
              <label className="text-[10px] text-text-muted uppercase tracking-wider block mb-1">Code</label>
              <input
                type="text"
                value={addForm.code}
                onChange={e => setAddForm(f => ({ ...f, code: e.target.value }))}
                className="w-full px-2 py-1.5 text-xs border border-gray-200 rounded focus:outline-none focus:ring-1 focus:ring-brand-purple-deep"
                placeholder="e.g. 5030"
                required
              />
            </div>
            <div>
              <label className="text-[10px] text-text-muted uppercase tracking-wider block mb-1">Name</label>
              <input
                type="text"
                value={addForm.name}
                onChange={e => setAddForm(f => ({ ...f, name: e.target.value }))}
                className="w-full px-2 py-1.5 text-xs border border-gray-200 rounded focus:outline-none focus:ring-1 focus:ring-brand-purple-deep"
                placeholder="e.g. Office Supplies"
                required
              />
            </div>
            <div>
              <label className="text-[10px] text-text-muted uppercase tracking-wider block mb-1">Type</label>
              <select
                value={addForm.accountType}
                onChange={e => setAddForm(f => ({ ...f, accountType: e.target.value }))}
                className="w-full px-2 py-1.5 text-xs border border-gray-200 rounded focus:outline-none focus:ring-1 focus:ring-brand-purple-deep"
              >
                {ACCOUNT_TYPE_ORDER.map(t => (
                  <option key={t} value={t}>{ACCOUNT_TYPE_LABELS[t]} ({BALANCE_TYPE_MAP[t] === 'D' ? 'Debit' : 'Credit'})</option>
                ))}
              </select>
            </div>
          </div>
          {addError && <div className="text-xs text-red-500">{addError}</div>}
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
        >
          + Add Account
        </button>
      )}
    </div>
  );
}

// Individual row with optional group header and drill-down
function GroupedRow({
  account,
  isFirst,
  type,
  isEditing,
  isExpanded,
  editForm,
  editSaving,
  editError,
  balanceColor,
  rowIndex,
  drilldownLoading,
  drilldownTxns,
  allCoaOptions,
  reassigning,
  onEditFormChange,
  onStartEdit,
  onCancelEdit,
  onSaveEdit,
  onToggleDrilldown,
  onReassign,
}: {
  account: COAAccount;
  isFirst: boolean;
  type: string;
  isEditing: boolean;
  isExpanded: boolean;
  editForm: { code: string; name: string };
  editSaving: boolean;
  editError: string | null;
  balanceColor: (type: string) => string;
  rowIndex: number;
  drilldownLoading: boolean;
  drilldownTxns: DrilldownTxn[];
  allCoaOptions: COAAccount[];
  reassigning: string | null;
  onEditFormChange: (f: { code: string; name: string }) => void;
  onStartEdit: (account: COAAccount) => void;
  onCancelEdit: () => void;
  onSaveEdit: (id: string) => void;
  onToggleDrilldown: (code: string) => void;
  onReassign: (txnId: string, newCode: string) => void;
}) {
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
      <tr className={rowIndex % 2 === 0 ? 'bg-white' : 'bg-bg-row/50'}>
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
            account.code
          )}
        </td>
        <td className="px-3 py-2 text-xs text-text-primary">
          {isEditing ? (
            <input
              type="text"
              value={editForm.name}
              onChange={e => onEditFormChange({ ...editForm, name: e.target.value })}
              className="w-full px-1.5 py-1 text-xs border border-gray-200 rounded focus:outline-none focus:ring-1 focus:ring-brand-purple-deep"
            />
          ) : (
            account.name
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
              {editError && <span className="text-[10px] text-red-500 mr-1">{editError}</span>}
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
          ) : (
            <button
              onClick={() => onStartEdit(account)}
              className="px-2 py-1 text-[10px] font-medium border border-gray-200 text-text-secondary rounded hover:bg-bg-row"
            >
              Edit
            </button>
          )}
        </td>
      </tr>
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
                        <td className="py-1.5 text-text-primary">{txn.merchantName || '\u2014'}</td>
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
            </div>
          </td>
        </tr>
      )}
    </>
  );
}
