'use client';

import { useState, useEffect, useMemo, useCallback, useRef, Fragment } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { Button, Badge } from '@/components/ui';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface CoaOption {
  id: string;
  code: string;
  name: string;
  accountType: string;
  balanceType: string;
  entity_type?: string | null;
}

export interface SpendingTransaction {
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
  predicted_coa_code: string | null;
  prediction_confidence: number | null;
  review_status: string;
  manually_overridden: boolean;
  createdAt: string;
  updatedAt: string;
}

interface SpendingTabProps {
  transactions: SpendingTransaction[];
  committedTransactions: SpendingTransaction[];
  coaOptions: CoaOption[];
  onReload: () => Promise<void>;
}

type SortField = 'date' | 'merchantName' | 'name' | 'amount' | 'payment_channel' | 'category' | 'accountName' | 'institutionName' | 'predicted_coa_code';
type SortDir = 'asc' | 'desc';

interface ActiveFilters {
  search: string;
  merchants: string[];
  categories: string[];
  accounts: string[];
  channels: string[];
  dateFrom: string;
  dateTo: string;
  amountMin: string;
  amountMax: string;
}

const EMPTY_FILTERS: ActiveFilters = {
  search: '',
  merchants: [],
  categories: [],
  accounts: [],
  channels: [],
  dateFrom: '',
  dateTo: '',
  amountMin: '',
  amountMax: '',
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatDate(d: string) {
  const dt = new Date(d);
  return `${String(dt.getMonth() + 1).padStart(2, '0')}/${String(dt.getDate()).padStart(2, '0')}/${dt.getFullYear()}`;
}

function formatMoney(n: number) {
  return '$' + Math.abs(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function channelLabel(ch: string | null): string {
  if (!ch) return 'Other';
  if (ch === 'in store') return 'In Store';
  if (ch === 'online') return 'Online';
  return ch.charAt(0).toUpperCase() + ch.slice(1);
}

function channelColor(ch: string | null): string {
  if (!ch) return 'bg-gray-100 text-gray-600';
  if (ch === 'in store') return 'bg-blue-100 text-blue-700';
  if (ch === 'online') return 'bg-purple-100 text-purple-700';
  return 'bg-gray-100 text-gray-600';
}

function confidenceDot(conf: number | null): string {
  if (conf === null) return '';
  if (conf >= 0.7) return 'bg-green-500';
  if (conf >= 0.4) return 'bg-yellow-500';
  return 'bg-red-500';
}

function matchesSearch(txn: SpendingTransaction, term: string): boolean {
  const lower = term.toLowerCase();
  return (
    txn.name.toLowerCase().includes(lower) ||
    (txn.merchantName?.toLowerCase().includes(lower) ?? false) ||
    (txn.personal_finance_category?.primary?.toLowerCase().includes(lower) ?? false) ||
    (txn.personal_finance_category?.detailed?.toLowerCase().includes(lower) ?? false)
  );
}

function applyFilters(txns: SpendingTransaction[], filters: ActiveFilters): SpendingTransaction[] {
  let result = txns;
  if (filters.search) {
    result = result.filter(t => matchesSearch(t, filters.search));
  }
  if (filters.merchants.length > 0) {
    result = result.filter(t => filters.merchants.includes(t.merchantName || t.name));
  }
  if (filters.categories.length > 0) {
    result = result.filter(t => filters.categories.includes(t.personal_finance_category?.primary || 'Other'));
  }
  if (filters.accounts.length > 0) {
    result = result.filter(t => filters.accounts.includes(t.accountName || 'Unknown'));
  }
  if (filters.channels.length > 0) {
    result = result.filter(t => filters.channels.includes(t.payment_channel || 'other'));
  }
  if (filters.dateFrom) {
    const from = new Date(filters.dateFrom);
    result = result.filter(t => new Date(t.date) >= from);
  }
  if (filters.dateTo) {
    const to = new Date(filters.dateTo);
    to.setHours(23, 59, 59, 999);
    result = result.filter(t => new Date(t.date) <= to);
  }
  if (filters.amountMin) {
    const min = parseFloat(filters.amountMin);
    if (!isNaN(min)) result = result.filter(t => Math.abs(t.amount) >= min);
  }
  if (filters.amountMax) {
    const max = parseFloat(filters.amountMax);
    if (!isNaN(max)) result = result.filter(t => Math.abs(t.amount) <= max);
  }
  return result;
}

function sortTransactions(txns: SpendingTransaction[], field: SortField, dir: SortDir): SpendingTransaction[] {
  const sorted = [...txns];
  sorted.sort((a, b) => {
    let cmp = 0;
    switch (field) {
      case 'date': cmp = new Date(a.date).getTime() - new Date(b.date).getTime(); break;
      case 'merchantName': cmp = (a.merchantName || a.name).localeCompare(b.merchantName || b.name); break;
      case 'name': cmp = a.name.localeCompare(b.name); break;
      case 'amount': cmp = Math.abs(a.amount) - Math.abs(b.amount); break;
      case 'payment_channel': cmp = (a.payment_channel || '').localeCompare(b.payment_channel || ''); break;
      case 'category': cmp = (a.personal_finance_category?.primary || '').localeCompare(b.personal_finance_category?.primary || ''); break;
      case 'accountName': cmp = (a.accountName || '').localeCompare(b.accountName || ''); break;
      case 'institutionName': cmp = (a.institutionName || '').localeCompare(b.institutionName || ''); break;
      case 'predicted_coa_code': cmp = (a.predicted_coa_code || '').localeCompare(b.predicted_coa_code || ''); break;
    }
    return dir === 'asc' ? cmp : -cmp;
  });
  return sorted;
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function MultiSelectFilter({ label, options, selected, onToggle }: {
  label: string;
  options: [string, number][];
  selected: string[];
  onToggle: (val: string) => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className={`px-3 py-1.5 text-xs border rounded-lg flex items-center gap-1 transition-colors ${
          selected.length > 0 ? 'bg-[#2d1b4e] text-white border-[#2d1b4e]' : 'bg-white hover:border-gray-400'
        }`}
      >
        {label} {selected.length > 0 && <span className="px-1 py-0.5 bg-white/20 rounded text-[10px]">{selected.length}</span>}
        <span className="text-[10px]">{open ? '▲' : '▼'}</span>
      </button>
      {open && (
        <div className="absolute z-30 top-full mt-1 left-0 bg-white border border-gray-200 rounded-lg shadow-lg max-h-60 overflow-auto min-w-[200px]">
          {options.map(([val, count]) => (
            <label key={val} className="flex items-center gap-2 px-3 py-1.5 hover:bg-gray-50 cursor-pointer text-xs">
              <input
                type="checkbox"
                checked={selected.includes(val)}
                onChange={() => onToggle(val)}
                className="w-3.5 h-3.5 rounded"
              />
              <span className="truncate flex-1">{val}</span>
              <span className="text-gray-400 text-[10px]">{count}</span>
            </label>
          ))}
        </div>
      )}
    </div>
  );
}

function SortHeader({ label, field, currentField, currentDir, onSort, className = '' }: {
  label: string;
  field: SortField;
  currentField: SortField;
  currentDir: SortDir;
  onSort: (f: SortField) => void;
  className?: string;
}) {
  const isActive = currentField === field;
  return (
    <th
      className={`px-2 py-2.5 text-xs font-semibold cursor-pointer select-none hover:bg-[#3d2b5e] transition-colors ${className}`}
      onClick={() => onSort(field)}
    >
      <span className="flex items-center gap-1">
        {label}
        {isActive && <span className="text-[10px]">{currentDir === 'asc' ? '▲' : '▼'}</span>}
      </span>
    </th>
  );
}

function CreateCoaModal({ onClose, onCreate }: {
  onClose: () => void;
  onCreate: (account: CoaOption) => void;
}) {
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [accountType, setAccountType] = useState('expense');
  const [entityType, setEntityType] = useState('personal');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleCreate = async () => {
    if (!code || !name) { setError('Code and Name are required'); return; }
    setSaving(true);
    setError('');
    try {
      const res = await fetch('/api/chart-of-accounts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code, name, accountType, entityType })
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || 'Failed to create'); setSaving(false); return; }
      onCreate(data.account);
      onClose();
    } catch {
      setError('Network error');
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md" onClick={e => e.stopPropagation()}>
        <div className="bg-[#2d1b4e] text-white px-4 py-3 rounded-t-lg flex items-center justify-between">
          <span className="text-sm font-semibold">Create New COA Account</span>
          <button onClick={onClose} className="text-white/60 hover:text-white text-lg">×</button>
        </div>
        <div className="p-4 space-y-3">
          {error && <div className="text-xs text-red-600 bg-red-50 px-3 py-2 rounded">{error}</div>}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Account Code</label>
            <input value={code} onChange={e => setCode(e.target.value)} placeholder="e.g. P-6100" className="w-full px-3 py-2 border rounded-lg text-sm" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Account Name</label>
            <input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Office Supplies" className="w-full px-3 py-2 border rounded-lg text-sm" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Account Type</label>
              <select value={accountType} onChange={e => setAccountType(e.target.value)} className="w-full px-3 py-2 border rounded-lg text-sm">
                <option value="expense">Expense</option>
                <option value="revenue">Revenue</option>
                <option value="asset">Asset</option>
                <option value="liability">Liability</option>
                <option value="equity">Equity</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Entity Type</label>
              <select value={entityType} onChange={e => setEntityType(e.target.value)} className="w-full px-3 py-2 border rounded-lg text-sm">
                <option value="personal">Personal</option>
                <option value="business">Business</option>
                <option value="trading">Trading</option>
              </select>
            </div>
          </div>
        </div>
        <div className="px-4 pb-4 flex justify-end gap-2">
          <Button variant="ghost" size="sm" onClick={onClose}>Cancel</Button>
          <Button size="sm" loading={saving} onClick={handleCreate}>Create</Button>
        </div>
      </div>
    </div>
  );
}

// ─── Virtualized Table ───────────────────────────────────────────────────────

function VirtualTable({
  rows,
  coaOptions,
  coaGroupedByEntity,
  selected,
  setSelected,
  rowChanges,
  setRowChanges,
  sortField,
  sortDir,
  onSort,
  variant,
  coaLookup,
}: {
  rows: SpendingTransaction[];
  coaOptions: CoaOption[];
  coaGroupedByEntity: Record<string, CoaOption[]>;
  selected: Set<string>;
  setSelected: (fn: (prev: Set<string>) => Set<string>) => void;
  rowChanges: Record<string, { coa: string; sub: string }>;
  setRowChanges: React.Dispatch<React.SetStateAction<Record<string, { coa: string; sub: string }>>>;
  sortField: SortField;
  sortDir: SortDir;
  onSort: (f: SortField) => void;
  variant: 'pending' | 'committed';
  coaLookup: Map<string, CoaOption>;
}) {
  const parentRef = useRef<HTMLDivElement>(null);
  const ROW_HEIGHT = 48;

  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: 20,
  });

  const allSelected = rows.length > 0 && rows.every(r => selected.has(r.id));

  const toggleAll = () => {
    if (allSelected) {
      setSelected(prev => {
        const next = new Set(prev);
        rows.forEach(r => next.delete(r.id));
        return next;
      });
    } else {
      setSelected(prev => {
        const next = new Set(prev);
        rows.forEach(r => next.add(r.id));
        return next;
      });
    }
  };

  const toggleOne = (id: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  return (
    <div ref={parentRef} className="overflow-auto" style={{ maxHeight: '600px' }}>
      <table className="w-full text-xs border-collapse min-w-[1200px]">
        <thead className="bg-[#2d1b4e] text-white sticky top-0 z-10">
          <tr>
            <th className="px-2 py-2.5 w-10 sticky left-0 bg-[#2d1b4e] z-20">
              <input type="checkbox" checked={allSelected} onChange={toggleAll} className="w-3.5 h-3.5 rounded" />
            </th>
            <SortHeader label="Date" field="date" currentField={sortField} currentDir={sortDir} onSort={onSort} className="w-24" />
            <SortHeader label="Merchant" field="merchantName" currentField={sortField} currentDir={sortDir} onSort={onSort} className="min-w-[130px]" />
            <SortHeader label="Description" field="name" currentField={sortField} currentDir={sortDir} onSort={onSort} className="min-w-[200px]" />
            <SortHeader label="Amount" field="amount" currentField={sortField} currentDir={sortDir} onSort={onSort} className="w-24 text-right" />
            <SortHeader label="Channel" field="payment_channel" currentField={sortField} currentDir={sortDir} onSort={onSort} className="w-20" />
            <SortHeader label="Category" field="category" currentField={sortField} currentDir={sortDir} onSort={onSort} className="w-28" />
            <SortHeader label="Account" field="accountName" currentField={sortField} currentDir={sortDir} onSort={onSort} className="w-28" />
            <SortHeader label="Institution" field="institutionName" currentField={sortField} currentDir={sortDir} onSort={onSort} className="w-28" />
            {variant === 'pending' && (
              <SortHeader label="AI Suggestion" field="predicted_coa_code" currentField={sortField} currentDir={sortDir} onSort={onSort} className="w-32" />
            )}
            <th className="px-2 py-2.5 text-xs font-semibold min-w-[180px]">
              {variant === 'pending' ? 'COA' : 'COA'}
            </th>
            <th className="px-2 py-2.5 text-xs font-semibold w-28">Sub-Account</th>
            {variant === 'committed' && (
              <th className="px-2 py-2.5 text-xs font-semibold w-24">Committed</th>
            )}
          </tr>
        </thead>
        <tbody>
          {/* spacer for virtual scroll offset */}
          {virtualizer.getVirtualItems().length > 0 && (
            <tr style={{ height: virtualizer.getVirtualItems()[0]?.start || 0 }}>
              <td colSpan={variant === 'pending' ? 12 : 13} />
            </tr>
          )}
          {virtualizer.getVirtualItems().map(vRow => {
            const txn = rows[vRow.index];
            const isSelected = selected.has(txn.id);
            const rowBg = isSelected
              ? 'bg-[#2d1b4e]/5'
              : vRow.index % 2 === 0
                ? 'bg-white'
                : 'bg-gray-50/50';
            const predicted = txn.predicted_coa_code ? coaLookup.get(txn.predicted_coa_code) : null;

            return (
              <tr
                key={txn.id}
                data-index={vRow.index}
                className={`${rowBg} hover:bg-[#2d1b4e]/[.07] transition-colors`}
                style={{ height: ROW_HEIGHT }}
              >
                {/* Checkbox */}
                <td className="px-2 py-1 sticky left-0 z-[5]" style={{ background: 'inherit' }}>
                  <input type="checkbox" checked={isSelected} onChange={() => toggleOne(txn.id)} className="w-3.5 h-3.5 rounded" />
                </td>
                {/* Date */}
                <td className="px-2 py-1 text-gray-600 whitespace-nowrap font-mono">{formatDate(txn.date)}</td>
                {/* Merchant */}
                <td className="px-2 py-1">
                  <div className="flex items-center gap-1.5">
                    {txn.logo_url && <img src={txn.logo_url} alt="" className="w-4 h-4 rounded-sm flex-shrink-0" />}
                    <span className="truncate text-gray-900">{txn.merchantName || '\u2014'}</span>
                  </div>
                </td>
                {/* Description */}
                <td className="px-2 py-1 text-gray-800">{txn.name}</td>
                {/* Amount */}
                <td className="px-2 py-1 text-right font-mono font-medium whitespace-nowrap">
                  <span className={txn.amount > 0 ? 'text-red-700' : 'text-green-700'}>
                    {txn.amount > 0 ? '-' : '+'}{formatMoney(txn.amount)}
                  </span>
                </td>
                {/* Channel */}
                <td className="px-2 py-1">
                  <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-medium ${channelColor(txn.payment_channel)}`}>
                    {channelLabel(txn.payment_channel)}
                  </span>
                </td>
                {/* Category */}
                <td className="px-2 py-1">
                  {txn.personal_finance_category?.primary ? (
                    <span
                      className="text-gray-700 truncate block"
                      title={txn.personal_finance_category?.detailed || ''}
                    >
                      {txn.personal_finance_category.primary}
                    </span>
                  ) : (
                    <span className="text-gray-300">&mdash;</span>
                  )}
                </td>
                {/* Account */}
                <td className="px-2 py-1 text-gray-600 truncate">{txn.accountName || '\u2014'}</td>
                {/* Institution */}
                <td className="px-2 py-1 text-gray-600 truncate">{txn.institutionName || '\u2014'}</td>
                {/* AI Suggestion (pending only) */}
                {variant === 'pending' && (
                  <td className="px-2 py-1">
                    {predicted ? (
                      <div className="flex items-center gap-1">
                        <span className={`w-2 h-2 rounded-full flex-shrink-0 ${confidenceDot(txn.prediction_confidence)}`} />
                        <span className="text-gray-600 truncate text-[11px]" title={`${predicted.code} - ${predicted.name}`}>
                          {predicted.code}
                        </span>
                      </div>
                    ) : (
                      <span className="text-gray-300">&mdash;</span>
                    )}
                  </td>
                )}
                {/* COA dropdown */}
                <td className="px-2 py-1">
                  {variant === 'pending' ? (
                    <select
                      value={rowChanges[txn.id]?.coa || ''}
                      onChange={e => setRowChanges(prev => ({ ...prev, [txn.id]: { ...(prev[txn.id] || { coa: '', sub: '' }), coa: e.target.value } }))}
                      className="w-full text-[11px] border border-gray-200 rounded px-1.5 py-1 bg-white focus:border-[#2d1b4e] focus:ring-1 focus:ring-[#2d1b4e] outline-none"
                    >
                      <option value="">{txn.predicted_coa_code ? `AI: ${txn.predicted_coa_code}` : 'Select...'}</option>
                      {Object.entries(coaGroupedByEntity).map(([entity, opts]) => (
                        <optgroup key={entity} label={entity || 'General'}>
                          {opts.map(o => <option key={o.id} value={o.code}>{o.code} - {o.name}</option>)}
                        </optgroup>
                      ))}
                      <option value="__NEW__">+ Add Category</option>
                    </select>
                  ) : (
                    <span className="font-mono text-green-700 text-[11px]">
                      {txn.accountCode}
                      {txn.accountCode && coaLookup.get(txn.accountCode) && (
                        <span className="text-gray-400 ml-1">{coaLookup.get(txn.accountCode)!.name}</span>
                      )}
                    </span>
                  )}
                </td>
                {/* Sub-Account */}
                <td className="px-2 py-1">
                  {variant === 'pending' ? (
                    <input
                      type="text"
                      value={rowChanges[txn.id]?.sub || ''}
                      onChange={e => setRowChanges(prev => ({ ...prev, [txn.id]: { ...(prev[txn.id] || { coa: '', sub: '' }), sub: e.target.value } }))}
                      placeholder="..."
                      className="w-full text-[11px] border border-gray-200 rounded px-1.5 py-1 bg-white focus:border-[#2d1b4e] focus:ring-1 focus:ring-[#2d1b4e] outline-none"
                    />
                  ) : (
                    <span className="text-gray-600 text-[11px]">{txn.subAccount || '\u2014'}</span>
                  )}
                </td>
                {/* Committed date */}
                {variant === 'committed' && (
                  <td className="px-2 py-1 text-gray-500 font-mono whitespace-nowrap">{formatDate(txn.updatedAt)}</td>
                )}
              </tr>
            );
          })}
          {/* bottom spacer */}
          {virtualizer.getVirtualItems().length > 0 && (
            <tr style={{
              height: virtualizer.getTotalSize() - (virtualizer.getVirtualItems()[virtualizer.getVirtualItems().length - 1]?.end || 0)
            }}>
              <td colSpan={variant === 'pending' ? 12 : 13} />
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

// ─── Merchant Group Table ────────────────────────────────────────────────────

function MerchantGroupTable({
  rows,
  coaOptions,
  coaGroupedByEntity,
  selected,
  setSelected,
  rowChanges,
  setRowChanges,
  coaLookup,
}: {
  rows: SpendingTransaction[];
  coaOptions: CoaOption[];
  coaGroupedByEntity: Record<string, CoaOption[]>;
  selected: Set<string>;
  setSelected: (fn: (prev: Set<string>) => Set<string>) => void;
  rowChanges: Record<string, { coa: string; sub: string }>;
  setRowChanges: React.Dispatch<React.SetStateAction<Record<string, { coa: string; sub: string }>>>;
  coaLookup: Map<string, CoaOption>;
}) {
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());

  const groups = useMemo(() => {
    const map = new Map<string, SpendingTransaction[]>();
    rows.forEach(r => {
      const key = r.merchantName || r.name;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(r);
    });
    return Array.from(map.entries()).sort((a, b) => b[1].length - a[1].length);
  }, [rows]);

  const toggleGroup = (merchant: string) => {
    setCollapsed(prev => {
      const next = new Set(prev);
      if (next.has(merchant)) next.delete(merchant); else next.add(merchant);
      return next;
    });
  };

  const selectGroup = (txns: SpendingTransaction[], allSelected: boolean) => {
    setSelected(prev => {
      const next = new Set(prev);
      txns.forEach(t => allSelected ? next.delete(t.id) : next.add(t.id));
      return next;
    });
  };

  return (
    <div className="overflow-auto" style={{ maxHeight: '600px' }}>
      <table className="w-full text-xs border-collapse min-w-[1000px]">
        <thead className="bg-[#2d1b4e] text-white sticky top-0 z-10">
          <tr>
            <th className="px-2 py-2.5 w-10"></th>
            <th className="px-2 py-2.5 text-left font-semibold">Merchant</th>
            <th className="px-2 py-2.5 text-right font-semibold w-16">Count</th>
            <th className="px-2 py-2.5 text-right font-semibold w-28">Total</th>
            <th className="px-2 py-2.5 text-left font-semibold min-w-[180px]">Batch COA</th>
          </tr>
        </thead>
        <tbody>
          {groups.map(([merchant, txns]) => {
            const allSel = txns.every(t => selected.has(t.id));
            const isCollapsed = collapsed.has(merchant);
            const total = txns.reduce((s, t) => s + Math.abs(t.amount), 0);

            return (
              <Fragment key={merchant}>
                <tr className="bg-gray-100 border-b border-gray-200 hover:bg-gray-200 cursor-pointer" onClick={() => toggleGroup(merchant)}>
                  <td className="px-2 py-2" onClick={e => { e.stopPropagation(); selectGroup(txns, allSel); }}>
                    <input type="checkbox" checked={allSel} onChange={() => selectGroup(txns, allSel)} className="w-3.5 h-3.5 rounded" />
                  </td>
                  <td className="px-2 py-2 font-medium text-gray-900">
                    <span className="text-[10px] text-gray-400 mr-1.5">{isCollapsed ? '▶' : '▼'}</span>
                    {merchant}
                  </td>
                  <td className="px-2 py-2 text-right font-mono text-gray-600">{txns.length}</td>
                  <td className="px-2 py-2 text-right font-mono font-medium">{formatMoney(total)}</td>
                  <td className="px-2 py-2" onClick={e => e.stopPropagation()}>
                    {/* placeholder for group-level COA if needed */}
                  </td>
                </tr>
                {!isCollapsed && txns.map((txn, i) => (
                  <tr key={txn.id} className={`${i % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'} hover:bg-[#2d1b4e]/[.05]`}>
                    <td className="px-2 py-1.5 pl-6">
                      <input type="checkbox" checked={selected.has(txn.id)} onChange={() => setSelected(prev => {
                        const next = new Set(prev);
                        if (next.has(txn.id)) next.delete(txn.id); else next.add(txn.id);
                        return next;
                      })} className="w-3.5 h-3.5 rounded" />
                    </td>
                    <td className="px-2 py-1.5 text-gray-600" colSpan={1}>
                      <span className="font-mono text-gray-400 mr-2">{formatDate(txn.date)}</span>
                      {txn.name}
                    </td>
                    <td className="px-2 py-1.5 text-right font-mono text-gray-500">{txn.personal_finance_category?.primary || ''}</td>
                    <td className="px-2 py-1.5 text-right font-mono">
                      <span className={txn.amount > 0 ? 'text-red-700' : 'text-green-700'}>
                        {formatMoney(txn.amount)}
                      </span>
                    </td>
                    <td className="px-2 py-1.5">
                      <select
                        value={rowChanges[txn.id]?.coa || ''}
                        onChange={e => setRowChanges(prev => ({ ...prev, [txn.id]: { ...(prev[txn.id] || { coa: '', sub: '' }), coa: e.target.value } }))}
                        className="w-full text-[11px] border border-gray-200 rounded px-1.5 py-1 bg-white"
                      >
                        <option value="">Select...</option>
                        {Object.entries(coaGroupedByEntity).map(([entity, opts]) => (
                          <optgroup key={entity} label={entity || 'General'}>
                            {opts.map(o => <option key={o.id} value={o.code}>{o.code} - {o.name}</option>)}
                          </optgroup>
                        ))}
                      </select>
                    </td>
                  </tr>
                ))}
              </Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ─── Toast ───────────────────────────────────────────────────────────────────

function Toast({ message, onDone }: { message: string; onDone: () => void }) {
  useEffect(() => { const t = setTimeout(onDone, 3000); return () => clearTimeout(t); }, [onDone]);
  return (
    <div className="fixed bottom-4 right-4 z-50 bg-green-600 text-white px-4 py-3 rounded-lg shadow-lg text-sm font-medium animate-[fadeIn_0.2s_ease-in]">
      {message}
    </div>
  );
}

// ─── Main Component ──────────────────────────────────────────────────────────

export default function SpendingTab({ transactions, committedTransactions, coaOptions, onReload }: SpendingTabProps) {
  // State
  const [pendingFilters, setPendingFilters] = useState<ActiveFilters>(EMPTY_FILTERS);
  const [committedFilters, setCommittedFilters] = useState<ActiveFilters>(EMPTY_FILTERS);
  const [pendingSort, setPendingSort] = useState<{ field: SortField; dir: SortDir }>({ field: 'date', dir: 'desc' });
  const [committedSort, setCommittedSort] = useState<{ field: SortField; dir: SortDir }>({ field: 'date', dir: 'desc' });
  const [selectedPending, setSelectedPending] = useState<Set<string>>(new Set());
  const [selectedCommitted, setSelectedCommitted] = useState<Set<string>>(new Set());
  const [rowChanges, setRowChanges] = useState<Record<string, { coa: string; sub: string }>>({});
  const [batchCoa, setBatchCoa] = useState('');
  const [batchSub, setBatchSub] = useState('');
  const [viewMode, setViewMode] = useState<'flat' | 'merchant'>('flat');
  const [showCreateCoa, setShowCreateCoa] = useState(false);
  const [localCoaOptions, setLocalCoaOptions] = useState<CoaOption[]>(coaOptions);
  const [committing, setCommitting] = useState(false);
  const [uncommitting, setUncommitting] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  const [activeTable, setActiveTable] = useState<'pending' | 'committed'>('pending');

  // Sync coaOptions from parent
  useEffect(() => { setLocalCoaOptions(coaOptions); }, [coaOptions]);

  // Watch for __NEW__ in rowChanges to trigger COA modal
  useEffect(() => {
    for (const [id, change] of Object.entries(rowChanges)) {
      if (change.coa === '__NEW__') {
        setShowCreateCoa(true);
        setRowChanges(prev => ({ ...prev, [id]: { ...prev[id], coa: '' } }));
        break;
      }
    }
  }, [rowChanges]);

  // Derived
  const coaLookup = useMemo(() => {
    const map = new Map<string, CoaOption>();
    localCoaOptions.forEach(o => map.set(o.code, o));
    return map;
  }, [localCoaOptions]);

  const coaGroupedByEntity = useMemo(() => {
    const g: Record<string, CoaOption[]> = {};
    localCoaOptions.forEach(o => {
      const key = o.entity_type || o.accountType;
      if (!g[key]) g[key] = [];
      g[key].push(o);
    });
    return g;
  }, [localCoaOptions]);

  // Unique values for filters
  const pendingMerchants = useMemo(() => {
    const m = new Map<string, number>();
    transactions.forEach(t => { const k = t.merchantName || t.name; m.set(k, (m.get(k) || 0) + 1); });
    return Array.from(m.entries()).sort((a, b) => b[1] - a[1]);
  }, [transactions]);

  const pendingCategories = useMemo(() => {
    const m = new Map<string, number>();
    transactions.forEach(t => { const k = t.personal_finance_category?.primary || 'Other'; m.set(k, (m.get(k) || 0) + 1); });
    return Array.from(m.entries()).sort((a, b) => b[1] - a[1]);
  }, [transactions]);

  const pendingAccounts = useMemo(() => {
    const m = new Map<string, number>();
    transactions.forEach(t => { const k = t.accountName || 'Unknown'; m.set(k, (m.get(k) || 0) + 1); });
    return Array.from(m.entries()).sort((a, b) => b[1] - a[1]);
  }, [transactions]);

  const pendingChannels = useMemo(() => {
    const m = new Map<string, number>();
    transactions.forEach(t => { const k = t.payment_channel || 'other'; m.set(k, (m.get(k) || 0) + 1); });
    return Array.from(m.entries()).sort((a, b) => b[1] - a[1]);
  }, [transactions]);

  // Filtered + sorted rows
  const pendingRows = useMemo(() => {
    const filtered = applyFilters(transactions, pendingFilters);
    return sortTransactions(filtered, pendingSort.field, pendingSort.dir);
  }, [transactions, pendingFilters, pendingSort]);

  const committedRows = useMemo(() => {
    const filtered = applyFilters(committedTransactions, committedFilters);
    return sortTransactions(filtered, committedSort.field, committedSort.dir);
  }, [committedTransactions, committedFilters, committedSort]);

  const hasActiveFilters = (f: ActiveFilters) =>
    f.search || f.merchants.length || f.categories.length || f.accounts.length || f.channels.length || f.dateFrom || f.dateTo || f.amountMin || f.amountMax;

  // Selection totals
  const selectedPendingAmount = useMemo(() =>
    transactions.filter(t => selectedPending.has(t.id)).reduce((s, t) => s + Math.abs(t.amount), 0),
    [transactions, selectedPending]
  );

  // Handlers
  const handlePendingSort = (field: SortField) => {
    setPendingSort(prev => ({
      field,
      dir: prev.field === field && prev.dir === 'asc' ? 'desc' : 'asc'
    }));
  };

  const handleCommittedSort = (field: SortField) => {
    setCommittedSort(prev => ({
      field,
      dir: prev.field === field && prev.dir === 'asc' ? 'desc' : 'asc'
    }));
  };

  const toggleFilter = (filters: ActiveFilters, setFilters: (f: ActiveFilters) => void, key: 'merchants' | 'categories' | 'accounts' | 'channels', val: string) => {
    const arr = filters[key];
    setFilters({ ...filters, [key]: arr.includes(val) ? arr.filter(v => v !== val) : [...arr, val] });
  };

  const removeFilterPill = (key: keyof ActiveFilters, val?: string) => {
    if (key === 'search' || key === 'dateFrom' || key === 'dateTo' || key === 'amountMin' || key === 'amountMax') {
      setPendingFilters(prev => ({ ...prev, [key]: '' }));
    } else if (val) {
      setPendingFilters(prev => ({ ...prev, [key]: (prev[key] as string[]).filter(v => v !== val) }));
    }
  };

  const handleBatchCommit = async () => {
    const ids = Array.from(selectedPending);
    if (ids.length === 0) return;
    if (!batchCoa) { alert('Select a COA account first'); return; }

    setCommitting(true);
    try {
      const res = await fetch('/api/transactions/commit-to-ledger', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ transactionIds: ids, accountCode: batchCoa, subAccount: batchSub || null })
      });
      const data = await res.json();
      if (data.success) {
        setToast(`Committed ${data.committed} transaction${data.committed !== 1 ? 's' : ''}`);
        setSelectedPending(new Set());
        setBatchCoa('');
        setBatchSub('');
        await onReload();
      }
    } catch (e) {
      console.error('Batch commit error:', e);
    }
    setCommitting(false);
  };

  const handleRowCommit = async () => {
    const entries = Object.entries(rowChanges).filter(([_, c]) => c.coa && c.coa !== '__NEW__');
    if (entries.length === 0) return;

    setCommitting(true);
    let committed = 0;
    try {
      for (const [id, change] of entries) {
        const res = await fetch('/api/transactions/commit-to-ledger', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ transactionIds: [id], accountCode: change.coa, subAccount: change.sub || null })
        });
        const data = await res.json();
        if (data.success) committed += data.committed;
      }
      if (committed > 0) {
        setToast(`Committed ${committed} transaction${committed !== 1 ? 's' : ''}`);
        setRowChanges({});
        await onReload();
      }
    } catch (e) {
      console.error('Row commit error:', e);
    }
    setCommitting(false);
  };

  const handleUncommit = async () => {
    const ids = Array.from(selectedCommitted);
    if (ids.length === 0) return;

    setUncommitting(true);
    try {
      const res = await fetch('/api/transactions/uncommit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ transactionIds: ids })
      });
      const data = await res.json();
      if (data.success) {
        setToast(`Uncommitted ${data.uncommitted} transaction${data.uncommitted !== 1 ? 's' : ''}`);
        setSelectedCommitted(new Set());
        await onReload();
      }
    } catch (e) {
      console.error('Uncommit error:', e);
    }
    setUncommitting(false);
  };

  const handleCoaCreated = (account: CoaOption) => {
    setLocalCoaOptions(prev => [...prev, account].sort((a, b) => a.code.localeCompare(b.code)));
  };

  const rowsWithCoa = Object.entries(rowChanges).filter(([_, c]) => c.coa && c.coa !== '__NEW__').length;

  if (!transactions && !committedTransactions) {
    return <div className="p-4 text-center text-gray-400">Loading...</div>;
  }

  return (
    <div className="space-y-4">
      {/* Stats Row */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <Badge variant="warning">{transactions.length} pending</Badge>
          <Badge variant="success">{committedTransactions.length} committed</Badge>
          {hasActiveFilters(pendingFilters) && activeTable === 'pending' && (
            <Badge variant="info">Showing {pendingRows.length} of {transactions.length}</Badge>
          )}
          {hasActiveFilters(committedFilters) && activeTable === 'committed' && (
            <Badge variant="info">Showing {committedRows.length} of {committedTransactions.length}</Badge>
          )}
        </div>
        <div className="flex items-center gap-2">
          {rowsWithCoa > 0 && (
            <Button size="sm" loading={committing} onClick={handleRowCommit}>
              Commit {rowsWithCoa} Row{rowsWithCoa !== 1 ? 's' : ''}
            </Button>
          )}
          <button
            onClick={() => setViewMode(viewMode === 'flat' ? 'merchant' : 'flat')}
            className={`px-3 py-1.5 text-xs border rounded-lg transition-colors ${viewMode === 'merchant' ? 'bg-[#2d1b4e] text-white border-[#2d1b4e]' : 'bg-white hover:border-gray-400'}`}
          >
            {viewMode === 'flat' ? 'Group by Merchant' : 'Flat View'}
          </button>
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`px-3 py-1.5 text-xs border rounded-lg transition-colors ${showFilters ? 'bg-[#2d1b4e] text-white border-[#2d1b4e]' : 'bg-white hover:border-gray-400'}`}
          >
            Filters
          </button>
        </div>
      </div>

      {/* Filter Bar */}
      {showFilters && (
        <div className="p-3 bg-gray-50 border rounded-lg space-y-3">
          <div className="flex flex-wrap gap-2 items-center">
            {/* Search */}
            <input
              type="text"
              placeholder="Search name, merchant, category..."
              value={pendingFilters.search}
              onChange={e => setPendingFilters(prev => ({ ...prev, search: e.target.value }))}
              className="flex-1 min-w-[200px] px-3 py-1.5 text-xs border rounded-lg bg-white focus:border-[#2d1b4e] focus:ring-1 focus:ring-[#2d1b4e] outline-none"
            />
            {/* Multi-selects */}
            <MultiSelectFilter
              label="Merchant"
              options={pendingMerchants}
              selected={pendingFilters.merchants}
              onToggle={val => toggleFilter(pendingFilters, setPendingFilters, 'merchants', val)}
            />
            <MultiSelectFilter
              label="Category"
              options={pendingCategories}
              selected={pendingFilters.categories}
              onToggle={val => toggleFilter(pendingFilters, setPendingFilters, 'categories', val)}
            />
            <MultiSelectFilter
              label="Account"
              options={pendingAccounts}
              selected={pendingFilters.accounts}
              onToggle={val => toggleFilter(pendingFilters, setPendingFilters, 'accounts', val)}
            />
            <MultiSelectFilter
              label="Channel"
              options={pendingChannels}
              selected={pendingFilters.channels}
              onToggle={val => toggleFilter(pendingFilters, setPendingFilters, 'channels', val)}
            />
          </div>
          <div className="flex flex-wrap gap-2 items-center">
            <span className="text-[10px] text-gray-500 uppercase font-semibold">Date:</span>
            <input
              type="date"
              value={pendingFilters.dateFrom}
              onChange={e => setPendingFilters(prev => ({ ...prev, dateFrom: e.target.value }))}
              className="px-2 py-1 text-xs border rounded-lg bg-white"
            />
            <span className="text-xs text-gray-400">to</span>
            <input
              type="date"
              value={pendingFilters.dateTo}
              onChange={e => setPendingFilters(prev => ({ ...prev, dateTo: e.target.value }))}
              className="px-2 py-1 text-xs border rounded-lg bg-white"
            />
            <span className="text-[10px] text-gray-500 uppercase font-semibold ml-2">Amount:</span>
            <input
              type="number"
              placeholder="Min"
              value={pendingFilters.amountMin}
              onChange={e => setPendingFilters(prev => ({ ...prev, amountMin: e.target.value }))}
              className="w-20 px-2 py-1 text-xs border rounded-lg bg-white"
            />
            <span className="text-xs text-gray-400">-</span>
            <input
              type="number"
              placeholder="Max"
              value={pendingFilters.amountMax}
              onChange={e => setPendingFilters(prev => ({ ...prev, amountMax: e.target.value }))}
              className="w-20 px-2 py-1 text-xs border rounded-lg bg-white"
            />
            {hasActiveFilters(pendingFilters) && (
              <button
                onClick={() => setPendingFilters(EMPTY_FILTERS)}
                className="ml-auto text-xs text-red-500 hover:text-red-700"
              >
                Clear All
              </button>
            )}
          </div>

          {/* Active filter pills */}
          {hasActiveFilters(pendingFilters) && (
            <div className="flex flex-wrap gap-1.5">
              {pendingFilters.search && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-[#2d1b4e]/10 text-[#2d1b4e] rounded-full text-[10px]">
                  Search: &quot;{pendingFilters.search}&quot;
                  <button onClick={() => removeFilterPill('search')} className="hover:text-red-500">×</button>
                </span>
              )}
              {pendingFilters.merchants.map(m => (
                <span key={m} className="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-100 text-blue-700 rounded-full text-[10px]">
                  {m.slice(0, 20)}
                  <button onClick={() => removeFilterPill('merchants', m)} className="hover:text-red-500">×</button>
                </span>
              ))}
              {pendingFilters.categories.map(c => (
                <span key={c} className="inline-flex items-center gap-1 px-2 py-0.5 bg-purple-100 text-purple-700 rounded-full text-[10px]">
                  {c}
                  <button onClick={() => removeFilterPill('categories', c)} className="hover:text-red-500">×</button>
                </span>
              ))}
              {pendingFilters.accounts.map(a => (
                <span key={a} className="inline-flex items-center gap-1 px-2 py-0.5 bg-green-100 text-green-700 rounded-full text-[10px]">
                  {a}
                  <button onClick={() => removeFilterPill('accounts', a)} className="hover:text-red-500">×</button>
                </span>
              ))}
              {pendingFilters.channels.map(ch => (
                <span key={ch} className="inline-flex items-center gap-1 px-2 py-0.5 bg-orange-100 text-orange-700 rounded-full text-[10px]">
                  {channelLabel(ch)}
                  <button onClick={() => removeFilterPill('channels', ch)} className="hover:text-red-500">×</button>
                </span>
              ))}
              {pendingFilters.dateFrom && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-gray-200 text-gray-700 rounded-full text-[10px]">
                  From: {pendingFilters.dateFrom}
                  <button onClick={() => removeFilterPill('dateFrom')} className="hover:text-red-500">×</button>
                </span>
              )}
              {pendingFilters.dateTo && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-gray-200 text-gray-700 rounded-full text-[10px]">
                  To: {pendingFilters.dateTo}
                  <button onClick={() => removeFilterPill('dateTo')} className="hover:text-red-500">×</button>
                </span>
              )}
            </div>
          )}
        </div>
      )}

      {/* Table Tabs */}
      <div className="flex border-b border-gray-200">
        <button
          onClick={() => setActiveTable('pending')}
          className={`px-4 py-2 text-xs font-medium border-b-2 transition-colors ${
            activeTable === 'pending'
              ? 'border-amber-500 text-amber-700 bg-amber-50'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          Pending ({pendingRows.length}{hasActiveFilters(pendingFilters) ? ` of ${transactions.length}` : ''})
        </button>
        <button
          onClick={() => setActiveTable('committed')}
          className={`px-4 py-2 text-xs font-medium border-b-2 transition-colors ${
            activeTable === 'committed'
              ? 'border-green-500 text-green-700 bg-green-50'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          Committed ({committedRows.length}{hasActiveFilters(committedFilters) ? ` of ${committedTransactions.length}` : ''})
        </button>
      </div>

      {/* Pending Table */}
      {activeTable === 'pending' && (
        <>
          {pendingRows.length === 0 ? (
            <div className="text-center py-12 text-gray-400">
              {transactions.length === 0 ? (
                <>
                  <div className="text-3xl mb-2">✓</div>
                  <p className="text-sm">All transactions have been committed</p>
                </>
              ) : (
                <>
                  <p className="text-sm">No transactions match current filters</p>
                  <button onClick={() => setPendingFilters(EMPTY_FILTERS)} className="text-xs text-[#2d1b4e] mt-2 underline">Clear filters</button>
                </>
              )}
            </div>
          ) : viewMode === 'flat' ? (
            <VirtualTable
              rows={pendingRows}
              coaOptions={localCoaOptions}
              coaGroupedByEntity={coaGroupedByEntity}
              selected={selectedPending}
              setSelected={setSelectedPending}
              rowChanges={rowChanges}
              setRowChanges={setRowChanges}
              sortField={pendingSort.field}
              sortDir={pendingSort.dir}
              onSort={handlePendingSort}
              variant="pending"
              coaLookup={coaLookup}
            />
          ) : (
            <MerchantGroupTable
              rows={pendingRows}
              coaOptions={localCoaOptions}
              coaGroupedByEntity={coaGroupedByEntity}
              selected={selectedPending}
              setSelected={setSelectedPending}
              rowChanges={rowChanges}
              setRowChanges={setRowChanges}
              coaLookup={coaLookup}
            />
          )}
        </>
      )}

      {/* Committed Table */}
      {activeTable === 'committed' && (
        <>
          {/* Committed filter bar */}
          <div className="flex items-center gap-2">
            <input
              type="text"
              placeholder="Search committed..."
              value={committedFilters.search}
              onChange={e => setCommittedFilters(prev => ({ ...prev, search: e.target.value }))}
              className="flex-1 max-w-xs px-3 py-1.5 text-xs border rounded-lg bg-white focus:border-[#2d1b4e] outline-none"
            />
            {hasActiveFilters(committedFilters) && (
              <button onClick={() => setCommittedFilters(EMPTY_FILTERS)} className="text-xs text-red-500">Clear</button>
            )}
          </div>
          {committedRows.length === 0 ? (
            <div className="text-center py-12 text-gray-400">
              <p className="text-sm">{committedTransactions.length === 0 ? 'No committed transactions yet' : 'No matches'}</p>
            </div>
          ) : (
            <VirtualTable
              rows={committedRows}
              coaOptions={localCoaOptions}
              coaGroupedByEntity={coaGroupedByEntity}
              selected={selectedCommitted}
              setSelected={setSelectedCommitted}
              rowChanges={{}}
              setRowChanges={() => {}}
              sortField={committedSort.field}
              sortDir={committedSort.dir}
              onSort={handleCommittedSort}
              variant="committed"
              coaLookup={coaLookup}
            />
          )}
        </>
      )}

      {/* Batch Commit Bar (sticky bottom when pending selected) */}
      {selectedPending.size > 0 && activeTable === 'pending' && (
        <div className="sticky bottom-0 left-0 right-0 bg-[#2d1b4e] text-white p-3 rounded-lg shadow-lg z-20">
          <div className="flex items-center gap-3 flex-wrap">
            <span className="text-xs font-medium">
              {selectedPending.size} transaction{selectedPending.size !== 1 ? 's' : ''} selected
              <span className="ml-1 text-white/60">({formatMoney(selectedPendingAmount)})</span>
            </span>
            <select
              value={batchCoa}
              onChange={e => {
                if (e.target.value === '__NEW__') { setShowCreateCoa(true); return; }
                setBatchCoa(e.target.value);
              }}
              className="flex-1 min-w-[200px] bg-[#3d2b5e] text-white border-0 text-xs px-3 py-2 rounded"
            >
              <option value="">Select COA...</option>
              {Object.entries(coaGroupedByEntity).map(([entity, opts]) => (
                <optgroup key={entity} label={entity || 'General'}>
                  {opts.map(o => <option key={o.id} value={o.code}>{o.code} - {o.name}</option>)}
                </optgroup>
              ))}
              <option value="__NEW__">+ Add Category</option>
            </select>
            <input
              type="text"
              placeholder="Sub-account (optional)"
              value={batchSub}
              onChange={e => setBatchSub(e.target.value)}
              className="w-40 bg-[#3d2b5e] text-white border-0 text-xs px-3 py-2 rounded placeholder-white/40"
            />
            <Button
              size="sm"
              loading={committing}
              disabled={!batchCoa}
              onClick={handleBatchCommit}
              className="!bg-green-500 hover:!bg-green-600 !text-white"
            >
              Commit Selected
            </Button>
            <button
              onClick={() => setSelectedPending(new Set())}
              className="text-white/60 hover:text-white text-xs underline"
            >
              Clear
            </button>
          </div>
        </div>
      )}

      {/* Uncommit Bar (sticky bottom when committed selected) */}
      {selectedCommitted.size > 0 && activeTable === 'committed' && (
        <div className="sticky bottom-0 left-0 right-0 bg-red-700 text-white p-3 rounded-lg shadow-lg z-20">
          <div className="flex items-center gap-3">
            <span className="text-xs font-medium">
              {selectedCommitted.size} transaction{selectedCommitted.size !== 1 ? 's' : ''} selected for uncommit
            </span>
            <div className="flex-1" />
            <Button
              size="sm"
              variant="danger"
              loading={uncommitting}
              onClick={handleUncommit}
              className="!bg-white !text-red-700 hover:!bg-red-50"
            >
              Uncommit Selected
            </Button>
            <button
              onClick={() => setSelectedCommitted(new Set())}
              className="text-white/60 hover:text-white text-xs underline"
            >
              Clear
            </button>
          </div>
        </div>
      )}

      {/* Create COA Modal */}
      {showCreateCoa && (
        <CreateCoaModal
          onClose={() => setShowCreateCoa(false)}
          onCreate={handleCoaCreated}
        />
      )}

      {/* Toast */}
      {toast && <Toast message={toast} onDone={() => setToast(null)} />}
    </div>
  );
}
