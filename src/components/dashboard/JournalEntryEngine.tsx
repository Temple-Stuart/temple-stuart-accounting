'use client';

import { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useVirtualizer } from '@tanstack/react-virtual';

// ─── Types ───────────────────────────────────────────────────────────────────

interface LedgerEntry {
  id: string;
  account_id: string;
  amount: number; // cents (BigInt serialized as number)
  entry_type: string; // 'D' or 'C'
  chart_of_accounts: {
    code: string;
    name: string;
    account_type: string;
  };
}

interface JournalTxn {
  id: string;
  transaction_date: string;
  description: string | null;
  is_reversal: boolean;
  reverses_journal_id: string | null;
  reversed_by_transaction_id: string | null;
  reversal_date: string | null;
  account_code: string | null;
  amount: number | null; // cents
  strategy: string | null;
  trade_num: string | null;
  created_at: string;
  posted_at: string | null;
  ledger_entries: LedgerEntry[];
}

interface CoaOption {
  id: string;
  code: string;
  name: string;
  accountType: string;
  balanceType: string;
  entity_type?: string | null;
}

interface JournalEntryEngineProps {
  journalTransactions: JournalTxn[];
  coaOptions: CoaOption[];
  onSave: (entry: any) => Promise<void>;
  onReload: () => void;
}

type SortField = 'date' | 'description' | 'type' | 'status' | 'debits' | 'credits';
type SortDir = 'asc' | 'desc';

type ColumnFilterValue =
  | { type: 'checkbox'; selected: string[] }
  | { type: 'dateRange'; from: string; to: string }
  | { type: 'amountRange'; min: string; max: string }
  | { type: 'search'; term: string };

type ColumnFilters = Partial<Record<SortField, ColumnFilterValue>>;

const COLUMN_FILTER_TYPE: Record<SortField, 'checkbox' | 'dateRange' | 'amountRange' | 'search'> = {
  date: 'dateRange',
  description: 'search',
  type: 'checkbox',
  status: 'checkbox',
  debits: 'amountRange',
  credits: 'amountRange',
};

interface JournalEntryLine {
  id?: string;
  accountCode: string;
  description: string;
  debit: string;
  credit: string;
}

const ENTRY_TYPES = [
  { value: 'adjusting', label: 'Adjusting Entry' },
  { value: 'reclassify', label: 'Reclassification' },
  { value: 'correction', label: 'Correction' },
  { value: 'accrual', label: 'Accrual' },
  { value: 'closing', label: 'Closing Entry' },
];

// ─── Helpers ─────────────────────────────────────────────────────────────────

const ROW_HEIGHT = 44;

function formatDate(d: string): string {
  const dt = new Date(d);
  return `${String(dt.getMonth() + 1).padStart(2, '0')}/${String(dt.getDate()).padStart(2, '0')}/${dt.getFullYear()}`;
}

function formatMoney(cents: number): string {
  return '$' + (Math.abs(cents) / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatMoneyDollars(dollars: number): string {
  return '$' + Math.abs(dollars).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function getDerivedType(txn: JournalTxn): string {
  return txn.is_reversal ? 'Reversal' : 'Original';
}

function getDerivedStatus(txn: JournalTxn): string {
  if (txn.is_reversal) return 'Reversal';
  if (txn.reversed_by_transaction_id) return 'Reversed';
  return 'Active';
}

function getDebits(txn: JournalTxn): number {
  return txn.ledger_entries.filter(e => e.entry_type === 'D').reduce((s, e) => s + e.amount, 0) / 100;
}

function getCredits(txn: JournalTxn): number {
  return txn.ledger_entries.filter(e => e.entry_type === 'C').reduce((s, e) => s + e.amount, 0) / 100;
}

function truncateId(id: string): string {
  return id.length > 8 ? id.slice(0, 8) + '...' : id;
}

function getFieldValue(txn: JournalTxn, field: SortField): string {
  switch (field) {
    case 'date': return txn.transaction_date;
    case 'description': return txn.description || '';
    case 'type': return getDerivedType(txn);
    case 'status': return getDerivedStatus(txn);
    case 'debits': return String(getDebits(txn));
    case 'credits': return String(getCredits(txn));
  }
}

function getUniqueValues(txns: JournalTxn[], field: SortField): [string, number][] {
  const m = new Map<string, number>();
  txns.forEach(t => {
    const v = getFieldValue(t, field);
    if (v) m.set(v, (m.get(v) || 0) + 1);
  });
  return Array.from(m.entries()).sort((a, b) => a[0].localeCompare(b[0]));
}

function sortTxns(txns: JournalTxn[], field: SortField, dir: SortDir): JournalTxn[] {
  const sorted = [...txns];
  sorted.sort((a, b) => {
    let cmp = 0;
    switch (field) {
      case 'date': cmp = new Date(a.transaction_date).getTime() - new Date(b.transaction_date).getTime(); break;
      case 'description': cmp = (a.description || '').localeCompare(b.description || ''); break;
      case 'type': cmp = getDerivedType(a).localeCompare(getDerivedType(b)); break;
      case 'status': cmp = getDerivedStatus(a).localeCompare(getDerivedStatus(b)); break;
      case 'debits': cmp = getDebits(a) - getDebits(b); break;
      case 'credits': cmp = getCredits(a) - getCredits(b); break;
    }
    return dir === 'asc' ? cmp : -cmp;
  });
  return sorted;
}

function applyColumnFilters(txns: JournalTxn[], colFilters: ColumnFilters): JournalTxn[] {
  let result = txns;
  for (const [field, filter] of Object.entries(colFilters) as [SortField, ColumnFilterValue][]) {
    if (!filter) continue;
    switch (filter.type) {
      case 'checkbox':
        if (filter.selected.length > 0)
          result = result.filter(t => filter.selected.includes(getFieldValue(t, field)));
        break;
      case 'dateRange':
        if (filter.from) { const f = new Date(filter.from); result = result.filter(t => new Date(t.transaction_date) >= f); }
        if (filter.to) { const to = new Date(filter.to); to.setHours(23, 59, 59, 999); result = result.filter(t => new Date(t.transaction_date) <= to); }
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
    date: 'Date',
    description: 'Description',
    type: 'Type',
    status: 'Status',
    debits: 'Debits',
    credits: 'Credits',
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

const emptyLine = (): JournalEntryLine => ({
  accountCode: '',
  description: '',
  debit: '',
  credit: '',
});

// ─── Column Filter Dropdown (portal) ─────────────────────────────────────────

function JournalColumnFilterDropdown({
  field, filterType, allTransactions, currentFilter, onApply, onCancel, anchorEl,
  sortField, sortDir, onSortWithDir,
}: {
  field: SortField;
  filterType: 'checkbox' | 'dateRange' | 'amountRange' | 'search';
  allTransactions: JournalTxn[];
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

  const isNumeric = field === 'debits' || field === 'credits';
  const sortAscLabel = field === 'date' ? 'Sort Oldest First' : isNumeric ? 'Sort Low \u2192 High' : 'Sort A \u2192 Z';
  const sortDescLabel = field === 'date' ? 'Sort Newest First' : isNumeric ? 'Sort High \u2192 Low' : 'Sort Z \u2192 A';
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

function JournalFilterableHeader({
  label, field, sortField, sortDir, onSort, filterType, allTransactions,
  columnFilter, onApplyColumnFilter, className,
}: {
  label: string;
  field: SortField;
  sortField: SortField;
  sortDir: SortDir;
  onSort: (f: SortField, dir?: SortDir) => void;
  filterType: 'checkbox' | 'dateRange' | 'amountRange' | 'search';
  allTransactions: JournalTxn[];
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
        <JournalColumnFilterDropdown
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

export default function JournalEntryEngine({ journalTransactions, coaOptions, onSave, onReload }: JournalEntryEngineProps) {
  const parentRef = useRef<HTMLDivElement>(null);

  // State
  const [search, setSearch] = useState('');
  const [sortField, setSortField] = useState<SortField>('date');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const [columnFilters, setColumnFilters] = useState<ColumnFilters>({});
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);

  // New entry form state
  const [newDate, setNewDate] = useState(new Date().toISOString().split('T')[0]);
  const [newType, setNewType] = useState('adjusting');
  const [newMemo, setNewMemo] = useState('');
  const [newLines, setNewLines] = useState<JournalEntryLine[]>([emptyLine(), emptyLine()]);
  const [saving, setSaving] = useState(false);

  const txns = journalTransactions;

  // Group COA by type
  const coaGrouped = useMemo(() => {
    const g: Record<string, CoaOption[]> = {};
    coaOptions.forEach(o => {
      if (!g[o.accountType]) g[o.accountType] = [];
      g[o.accountType].push(o);
    });
    return g;
  }, [coaOptions]);

  // Stats
  const reversalCount = useMemo(() => txns.filter(t => t.is_reversal).length, [txns]);

  const handleSort = useCallback((field: SortField, forcedDir?: SortDir) => {
    if (forcedDir) { setSortField(field); setSortDir(forcedDir); return; }
    if (sortField === field) { setSortDir(d => d === 'asc' ? 'desc' : 'asc'); }
    else { setSortField(field); setSortDir(field === 'date' ? 'desc' : 'asc'); }
  }, [sortField]);

  const handleApplyColumnFilter = useCallback((field: SortField, value: ColumnFilterValue | undefined) => {
    setColumnFilters(prev => {
      const next = { ...prev };
      if (value) next[field] = value; else delete next[field];
      return next;
    });
  }, []);

  // Filter pipeline
  const filtered = useMemo(() => {
    let result = txns;
    // Keyword search
    if (search) {
      const lower = search.toLowerCase();
      result = result.filter(t =>
        (t.description || '').toLowerCase().includes(lower)
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

  const activeColFilterCount = countActiveColumnFilters(columnFilters);

  // ─── New Entry Form Logic ────────────────────────────────────────────────

  const totalDebits = newLines.reduce((sum, l) => sum + (parseFloat(l.debit) || 0), 0);
  const totalCredits = newLines.reduce((sum, l) => sum + (parseFloat(l.credit) || 0), 0);
  const isBalanced = Math.abs(totalDebits - totalCredits) < 0.01 && totalDebits > 0;

  const updateLine = (index: number, field: keyof JournalEntryLine, value: string) => {
    const updated = [...newLines];
    updated[index] = { ...updated[index], [field]: value };
    setNewLines(updated);
  };

  const addLine = () => {
    setNewLines([...newLines, emptyLine()]);
  };

  const removeLine = (index: number) => {
    if (newLines.length > 2) {
      setNewLines(newLines.filter((_, i) => i !== index));
    }
  };

  const resetForm = () => {
    setNewDate(new Date().toISOString().split('T')[0]);
    setNewType('adjusting');
    setNewMemo('');
    setNewLines([emptyLine(), emptyLine()]);
  };

  const handleSave = async (status: 'draft' | 'posted') => {
    if (!isBalanced) return;

    const validLines = newLines.filter(l => l.accountCode && (l.debit || l.credit));
    if (validLines.length < 2) return;

    setSaving(true);
    await onSave({
      date: newDate,
      type: newType,
      memo: newMemo || null,
      status,
      lines: validLines,
    });
    resetForm();
    setShowForm(false);
    setSaving(false);
    onReload();
  };

  // ─── Render ──────────────────────────────────────────────────────────────

  return (
    <div className="bg-white rounded-xl border overflow-hidden">
      {/* Header */}
      <div className="bg-[#2d1b4e] text-white px-4 py-3 flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold">Journal Entries</h3>
          <p className="text-[10px] text-gray-300 font-mono">
            {txns.length} journal entries ({reversalCount} reversals)
          </p>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="px-4 py-1.5 bg-white/10 hover:bg-white/20 text-white rounded-lg text-xs font-medium transition-colors"
        >
          {showForm ? '\u2715 Cancel' : '+ New Entry'}
        </button>
      </div>

      {/* New Entry Form */}
      {showForm && (
        <div className="p-4 border-b bg-blue-50">
          <h4 className="font-semibold mb-3 text-sm">New Journal Entry</h4>

          {/* Entry Header */}
          <div className="flex flex-wrap gap-3 mb-4">
            <div>
              <label className="block text-xs text-gray-500 mb-1">Date</label>
              <input
                type="date"
                value={newDate}
                onChange={(e) => setNewDate(e.target.value)}
                className="px-3 py-2 border rounded-lg text-sm"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Type</label>
              <select
                value={newType}
                onChange={(e) => setNewType(e.target.value)}
                className="px-3 py-2 border rounded-lg text-sm"
              >
                {ENTRY_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </div>
            <div className="flex-1 min-w-[200px]">
              <label className="block text-xs text-gray-500 mb-1">Memo</label>
              <input
                type="text"
                value={newMemo}
                onChange={(e) => setNewMemo(e.target.value)}
                placeholder="Description of this entry..."
                className="w-full px-3 py-2 border rounded-lg text-sm"
              />
            </div>
          </div>

          {/* Entry Lines */}
          <table className="w-full text-sm mb-3">
            <thead className="bg-gray-100">
              <tr>
                <th className="px-2 py-2 text-left font-medium">Account</th>
                <th className="px-2 py-2 text-left font-medium">Description</th>
                <th className="px-2 py-2 text-right font-medium w-28">Debit</th>
                <th className="px-2 py-2 text-right font-medium w-28">Credit</th>
                <th className="w-8"></th>
              </tr>
            </thead>
            <tbody>
              {newLines.map((line, idx) => (
                <tr key={idx} className="border-b">
                  <td className="px-2 py-2">
                    <select
                      value={line.accountCode}
                      onChange={(e) => updateLine(idx, 'accountCode', e.target.value)}
                      className="w-full px-2 py-1 border rounded text-sm"
                    >
                      <option value="">Select account...</option>
                      {Object.entries(coaGrouped).map(([type, opts]) => (
                        <optgroup key={type} label={type}>
                          {opts.map(o => <option key={o.id} value={o.code}>{o.code} - {o.name}</option>)}
                        </optgroup>
                      ))}
                    </select>
                  </td>
                  <td className="px-2 py-2">
                    <input
                      type="text"
                      value={line.description}
                      onChange={(e) => updateLine(idx, 'description', e.target.value)}
                      placeholder="Line description..."
                      className="w-full px-2 py-1 border rounded text-sm"
                    />
                  </td>
                  <td className="px-2 py-2">
                    <input
                      type="number"
                      step="0.01"
                      value={line.debit}
                      onChange={(e) => updateLine(idx, 'debit', e.target.value)}
                      placeholder="0.00"
                      className="w-full px-2 py-1 border rounded text-sm text-right"
                      disabled={!!line.credit}
                    />
                  </td>
                  <td className="px-2 py-2">
                    <input
                      type="number"
                      step="0.01"
                      value={line.credit}
                      onChange={(e) => updateLine(idx, 'credit', e.target.value)}
                      placeholder="0.00"
                      className="w-full px-2 py-1 border rounded text-sm text-right"
                      disabled={!!line.debit}
                    />
                  </td>
                  <td className="px-1">
                    {newLines.length > 2 && (
                      <button onClick={() => removeLine(idx)} className="text-red-400 hover:text-red-600">{'\u2715'}</button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot className="bg-gray-50 font-semibold">
              <tr>
                <td className="px-2 py-2" colSpan={2}>
                  <button onClick={addLine} className="text-[#2d1b4e] text-sm hover:underline">+ Add Line</button>
                </td>
                <td className="px-2 py-2 text-right">${totalDebits.toFixed(2)}</td>
                <td className="px-2 py-2 text-right">${totalCredits.toFixed(2)}</td>
                <td className="px-1">
                  {isBalanced ? (
                    <span className="text-green-600">{'\u2713'}</span>
                  ) : (
                    <span className="text-red-600">{'\u2260'}</span>
                  )}
                </td>
              </tr>
            </tfoot>
          </table>

          {/* Actions */}
          <div className="flex items-center justify-between">
            <div className="text-sm">
              {!isBalanced && totalDebits > 0 && (
                <span className="text-red-600">
                  Out of balance by ${Math.abs(totalDebits - totalCredits).toFixed(2)}
                </span>
              )}
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => handleSave('draft')}
                disabled={!isBalanced || saving}
                className="px-4 py-2 border rounded-lg text-sm disabled:opacity-50"
              >
                Save as Draft
              </button>
              <button
                onClick={() => handleSave('posted')}
                disabled={!isBalanced || saving}
                className="px-4 py-2 bg-[#2d1b4e] text-white rounded-lg text-sm font-medium disabled:opacity-50"
              >
                {saving ? 'Saving...' : 'Post Entry'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Search + filter pills */}
      <div className="bg-gray-50 border-x border-gray-200 px-4 py-2 space-y-2">
        <div className="flex items-center gap-2">
          <input
            type="text"
            placeholder="Search descriptions..."
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
        <table className="w-full text-xs border-collapse min-w-[1000px]">
          <thead className="bg-[#2d1b4e] text-white sticky top-0 z-10">
            <tr>
              <JournalFilterableHeader label="Date" field="date" sortField={sortField} sortDir={sortDir} onSort={handleSort}
                filterType="dateRange" allTransactions={txns} columnFilter={columnFilters.date} onApplyColumnFilter={handleApplyColumnFilter} className="w-24" />
              <JournalFilterableHeader label="Description" field="description" sortField={sortField} sortDir={sortDir} onSort={handleSort}
                filterType="search" allTransactions={txns} columnFilter={columnFilters.description} onApplyColumnFilter={handleApplyColumnFilter} className="min-w-[200px]" />
              <JournalFilterableHeader label="Type" field="type" sortField={sortField} sortDir={sortDir} onSort={handleSort}
                filterType="checkbox" allTransactions={txns} columnFilter={columnFilters.type} onApplyColumnFilter={handleApplyColumnFilter} className="w-24" />
              <JournalFilterableHeader label="Status" field="status" sortField={sortField} sortDir={sortDir} onSort={handleSort}
                filterType="checkbox" allTransactions={txns} columnFilter={columnFilters.status} onApplyColumnFilter={handleApplyColumnFilter} className="w-24" />
              <JournalFilterableHeader label="Debits" field="debits" sortField={sortField} sortDir={sortDir} onSort={handleSort}
                filterType="amountRange" allTransactions={txns} columnFilter={columnFilters.debits} onApplyColumnFilter={handleApplyColumnFilter} className="w-24 text-right" />
              <JournalFilterableHeader label="Credits" field="credits" sortField={sortField} sortDir={sortDir} onSort={handleSort}
                filterType="amountRange" allTransactions={txns} columnFilter={columnFilters.credits} onApplyColumnFilter={handleApplyColumnFilter} className="w-24 text-right" />
              <th className="px-2 py-2.5 text-xs font-semibold w-16 text-center">Balanced</th>
              <th className="px-2 py-2.5 text-xs font-semibold w-36">Related</th>
            </tr>
          </thead>
          <tbody>
            {/* top spacer */}
            {virtualizer.getVirtualItems().length > 0 && (
              <tr style={{ height: virtualizer.getVirtualItems()[0]?.start || 0 }}>
                <td colSpan={8} />
              </tr>
            )}
            {virtualizer.getVirtualItems().map(vRow => {
              const txn = filtered[vRow.index];
              const derivedType = getDerivedType(txn);
              const derivedStatus = getDerivedStatus(txn);
              const debits = getDebits(txn);
              const credits = getCredits(txn);
              const balanced = Math.abs(debits - credits) < 0.005;
              const isReversed = derivedStatus === 'Reversed';
              const isReversal = txn.is_reversal;
              const isExpanded = expandedId === txn.id;

              const rowBg = vRow.index % 2 === 0 ? 'bg-white' : 'bg-gray-50/50';
              const textClass = isReversed ? 'text-gray-400' : '';
              const borderClass = isReversal ? 'border-l-[3px] border-amber-400' : '';

              return (
                <tr key={txn.id} data-index={vRow.index}>
                  {/* Main row */}
                  <td colSpan={8} className="p-0">
                    <div
                      className={`${rowBg} ${borderClass} hover:bg-[#2d1b4e]/[.07] transition-colors cursor-pointer flex items-center ${textClass}`}
                      style={{ height: ROW_HEIGHT }}
                      onClick={() => setExpandedId(isExpanded ? null : txn.id)}
                    >
                      {/* Date */}
                      <div className="px-2 py-1 w-24 flex-shrink-0 whitespace-nowrap font-mono">
                        {formatDate(txn.transaction_date)}
                      </div>
                      {/* Description */}
                      <div className="px-2 py-1 min-w-[200px] flex-1 truncate">
                        <span className={isReversed ? 'line-through' : ''}>
                          {isReversal ? 'REVERSAL: ' : ''}{txn.description || '\u2014'}
                        </span>
                      </div>
                      {/* Type */}
                      <div className="px-2 py-1 w-24 flex-shrink-0">
                        <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${
                          derivedType === 'Reversal' ? 'bg-amber-100 text-amber-700' : 'bg-gray-100 text-gray-600'
                        }`}>
                          {derivedType}
                        </span>
                      </div>
                      {/* Status */}
                      <div className="px-2 py-1 w-24 flex-shrink-0">
                        <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${
                          derivedStatus === 'Active' ? 'bg-green-100 text-green-700' :
                          derivedStatus === 'Reversed' ? 'bg-red-100 text-red-700' :
                          'bg-amber-100 text-amber-700'
                        }`}>
                          {derivedStatus}
                        </span>
                      </div>
                      {/* Debits */}
                      <div className="px-2 py-1 w-24 flex-shrink-0 text-right font-mono">
                        {debits > 0 ? formatMoneyDollars(debits) : '\u2014'}
                      </div>
                      {/* Credits */}
                      <div className="px-2 py-1 w-24 flex-shrink-0 text-right font-mono">
                        {credits > 0 ? formatMoneyDollars(credits) : '\u2014'}
                      </div>
                      {/* Balanced */}
                      <div className="px-2 py-1 w-16 flex-shrink-0 text-center">
                        {balanced ? (
                          <span className="text-green-600 font-bold">{'\u2713'}</span>
                        ) : (
                          <span className="text-red-600 font-bold">{'\u2717'}</span>
                        )}
                      </div>
                      {/* Related */}
                      <div className="px-2 py-1 w-36 flex-shrink-0">
                        {isReversal && txn.reverses_journal_id && (
                          <button
                            onClick={(e) => { e.stopPropagation(); setExpandedId(txn.reverses_journal_id); }}
                            className="text-[10px] text-[#2d1b4e] hover:underline truncate block"
                          >
                            Reversal of {truncateId(txn.reverses_journal_id)}
                          </button>
                        )}
                        {isReversed && txn.reversed_by_transaction_id && (
                          <button
                            onClick={(e) => { e.stopPropagation(); setExpandedId(txn.reversed_by_transaction_id); }}
                            className="text-[10px] text-[#2d1b4e] hover:underline truncate block"
                          >
                            Reversed by {truncateId(txn.reversed_by_transaction_id)}
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Expanded detail */}
                    {isExpanded && (
                      <div className="bg-gray-50 px-6 py-3 border-t border-gray-200">
                        <table className="w-full text-xs">
                          <thead className="bg-gray-100">
                            <tr>
                              <th className="px-3 py-2 text-left font-medium">COA Code</th>
                              <th className="px-3 py-2 text-left font-medium">COA Name</th>
                              <th className="px-3 py-2 text-right font-medium">Debit</th>
                              <th className="px-3 py-2 text-right font-medium">Credit</th>
                            </tr>
                          </thead>
                          <tbody>
                            {txn.ledger_entries.map((leg) => {
                              const legDebit = leg.entry_type === 'D' ? leg.amount : 0;
                              const legCredit = leg.entry_type === 'C' ? leg.amount : 0;
                              return (
                                <tr key={leg.id} className={`border-b border-gray-200 ${isReversed ? 'text-gray-400' : ''}`}>
                                  <td className={`px-3 py-2 font-mono ${isReversed ? 'line-through' : ''}`}>
                                    {leg.chart_of_accounts.code}
                                  </td>
                                  <td className={`px-3 py-2 ${isReversed ? 'line-through' : ''}`}>
                                    {leg.chart_of_accounts.name}
                                  </td>
                                  <td className={`px-3 py-2 text-right font-mono ${isReversed ? 'line-through' : ''}`}>
                                    {legDebit > 0 ? formatMoney(legDebit) : '\u2014'}
                                  </td>
                                  <td className={`px-3 py-2 text-right font-mono ${isReversed ? 'line-through' : ''}`}>
                                    {legCredit > 0 ? formatMoney(legCredit) : '\u2014'}
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                          <tfoot className="bg-gray-100 font-semibold">
                            <tr>
                              <td colSpan={2} className="px-3 py-2">Total</td>
                              <td className="px-3 py-2 text-right font-mono">{formatMoneyDollars(debits)}</td>
                              <td className="px-3 py-2 text-right font-mono">{formatMoneyDollars(credits)}</td>
                            </tr>
                          </tfoot>
                        </table>
                        {txn.strategy && (
                          <div className="mt-2 text-[10px] text-gray-500">
                            Strategy: <span className="font-medium text-gray-700">{txn.strategy}</span>
                            {txn.trade_num && <> | Trade #: <span className="font-medium text-gray-700">{txn.trade_num}</span></>}
                          </div>
                        )}
                      </div>
                    )}
                  </td>
                </tr>
              );
            })}
            {/* bottom spacer */}
            {virtualizer.getVirtualItems().length > 0 && (
              <tr style={{
                height: virtualizer.getTotalSize() - (virtualizer.getVirtualItems()[virtualizer.getVirtualItems().length - 1]?.end || 0)
              }}>
                <td colSpan={8} />
              </tr>
            )}
          </tbody>
        </table>
        {filtered.length === 0 && (
          <div className="px-4 py-8 text-center text-gray-400 text-xs">
            {search || activeColFilterCount > 0 ? 'No journal entries match your filters.' : 'No journal entries yet. Click "+ New Entry" to create one.'}
          </div>
        )}
      </div>

      {/* Footer summary */}
      <div className="bg-gray-100 border border-gray-200 border-t-0 px-4 py-2 flex items-center justify-between text-xs">
        <span className="text-gray-500">
          {filtered.length === txns.length ? txns.length : `${filtered.length} of ${txns.length}`} entries
        </span>
        <span className="font-mono font-medium">
          Debits: {formatMoneyDollars(filtered.reduce((s, t) => s + getDebits(t), 0))}
          {' \u00B7 '}
          Credits: {formatMoneyDollars(filtered.reduce((s, t) => s + getCredits(t), 0))}
        </span>
      </div>
    </div>
  );
}
