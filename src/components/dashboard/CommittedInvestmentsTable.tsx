'use client';

import { useState, useMemo, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useVirtualizer } from '@tanstack/react-virtual';

// ─── Types ───────────────────────────────────────────────────────────────────

interface InvestmentTxn {
  id: string;
  date: string;
  name: string;
  amount: number | null;
  price: number | null;
  quantity: number | null;
  fees: number | null;
  subtype: string | null;
  type: string | null;
  accountCode: string | null;
  strategy: string | null;
  tradeNum: string | null;
  security_id: string | null;
  security?: {
    ticker_symbol: string | null;
    name: string | null;
    option_contract_type: string | null;
    option_strike_price: number | null;
    option_expiration_date: string | null;
    option_underlying_ticker: string | null;
  } | null;
  updatedAt?: string;
}

type SortField = 'date' | 'symbol' | 'name' | 'action' | 'quantity' | 'price' | 'amount' | 'fees' | 'strategy' | 'accountCode' | 'tradeNum';
type SortDir = 'asc' | 'desc';

type ColumnFilterValue =
  | { type: 'checkbox'; selected: string[] }
  | { type: 'dateRange'; from: string; to: string }
  | { type: 'amountRange'; min: string; max: string }
  | { type: 'search'; term: string };

type ColumnFilters = Partial<Record<SortField, ColumnFilterValue>>;

const COLUMN_FILTER_TYPE: Record<SortField, 'checkbox' | 'dateRange' | 'amountRange' | 'search'> = {
  date: 'dateRange',
  symbol: 'checkbox',
  name: 'search',
  action: 'checkbox',
  quantity: 'amountRange',
  price: 'amountRange',
  amount: 'amountRange',
  fees: 'amountRange',
  strategy: 'checkbox',
  accountCode: 'checkbox',
  tradeNum: 'checkbox',
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getSymbol(txn: InvestmentTxn): string {
  return txn.security?.option_underlying_ticker
    || txn.security?.ticker_symbol
    || txn.name?.split(' ').find((p: string) => /^[A-Z]{1,6}$/.test(p))
    || '-';
}

function getAction(txn: InvestmentTxn): string {
  const n = (txn.name || '').toLowerCase();
  if (n.startsWith('sell')) return 'SELL';
  if (n.startsWith('buy')) return 'BUY';
  if (n.includes('exercise')) return 'EXERCISE';
  if (n.includes('assignment')) return 'ASSIGN';
  if (n.includes('expir')) return 'EXPIRE';
  if (n.includes('dividend')) return 'DIV';
  if (txn.subtype) return txn.subtype.toUpperCase();
  return txn.type?.toUpperCase() || '-';
}

function formatDate(d: string) {
  const dt = new Date(d);
  return `${String(dt.getMonth() + 1).padStart(2, '0')}/${String(dt.getDate()).padStart(2, '0')}/${dt.getFullYear()}`;
}

function formatMoney(n: number) {
  return '$' + Math.abs(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function getFieldValue(txn: InvestmentTxn, field: SortField): string {
  switch (field) {
    case 'date': return txn.date;
    case 'symbol': return getSymbol(txn);
    case 'name': return txn.name;
    case 'action': return getAction(txn);
    case 'quantity': return String(Math.abs(txn.quantity || 0));
    case 'price': return String(txn.price || 0);
    case 'amount': return String(Math.abs(txn.amount || 0));
    case 'fees': return String(txn.fees || 0);
    case 'strategy': return txn.strategy || '-';
    case 'accountCode': return txn.accountCode || '-';
    case 'tradeNum': return txn.tradeNum || '-';
  }
}

function getUniqueValues(txns: InvestmentTxn[], field: SortField): [string, number][] {
  const m = new Map<string, number>();
  txns.forEach(t => {
    const v = getFieldValue(t, field);
    if (v) m.set(v, (m.get(v) || 0) + 1);
  });
  return Array.from(m.entries()).sort((a, b) => a[0].localeCompare(b[0]));
}

function sortTxns(txns: InvestmentTxn[], field: SortField, dir: SortDir): InvestmentTxn[] {
  const sorted = [...txns];
  sorted.sort((a, b) => {
    let cmp = 0;
    switch (field) {
      case 'date': cmp = new Date(a.date).getTime() - new Date(b.date).getTime(); break;
      case 'symbol': cmp = getSymbol(a).localeCompare(getSymbol(b)); break;
      case 'name': cmp = a.name.localeCompare(b.name); break;
      case 'action': cmp = getAction(a).localeCompare(getAction(b)); break;
      case 'quantity': cmp = Math.abs(a.quantity || 0) - Math.abs(b.quantity || 0); break;
      case 'price': cmp = (a.price || 0) - (b.price || 0); break;
      case 'amount': cmp = Math.abs(a.amount || 0) - Math.abs(b.amount || 0); break;
      case 'fees': cmp = (a.fees || 0) - (b.fees || 0); break;
      case 'strategy': cmp = (a.strategy || '').localeCompare(b.strategy || ''); break;
      case 'accountCode': cmp = (a.accountCode || '').localeCompare(b.accountCode || ''); break;
      case 'tradeNum': cmp = Number(a.tradeNum || 0) - Number(b.tradeNum || 0); break;
    }
    return dir === 'asc' ? cmp : -cmp;
  });
  return sorted;
}

function applyColumnFilters(txns: InvestmentTxn[], colFilters: ColumnFilters): InvestmentTxn[] {
  let result = txns;
  for (const [field, filter] of Object.entries(colFilters) as [SortField, ColumnFilterValue][]) {
    if (!filter) continue;
    switch (filter.type) {
      case 'checkbox':
        if (filter.selected.length > 0)
          result = result.filter(t => filter.selected.includes(getFieldValue(t, field)));
        break;
      case 'dateRange':
        if (filter.from) { const f = new Date(filter.from); result = result.filter(t => new Date(t.date) >= f); }
        if (filter.to) { const to = new Date(filter.to); to.setHours(23, 59, 59, 999); result = result.filter(t => new Date(t.date) <= to); }
        break;
      case 'amountRange': {
        if (filter.min) { const min = parseFloat(filter.min); if (!isNaN(min)) result = result.filter(t => parseFloat(getFieldValue(t, field)) >= min); }
        if (filter.max) { const max = parseFloat(filter.max); if (!isNaN(max)) result = result.filter(t => parseFloat(getFieldValue(t, field)) <= max); }
        break;
      }
      case 'search':
        if (filter.term) { const lower = filter.term.toLowerCase(); result = result.filter(t => getFieldValue(t, field).toLowerCase().includes(lower)); }
        break;
    }
  }
  return result;
}

function columnFilterLabel(field: SortField): string {
  const labels: Record<SortField, string> = {
    date: 'Date', symbol: 'Symbol', name: 'Description', action: 'Action',
    quantity: 'Qty', price: 'Price', amount: 'Amount', fees: 'Fees',
    strategy: 'Strategy', accountCode: 'COA', tradeNum: 'Trade #',
  };
  return labels[field];
}

function columnFilterSummary(filter: ColumnFilterValue): string {
  switch (filter.type) {
    case 'checkbox': return filter.selected.slice(0, 2).join(', ') + (filter.selected.length > 2 ? ` +${filter.selected.length - 2}` : '');
    case 'dateRange': return [filter.from, filter.to].filter(Boolean).join(' \u2013 ');
    case 'amountRange': return ['$' + filter.min, '$' + filter.max].filter(v => v !== '$').join(' \u2013 ');
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

// ─── Column Filter Dropdown (portal) ─────────────────────────────────────────

function InvColumnFilterDropdown({
  field, filterType, allTransactions, currentFilter, onApply, onCancel, anchorEl,
  sortField, sortDir, onSortWithDir,
}: {
  field: SortField;
  filterType: 'checkbox' | 'dateRange' | 'amountRange' | 'search';
  allTransactions: InvestmentTxn[];
  currentFilter: ColumnFilterValue | undefined;
  onApply: (filter: ColumnFilterValue | undefined) => void;
  onCancel: () => void;
  anchorEl: HTMLElement | null;
  sortField: SortField;
  sortDir: SortDir;
  onSortWithDir: (field: SortField, dir: SortDir) => void;
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  const [localSearch, setLocalSearch] = useState('');
  const [localSelected, setLocalSelected] = useState<Set<string>>(() =>
    currentFilter?.type === 'checkbox' ? new Set(currentFilter.selected) : new Set()
  );
  const [localFrom, setLocalFrom] = useState(() => currentFilter?.type === 'dateRange' ? currentFilter.from : '');
  const [localTo, setLocalTo] = useState(() => currentFilter?.type === 'dateRange' ? currentFilter.to : '');
  const [localMin, setLocalMin] = useState(() => currentFilter?.type === 'amountRange' ? currentFilter.min : '');
  const [localMax, setLocalMax] = useState(() => currentFilter?.type === 'amountRange' ? currentFilter.max : '');
  const [localTerm, setLocalTerm] = useState(() => currentFilter?.type === 'search' ? currentFilter.term : '');

  const uniqueValues = useMemo(() => filterType === 'checkbox' ? getUniqueValues(allTransactions, field) : [], [allTransactions, field, filterType]);
  const filteredValues = useMemo(() => {
    if (!localSearch) return uniqueValues;
    const lower = localSearch.toLowerCase();
    return uniqueValues.filter(([val]) => val.toLowerCase().includes(lower));
  }, [uniqueValues, localSearch]);

  const [pos, setPos] = useState({ top: 0, left: 0, alignRight: false });
  useEffect(() => {
    if (!anchorEl) return;
    const rect = anchorEl.getBoundingClientRect();
    const alignRight = rect.left > window.innerWidth * 0.6;
    setPos({ top: rect.bottom + 4, left: alignRight ? 0 : rect.left, alignRight });
  }, [anchorEl]);

  useEffect(() => { const t = setTimeout(() => searchRef.current?.focus(), 50); return () => clearTimeout(t); }, []);

  useEffect(() => {
    const handler = (e: MouseEvent) => { if (panelRef.current && !panelRef.current.contains(e.target as Node)) onCancel(); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [onCancel]);

  const handleApply = () => {
    switch (filterType) {
      case 'checkbox': onApply(localSelected.size > 0 ? { type: 'checkbox', selected: Array.from(localSelected) } : undefined); break;
      case 'dateRange': onApply(localFrom || localTo ? { type: 'dateRange', from: localFrom, to: localTo } : undefined); break;
      case 'amountRange': onApply(localMin || localMax ? { type: 'amountRange', min: localMin, max: localMax } : undefined); break;
      case 'search': onApply(localTerm ? { type: 'search', term: localTerm } : undefined); break;
    }
  };

  const sortAscLabel = field === 'date' ? 'Sort Oldest First' : field === 'amount' || field === 'price' || field === 'quantity' || field === 'fees' ? 'Sort Low \u2192 High' : 'Sort A \u2192 Z';
  const sortDescLabel = field === 'date' ? 'Sort Newest First' : field === 'amount' || field === 'price' || field === 'quantity' || field === 'fees' ? 'Sort High \u2192 Low' : 'Sort Z \u2192 A';
  const isSortedAsc = sortField === field && sortDir === 'asc';
  const isSortedDesc = sortField === field && sortDir === 'desc';

  const panelStyle: React.CSSProperties = {
    top: pos.top,
    ...(pos.alignRight && anchorEl
      ? { right: window.innerWidth - anchorEl.getBoundingClientRect().right }
      : { left: pos.left }),
  };

  return createPortal(
    <div ref={panelRef} className="fixed bg-white border border-gray-200 rounded-lg shadow-xl z-[100] w-64" style={panelStyle}>
      <div className="border-b border-gray-100 p-2 space-y-1">
        <button onClick={() => { onSortWithDir(field, 'asc'); onCancel(); }}
          className={`w-full text-left px-2 py-1.5 text-xs rounded hover:bg-gray-50 flex items-center gap-2 ${isSortedAsc ? 'text-[#2d1b4e] font-semibold bg-[#2d1b4e]/5' : 'text-gray-600'}`}>
          <span className="text-[10px]">{'\u25B2'}</span> {sortAscLabel}
        </button>
        <button onClick={() => { onSortWithDir(field, 'desc'); onCancel(); }}
          className={`w-full text-left px-2 py-1.5 text-xs rounded hover:bg-gray-50 flex items-center gap-2 ${isSortedDesc ? 'text-[#2d1b4e] font-semibold bg-[#2d1b4e]/5' : 'text-gray-600'}`}>
          <span className="text-[10px]">{'\u25BC'}</span> {sortDescLabel}
        </button>
      </div>

      <div className="p-2">
        {filterType === 'checkbox' && (
          <>
            {uniqueValues.length > 6 && (
              <input ref={searchRef} type="text" placeholder="Search..." value={localSearch}
                onChange={e => setLocalSearch(e.target.value)}
                className="w-full px-2 py-1.5 text-xs border rounded mb-2 outline-none focus:border-[#2d1b4e]" />
            )}
            <div className="flex items-center justify-between mb-1 px-1">
              <button onClick={() => setLocalSelected(new Set(filteredValues.map(([v]) => v)))} className="text-[10px] text-[#2d1b4e] hover:underline">Select All</button>
              <button onClick={() => setLocalSelected(new Set())} className="text-[10px] text-red-500 hover:underline">Clear All</button>
            </div>
            <div className="max-h-[300px] overflow-auto border rounded">
              {filteredValues.map(([val, count]) => (
                <label key={val} className="flex items-center gap-2 px-2 py-1.5 hover:bg-gray-50 cursor-pointer text-xs">
                  <input type="checkbox" checked={localSelected.has(val)}
                    onChange={() => setLocalSelected(prev => { const next = new Set(prev); if (next.has(val)) next.delete(val); else next.add(val); return next; })}
                    className="w-3.5 h-3.5 rounded flex-shrink-0" />
                  <span className="truncate flex-1">{val}</span>
                  <span className="text-gray-400 text-[10px] flex-shrink-0">({count})</span>
                </label>
              ))}
              {filteredValues.length === 0 && <div className="px-2 py-3 text-center text-gray-400 text-xs">No values found</div>}
            </div>
          </>
        )}

        {filterType === 'dateRange' && (
          <div className="space-y-2">
            <div><label className="block text-[10px] text-gray-500 mb-1">From</label>
              <input ref={searchRef} type="date" value={localFrom} onChange={e => setLocalFrom(e.target.value)} className="w-full px-2 py-1.5 text-xs border rounded outline-none focus:border-[#2d1b4e]" /></div>
            <div><label className="block text-[10px] text-gray-500 mb-1">To</label>
              <input type="date" value={localTo} onChange={e => setLocalTo(e.target.value)} className="w-full px-2 py-1.5 text-xs border rounded outline-none focus:border-[#2d1b4e]" /></div>
          </div>
        )}

        {filterType === 'amountRange' && (
          <div className="space-y-2">
            <div><label className="block text-[10px] text-gray-500 mb-1">Min</label>
              <input ref={searchRef} type="number" placeholder="0" value={localMin} onChange={e => setLocalMin(e.target.value)} className="w-full px-2 py-1.5 text-xs border rounded outline-none focus:border-[#2d1b4e]" /></div>
            <div><label className="block text-[10px] text-gray-500 mb-1">Max</label>
              <input type="number" placeholder="999999" value={localMax} onChange={e => setLocalMax(e.target.value)} className="w-full px-2 py-1.5 text-xs border rounded outline-none focus:border-[#2d1b4e]" /></div>
          </div>
        )}

        {filterType === 'search' && (
          <input ref={searchRef} type="text" placeholder="Search..." value={localTerm}
            onChange={e => setLocalTerm(e.target.value)}
            className="w-full px-2 py-1.5 text-xs border rounded outline-none focus:border-[#2d1b4e]" />
        )}
      </div>

      <div className="border-t border-gray-100 p-2 flex justify-between gap-2">
        <button onClick={() => onApply(undefined)} className="text-[10px] text-red-500 hover:underline">Clear</button>
        <div className="flex gap-2">
          <button onClick={onCancel} className="px-3 py-1 text-xs border rounded hover:bg-gray-50">Cancel</button>
          <button onClick={handleApply} className="px-3 py-1 text-xs bg-[#2d1b4e] text-white rounded hover:bg-[#3d2b5e]">Apply</button>
        </div>
      </div>
    </div>,
    document.body
  );
}

// ─── Filterable Header ──────────────────────────────────────────────────────

function InvFilterableHeader({
  label, field, sortField, sortDir, onSort, filterType, allTransactions,
  columnFilter, onApplyColumnFilter, className,
}: {
  label: string;
  field: SortField;
  sortField: SortField;
  sortDir: SortDir;
  onSort: (f: SortField, dir?: SortDir) => void;
  filterType: 'checkbox' | 'dateRange' | 'amountRange' | 'search';
  allTransactions: InvestmentTxn[];
  columnFilter: ColumnFilterValue | undefined;
  onApplyColumnFilter: (field: SortField, value: ColumnFilterValue | undefined) => void;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const btnRef = useRef<HTMLButtonElement>(null);
  const isSortActive = sortField === field;
  const hasFilter = !!columnFilter;

  return (
    <th className={`px-2 py-2.5 text-xs font-semibold select-none ${className || ''}`}>
      <span className="flex items-center gap-0.5">
        <span className="cursor-pointer hover:underline truncate" onClick={() => onSort(field)}>
          {label}
          {isSortActive && <span className="text-[10px] ml-0.5">{sortDir === 'asc' ? '\u25B2' : '\u25BC'}</span>}
        </span>
        <button ref={btnRef} onClick={e => { e.stopPropagation(); setOpen(!open); }}
          className={`ml-auto w-4 h-4 flex items-center justify-center rounded text-[9px] flex-shrink-0 ${
            hasFilter ? 'text-amber-400 bg-amber-400/20' : 'text-white/40 hover:text-white/80 hover:bg-white/10'
          }`}>
          {'\u25BC'}
        </button>
      </span>
      {open && (
        <InvColumnFilterDropdown
          field={field} filterType={filterType} allTransactions={allTransactions}
          currentFilter={columnFilter}
          onApply={(val) => { onApplyColumnFilter(field, val); setOpen(false); }}
          onCancel={() => setOpen(false)}
          anchorEl={btnRef.current}
          sortField={sortField} sortDir={sortDir}
          onSortWithDir={(f, d) => onSort(f, d)}
        />
      )}
    </th>
  );
}

// ─── Main Component ──────────────────────────────────────────────────────────

interface CommittedInvestmentsTableProps {
  committedInvestments: any[];
  selectedCommittedInvestments: string[];
  setSelectedCommittedInvestments: (ids: string[]) => void;
  massUncommitInvestments: () => void;
}

export default function CommittedInvestmentsTable({
  committedInvestments,
  selectedCommittedInvestments,
  setSelectedCommittedInvestments,
  massUncommitInvestments,
}: CommittedInvestmentsTableProps) {
  const parentRef = useRef<HTMLDivElement>(null);
  const ROW_HEIGHT = 44;

  // State
  const [search, setSearch] = useState('');
  const [sortField, setSortField] = useState<SortField>('date');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const [columnFilters, setColumnFilters] = useState<ColumnFilters>({});

  const txns = committedInvestments as InvestmentTxn[];

  const handleSort = (field: SortField, forcedDir?: SortDir) => {
    if (forcedDir) { setSortField(field); setSortDir(forcedDir); return; }
    if (sortField === field) { setSortDir(d => d === 'asc' ? 'desc' : 'asc'); }
    else { setSortField(field); setSortDir(field === 'date' ? 'desc' : 'asc'); }
  };

  const handleApplyColumnFilter = (field: SortField, value: ColumnFilterValue | undefined) => {
    setColumnFilters(prev => {
      const next = { ...prev };
      if (value) next[field] = value; else delete next[field];
      return next;
    });
  };

  // Filter pipeline
  const filtered = useMemo(() => {
    let result = txns;
    // Keyword search
    if (search) {
      const lower = search.toLowerCase();
      result = result.filter(t =>
        t.name.toLowerCase().includes(lower) ||
        getSymbol(t).toLowerCase().includes(lower) ||
        getAction(t).toLowerCase().includes(lower) ||
        (t.strategy || '').toLowerCase().includes(lower) ||
        (t.accountCode || '').toLowerCase().includes(lower) ||
        (t.tradeNum || '').toLowerCase().includes(lower)
      );
    }
    // Column filters
    result = applyColumnFilters(result, columnFilters);
    // Sort
    result = sortTxns(result, sortField, sortDir);
    return result;
  }, [txns, search, columnFilters, sortField, sortDir]);

  const virtualizer = useVirtualizer({
    count: filtered.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: 20,
  });

  const selectedSet = useMemo(() => new Set(selectedCommittedInvestments), [selectedCommittedInvestments]);
  const allSelected = filtered.length > 0 && filtered.every(r => selectedSet.has(r.id));

  const toggleAll = () => {
    if (allSelected) {
      const filterIds = new Set(filtered.map(r => r.id));
      setSelectedCommittedInvestments(selectedCommittedInvestments.filter(id => !filterIds.has(id)));
    } else {
      const newSet = new Set(selectedCommittedInvestments);
      filtered.forEach(r => newSet.add(r.id));
      setSelectedCommittedInvestments(Array.from(newSet));
    }
  };

  const toggleOne = (id: string) => {
    if (selectedSet.has(id)) {
      setSelectedCommittedInvestments(selectedCommittedInvestments.filter(i => i !== id));
    } else {
      setSelectedCommittedInvestments([...selectedCommittedInvestments, id]);
    }
  };

  const activeColFilterCount = countActiveColumnFilters(columnFilters);

  if (txns.length === 0) return null;

  return (
    <div className="mt-6">
      {/* Header */}
      <div className="bg-[#2d1b4e] text-white px-4 py-3 flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold">Committed Investment Transactions</h3>
          <p className="text-[10px] text-gray-300 font-mono">
            {filtered.length === txns.length ? txns.length : `${filtered.length} of ${txns.length}`} transactions
            {selectedCommittedInvestments.length > 0 && ` \u00B7 ${selectedCommittedInvestments.length} selected`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {selectedCommittedInvestments.length > 0 && (
            <button onClick={massUncommitInvestments}
              className="px-3 py-1.5 bg-red-500 hover:bg-red-600 text-white text-xs font-medium rounded transition-colors">
              Uncommit ({selectedCommittedInvestments.length})
            </button>
          )}
        </div>
      </div>

      {/* Search + filter pills */}
      <div className="bg-gray-50 border-x border-gray-200 px-4 py-2 space-y-2">
        <div className="flex items-center gap-2">
          <input
            type="text"
            placeholder="Search symbol, name, strategy, COA, trade#..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="flex-1 px-3 py-1.5 text-xs border border-gray-200 rounded-lg outline-none focus:border-[#2d1b4e] focus:ring-1 focus:ring-[#2d1b4e]"
          />
          {(search || activeColFilterCount > 0) && (
            <button onClick={() => { setSearch(''); setColumnFilters({}); }}
              className="px-2 py-1.5 text-[10px] text-red-500 hover:text-red-700">
              Clear All
            </button>
          )}
        </div>

        {/* Column filter pills */}
        {activeColFilterCount > 0 && (
          <div className="flex flex-wrap gap-1">
            {(Object.entries(columnFilters) as [SortField, ColumnFilterValue][]).map(([field, filter]) => {
              if (!filter) return null;
              const hasContent = filter.type === 'checkbox' ? filter.selected.length > 0
                : filter.type === 'dateRange' ? !!(filter.from || filter.to)
                : filter.type === 'amountRange' ? !!(filter.min || filter.max)
                : filter.term.length > 0;
              if (!hasContent) return null;
              return (
                <span key={field} className="inline-flex items-center gap-1 px-2 py-0.5 bg-amber-100 text-amber-800 text-[10px] rounded-full">
                  <span className="font-semibold">{columnFilterLabel(field)}:</span>
                  <span className="truncate max-w-[120px]">{columnFilterSummary(filter)}</span>
                  <button onClick={() => handleApplyColumnFilter(field, undefined)} className="text-amber-500 hover:text-amber-700 ml-0.5">&times;</button>
                </span>
              );
            })}
          </div>
        )}
      </div>

      {/* Virtualized Table */}
      <div ref={parentRef} className="overflow-auto border border-gray-200 border-t-0" style={{ maxHeight: '600px' }}>
        <table className="w-full text-xs border-collapse min-w-[1100px]">
          <thead className="bg-[#2d1b4e] text-white sticky top-0 z-10">
            <tr>
              <th className="px-2 py-2.5 w-10 sticky left-0 bg-[#2d1b4e] z-20">
                <input type="checkbox" checked={allSelected} onChange={toggleAll} className="w-3.5 h-3.5 rounded" />
              </th>
              <InvFilterableHeader label="Date" field="date" sortField={sortField} sortDir={sortDir} onSort={handleSort}
                filterType="dateRange" allTransactions={txns} columnFilter={columnFilters.date} onApplyColumnFilter={handleApplyColumnFilter} className="w-24" />
              <InvFilterableHeader label="Symbol" field="symbol" sortField={sortField} sortDir={sortDir} onSort={handleSort}
                filterType="checkbox" allTransactions={txns} columnFilter={columnFilters.symbol} onApplyColumnFilter={handleApplyColumnFilter} className="w-20" />
              <InvFilterableHeader label="Action" field="action" sortField={sortField} sortDir={sortDir} onSort={handleSort}
                filterType="checkbox" allTransactions={txns} columnFilter={columnFilters.action} onApplyColumnFilter={handleApplyColumnFilter} className="w-20" />
              <InvFilterableHeader label="Description" field="name" sortField={sortField} sortDir={sortDir} onSort={handleSort}
                filterType="search" allTransactions={txns} columnFilter={columnFilters.name} onApplyColumnFilter={handleApplyColumnFilter} className="min-w-[180px]" />
              <InvFilterableHeader label="Qty" field="quantity" sortField={sortField} sortDir={sortDir} onSort={handleSort}
                filterType="amountRange" allTransactions={txns} columnFilter={columnFilters.quantity} onApplyColumnFilter={handleApplyColumnFilter} className="w-16 text-right" />
              <InvFilterableHeader label="Price" field="price" sortField={sortField} sortDir={sortDir} onSort={handleSort}
                filterType="amountRange" allTransactions={txns} columnFilter={columnFilters.price} onApplyColumnFilter={handleApplyColumnFilter} className="w-20 text-right" />
              <InvFilterableHeader label="Amount" field="amount" sortField={sortField} sortDir={sortDir} onSort={handleSort}
                filterType="amountRange" allTransactions={txns} columnFilter={columnFilters.amount} onApplyColumnFilter={handleApplyColumnFilter} className="w-24 text-right" />
              <InvFilterableHeader label="Fees" field="fees" sortField={sortField} sortDir={sortDir} onSort={handleSort}
                filterType="amountRange" allTransactions={txns} columnFilter={columnFilters.fees} onApplyColumnFilter={handleApplyColumnFilter} className="w-16 text-right" />
              <InvFilterableHeader label="Strategy" field="strategy" sortField={sortField} sortDir={sortDir} onSort={handleSort}
                filterType="checkbox" allTransactions={txns} columnFilter={columnFilters.strategy} onApplyColumnFilter={handleApplyColumnFilter} className="w-28" />
              <InvFilterableHeader label="COA" field="accountCode" sortField={sortField} sortDir={sortDir} onSort={handleSort}
                filterType="checkbox" allTransactions={txns} columnFilter={columnFilters.accountCode} onApplyColumnFilter={handleApplyColumnFilter} className="w-20" />
              <InvFilterableHeader label="Trade #" field="tradeNum" sortField={sortField} sortDir={sortDir} onSort={handleSort}
                filterType="checkbox" allTransactions={txns} columnFilter={columnFilters.tradeNum} onApplyColumnFilter={handleApplyColumnFilter} className="w-16 text-center" />
            </tr>
          </thead>
          <tbody>
            {/* top spacer */}
            {virtualizer.getVirtualItems().length > 0 && (
              <tr style={{ height: virtualizer.getVirtualItems()[0]?.start || 0 }}>
                <td colSpan={12} />
              </tr>
            )}
            {virtualizer.getVirtualItems().map(vRow => {
              const txn = filtered[vRow.index];
              const isSelected = selectedSet.has(txn.id);
              const symbol = getSymbol(txn);
              const action = getAction(txn);
              const isOption = !!(txn.security?.option_contract_type);
              const rowBg = isSelected ? 'bg-[#2d1b4e]/5' : vRow.index % 2 === 0 ? 'bg-white' : 'bg-gray-50/50';

              return (
                <tr key={txn.id} data-index={vRow.index}
                  className={`${rowBg} hover:bg-[#2d1b4e]/[.07] transition-colors`}
                  style={{ height: ROW_HEIGHT }}>
                  <td className="px-2 py-1 sticky left-0 z-[5]" style={{ background: 'inherit' }}>
                    <input type="checkbox" checked={isSelected} onChange={() => toggleOne(txn.id)} className="w-3.5 h-3.5 rounded" />
                  </td>
                  <td className="px-2 py-1 text-gray-600 whitespace-nowrap font-mono">{formatDate(txn.date)}</td>
                  <td className="px-2 py-1 font-medium text-gray-900">
                    {symbol}
                    {isOption && (
                      <span className={`ml-1 text-[9px] px-1 py-0.5 rounded ${
                        txn.security?.option_contract_type === 'call' ? 'bg-blue-50 text-blue-600' : 'bg-purple-50 text-purple-600'
                      }`}>
                        {txn.security?.option_contract_type?.toUpperCase()}
                      </span>
                    )}
                  </td>
                  <td className="px-2 py-1">
                    <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${
                      action === 'BUY' ? 'bg-blue-100 text-blue-700' :
                      action === 'SELL' ? 'bg-orange-100 text-orange-700' :
                      action === 'EXERCISE' || action === 'ASSIGN' ? 'bg-purple-100 text-purple-700' :
                      action === 'EXPIRE' ? 'bg-gray-100 text-gray-600' :
                      action === 'DIV' ? 'bg-green-100 text-green-700' :
                      'bg-gray-100 text-gray-600'
                    }`}>
                      {action}
                    </span>
                  </td>
                  <td className="px-2 py-1 text-gray-800 truncate" title={txn.name}>
                    {txn.name}
                    {isOption && txn.security?.option_strike_price && (
                      <span className="text-gray-400 ml-1 text-[10px]">
                        ${txn.security.option_strike_price} {txn.security.option_expiration_date ? new Date(txn.security.option_expiration_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : ''}
                      </span>
                    )}
                  </td>
                  <td className="px-2 py-1 text-right font-mono text-gray-700">{txn.quantity != null ? Math.abs(txn.quantity) : '\u2014'}</td>
                  <td className="px-2 py-1 text-right font-mono text-gray-700">{txn.price != null ? `$${txn.price.toFixed(2)}` : '\u2014'}</td>
                  <td className="px-2 py-1 text-right font-mono font-medium whitespace-nowrap">
                    <span className={(txn.amount || 0) > 0 ? 'text-red-700' : 'text-green-700'}>
                      {(txn.amount || 0) > 0 ? '-' : '+'}{formatMoney(txn.amount || 0)}
                    </span>
                  </td>
                  <td className="px-2 py-1 text-right font-mono text-gray-500">{txn.fees ? `$${txn.fees.toFixed(2)}` : '\u2014'}</td>
                  <td className="px-2 py-1 text-gray-700 truncate">{txn.strategy || '\u2014'}</td>
                  <td className="px-2 py-1 font-mono text-green-700 text-[11px]">{txn.accountCode || '\u2014'}</td>
                  <td className="px-2 py-1 text-center font-mono">{txn.tradeNum || '\u2014'}</td>
                </tr>
              );
            })}
            {/* bottom spacer */}
            {virtualizer.getVirtualItems().length > 0 && (
              <tr style={{
                height: virtualizer.getTotalSize() - (virtualizer.getVirtualItems()[virtualizer.getVirtualItems().length - 1]?.end || 0)
              }}>
                <td colSpan={12} />
              </tr>
            )}
          </tbody>
        </table>
        {filtered.length === 0 && (
          <div className="px-4 py-8 text-center text-gray-400 text-xs">
            {search || activeColFilterCount > 0 ? 'No transactions match your filters.' : 'No committed investment transactions.'}
          </div>
        )}
      </div>

      {/* Footer summary */}
      <div className="bg-gray-100 border border-gray-200 border-t-0 px-4 py-2 flex items-center justify-between text-xs">
        <span className="text-gray-500">{filtered.length} row{filtered.length !== 1 ? 's' : ''}</span>
        <span className="font-mono font-medium">
          Total: {formatMoney(filtered.reduce((s, t) => s + Math.abs(t.amount || 0), 0))}
        </span>
      </div>
    </div>
  );
}
