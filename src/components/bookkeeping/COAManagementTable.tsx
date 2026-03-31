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

export default function COAManagementTable({ entityId, entityName, entityType }: COAManagementTableProps) {
  const [accounts, setAccounts] = useState<COAAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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

  useEffect(() => { fetchAccounts(); }, [fetchAccounts]);

  const grouped = ACCOUNT_TYPE_ORDER.reduce<Record<string, COAAccount[]>>((acc, type) => {
    const items = accounts.filter(a => a.accountType === type);
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
    } catch (err: any) {
      setAddError(err.message);
    } finally {
      setAddSaving(false);
    }
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
    <div className="space-y-1">
      <div className="flex items-center justify-between mb-3">
        <div>
          <h3 className="text-sm font-semibold text-text-primary">Chart of Accounts</h3>
          <p className="text-xs text-text-muted">{entityName} — {accounts.length} accounts</p>
        </div>
      </div>

      <div className="border border-gray-200/50 rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50">
              <th className="text-left px-3 py-2 text-xs font-semibold text-text-secondary">Code</th>
              <th className="text-left px-3 py-2 text-xs font-semibold text-text-secondary">Account Name</th>
              <th className="text-right px-3 py-2 text-xs font-semibold text-text-secondary">Balance</th>
              <th className="text-right px-3 py-2 text-xs font-semibold text-text-secondary w-[140px]">Actions</th>
            </tr>
          </thead>
          <tbody>
            {Object.entries(grouped).map(([type, items]) => (
              <GroupRows
                key={type}
                type={type}
                items={items}
                editingId={editingId}
                editForm={editForm}
                editSaving={editSaving}
                editError={editError}
                balanceColor={balanceColor}
                onEditFormChange={setEditForm}
                onStartEdit={startEdit}
                onCancelEdit={cancelEdit}
                onSaveEdit={saveEdit}
              />
            ))}
            {accounts.length === 0 && (
              <tr>
                <td colSpan={4} className="text-center py-6 text-xs text-text-muted">
                  No accounts found for this entity. Add one below.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

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

      {/* Reassignment guidance */}
      <div className="mt-3 px-3 py-2 bg-amber-50 border border-amber-200/50 rounded text-[11px] text-amber-800">
        <span className="font-semibold">Reassign transactions?</span>{' '}
        To move transactions to a different COA, go to the Categorize section — switch to the Committed tab, find the transactions, uncommit them, then reassign and recommit.
      </div>
    </div>
  );
}

// Sub-component for grouped rows
function GroupRows({
  type,
  items,
  editingId,
  editForm,
  editSaving,
  editError,
  balanceColor,
  onEditFormChange,
  onStartEdit,
  onCancelEdit,
  onSaveEdit,
}: {
  type: string;
  items: COAAccount[];
  editingId: string | null;
  editForm: { code: string; name: string };
  editSaving: boolean;
  editError: string | null;
  balanceColor: (type: string) => string;
  onEditFormChange: (f: { code: string; name: string }) => void;
  onStartEdit: (account: COAAccount) => void;
  onCancelEdit: () => void;
  onSaveEdit: (id: string) => void;
}) {
  return (
    <>
      <tr className="bg-bg-row">
        <td colSpan={4} className="px-3 py-1.5">
          <span className="text-[10px] uppercase text-text-muted font-semibold tracking-wider">
            {ACCOUNT_TYPE_LABELS[type] || type}
          </span>
        </td>
      </tr>
      {items.map((account, i) => {
        const isEditing = editingId === account.id;
        return (
          <tr key={account.id} className={i % 2 === 0 ? 'bg-white' : 'bg-bg-row/50'}>
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
              {formatCurrency(account.settledBalance)}
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
                <div className="flex items-center justify-end gap-1.5">
                  <button
                    onClick={() => onStartEdit(account)}
                    className="px-2 py-1 text-[10px] font-medium border border-gray-200 text-text-secondary rounded hover:bg-bg-row"
                  >
                    Edit
                  </button>
                  <span className="px-2 py-1 text-[10px] font-medium text-text-muted">
                    View Txns
                  </span>
                </div>
              )}
            </td>
          </tr>
        );
      })}
    </>
  );
}
