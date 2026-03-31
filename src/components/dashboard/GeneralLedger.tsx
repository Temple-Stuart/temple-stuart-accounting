'use client';

import { useState, useEffect, useMemo, useRef, useCallback, Fragment } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface CoaOption {
  id: string;
  code: string;
  name: string;
  accountType: string;
  balanceType: string;
  entity_type?: string | null;
}

interface GeneralLedgerProps {
  coaOptions: CoaOption[];
  onReload: () => void;
}

interface LedgerEntry {
  id: string;
  date: string;
  description: string;
  entryType: string; // 'D' or 'C'
  amount: number;
  runningBalance: number;
  journal_id: string;
  is_reversal: boolean;
  reversed_by_transaction_id: string | null;
}

interface LedgerAccount {
  accountCode: string;
  accountName: string;
  accountType: string;
  balanceType: string;
  entityId: string | null;
  entityName: string;
  entries: LedgerEntry[];
  openingBalance: number;
  closingBalance: number;
}

interface Entity {
  id: string;
  name: string;
  entity_type: string | null;
}

interface LedgerApiResponse {
  ledgers: LedgerAccount[];
}

type SortField = 'date' | 'description' | 'amount' | 'balance';
type SortDir = 'asc' | 'desc';

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

const ROW_HEIGHT = 30;

const fmtMoney = (n: number): string => {
  const sign = n < 0 ? '-' : '';
  return sign + '$' +
    Math.abs(n).toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
};

const fmtDate = (iso: string): string => {
  const d = new Date(iso);
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  const yyyy = d.getFullYear();
  return `${mm}/${dd}/${yyyy}`;
};

const entryStatus = (e: LedgerEntry): 'Active' | 'Reversed' | 'Reversal' => {
  if (e.is_reversal) return 'Reversal';
  if (e.reversed_by_transaction_id) return 'Reversed';
  return 'Active';
};

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export default function GeneralLedger({ coaOptions, onReload }: GeneralLedgerProps) {
  /* ---- state ---- */
  const [ledgers, setLedgers] = useState<LedgerAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [entities, setEntities] = useState<Entity[]>([]);
  const [selectedEntityId, setSelectedEntityId] = useState<string | null>(null);

  const [selectedCode, setSelectedCode] = useState<string | null>(null);
  const [accountSearch, setAccountSearch] = useState('');
  const [accountDropdownOpen, setAccountDropdownOpen] = useState(false);

  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [keyword, setKeyword] = useState('');

  const [sortField, setSortField] = useState<SortField>('date');
  const [sortDir, setSortDir] = useState<SortDir>('asc');

  const scrollRef = useRef<HTMLDivElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  /* ---- fetch helper ---- */
  const fetchLedger = useCallback(async (accountCode?: string | null, entityId?: string | null) => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (accountCode) params.set('accountCode', accountCode);
      if (entityId) params.set('entityId', entityId);
      const qs = params.toString();
      const url = qs ? `/api/ledger?${qs}` : '/api/ledger';
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data: LedgerApiResponse = await res.json();
      setLedgers(data.ledgers);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to fetch ledger data');
    } finally {
      setLoading(false);
    }
  }, []);

  /* ---- fetch entities ---- */
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/entities');
        if (res.ok) {
          const data = await res.json();
          setEntities(data.entities || []);
        }
      } catch {}
    })();
  }, []);

  /* ---- initial load + refetch on filters ---- */
  useEffect(() => {
    fetchLedger(selectedCode, selectedEntityId);
  }, [selectedCode, selectedEntityId, fetchLedger]);

  /* ---- close dropdown on outside click ---- */
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setAccountDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  /* ---- derived: selected account ---- */
  const selectedAccount = useMemo(
    () => (selectedCode ? ledgers.find((l) => l.accountCode === selectedCode) ?? null : null),
    [ledgers, selectedCode],
  );

  /* ---- account list for selector, grouped by entity_type ---- */
  const groupedAccounts = useMemo(() => {
    const groups: Record<string, { code: string; name: string; balance: number }[]> = {};
    const search = accountSearch.toLowerCase();

    ledgers.forEach((l) => {
      if (search && !l.accountCode.toLowerCase().includes(search) && !l.accountName.toLowerCase().includes(search)) {
        return;
      }
      const coaMatch = coaOptions.find((c) => c.code === l.accountCode);
      const group = coaMatch?.entity_type || 'Other';
      if (!groups[group]) groups[group] = [];
      groups[group].push({ code: l.accountCode, name: l.accountName, balance: l.closingBalance });
    });

    // Also include COA options that may not have entries yet
    coaOptions.forEach((c) => {
      if (search && !c.code.toLowerCase().includes(search) && !c.name.toLowerCase().includes(search)) {
        return;
      }
      const group = c.entity_type || 'Other';
      if (!groups[group]) groups[group] = [];
      const exists = groups[group].some((a) => a.code === c.code);
      if (!exists) {
        groups[group].push({ code: c.code, name: c.name, balance: 0 });
      }
    });

    // Sort within each group
    Object.values(groups).forEach((arr) => arr.sort((a, b) => a.code.localeCompare(b.code)));

    return groups;
  }, [ledgers, coaOptions, accountSearch]);

  /* ---- filtered + sorted entries ---- */
  const filteredEntries = useMemo(() => {
    if (!selectedAccount) return [];
    let entries = [...selectedAccount.entries];

    // date range filter
    if (dateFrom) {
      const from = new Date(dateFrom);
      entries = entries.filter((e) => new Date(e.date) >= from);
    }
    if (dateTo) {
      const to = new Date(dateTo);
      to.setHours(23, 59, 59, 999);
      entries = entries.filter((e) => new Date(e.date) <= to);
    }

    // keyword search
    if (keyword) {
      const kw = keyword.toLowerCase();
      entries = entries.filter((e) => e.description.toLowerCase().includes(kw));
    }

    // sort
    entries.sort((a, b) => {
      let cmp = 0;
      switch (sortField) {
        case 'date':
          cmp = new Date(a.date).getTime() - new Date(b.date).getTime();
          break;
        case 'description':
          cmp = a.description.localeCompare(b.description);
          break;
        case 'amount':
          cmp = a.amount - b.amount;
          break;
        case 'balance':
          cmp = a.runningBalance - b.runningBalance;
          break;
      }
      return sortDir === 'asc' ? cmp : -cmp;
    });

    return entries;
  }, [selectedAccount, dateFrom, dateTo, keyword, sortField, sortDir]);

  /* ---- virtualizer ---- */
  const virtualizer = useVirtualizer({
    count: filteredEntries.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: 20,
  });

  /* ---- totals ---- */
  const totalDebits = useMemo(
    () => filteredEntries.filter((e) => e.entryType === 'D').reduce((s, e) => s + e.amount, 0),
    [filteredEntries],
  );
  const totalCredits = useMemo(
    () => filteredEntries.filter((e) => e.entryType === 'C').reduce((s, e) => s + e.amount, 0),
    [filteredEntries],
  );

  /* ---- sort handler ---- */
  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDir('asc');
    }
  };

  const sortArrow = (field: SortField) => {
    if (sortField !== field) return ' \u2195';
    return sortDir === 'asc' ? ' \u2191' : ' \u2193';
  };

  /* ---- CSV export ---- */
  const handleExportCSV = () => {
    if (!selectedAccount) return;
    const header = ['Date', 'Entry #', 'Description', 'Debit', 'Credit', 'Balance', 'Status'];
    const rows = filteredEntries.map((e) => {
      const status = entryStatus(e);
      return [
        fmtDate(e.date),
        e.journal_id.substring(0, 8),
        `"${e.description.replace(/"/g, '""')}"`,
        e.entryType === 'D' ? fmtMoney(e.amount) : '',
        e.entryType === 'C' ? fmtMoney(e.amount) : '',
        fmtMoney(e.runningBalance),
        status,
      ];
    });

    const csv = [header.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ledger_${selectedAccount.accountCode}_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  /* ---- grouped summary for "no account selected" view ---- */
  const accountsByEntityAndType = useMemo(() => {
    const typeOrder = ['Asset', 'Liability', 'Equity', 'Revenue', 'Expense'];

    if (selectedEntityId) {
      // Single entity: group by type only
      const groups: Record<string, LedgerAccount[]> = {};
      ledgers.forEach((l) => {
        const t = l.accountType || 'Other';
        if (!groups[t]) groups[t] = [];
        groups[t].push(l);
      });
      const ordered: [string, LedgerAccount[]][] = [];
      typeOrder.forEach((t) => { if (groups[t]) { ordered.push([t, groups[t].sort((a, b) => a.accountCode.localeCompare(b.accountCode))]); delete groups[t]; } });
      Object.entries(groups).forEach(([t, accts]) => ordered.push([t, accts.sort((a, b) => a.accountCode.localeCompare(b.accountCode))]));
      return [{ entityName: null as string | null, sections: ordered }];
    }

    // All entities: group by entity, then by type within each entity
    const entityMap: Record<string, { entityName: string; accounts: LedgerAccount[] }> = {};
    ledgers.forEach((l) => {
      const key = l.entityId || '__other__';
      if (!entityMap[key]) entityMap[key] = { entityName: l.entityName || 'Other', accounts: [] };
      entityMap[key].accounts.push(l);
    });

    // Sort entities: match entity order from entities list, fallback alphabetical
    const entityOrder = entities.map(e => e.id);
    const sortedKeys = Object.keys(entityMap).sort((a, b) => {
      const ai = entityOrder.indexOf(a);
      const bi = entityOrder.indexOf(b);
      if (ai !== -1 && bi !== -1) return ai - bi;
      if (ai !== -1) return -1;
      if (bi !== -1) return 1;
      return entityMap[a].entityName.localeCompare(entityMap[b].entityName);
    });

    return sortedKeys.map(key => {
      const { entityName, accounts } = entityMap[key];
      const groups: Record<string, LedgerAccount[]> = {};
      accounts.forEach((l) => {
        const t = l.accountType || 'Other';
        if (!groups[t]) groups[t] = [];
        groups[t].push(l);
      });
      const ordered: [string, LedgerAccount[]][] = [];
      typeOrder.forEach((t) => { if (groups[t]) { ordered.push([t, groups[t].sort((a, b) => a.accountCode.localeCompare(b.accountCode))]); delete groups[t]; } });
      Object.entries(groups).forEach(([t, accts]) => ordered.push([t, accts.sort((a, b) => a.accountCode.localeCompare(b.accountCode))]));
      return { entityName, sections: ordered };
    });
  }, [ledgers, selectedEntityId, entities]);

  /* ================================================================ */
  /*  RENDER                                                           */
  /* ================================================================ */

  return (
    <div className="bg-white overflow-hidden">
      {/* ---- Entity tabs ---- */}
      <div className="flex border-b border-border">
        <button
          onClick={() => { setSelectedEntityId(null); setSelectedCode(null); }}
          className={`px-3 py-1.5 text-terminal-base font-mono font-medium border-b-2 transition-colors ${
            selectedEntityId === null
              ? 'border-brand-purple text-brand-purple'
              : 'border-transparent text-text-muted hover:text-text-secondary'
          }`}
        >
          All
        </button>
        {entities.map(entity => (
          <button
            key={entity.id}
            onClick={() => { setSelectedEntityId(entity.id); setSelectedCode(null); }}
            className={`px-3 py-1.5 text-terminal-base font-mono font-medium border-b-2 transition-colors ${
              selectedEntityId === entity.id
                ? 'border-brand-purple text-brand-purple'
                : 'border-transparent text-text-muted hover:text-text-secondary'
            }`}
          >
            {entity.name}
          </button>
        ))}
      </div>

      {/* ---- Controls bar ---- */}
      <div className="p-2 border-b bg-bg-row flex flex-wrap gap-2 items-center">
        {/* Account selector */}
        <div className="relative min-w-[260px]" ref={dropdownRef}>
          <input
            type="text"
            value={
              accountDropdownOpen
                ? accountSearch
                : selectedCode
                  ? `${selectedCode} - ${selectedAccount?.accountName || ''}`
                  : ''
            }
            onChange={(e) => {
              setAccountSearch(e.target.value);
              setAccountDropdownOpen(true);
            }}
            onFocus={() => {
              setAccountDropdownOpen(true);
              setAccountSearch('');
            }}
            placeholder="Search accounts..."
            className="w-full h-7 px-2 border border-border rounded text-terminal-base font-mono pr-8"
          />
          {selectedCode && (
            <button
              onClick={() => {
                setSelectedCode(null);
                setAccountSearch('');
                setAccountDropdownOpen(false);
              }}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-text-faint hover:text-text-primary text-sm"
              title="Clear selection"
            >
              x
            </button>
          )}
          {accountDropdownOpen && (
            <div className="absolute z-30 top-full left-0 right-0 mt-1 bg-white border border-border rounded shadow-sm max-h-72 overflow-y-auto">
              {Object.entries(groupedAccounts).length === 0 && (
                <div className="px-3 py-2 text-terminal-base text-text-faint">No accounts found</div>
              )}
              {Object.entries(groupedAccounts).map(([group, accounts]) => (
                <div key={group}>
                  <div className="px-3 py-1.5 text-terminal-xs font-semibold text-text-muted bg-bg-row uppercase tracking-wider">
                    {group}
                  </div>
                  {accounts.map((a) => (
                    <button
                      key={a.code}
                      onClick={() => {
                        setSelectedCode(a.code);
                        setAccountSearch('');
                        setAccountDropdownOpen(false);
                      }}
                      className="w-full text-left px-3 py-1.5 text-terminal-base hover:bg-brand-purple/[.07] flex justify-between items-center"
                    >
                      <span>
                        <span className="font-medium">{a.code}</span>{' '}
                        <span className="text-text-secondary">- {a.name}</span>
                      </span>
                      <span className="text-text-muted ml-2 tabular-nums">{fmtMoney(a.balance)}</span>
                    </button>
                  ))}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Date range */}
        <input
          type="date"
          value={dateFrom}
          onChange={(e) => setDateFrom(e.target.value)}
          className="h-7 px-2 border border-border rounded text-terminal-base font-mono"
          placeholder="From"
        />
        <input
          type="date"
          value={dateTo}
          onChange={(e) => setDateTo(e.target.value)}
          className="h-7 px-2 border border-border rounded text-terminal-base font-mono"
          placeholder="To"
        />

        {/* Keyword search */}
        <input
          type="text"
          value={keyword}
          onChange={(e) => setKeyword(e.target.value)}
          placeholder="Search descriptions..."
          className="flex-1 min-w-[150px] h-7 px-2 border border-border rounded text-terminal-base font-mono"
        />

        {/* Reload */}
        <button
          onClick={() => {
            onReload();
            fetchLedger(selectedCode, selectedEntityId);
          }}
          className="h-7 px-2 text-terminal-base font-mono border border-border rounded hover:bg-bg-row"
        >
          Reload
        </button>

        {selectedCode && (
          <button
            onClick={handleExportCSV}
            className="h-7 px-2 text-terminal-base font-mono border border-border rounded hover:bg-bg-row ml-auto"
          >
            Export CSV
          </button>
        )}
      </div>

      {/* ---- Loading / Error ---- */}
      {loading && (
        <div className="p-8 text-center text-terminal-sm text-text-muted">Loading ledger data...</div>
      )}
      {error && (
        <div className="p-4 text-center text-terminal-sm text-brand-red bg-red-50">
          Error: {error}
          <button onClick={() => fetchLedger(selectedCode)} className="ml-2 underline">
            Retry
          </button>
        </div>
      )}

      {/* ---- No account selected: show summary grid ---- */}
      {!loading && !error && !selectedCode && (
        <div className="overflow-x-auto">
          <table className="w-full text-terminal-base min-w-[700px]">
            <thead>
              <tr className="bg-gray-50 text-text-secondary">
                <th className="text-terminal-xs uppercase tracking-widest font-mono py-1 px-2 text-left">Account Code</th>
                <th className="text-terminal-xs uppercase tracking-widest font-mono py-1 px-2 text-left">Account Name</th>
                <th className="text-terminal-xs uppercase tracking-widest font-mono py-1 px-2 text-left">Type</th>
                <th className="text-terminal-xs uppercase tracking-widest font-mono py-1 px-2 text-right">Balance</th>
              </tr>
            </thead>
            <tbody>
              {accountsByEntityAndType.map((group, gi) => (
                <Fragment key={group.entityName || gi}>
                  {group.entityName && (
                    <tr>
                      <td
                        colSpan={4}
                        className="py-2 px-2 text-xs uppercase text-text-muted font-semibold tracking-wider border-b border-border-light bg-bg-row"
                      >
                        {group.entityName}
                      </td>
                    </tr>
                  )}
                  {group.sections.map(([type, accounts]) => (
                    <Fragment key={type}>
                      <tr>
                        <td
                          colSpan={4}
                          className="py-1 px-2 text-terminal-xs font-bold text-text-muted bg-bg-row/60 uppercase tracking-wider pl-4"
                        >
                          {type}
                        </td>
                      </tr>
                      {accounts.map((acct, idx) => (
                        <tr
                          key={acct.accountCode}
                          onClick={() => setSelectedCode(acct.accountCode)}
                          className={`cursor-pointer hover:bg-brand-purple/[.07] ${
                            idx % 2 === 0 ? 'bg-white' : 'bg-bg-row'
                          }`}
                        >
                          <td className="py-1 px-2 font-medium">{acct.accountCode}</td>
                          <td className="py-1 px-2 text-text-secondary">{acct.accountName}</td>
                          <td className="py-1 px-2 text-text-muted">{acct.accountType}</td>
                          <td className="py-1 px-2 text-right font-mono tabular-nums">
                            {fmtMoney(acct.closingBalance)}
                          </td>
                        </tr>
                      ))}
                    </Fragment>
                  ))}
                </Fragment>
              ))}
              {accountsByEntityAndType.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-3 py-8 text-center text-text-faint">
                    No ledger entries found. Post journal entries first.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* ---- Account selected: summary + entries ---- */}
      {!loading && !error && selectedCode && selectedAccount && (
        <>
          {/* Account summary row */}
          <div className="px-3 py-1.5 bg-bg-row border-b flex flex-wrap gap-6 text-terminal-sm">
            <div>
              <span className="text-text-muted">Opening Balance</span>
              <div className="font-semibold tabular-nums mt-0.5">
                {fmtMoney(selectedAccount.openingBalance)}
              </div>
            </div>
            <div>
              <span className="text-text-muted">Total Debits</span>
              <div className="font-semibold text-brand-red tabular-nums mt-0.5">
                {fmtMoney(
                  selectedAccount.entries
                    .filter((e) => e.entryType === 'D')
                    .reduce((s, e) => s + e.amount, 0),
                )}
              </div>
            </div>
            <div>
              <span className="text-text-muted">Total Credits</span>
              <div className="font-semibold text-brand-green tabular-nums mt-0.5">
                {fmtMoney(
                  selectedAccount.entries
                    .filter((e) => e.entryType === 'C')
                    .reduce((s, e) => s + e.amount, 0),
                )}
              </div>
            </div>
            <div>
              <span className="text-text-muted">Closing Balance</span>
              <div className="font-semibold tabular-nums mt-0.5">
                {fmtMoney(selectedAccount.closingBalance)}
              </div>
            </div>
            <div className="ml-auto self-center text-text-muted">
              {selectedAccount.accountCode} - {selectedAccount.accountName} ({selectedAccount.accountType})
            </div>
          </div>

          {/* Virtualized table */}
          <div className="overflow-x-auto border border-border">
            {/* Column headers */}
            <div className="min-w-[900px]">
              <div className="bg-gray-50 text-text-secondary flex text-terminal-xs uppercase tracking-widest font-mono sticky top-0 z-10">
                <button
                  onClick={() => handleSort('date')}
                  className="py-1 px-2 text-left w-[100px] hover:bg-gray-100 shrink-0"
                >
                  Date{sortArrow('date')}
                </button>
                <div className="py-1 px-2 text-left w-[90px] shrink-0">Entry #</div>
                <button
                  onClick={() => handleSort('description')}
                  className="py-1 px-2 text-left flex-1 hover:bg-gray-100"
                >
                  Description{sortArrow('description')}
                </button>
                <button
                  onClick={() => handleSort('amount')}
                  className="py-1 px-2 text-right w-[100px] hover:bg-gray-100 shrink-0"
                >
                  Debit{sortArrow('amount')}
                </button>
                <div className="py-1 px-2 text-right w-[100px] shrink-0">Credit</div>
                <button
                  onClick={() => handleSort('balance')}
                  className="py-1 px-2 text-right w-[110px] hover:bg-gray-100 shrink-0"
                >
                  Balance{sortArrow('balance')}
                </button>
                <div className="py-1 px-2 text-center w-[90px] shrink-0">Status</div>
              </div>

              {/* Scroll container */}
              <div ref={scrollRef} className="max-h-[600px] overflow-y-auto">
                <div
                  style={{ height: `${virtualizer.getTotalSize()}px`, position: 'relative' }}
                >
                  {virtualizer.getVirtualItems().map((vRow) => {
                    const entry = filteredEntries[vRow.index];
                    const status = entryStatus(entry);
                    const isReversed = status === 'Reversed';
                    const isReversal = status === 'Reversal';
                    const rowIdx = vRow.index;

                    return (
                      <div
                        key={entry.id}
                        style={{
                          position: 'absolute',
                          top: 0,
                          left: 0,
                          width: '100%',
                          height: `${vRow.size}px`,
                          transform: `translateY(${vRow.start}px)`,
                        }}
                        className={[
                          'flex items-center text-terminal-base',
                          rowIdx % 2 === 0 ? 'bg-white' : 'bg-bg-row',
                          'hover:bg-brand-purple/[.07]',
                          isReversed ? 'text-text-faint' : '',
                          isReversal ? 'border-l-[3px] border-amber-400' : '',
                        ].join(' ')}
                      >
                        {/* Date */}
                        <div className="py-1 px-2 w-[100px] shrink-0 whitespace-nowrap font-mono text-text-muted">
                          {fmtDate(entry.date)}
                        </div>

                        {/* Entry # */}
                        <div className="py-1 px-2 w-[90px] shrink-0 font-mono text-terminal-sm truncate">
                          {entry.journal_id.substring(0, 8)}
                        </div>

                        {/* Description */}
                        <div
                          className={`py-1 px-2 flex-1 truncate ${isReversed ? 'line-through' : ''}`}
                          title={entry.description}
                        >
                          {entry.description}
                        </div>

                        {/* Debit */}
                        <div className="py-1 px-2 w-[100px] shrink-0 text-right font-mono tabular-nums">
                          {entry.entryType === 'D' ? fmtMoney(entry.amount) : ''}
                        </div>

                        {/* Credit */}
                        <div className="py-1 px-2 w-[100px] shrink-0 text-right font-mono tabular-nums">
                          {entry.entryType === 'C' ? fmtMoney(entry.amount) : ''}
                        </div>

                        {/* Balance */}
                        <div className="py-1 px-2 w-[110px] shrink-0 text-right font-mono tabular-nums">
                          {fmtMoney(entry.runningBalance)}
                        </div>

                        {/* Status */}
                        <div className="py-1 px-2 w-[90px] shrink-0 text-center">
                          {status === 'Active' && (
                            <span className="inline-block px-1.5 py-0.5 rounded text-[10px] bg-green-100 text-brand-green">
                              Active
                            </span>
                          )}
                          {status === 'Reversed' && (
                            <span className="inline-block px-1.5 py-0.5 rounded text-[10px] bg-bg-row text-text-muted">
                              Reversed
                            </span>
                          )}
                          {status === 'Reversal' && (
                            <span className="inline-block px-1.5 py-0.5 rounded text-[10px] bg-amber-100 text-amber-700">
                              Reversal
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>

          {/* Footer summary */}
          <div className="px-3 py-1.5 bg-bg-row border-t flex justify-between text-terminal-sm">
            <span className="text-text-secondary">
              {filteredEntries.length} {filteredEntries.length === 1 ? 'entry' : 'entries'}
            </span>
            <span className="text-text-secondary">
              Total Debits:{' '}
              <span className="font-semibold text-brand-red">{fmtMoney(totalDebits)}</span>
            </span>
            <span className="text-text-secondary">
              Total Credits:{' '}
              <span className="font-semibold text-brand-green">{fmtMoney(totalCredits)}</span>
            </span>
          </div>
        </>
      )}

      {/* Account selected but not found in data */}
      {!loading && !error && selectedCode && !selectedAccount && (
        <div className="p-8 text-center text-terminal-sm text-text-muted">
          No ledger entries for account {selectedCode}.
        </div>
      )}
    </div>
  );
}
