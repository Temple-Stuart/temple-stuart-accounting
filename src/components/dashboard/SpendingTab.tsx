'use client';

import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useVirtualizer } from '@tanstack/react-virtual';
import { Button } from '@/components/ui';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface CoaOption {
  id: string;
  code: string;
  name: string;
  accountType: string;
  balanceType: string;
  entity_id?: string;
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
  entity_id: string | null;
  predicted_coa_code: string | null;
  prediction_confidence: number | null;
  review_status: string;
  manually_overridden: boolean;
  createdAt: string;
  updatedAt: string;
  journalProof?: any;
}

interface SpendingTabProps {
  transactions: SpendingTransaction[];
  committedTransactions: SpendingTransaction[];
  coaOptions: CoaOption[];
  onReload: () => Promise<void>;
}

type SortField = 'date' | 'merchantName' | 'name' | 'amount' | 'accountName' | 'institutionName';
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

// ─── Column Filter Types ────────────────────────────────────────────────────

type ColumnFilterValue =
  | { type: 'checkbox'; selected: string[] }
  | { type: 'dateRange'; from: string; to: string }
  | { type: 'amountRange'; min: string; max: string }
  | { type: 'search'; term: string };

type ColumnFilters = Partial<Record<SortField, ColumnFilterValue>>;

const COLUMN_FILTER_TYPE: Record<SortField, 'checkbox' | 'dateRange' | 'amountRange' | 'search'> = {
  date: 'dateRange',
  merchantName: 'checkbox',
  name: 'search',
  amount: 'amountRange',
  accountName: 'checkbox',
  institutionName: 'checkbox',
};

const EMPTY_COL_FILTERS: ColumnFilters = {};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatDate(d: string) {
  const dt = new Date(d);
  return `${String(dt.getMonth() + 1).padStart(2, '0')}/${String(dt.getDate()).padStart(2, '0')}/${dt.getFullYear()}`;
}

function formatMoney(n: number) {
  return '$' + Math.abs(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
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

function getFieldValue(txn: SpendingTransaction, field: SortField): string {
  switch (field) {
    case 'date': return txn.date;
    case 'merchantName': return txn.merchantName || txn.name;
    case 'name': return txn.name;
    case 'amount': return String(Math.abs(txn.amount));
    case 'accountName': return txn.accountName || 'Unknown';
    case 'institutionName': return txn.institutionName || 'Unknown';
  }
}

function getUniqueValues(txns: SpendingTransaction[], field: SortField): [string, number][] {
  const m = new Map<string, number>();
  txns.forEach(t => {
    const v = getFieldValue(t, field);
    if (v) m.set(v, (m.get(v) || 0) + 1);
  });
  return Array.from(m.entries()).sort((a, b) => a[0].localeCompare(b[0]));
}

function applyColumnFilters(txns: SpendingTransaction[], colFilters: ColumnFilters): SpendingTransaction[] {
  let result = txns;
  for (const [field, filter] of Object.entries(colFilters) as [SortField, ColumnFilterValue][]) {
    if (!filter) continue;
    switch (filter.type) {
      case 'checkbox':
        if (filter.selected.length > 0) {
          result = result.filter(t => filter.selected.includes(getFieldValue(t, field)));
        }
        break;
      case 'dateRange':
        if (filter.from) {
          const from = new Date(filter.from);
          result = result.filter(t => new Date(t.date) >= from);
        }
        if (filter.to) {
          const to = new Date(filter.to);
          to.setHours(23, 59, 59, 999);
          result = result.filter(t => new Date(t.date) <= to);
        }
        break;
      case 'amountRange': {
        if (filter.min) {
          const min = parseFloat(filter.min);
          if (!isNaN(min)) result = result.filter(t => Math.abs(t.amount) >= min);
        }
        if (filter.max) {
          const max = parseFloat(filter.max);
          if (!isNaN(max)) result = result.filter(t => Math.abs(t.amount) <= max);
        }
        break;
      }
      case 'search':
        if (filter.term) {
          const lower = filter.term.toLowerCase();
          result = result.filter(t => getFieldValue(t, field).toLowerCase().includes(lower));
        }
        break;
    }
  }
  return result;
}

function columnFilterLabel(field: SortField): string {
  switch (field) {
    case 'date': return 'Date';
    case 'merchantName': return 'Merchant';
    case 'name': return 'Description';
    case 'amount': return 'Amount';
    case 'accountName': return 'Account';
    case 'institutionName': return 'Institution';
  }
}

function columnFilterSummary(filter: ColumnFilterValue): string {
  switch (filter.type) {
    case 'checkbox': return filter.selected.slice(0, 2).join(', ') + (filter.selected.length > 2 ? ` +${filter.selected.length - 2}` : '');
    case 'dateRange': return [filter.from, filter.to].filter(Boolean).join(' – ');
    case 'amountRange': return ['$' + filter.min, '$' + filter.max].filter(v => v !== '$').join(' – ');
    case 'search': return `"${filter.term}"`;
  }
}

function countActiveColumnFilters(colFilters: ColumnFilters): number {
  return Object.values(colFilters).filter(f => {
    if (!f) return false;
    switch (f.type) {
      case 'checkbox': return f.selected.length > 0;
      case 'dateRange': return !!(f.from || f.to);
      case 'amountRange': return !!(f.min || f.max);
      case 'search': return f.term.length > 0;
    }
  }).length;
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
      case 'accountName': cmp = (a.accountName || '').localeCompare(b.accountName || ''); break;
      case 'institutionName': cmp = (a.institutionName || '').localeCompare(b.institutionName || ''); break;
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
        className={`px-2 py-1 text-terminal-sm font-mono border rounded flex items-center gap-1 transition-colors ${
          selected.length > 0 ? 'bg-brand-purple-deep text-white border-brand-purple-deep' : 'bg-white hover:border-border'
        }`}
      >
        {label} {selected.length > 0 && <span className="px-1 py-0.5 bg-white/20 rounded text-[8px]">{selected.length}</span>}
        <span className="text-[8px]">{open ? '▲' : '▼'}</span>
      </button>
      {open && (
        <div className="absolute z-30 top-full mt-1 left-0 bg-white border border-border rounded shadow-sm max-h-60 overflow-auto min-w-[200px]">
          {options.map(([val, count]) => (
            <label key={val} className="flex items-center gap-2 px-2 py-1 hover:bg-bg-row cursor-pointer text-terminal-sm">
              <input
                type="checkbox"
                checked={selected.includes(val)}
                onChange={() => onToggle(val)}
                className="w-3 h-3 rounded"
              />
              <span className="truncate flex-1">{val}</span>
              <span className="text-text-faint text-terminal-xs">{count}</span>
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
      className={`px-2 py-1 text-terminal-xs font-semibold font-mono uppercase tracking-widest cursor-pointer select-none hover:bg-gray-100 transition-colors ${className}`}
      onClick={() => onSort(field)}
    >
      <span className="flex items-center gap-1">
        {label}
        {isActive && <span className="text-[8px]">{currentDir === 'asc' ? '▲' : '▼'}</span>}
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
      <div className="bg-white rounded shadow-sm w-full max-w-md" onClick={e => e.stopPropagation()}>
        <div className="bg-brand-purple-deep text-white px-4 py-3 rounded-t-lg flex items-center justify-between">
          <span className="text-sm font-semibold">Create New COA Account</span>
          <button onClick={onClose} className="text-white/60 hover:text-white text-terminal-lg">×</button>
        </div>
        <div className="p-4 space-y-3">
          {error && <div className="text-xs text-brand-red bg-red-50 px-3 py-2 rounded">{error}</div>}
          <div>
            <label className="block text-xs font-medium text-text-secondary mb-1">Account Code</label>
            <input value={code} onChange={e => setCode(e.target.value)} placeholder="e.g. P-6100" className="w-full px-3 py-2 border rounded text-sm" />
          </div>
          <div>
            <label className="block text-xs font-medium text-text-secondary mb-1">Account Name</label>
            <input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Office Supplies" className="w-full px-3 py-2 border rounded text-sm" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-text-secondary mb-1">Account Type</label>
              <select value={accountType} onChange={e => setAccountType(e.target.value)} className="w-full px-3 py-2 border rounded text-sm">
                <option value="expense">Expense</option>
                <option value="revenue">Revenue</option>
                <option value="asset">Asset</option>
                <option value="liability">Liability</option>
                <option value="equity">Equity</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-text-secondary mb-1">Entity Type</label>
              <select value={entityType} onChange={e => setEntityType(e.target.value)} className="w-full px-3 py-2 border rounded text-sm">
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

// ─── Column Filter Dropdown ──────────────────────────────────────────────────

function ColumnFilterDropdown({
  field,
  filterType,
  allTransactions,
  currentFilter,
  onApply,
  onCancel,
  anchorEl,
  sortField,
  sortDir,
  onSortWithDir,
  coaLookup,
}: {
  field: SortField;
  filterType: 'checkbox' | 'dateRange' | 'amountRange' | 'search';
  allTransactions: SpendingTransaction[];
  currentFilter: ColumnFilterValue | undefined;
  onApply: (filter: ColumnFilterValue | undefined) => void;
  onCancel: () => void;
  anchorEl: HTMLElement | null;
  sortField: SortField;
  sortDir: SortDir;
  onSortWithDir: (field: SortField, dir: SortDir) => void;
  coaLookup: Map<string, CoaOption>;
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  // Local state
  const [localSearch, setLocalSearch] = useState('');
  const [localSelected, setLocalSelected] = useState<Set<string>>(() => {
    if (currentFilter?.type === 'checkbox') return new Set(currentFilter.selected);
    return new Set();
  });
  const [localFrom, setLocalFrom] = useState(() =>
    currentFilter?.type === 'dateRange' ? currentFilter.from : ''
  );
  const [localTo, setLocalTo] = useState(() =>
    currentFilter?.type === 'dateRange' ? currentFilter.to : ''
  );
  const [localMin, setLocalMin] = useState(() =>
    currentFilter?.type === 'amountRange' ? currentFilter.min : ''
  );
  const [localMax, setLocalMax] = useState(() =>
    currentFilter?.type === 'amountRange' ? currentFilter.max : ''
  );
  const [localTerm, setLocalTerm] = useState(() =>
    currentFilter?.type === 'search' ? currentFilter.term : ''
  );

  // Unique values for checkbox type
  const uniqueValues = useMemo(() => {
    if (filterType !== 'checkbox') return [];
    return getUniqueValues(allTransactions, field);
  }, [allTransactions, field, filterType]);

  const filteredValues = useMemo(() => {
    if (!localSearch) return uniqueValues;
    const lower = localSearch.toLowerCase();
    return uniqueValues.filter(([val]) => val.toLowerCase().includes(lower));
  }, [uniqueValues, localSearch]);

  // Position
  const [pos, setPos] = useState({ top: 0, left: 0, alignRight: false });

  useEffect(() => {
    if (!anchorEl) return;
    const rect = anchorEl.getBoundingClientRect();
    const alignRight = rect.left > window.innerWidth * 0.6;
    setPos({
      top: rect.bottom + 4,
      left: alignRight ? 0 : rect.left,
      alignRight,
    });
  }, [anchorEl]);

  // Auto-focus search
  useEffect(() => {
    const t = setTimeout(() => searchRef.current?.focus(), 50);
    return () => clearTimeout(t);
  }, []);

  // Click outside
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        onCancel();
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [onCancel]);

  const handleApply = () => {
    switch (filterType) {
      case 'checkbox':
        onApply(localSelected.size > 0 ? { type: 'checkbox', selected: Array.from(localSelected) } : undefined);
        break;
      case 'dateRange':
        onApply(localFrom || localTo ? { type: 'dateRange', from: localFrom, to: localTo } : undefined);
        break;
      case 'amountRange':
        onApply(localMin || localMax ? { type: 'amountRange', min: localMin, max: localMax } : undefined);
        break;
      case 'search':
        onApply(localTerm ? { type: 'search', term: localTerm } : undefined);
        break;
    }
  };

  const sortAscLabel = field === 'date' ? 'Sort Oldest First' : field === 'amount' ? 'Sort Low \u2192 High' : 'Sort A \u2192 Z';
  const sortDescLabel = field === 'date' ? 'Sort Newest First' : field === 'amount' ? 'Sort High \u2192 Low' : 'Sort Z \u2192 A';
  const isSortedAsc = sortField === field && sortDir === 'asc';
  const isSortedDesc = sortField === field && sortDir === 'desc';

  const displayVal = (val: string) => {
    return val;
  };

  const panelStyle: React.CSSProperties = {
    top: pos.top,
    ...(pos.alignRight && anchorEl
      ? { right: window.innerWidth - anchorEl.getBoundingClientRect().right }
      : { left: pos.left }),
  };

  return createPortal(
    <div ref={panelRef} className="fixed bg-white border border-border rounded shadow-sm z-[100] w-64" style={panelStyle}>
      {/* Sort controls */}
      <div className="border-b border-border-light p-2 space-y-1">
        <button
          onClick={() => { onSortWithDir(field, 'asc'); onCancel(); }}
          className={`w-full text-left px-2 py-1.5 text-xs rounded hover:bg-bg-row flex items-center gap-2 ${isSortedAsc ? 'text-brand-purple-deep font-semibold bg-brand-purple-deep/5' : 'text-text-secondary'}`}
        >
          <span className="text-[10px]">{'\u25B2'}</span> {sortAscLabel}
        </button>
        <button
          onClick={() => { onSortWithDir(field, 'desc'); onCancel(); }}
          className={`w-full text-left px-2 py-1.5 text-xs rounded hover:bg-bg-row flex items-center gap-2 ${isSortedDesc ? 'text-brand-purple-deep font-semibold bg-brand-purple-deep/5' : 'text-text-secondary'}`}
        >
          <span className="text-[10px]">{'\u25BC'}</span> {sortDescLabel}
        </button>
      </div>

      {/* Filter content */}
      <div className="p-2">
        {filterType === 'checkbox' && (
          <>
            {uniqueValues.length > 6 && (
              <input
                ref={searchRef}
                type="text"
                placeholder="Search..."
                value={localSearch}
                onChange={e => setLocalSearch(e.target.value)}
                className="w-full px-2 py-1.5 text-xs border rounded mb-2 outline-none focus:border-brand-purple-deep"
              />
            )}
            <div className="flex items-center justify-between mb-1 px-1">
              <button onClick={() => setLocalSelected(new Set(filteredValues.map(([v]) => v)))} className="text-[10px] text-brand-purple-deep hover:underline">Select All</button>
              <button onClick={() => setLocalSelected(new Set())} className="text-[10px] text-brand-red hover:underline">Clear All</button>
            </div>
            <div className="max-h-[300px] overflow-auto border rounded">
              {filteredValues.map(([val, count]) => (
                <label key={val} className="flex items-center gap-2 px-2 py-1.5 hover:bg-bg-row cursor-pointer text-xs">
                  <input
                    type="checkbox"
                    checked={localSelected.has(val)}
                    onChange={() => {
                      setLocalSelected(prev => {
                        const next = new Set(prev);
                        if (next.has(val)) next.delete(val); else next.add(val);
                        return next;
                      });
                    }}
                    className="w-3.5 h-3.5 rounded flex-shrink-0"
                  />
                  <span className="truncate flex-1">{displayVal(val)}</span>
                  <span className="text-text-faint text-[10px] flex-shrink-0">({count})</span>
                </label>
              ))}
              {filteredValues.length === 0 && (
                <div className="px-2 py-3 text-center text-text-faint text-xs">No values found</div>
              )}
            </div>
          </>
        )}

        {filterType === 'dateRange' && (
          <div className="space-y-2">
            <div>
              <label className="block text-[10px] text-text-muted mb-1">From</label>
              <input ref={searchRef} type="date" value={localFrom} onChange={e => setLocalFrom(e.target.value)} className="w-full px-2 py-1.5 text-xs border rounded outline-none focus:border-brand-purple-deep" />
            </div>
            <div>
              <label className="block text-[10px] text-text-muted mb-1">To</label>
              <input type="date" value={localTo} onChange={e => setLocalTo(e.target.value)} className="w-full px-2 py-1.5 text-xs border rounded outline-none focus:border-brand-purple-deep" />
            </div>
          </div>
        )}

        {filterType === 'amountRange' && (
          <div className="space-y-2">
            <div>
              <label className="block text-[10px] text-text-muted mb-1">Min ($)</label>
              <input ref={searchRef} type="number" placeholder="0.00" value={localMin} onChange={e => setLocalMin(e.target.value)} className="w-full px-2 py-1.5 text-xs border rounded outline-none focus:border-brand-purple-deep" />
            </div>
            <div>
              <label className="block text-[10px] text-text-muted mb-1">Max ($)</label>
              <input type="number" placeholder="999999" value={localMax} onChange={e => setLocalMax(e.target.value)} className="w-full px-2 py-1.5 text-xs border rounded outline-none focus:border-brand-purple-deep" />
            </div>
          </div>
        )}

        {filterType === 'search' && (
          <input ref={searchRef} type="text" placeholder="Search descriptions..." value={localTerm} onChange={e => setLocalTerm(e.target.value)} className="w-full px-2 py-1.5 text-xs border rounded outline-none focus:border-brand-purple-deep" />
        )}
      </div>

      {/* Apply / Cancel */}
      <div className="border-t border-border-light p-2 flex justify-between gap-2">
        <button onClick={() => onApply(undefined)} className="text-[10px] text-brand-red hover:underline">Clear</button>
        <div className="flex gap-2">
          <button onClick={onCancel} className="px-3 py-1 text-xs border rounded hover:bg-bg-row">Cancel</button>
          <button onClick={handleApply} className="px-3 py-1 text-xs bg-brand-purple-deep text-white rounded hover:bg-brand-purple-hover">Apply</button>
        </div>
      </div>
    </div>,
    document.body
  );
}

// ─── Filterable Header ──────────────────────────────────────────────────────

function FilterableHeader({
  label, field, sortField, sortDir, onSort,
  filterType, allTransactions, columnFilter, onApplyColumnFilter,
  className, coaLookup,
}: {
  label: string;
  field: SortField;
  sortField: SortField;
  sortDir: SortDir;
  onSort: (f: SortField, dir?: SortDir) => void;
  filterType: 'checkbox' | 'dateRange' | 'amountRange' | 'search';
  allTransactions: SpendingTransaction[];
  columnFilter: ColumnFilterValue | undefined;
  onApplyColumnFilter: (field: SortField, value: ColumnFilterValue | undefined) => void;
  className?: string;
  coaLookup: Map<string, CoaOption>;
}) {
  const [open, setOpen] = useState(false);
  const btnRef = useRef<HTMLButtonElement>(null);
  const isSortActive = sortField === field;
  const hasFilter = !!columnFilter;

  return (
    <th className={`px-2 py-1 text-terminal-xs font-semibold font-mono uppercase tracking-widest select-none ${className || ''}`}>
      <span className="flex items-center gap-0.5">
        <span
          className="cursor-pointer hover:underline truncate"
          onClick={() => onSort(field)}
        >
          {label}
          {isSortActive && <span className="text-[8px] ml-0.5">{sortDir === 'asc' ? '\u25B2' : '\u25BC'}</span>}
        </span>
        <button
          ref={btnRef}
          onClick={e => { e.stopPropagation(); setOpen(!open); }}
          className={`ml-auto w-3.5 h-3.5 flex items-center justify-center rounded text-[8px] flex-shrink-0 ${
            hasFilter
              ? 'text-amber-400 bg-amber-400/20'
              : 'text-white/40 hover:text-white/80 hover:bg-white/10'
          }`}
        >
          {'\u25BC'}
        </button>
      </span>
      {open && (
        <ColumnFilterDropdown
          field={field}
          filterType={filterType}
          allTransactions={allTransactions}
          currentFilter={columnFilter}
          onApply={(val) => { onApplyColumnFilter(field, val); setOpen(false); }}
          onCancel={() => setOpen(false)}
          anchorEl={btnRef.current}
          sortField={sortField}
          sortDir={sortDir}
          onSortWithDir={(f, d) => onSort(f, d)}
          coaLookup={coaLookup}
        />
      )}
    </th>
  );
}

// ─── JE Proof Helpers ────────────────────────────────────────────────────────

function getProofDrAccounts(journalProof: any): string {
  if (!journalProof?.ledgerEntries) return '\u2014';
  return journalProof.ledgerEntries
    .filter((le: any) => le.entryType === 'D')
    .map((le: any) => `${le.accountCode} - ${le.accountName}`)
    .join(', ') || '\u2014';
}

function getProofCrAccounts(journalProof: any): string {
  if (!journalProof?.ledgerEntries) return '\u2014';
  return journalProof.ledgerEntries
    .filter((le: any) => le.entryType === 'C')
    .map((le: any) => `${le.accountCode} - ${le.accountName}`)
    .join(', ') || '\u2014';
}

function isProofBalanced(journalProof: any): boolean | null {
  if (!journalProof?.ledgerEntries) return null;
  const dr = journalProof.ledgerEntries
    .filter((le: any) => le.entryType === 'D')
    .reduce((sum: number, le: any) => sum + Number(le.amount), 0);
  const cr = journalProof.ledgerEntries
    .filter((le: any) => le.entryType === 'C')
    .reduce((sum: number, le: any) => sum + Number(le.amount), 0);
  return dr === cr;
}

function formatProofDate(d: string | null | undefined): string {
  if (!d) return '\u2014';
  const dt = new Date(d);
  return `${String(dt.getMonth() + 1).padStart(2, '0')}/${String(dt.getDate()).padStart(2, '0')} ${String(dt.getHours()).padStart(2, '0')}:${String(dt.getMinutes()).padStart(2, '0')}`;
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
  allTransactions,
  columnFilters,
  onApplyColumnFilter,
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
  onSort: (f: SortField, dir?: SortDir) => void;
  variant: 'pending' | 'committed';
  coaLookup: Map<string, CoaOption>;
  allTransactions: SpendingTransaction[];
  columnFilters: ColumnFilters;
  onApplyColumnFilter: (field: SortField, value: ColumnFilterValue | undefined) => void;
}) {
  const parentRef = useRef<HTMLDivElement>(null);
  const ROW_HEIGHT = 30;

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
    <div ref={parentRef} className="overflow-auto [&::-webkit-scrollbar]:h-2 [&::-webkit-scrollbar-track]:bg-bg-row [&::-webkit-scrollbar-thumb]:bg-brand-purple/30 [&::-webkit-scrollbar-thumb]:rounded" style={{ maxHeight: '600px' }}>
      <table className={`w-full text-xs border-collapse ${variant === 'committed' ? 'min-w-[1500px]' : 'min-w-[900px]'}`}>
        <thead className="bg-gray-50 text-text-secondary sticky top-0 z-10">
          <tr>
            <th className="px-2 py-1 w-10 sticky left-0 bg-gray-50 z-20">
              <input type="checkbox" checked={allSelected} onChange={toggleAll} className="w-3 h-3 rounded" />
            </th>
            <FilterableHeader label="Date" field="date" sortField={sortField} sortDir={sortDir} onSort={onSort} filterType="dateRange" allTransactions={allTransactions} columnFilter={columnFilters.date} onApplyColumnFilter={onApplyColumnFilter} coaLookup={coaLookup} className="w-24" />
            <FilterableHeader label="Merchant" field="merchantName" sortField={sortField} sortDir={sortDir} onSort={onSort} filterType="checkbox" allTransactions={allTransactions} columnFilter={columnFilters.merchantName} onApplyColumnFilter={onApplyColumnFilter} coaLookup={coaLookup} className="min-w-[130px]" />
            <FilterableHeader label="Desc" field="name" sortField={sortField} sortDir={sortDir} onSort={onSort} filterType="search" allTransactions={allTransactions} columnFilter={columnFilters.name} onApplyColumnFilter={onApplyColumnFilter} coaLookup={coaLookup} className="min-w-[200px]" />
            <FilterableHeader label="Amount" field="amount" sortField={sortField} sortDir={sortDir} onSort={onSort} filterType="amountRange" allTransactions={allTransactions} columnFilter={columnFilters.amount} onApplyColumnFilter={onApplyColumnFilter} coaLookup={coaLookup} className="w-24 text-right" />
            <FilterableHeader label="Account" field="accountName" sortField={sortField} sortDir={sortDir} onSort={onSort} filterType="checkbox" allTransactions={allTransactions} columnFilter={columnFilters.accountName} onApplyColumnFilter={onApplyColumnFilter} coaLookup={coaLookup} className="w-28" />
            <FilterableHeader label="Inst" field="institutionName" sortField={sortField} sortDir={sortDir} onSort={onSort} filterType="checkbox" allTransactions={allTransactions} columnFilter={columnFilters.institutionName} onApplyColumnFilter={onApplyColumnFilter} coaLookup={coaLookup} className="w-28" />
            <th className="px-2 py-1 text-terminal-xs font-semibold font-mono uppercase tracking-widest min-w-[180px]">COA</th>
            {variant === 'committed' && (
              <>
                <th className="px-2 py-1 text-terminal-xs font-semibold font-mono uppercase tracking-widest w-20">JE ID</th>
                <th className="px-2 py-1 text-terminal-xs font-semibold font-mono uppercase tracking-widest w-28">DR Acct</th>
                <th className="px-2 py-1 text-terminal-xs font-semibold font-mono uppercase tracking-widest w-28">CR Acct</th>
                <th className="px-2 py-1 text-terminal-xs font-semibold font-mono uppercase tracking-widest w-10 text-center">D=C</th>
                <th className="px-2 py-1 text-terminal-xs font-semibold font-mono uppercase tracking-widest w-20">Entity</th>
                <th className="px-2 py-1 text-terminal-xs font-semibold font-mono uppercase tracking-widest w-24">By</th>
                <th className="px-2 py-1 text-terminal-xs font-semibold font-mono uppercase tracking-widest w-20">At</th>
                <th className="px-2 py-1 text-terminal-xs font-semibold font-mono uppercase tracking-widest w-8 text-center" title="Trigger-enforced immutability">{'\uD83D\uDD12'}</th>
              </>
            )}
          </tr>
        </thead>
        <tbody>
          {/* spacer for virtual scroll offset */}
          {virtualizer.getVirtualItems().length > 0 && (
            <tr style={{ height: virtualizer.getVirtualItems()[0]?.start || 0 }}>
              <td colSpan={variant === 'pending' ? 8 : 16} />
            </tr>
          )}
          {virtualizer.getVirtualItems().map(vRow => {
            const txn = rows[vRow.index];
            const isSelected = selected.has(txn.id);
            const rowBg = isSelected
              ? 'bg-brand-purple-deep/5'
              : vRow.index % 2 === 0
                ? 'bg-white'
                : 'bg-bg-row';

            return (
              <tr
                key={txn.id}
                data-index={vRow.index}
                className={`${rowBg} hover:bg-brand-purple-deep/[.07] border-b border-border-light transition-colors`}
                style={{ height: ROW_HEIGHT }}
              >
                {/* Checkbox */}
                <td className="py-1 px-2 sticky left-0 z-[5]" style={{ background: 'inherit' }}>
                  <input type="checkbox" checked={isSelected} onChange={() => toggleOne(txn.id)} className="w-3 h-3 rounded" />
                </td>
                {/* Date */}
                <td className="py-1 px-2 text-text-muted whitespace-nowrap font-mono text-terminal-base">{formatDate(txn.date)}</td>
                {/* Merchant */}
                <td className="py-1 px-2">
                  <div className="flex items-center gap-1">
                    {txn.logo_url && <img src={txn.logo_url} alt="" className="w-3.5 h-3.5 rounded-sm flex-shrink-0" />}
                    <span className="truncate font-medium text-terminal-base">{txn.merchantName || '\u2014'}</span>
                  </div>
                </td>
                {/* Description */}
                <td className="py-1 px-2 text-text-secondary text-terminal-sm truncate">{txn.name}</td>
                {/* Amount */}
                <td className="py-1 px-2 text-right font-mono font-semibold whitespace-nowrap text-terminal-base">
                  <span className={txn.amount > 0 ? 'text-brand-red' : 'text-brand-green'}>
                    {txn.amount > 0 ? '-' : '+'}{formatMoney(txn.amount)}
                  </span>
                </td>
                {/* Account */}
                <td className="py-1 px-2 font-mono text-terminal-sm text-text-muted truncate">{txn.accountName || '\u2014'}</td>
                {/* Institution */}
                <td className="py-1 px-2 font-mono text-terminal-sm text-text-muted truncate">{txn.institutionName || '\u2014'}</td>
                {/* COA dropdown */}
                <td className="py-1 px-2">
                  {variant === 'pending' ? (
                    <select
                      value={rowChanges[txn.id]?.coa || ''}
                      onChange={e => setRowChanges(prev => ({ ...prev, [txn.id]: { ...(prev[txn.id] || { coa: '', sub: '' }), coa: e.target.value } }))}
                      className="w-full text-terminal-sm font-mono border border-border rounded px-1 py-0.5 bg-white focus:border-brand-purple-deep focus:ring-1 focus:ring-brand-purple-deep outline-none"
                    >
                      <option value="">{txn.predicted_coa_code ? `${txn.predicted_coa_code} - ${coaLookup.get(txn.predicted_coa_code)?.name || 'Unknown'}` : 'Select...'}</option>
                      {Object.entries(coaGroupedByEntity).map(([entity, opts]) => (
                        <optgroup key={entity} label={entity || 'General'}>
                          {opts.map(o => <option key={o.id} value={`${o.code}|${o.entity_id || ''}`}>{o.code} - {o.name}</option>)}
                        </optgroup>
                      ))}
                      <option value="__NEW__">+ Add Category</option>
                    </select>
                  ) : (() => {
                    const jp = (txn as any).journalProof;
                    const drEntry = jp?.ledgerEntries?.find((e: any) => e.entryType === 'D' && e.accountCode !== txn.accountCode);
                    const drName = jp?.ledgerEntries?.find((e: any) => e.entryType === 'D' && e.accountCode === txn.accountCode)?.accountName;
                    const displayName = drName || coaLookup.get(txn.accountCode!)?.name;
                    return (
                      <span className="font-mono text-brand-green text-terminal-sm">
                        {txn.accountCode}
                        {displayName && <span className="text-text-faint ml-1">{displayName}</span>}
                      </span>
                    );
                  })()}
                </td>
                {/* JE Proof columns */}
                {variant === 'committed' && (() => {
                  const jp = (txn as any).journalProof;
                  const balanced = isProofBalanced(jp);
                  return (
                    <>
                      <td className="py-1 px-2 font-mono text-terminal-sm whitespace-nowrap text-brand-purple" title={jp?.jeId || ''}>
                        {jp?.jeId ? jp.jeId.slice(0, 8) : '\u2014'}
                      </td>
                      <td className="py-1 px-2 text-terminal-sm text-text-secondary truncate" title={getProofDrAccounts(jp)}>
                        {getProofDrAccounts(jp)}
                      </td>
                      <td className="py-1 px-2 text-terminal-sm text-text-secondary truncate" title={getProofCrAccounts(jp)}>
                        {getProofCrAccounts(jp)}
                      </td>
                      <td className="py-1 px-2 text-center text-terminal-base">
                        {balanced === null ? '\u2014' : balanced ? <span className="text-brand-green font-bold">{'\u2713'}</span> : <span className="text-brand-red font-bold">{'\u2717'}</span>}
                      </td>
                      <td className="py-1 px-2 text-terminal-sm text-text-muted truncate">{jp?.entityName || '\u2014'}</td>
                      <td className="py-1 px-2 text-terminal-sm text-text-muted truncate" title={jp?.createdBy || ''}>
                        {jp?.createdBy || '\u2014'}
                      </td>
                      <td className="py-1 px-2 text-terminal-sm text-text-faint font-mono whitespace-nowrap">{formatProofDate(jp?.createdAt)}</td>
                      <td className="py-1 px-2 text-center" title="Immutable (trigger-enforced)">
                        <span className="text-brand-gold">{'\uD83D\uDD12'}</span>
                      </td>
                    </>
                  );
                })()}
              </tr>
            );
          })}
          {/* bottom spacer */}
          {virtualizer.getVirtualItems().length > 0 && (
            <tr style={{
              height: virtualizer.getTotalSize() - (virtualizer.getVirtualItems()[virtualizer.getVirtualItems().length - 1]?.end || 0)
            }}>
              <td colSpan={variant === 'pending' ? 8 : 16} />
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}


// ─── Toast ───────────────────────────────────────────────────────────────────

function Toast({ message, onDone }: { message: string; onDone: () => void }) {
  useEffect(() => { const t = setTimeout(onDone, 3000); return () => clearTimeout(t); }, [onDone]);
  return (
    <div className="fixed bottom-4 right-4 z-50 bg-green-600 text-white px-4 py-3 rounded shadow-sm text-sm font-medium animate-[fadeIn_0.2s_ease-in]">
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
  const [showCreateCoa, setShowCreateCoa] = useState(false);
  const [localCoaOptions, setLocalCoaOptions] = useState<CoaOption[]>(coaOptions);
  const [committing, setCommitting] = useState(false);
  const [uncommitting, setUncommitting] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [activeTable, setActiveTable] = useState<'pending' | 'committed'>('pending');
  const [pendingColFilters, setPendingColFilters] = useState<ColumnFilters>(EMPTY_COL_FILTERS);
  const [committedColFilters, setCommittedColFilters] = useState<ColumnFilters>(EMPTY_COL_FILTERS);

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

  const pendingAccounts = useMemo(() => {
    const m = new Map<string, number>();
    transactions.forEach(t => { const k = t.accountName || 'Unknown'; m.set(k, (m.get(k) || 0) + 1); });
    return Array.from(m.entries()).sort((a, b) => b[1] - a[1]);
  }, [transactions]);

  // Filtered + sorted rows (top-level filters AND column filters stacked)
  const pendingRows = useMemo(() => {
    let filtered = applyFilters(transactions, pendingFilters);
    filtered = applyColumnFilters(filtered, pendingColFilters);
    return sortTransactions(filtered, pendingSort.field, pendingSort.dir);
  }, [transactions, pendingFilters, pendingColFilters, pendingSort]);

  const committedRows = useMemo(() => {
    let filtered = applyFilters(committedTransactions, committedFilters);
    filtered = applyColumnFilters(filtered, committedColFilters);
    return sortTransactions(filtered, committedSort.field, committedSort.dir);
  }, [committedTransactions, committedFilters, committedColFilters, committedSort]);

  const hasActiveFilters = (f: ActiveFilters) =>
    f.search || f.merchants.length || f.categories.length || f.accounts.length || f.channels.length || f.dateFrom || f.dateTo || f.amountMin || f.amountMax;

  const pendingColFilterCount = countActiveColumnFilters(pendingColFilters);
  const committedColFilterCount = countActiveColumnFilters(committedColFilters);
  const hasPendingColFilters = pendingColFilterCount > 0;
  const hasCommittedColFilters = committedColFilterCount > 0;

  // Selection totals
  const selectedPendingAmount = useMemo(() =>
    transactions.filter(t => selectedPending.has(t.id)).reduce((s, t) => s + Math.abs(t.amount), 0),
    [transactions, selectedPending]
  );

  // Handlers
  const handlePendingSort = (field: SortField, forcedDir?: SortDir) => {
    setPendingSort(prev => ({
      field,
      dir: forcedDir ?? (prev.field === field && prev.dir === 'asc' ? 'desc' : 'asc')
    }));
  };

  const handleCommittedSort = (field: SortField, forcedDir?: SortDir) => {
    setCommittedSort(prev => ({
      field,
      dir: forcedDir ?? (prev.field === field && prev.dir === 'asc' ? 'desc' : 'asc')
    }));
  };

  const handlePendingColFilter = useCallback((field: SortField, value: ColumnFilterValue | undefined) => {
    setPendingColFilters(prev => {
      const next = { ...prev };
      if (value) next[field] = value; else delete next[field];
      return next;
    });
  }, []);

  const handleCommittedColFilter = useCallback((field: SortField, value: ColumnFilterValue | undefined) => {
    setCommittedColFilters(prev => {
      const next = { ...prev };
      if (value) next[field] = value; else delete next[field];
      return next;
    });
  }, []);

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

    // Parse "code|entity_id" from dropdown value
    const [accountCode, coaEntityId] = batchCoa.split('|');

    setCommitting(true);
    try {
      const res = await fetch('/api/transactions/commit-to-ledger', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ transactionIds: ids, accountCode, subAccount: batchSub || null, entityId: coaEntityId || undefined })
      });
      const data = await res.json();
      if (data.success) {
        setToast(`Committed ${data.committed} transaction${data.committed !== 1 ? 's' : ''}`);
        setSelectedPending(new Set());
        setBatchCoa('');
        setBatchSub('');
        await onReload();
      } else {
        const errMsg = data.error || data.errors?.map((e: { error: string }) => e.error).join(', ') || 'Commit failed';
        alert(`Commit failed: ${errMsg}`);
      }
    } catch (e) {
      console.error('Batch commit error:', e);
      alert(`Commit error: ${e instanceof Error ? e.message : 'Network error'}`);
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
        // Parse "code|entity_id" from dropdown value
        const [accountCode, coaEntityId] = change.coa.split('|');
        const res = await fetch('/api/transactions/commit-to-ledger', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ transactionIds: [id], accountCode, subAccount: change.sub || null, entityId: coaEntityId || undefined })
        });
        const data = await res.json();
        if (data.success) committed += data.committed;
      }
      if (committed > 0) {
        setToast(`Committed ${committed} transaction${committed !== 1 ? 's' : ''}`);
        setRowChanges({});
        await onReload();
      } else {
        alert('No transactions were committed — check that accounts have COA codes mapped');
      }
    } catch (e) {
      console.error('Row commit error:', e);
      alert(`Commit error: ${e instanceof Error ? e.message : 'Network error'}`);
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
      } else {
        alert(`Uncommit failed: ${data.error || 'Unknown error'}`);
      }
    } catch (e) {
      console.error('Uncommit error:', e);
      alert(`Uncommit error: ${e instanceof Error ? e.message : 'Network error'}`);
    }
    setUncommitting(false);
  };

  const handleCoaCreated = (account: CoaOption) => {
    setLocalCoaOptions(prev => [...prev, account].sort((a, b) => a.code.localeCompare(b.code)));
  };

  const rowsWithCoa = Object.entries(rowChanges).filter(([_, c]) => c.coa && c.coa !== '__NEW__').length;

  if (!transactions && !committedTransactions) {
    return <div className="p-4 text-center text-text-faint">Loading...</div>;
  }

  return (
    <div className="space-y-2">
      {/* Compact Filter Bar — always visible */}
      <div className="flex items-center gap-2 flex-wrap">
        <input
          type="text"
          placeholder="Search..."
          value={activeTable === 'pending' ? pendingFilters.search : committedFilters.search}
          onChange={e => activeTable === 'pending'
            ? setPendingFilters(prev => ({ ...prev, search: e.target.value }))
            : setCommittedFilters(prev => ({ ...prev, search: e.target.value }))}
          className="flex-1 min-w-[120px] max-w-[200px] h-7 px-2 text-terminal-sm font-mono border border-border rounded bg-white focus:border-brand-purple-deep outline-none"
        />
        <input type="date" value={pendingFilters.dateFrom} onChange={e => setPendingFilters(prev => ({ ...prev, dateFrom: e.target.value }))}
          className="h-7 px-1.5 text-terminal-sm font-mono border border-border rounded bg-white" />
        <span className="text-terminal-xs text-text-faint">{'\u2192'}</span>
        <input type="date" value={pendingFilters.dateTo} onChange={e => setPendingFilters(prev => ({ ...prev, dateTo: e.target.value }))}
          className="h-7 px-1.5 text-terminal-sm font-mono border border-border rounded bg-white" />
        <input type="number" placeholder="Min $" value={pendingFilters.amountMin} onChange={e => setPendingFilters(prev => ({ ...prev, amountMin: e.target.value }))}
          className="w-16 h-7 px-1.5 text-terminal-sm font-mono border border-border rounded bg-white" />
        <span className="text-terminal-xs text-text-faint">-</span>
        <input type="number" placeholder="Max $" value={pendingFilters.amountMax} onChange={e => setPendingFilters(prev => ({ ...prev, amountMax: e.target.value }))}
          className="w-16 h-7 px-1.5 text-terminal-sm font-mono border border-border rounded bg-white" />
        <MultiSelectFilter label="Merchant" options={pendingMerchants} selected={pendingFilters.merchants}
          onToggle={val => toggleFilter(pendingFilters, setPendingFilters, 'merchants', val)} />
        <MultiSelectFilter label="Account" options={pendingAccounts} selected={pendingFilters.accounts}
          onToggle={val => toggleFilter(pendingFilters, setPendingFilters, 'accounts', val)} />
        {(hasActiveFilters(pendingFilters) || hasPendingColFilters) && (
          <button onClick={() => { setPendingFilters(EMPTY_FILTERS); setPendingColFilters(EMPTY_COL_FILTERS); }}
            className="text-terminal-sm text-brand-red hover:underline font-mono">Clear</button>
        )}
        {rowsWithCoa > 0 && (
          <Button size="sm" loading={committing} onClick={handleRowCommit} className="ml-auto">
            Commit {rowsWithCoa} Row{rowsWithCoa !== 1 ? 's' : ''}
          </Button>
        )}
      </div>

      {/* Table Tabs */}
      <div className="flex border-b border-border">
        <button
          onClick={() => setActiveTable('pending')}
          className={`px-3 py-1 text-terminal-base font-mono font-medium border-b-2 transition-colors ${
            activeTable === 'pending'
              ? 'border-brand-amber text-brand-amber'
              : 'border-transparent text-text-muted hover:text-text-secondary'
          }`}
        >
          Pending ({pendingRows.length}{hasActiveFilters(pendingFilters) || hasPendingColFilters ? ` of ${transactions.length}` : ''})
        </button>
        <button
          onClick={() => setActiveTable('committed')}
          className={`px-3 py-1 text-terminal-base font-mono font-medium border-b-2 transition-colors ${
            activeTable === 'committed'
              ? 'border-brand-green text-brand-green'
              : 'border-transparent text-text-muted hover:text-text-secondary'
          }`}
        >
          Committed ({committedRows.length}{hasActiveFilters(committedFilters) || hasCommittedColFilters ? ` of ${committedTransactions.length}` : ''})
        </button>
      </div>

      {/* Pending Table */}
      {activeTable === 'pending' && (
        <>
          {pendingRows.length === 0 ? (
            <div className="text-center py-12 text-text-faint">
              {transactions.length === 0 ? (
                <>
                  <div className="text-3xl mb-2">✓</div>
                  <p className="text-sm">All transactions have been committed</p>
                </>
              ) : (
                <>
                  <p className="text-sm">No transactions match current filters</p>
                  <button onClick={() => { setPendingFilters(EMPTY_FILTERS); setPendingColFilters(EMPTY_COL_FILTERS); }} className="text-xs text-brand-purple-deep mt-2 underline">Clear filters</button>
                </>
              )}
            </div>
          ) : (
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
              allTransactions={transactions}
              columnFilters={pendingColFilters}
              onApplyColumnFilter={handlePendingColFilter}
            />
          )}
        </>
      )}

      {/* Committed Table */}
      {activeTable === 'committed' && (
        <>
          {/* Committed filter bar */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <input
              type="text"
              placeholder="Search committed..."
              value={committedFilters.search}
              onChange={e => setCommittedFilters(prev => ({ ...prev, search: e.target.value }))}
              className="flex-1 max-w-xs px-2 py-1 text-terminal-base font-mono border rounded bg-white focus:border-brand-purple-deep outline-none"
            />
            {hasActiveFilters(committedFilters) && (
              <button onClick={() => setCommittedFilters(EMPTY_FILTERS)} className="text-terminal-sm text-brand-red">Clear search</button>
            )}
            {hasCommittedColFilters && (
              <button onClick={() => setCommittedColFilters(EMPTY_COL_FILTERS)} className="text-terminal-sm text-brand-amber hover:text-brand-red">Clear column filters</button>
            )}
          </div>
          {/* Committed column filter pills */}
          {hasCommittedColFilters && (
            <div className="flex flex-wrap gap-1.5">
              {(Object.entries(committedColFilters) as [SortField, ColumnFilterValue][]).map(([field, filter]) => filter && (
                <span key={`col-${field}`} className="inline-flex items-center gap-1 px-2 py-0.5 bg-amber-100 text-amber-800 rounded-full text-[10px]">
                  {columnFilterLabel(field)}: {columnFilterSummary(filter)}
                  <button onClick={() => handleCommittedColFilter(field, undefined)} className="hover:text-brand-red">{'\u00D7'}</button>
                </span>
              ))}
            </div>
          )}
          {committedRows.length === 0 ? (
            <div className="text-center py-12 text-text-faint">
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
              allTransactions={committedTransactions}
              columnFilters={committedColFilters}
              onApplyColumnFilter={handleCommittedColFilter}
            />
          )}
        </>
      )}

      {/* Batch Commit Bar (sticky bottom when pending selected) */}
      {selectedPending.size > 0 && activeTable === 'pending' && (
        <div className="sticky bottom-0 left-0 right-0 bg-brand-purple-deep text-white p-2 rounded shadow-sm z-20">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-terminal-base font-mono font-medium">
              {selectedPending.size} txn{selectedPending.size !== 1 ? 's' : ''}
              <span className="ml-1 text-white/60">({formatMoney(selectedPendingAmount)})</span>
            </span>
            <select
              value={batchCoa}
              onChange={e => {
                if (e.target.value === '__NEW__') { setShowCreateCoa(true); return; }
                setBatchCoa(e.target.value);
              }}
              className="flex-1 min-w-[200px] bg-brand-purple-hover text-white border-0 text-terminal-base font-mono px-2 py-1 rounded"
            >
              <option value="">Select COA...</option>
              {Object.entries(coaGroupedByEntity).map(([entity, opts]) => (
                <optgroup key={entity} label={entity || 'General'}>
                  {opts.map(o => <option key={o.id} value={`${o.code}|${o.entity_id || ''}`}>{o.code} - {o.name}</option>)}
                </optgroup>
              ))}
              <option value="__NEW__">+ Add Category</option>
            </select>
            <input
              type="text"
              placeholder="Sub-account"
              value={batchSub}
              onChange={e => setBatchSub(e.target.value)}
              className="w-32 bg-brand-purple-hover text-white border-0 text-terminal-base font-mono px-2 py-1 rounded placeholder-white/40"
            />
            <Button
              size="sm"
              loading={committing}
              disabled={!batchCoa}
              onClick={handleBatchCommit}
              className="!bg-green-500 hover:!bg-green-600 !text-white"
            >
              Commit
            </Button>
            <button
              onClick={() => setSelectedPending(new Set())}
              className="text-white/60 hover:text-white text-terminal-sm underline"
            >
              Clear
            </button>
          </div>
        </div>
      )}

      {/* Uncommit Bar (sticky bottom when committed selected) */}
      {selectedCommitted.size > 0 && activeTable === 'committed' && (
        <div className="sticky bottom-0 left-0 right-0 bg-brand-red text-white p-2 rounded shadow-sm z-20">
          <div className="flex items-center gap-2">
            <span className="text-terminal-base font-mono font-medium">
              {selectedCommitted.size} txn{selectedCommitted.size !== 1 ? 's' : ''} to uncommit
            </span>
            <div className="flex-1" />
            <Button
              size="sm"
              variant="danger"
              loading={uncommitting}
              onClick={handleUncommit}
              className="!bg-white !text-brand-red hover:!bg-red-50"
            >
              Uncommit
            </Button>
            <button
              onClick={() => setSelectedCommitted(new Set())}
              className="text-white/60 hover:text-white text-terminal-sm underline"
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
