'use client';

import { useState, useEffect, useMemo, useRef, useCallback, Fragment } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { CoverageLine, EntrySourcePanel, EntrySourceWords } from '@/components/books/EntrySourceCell';
import { coverageOf, documentOf, type DocumentMoneyEventFacts, type DocumentReservationFacts } from '@/lib/books/entrySource';
// DOCUMENTS-01 (2026-10-28): the receipt on its posting — Bookkeeping's controls, on Bookkeeping's page.
import { ReceiptLine, ReceiptPanel, readReceipts, type ReceiptsRead } from '@/components/books/ReceiptControls';
import { canCarryReceipt, receiptCoverage, receiptsFailedWords, RECEIPTS_LOADING_WORDS } from '@/lib/books/sourceDocuments';
// BUDGET-02 (ruling F): a link's account is read by the budget report's ONE code reader, so an old "B-5100" row matches 5100.
import { readChartCode } from '@/lib/budget/reportInputs';
import { FUNCTIONAL_CURRENCY_WORDS, functionalMoneyWords } from '@/lib/books/functionalCurrency';


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
  // BUDGET-02: /api/chart-of-accounts carries each account's book (route.ts serializes entity_id).
  entity_id?: string | null;
}

/**
 * BUDGET-02 (Alex, ruling F, 2026-10-20) — A LINK INTO THE LEDGER. "open in Books"
 * on /budget links to /ledger?account=&book=&from=&to=, which carries those four
 * keys to /books (src/app/ledger/page.tsx); BooksPipeline reads them once, opens
 * this ledger's phase and hands them here, and clears them from the URL. A key
 * named twice, or a from/to that is not a day, is not used — and said.
 */
export const LEDGER_LINK_KEYS = ['account', 'book', 'from', 'to'] as const;

export interface LedgerLink {
  readonly account: string | null;
  readonly book: string | null;
  readonly from: string | null;
  readonly to: string | null;
  /** What the link named that cannot be used, in words. */
  readonly words: readonly string[];
}

/** The link the URL carries, or null when it names none of the four keys. */
export function ledgerLinkOf(search: URLSearchParams): LedgerLink | null {
  if (LEDGER_LINK_KEYS.every((key) => !search.has(key))) return null;
  const words: string[] = [];
  const one = (key: (typeof LEDGER_LINK_KEYS)[number]): string | null => {
    const all = search.getAll(key);
    if (all.length === 0) return null;
    if (all.length > 1) { words.push(`This link names ${key} ${all.length} times — it is not used.`); return null; }
    return all[0];
  };
  const day = (key: 'from' | 'to'): string | null => {
    const value = one(key);
    if (value !== null && !/^\d{4}-\d{2}-\d{2}$/.test(value)) { words.push(`This link's ${key} "${value}" is not a day (YYYY-MM-DD) — it is not used.`); return null; }
    return value;
  };
  return { account: one('account'), book: one('book'), from: day('from'), to: day('to'), words };
}

interface GeneralLedgerProps {
  coaOptions: CoaOption[];
  onReload: () => void;
  /** BUDGET-02: the link to apply once, or null. */
  link: LedgerLink | null;
  /** Called when the link has been taken, so a remount never applies it twice. */
  onLinkUsed: () => void;
}

interface LedgerEntry {
  id: string;
  date: string;
  description: string;
  entryType: string; // 'D' or 'C'
  /** Integer cents (FX-01) — the route no longer divides into dollars. */
  amount: number;
  runningBalance: number;
  journal_id: string;
  is_reversal: boolean;
  // DOCUMENTS-01 (2026-10-28): the wire's own names. This field was read as
  // `reversed_by_transaction_id`, a name /api/ledger never sends (route.ts:96 sends
  // reversed_by_entry_id), so no row ever read as Reversed; and the entry's status
  // now rides beside it (route.ts) — the receipt rule (canCarryReceipt) reads all three.
  reversed_by_entry_id: string | null;
  status: string;
  // DRILL-01 (2026-09-23): WHERE THE ENTRY CAME FROM. /api/ledger already pulled the
  // whole journal_entry (route.ts:37) and dropped these three when it mapped its rows;
  // the route now carries them and this type reads them.
  source_type: string | null;
  source_id: string | null;
  reverses_entry_id: string | null;
  // POST-01 (2026-09-26): THE DOCUMENT — the booking this posting is the charge (or
  // refund) of, as /api/ledger puts it on the wire; null renders nothing.
  document_reservation_id: string | null;
  document_money_event_id: string | null;
  document_reservation: DocumentReservationFacts | null;
  document_money_event: DocumentMoneyEventFacts | null;
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
// DOCUMENTS-01: a row grows by one line for each line under its source — the booking it documents
// (POST-01) and the receipt line — so neither is clipped by the fixed-height virtual row.
const LINE_HEIGHT = 16;

// FX-01 (2026-10-30, ruling B): every figure is integer CENTS from /api/ledger, written by the books' one
// formatter (src/lib/books/functionalCurrency.ts functionalMoneyWords) — the local dollars formatter is gone.

const fmtDate = (iso: string): string => {
  const d = new Date(iso);
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  const yyyy = d.getFullYear();
  return `${mm}/${dd}/${yyyy}`;
};

const entryStatus = (e: LedgerEntry): 'Active' | 'Reversed' | 'Reversal' => {
  if (e.is_reversal) return 'Reversal';
  if (e.reversed_by_entry_id) return 'Reversed';
  return 'Active';
};

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export default function GeneralLedger({ coaOptions, onReload, link, onLinkUsed }: GeneralLedgerProps) {
  /* ---- state ---- */
  // DRILL-01: which entry's source is open. The rows are virtualized at a fixed
  // height, so the panel is rendered UNDER the table rather than inside a row.
  const [sourceFor, setSourceFor] = useState<string | null>(null);
  const [ledgers, setLedgers] = useState<LedgerAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [entities, setEntities] = useState<Entity[]>([]);
  // BUDGET-02: whether the books were read — a link's book is looked up only once they are.
  const [entitiesRead, setEntitiesRead] = useState<'waiting' | 'ok' | 'failed'>('waiting');
  // BUDGET-02: a link's account, waiting for the book's ledger; and what a link named that cannot be shown, in words.
  const [pendingAccount, setPendingAccount] = useState<{ book: Entity; account: string } | null>(null);
  const [linkWords, setLinkWords] = useState<string[]>([]);
  const [selectedEntityId, setSelectedEntityId] = useState<string | null>(null);

  const [selectedCode, setSelectedCode] = useState<string | null>(null);
  const [accountSearch, setAccountSearch] = useState('');
  const [accountDropdownOpen, setAccountDropdownOpen] = useState(false);

  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [keyword, setKeyword] = useState('');

  const [sortField, setSortField] = useState<SortField>('date');
  const [sortDir, setSortDir] = useState<SortDir>('asc');

  // DOCUMENTS-01 (ruling F): the account's postings' current receipts, the open attach/replace panel,
  // and a counter bumped after a kept file so the ledger re-reads its receipts. React state only.
  const [receiptsRead, setReceiptsRead] = useState<ReceiptsRead>({ state: 'loading' });
  const [receiptFor, setReceiptFor] = useState<{ entryId: string; replacing: boolean } | null>(null);
  const [receiptWrites, setReceiptWrites] = useState(0);

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
          setEntitiesRead('ok');
        } else {
          setEntitiesRead('failed');
        }
      } catch {
        setEntitiesRead('failed');
      }
    })();
  }, []);

  /* ---- BUDGET-02: a link — the book, the dates, then the account once the book's ledger is read ---- */
  useEffect(() => {
    if (link === null || entitiesRead === 'waiting') return;
    const words = [...link.words];
    if (link.from !== null) setDateFrom(link.from);
    if (link.to !== null) setDateTo(link.to);
    let book: Entity | null = null;
    if (link.book !== null) {
      const found = entities.find((e) => e.id === link.book);
      if (entitiesRead === 'failed') words.push('Your books could not be read — this link\'s book cannot be found.');
      else if (found === undefined) words.push('This link names a book that is not one of your books — the ledger shows every book.');
      else { book = found; setSelectedEntityId(found.id); }
    }
    if (link.account !== null) {
      if (book === null) words.push(`This link names account ${link.account} without a book of yours — an account is read within its book.`);
      else setPendingAccount({ book, account: link.account });
    }
    setLinkWords(words);
    onLinkUsed();
  }, [link, entitiesRead, entities, onLinkUsed]);


  /* ---- BUDGET-02: the link's account, read by the one code reader against the book's ledger and chart ---- */
  useEffect(() => {
    if (pendingAccount === null || loading) return;
    const { book, account } = pendingAccount;
    setPendingAccount(null);
    if (error !== null) { setLinkWords((w) => [...w, `The ledger could not be read — account ${account} cannot be found.`]); return; }
    if (book.entity_type === null) { setLinkWords((w) => [...w, `${book.name} has no entity type — its account codes cannot be read.`]); return; }
    const entity = { id: book.id, name: book.name, entityType: book.entity_type };
    const want = readChartCode(account, entity);
    if (!want.ok) { setLinkWords((w) => [...w, `This link's account "${account}" is not a code of ${book.name}: ${want.reason}.`]); return; }
    const reads = (saved: string): boolean => { const r = readChartCode(saved, entity); return r.ok && r.code === want.code; };
    const hits = ledgers.filter((l) => l.entityId === book.id && reads(l.accountCode));
    if (hits.length === 1) { setSelectedCode(hits[0].accountCode); return; }
    if (hits.length > 1) { setLinkWords((w) => [...w, `${hits.length} accounts of ${book.name} read as ${want.code} (${hits.map((h) => h.accountCode).join(', ')}) — choose one above.`]); return; }
    const inChart = coaOptions.some((c) => c.entity_id === book.id && reads(c.code));
    setLinkWords((w) => [...w, inChart ? `Account ${want.code} has no ledger lines in ${book.name}.` : `Account ${want.code} is not an active account of ${book.name}'s chart, and has no ledger lines.`]);
  }, [pendingAccount, loading, error, ledgers, coaOptions]);

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

  /* ---- DOCUMENTS-01: the receipts of the selected account's postings ---- */
  const accountEntryIds = useMemo(() => (selectedAccount ? [...new Set(selectedAccount.entries.map((e) => e.journal_id))] : []), [selectedAccount]);
  useEffect(() => {
    if (accountEntryIds.length === 0) { setReceiptsRead({ state: 'done', receipts: new Map() }); return; }
    let alive = true;
    setReceiptsRead({ state: 'loading' });
    readReceipts(accountEntryIds)
      .then((receipts) => { if (alive) setReceiptsRead({ state: 'done', receipts }); })
      .catch((err: unknown) => { if (alive) setReceiptsRead({ state: 'failed', reason: err instanceof Error ? err.message : String(err) }); });
    return () => { alive = false; };
  }, [accountEntryIds, receiptWrites]);

  /** Whether the receipt line shows on a row: a posting that can carry one, or one that already does. */
  const showsReceiptLine = useCallback((e: LedgerEntry): boolean =>
    canCarryReceipt(e) || (receiptsRead.state === 'done' && receiptsRead.receipts.has(e.journal_id)), [receiptsRead]);
  const rowHeightOf = useCallback((e: LedgerEntry): number =>
    ROW_HEIGHT + (documentOf(e).kind !== 'none' ? LINE_HEIGHT : 0) + (receiptsRead.state !== 'failed' && showsReceiptLine(e) ? LINE_HEIGHT : 0),
  [receiptsRead, showsReceiptLine]);

  /* ---- virtualizer ---- */
  const virtualizer = useVirtualizer({
    count: filteredEntries.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: (i) => rowHeightOf(filteredEntries[i]),
    overscan: 20,
  });
  // DOCUMENTS-01: the rows' heights follow their lines; re-measure when the rows or the receipts change.
  useEffect(() => { virtualizer.measure(); }, [virtualizer, filteredEntries, rowHeightOf]);

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
        e.entryType === 'D' ? functionalMoneyWords(e.amount) : '',
        e.entryType === 'C' ? functionalMoneyWords(e.amount) : '',
        functionalMoneyWords(e.runningBalance),
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

      {/* ---- BUDGET-02: what a link named that cannot be shown, in words ---- */}
      {linkWords.map((w) => <p key={w} className="px-2 py-1 text-terminal-base text-brand-red" data-ledger-link-words>{w}</p>)}

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
                      <span className="text-text-muted ml-2 tabular-nums">{functionalMoneyWords(a.balance)}</span>
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
        <span className="text-[10px] text-text-muted" data-functional-currency>{FUNCTIONAL_CURRENCY_WORDS}</span>
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
                          data-ledger-account={acct.accountCode}
                          onClick={() => setSelectedCode(acct.accountCode)}
                          className={`cursor-pointer hover:bg-brand-purple/[.07] ${
                            idx % 2 === 0 ? 'bg-white' : 'bg-bg-row'
                          }`}
                        >
                          <td className="py-1 px-2 font-medium">{acct.accountCode}</td>
                          <td className="py-1 px-2 text-text-secondary">{acct.accountName}</td>
                          <td className="py-1 px-2 text-text-muted">{acct.accountType}</td>
                          <td className="py-1 px-2 text-right font-mono tabular-nums">
                            {functionalMoneyWords(acct.closingBalance)}
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
                {functionalMoneyWords(selectedAccount.openingBalance)}
              </div>
            </div>
            <div>
              <span className="text-text-muted">Total Debits</span>
              <div className="font-semibold text-brand-red tabular-nums mt-0.5">
                {functionalMoneyWords(
                  selectedAccount.entries
                    .filter((e) => e.entryType === 'D')
                    .reduce((s, e) => s + e.amount, 0),
                )}
              </div>
            </div>
            <div>
              <span className="text-text-muted">Total Credits</span>
              <div className="font-semibold text-brand-green tabular-nums mt-0.5">
                {functionalMoneyWords(
                  selectedAccount.entries
                    .filter((e) => e.entryType === 'C')
                    .reduce((s, e) => s + e.amount, 0),
                )}
              </div>
            </div>
            <div>
              <span className="text-text-muted">Closing Balance</span>
              <div className="font-semibold tabular-nums mt-0.5">
                {functionalMoneyWords(selectedAccount.closingBalance)}
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
                {/* DRILL-01: where it came from. */}
                <div className="py-1 px-2 text-left w-[220px] shrink-0">Source</div>
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
                          {entry.entryType === 'D' ? functionalMoneyWords(entry.amount) : ''}
                        </div>

                        {/* Credit */}
                        <div className="py-1 px-2 w-[100px] shrink-0 text-right font-mono tabular-nums">
                          {entry.entryType === 'C' ? functionalMoneyWords(entry.amount) : ''}
                        </div>

                        {/* Balance */}
                        <div className="py-1 px-2 w-[110px] shrink-0 text-right font-mono tabular-nums">
                          {functionalMoneyWords(entry.runningBalance)}
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

                        {/* DRILL-01: where it came from, in the customer's words. The
                            row is a fixed-height virtual row, so the opened panel is
                            rendered under the table — the words stay on the line. */}
                        <div className="py-1 px-2 w-[220px] shrink-0 truncate" data-entry-source-row={entry.journal_id}>
                          <EntrySourceWords
                            entryId={entry.journal_id}
                            entry={{ source_type: entry.source_type, source_id: entry.source_id, reverses_entry_id: entry.reverses_entry_id, document_reservation_id: entry.document_reservation_id, document_money_event_id: entry.document_money_event_id, document_reservation: entry.document_reservation, document_money_event: entry.document_money_event }}
                            opened={sourceFor === entry.journal_id}
                            onOpen={(id) => setSourceFor((cur) => (cur === id ? null : id))}
                            compact
                          />
                          {/* DOCUMENTS-01: the receipt under its source — a reversal or a reversed row offers no attach. */}
                          <div className="text-[11px]">
                            <ReceiptLine
                              entryId={entry.journal_id}
                              read={receiptsRead}
                              canCarry={canCarryReceipt(entry)}
                              onAttach={(id, replacing) => setReceiptFor({ entryId: id, replacing })}
                            />
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>

          {/* DRILL-01: the opened source, under the virtualized table. */}
          {sourceFor && (
            <div className="border-x border-b border-border px-3 py-2">
              <div className="flex items-baseline justify-between gap-2">
                <span className="font-mono text-[10px] uppercase tracking-wider text-text-faint">
                  Where entry {sourceFor.substring(0, 8)} came from
                </span>
                <button type="button" onClick={() => setSourceFor(null)} className="text-[11px] text-text-secondary hover:text-text-primary">Close</button>
              </div>
              <EntrySourcePanel entryId={sourceFor} />
            </div>
          )}

          {/* DOCUMENTS-01: the attach (or replace) panel, under the virtualized table like the source. */}
          {receiptFor && (
            <div className="border-x border-b border-border px-3 py-2">
              <div className="flex items-baseline justify-between gap-2">
                <span className="font-mono text-[10px] uppercase tracking-wider text-text-faint">
                  {receiptFor.replacing ? 'Replace the receipt of' : 'A receipt for'} entry {receiptFor.entryId.substring(0, 8)}
                </span>
              </div>
              <ReceiptPanel
                key={`${receiptFor.entryId}:${receiptFor.replacing}`}
                entryId={receiptFor.entryId}
                replacing={receiptFor.replacing}
                onKept={() => { setReceiptFor(null); setReceiptWrites((n) => n + 1); }}
                onClose={() => setReceiptFor(null)}
              />
            </div>
          )}

          {/* Footer summary */}
          <div className="px-3 py-1.5 bg-bg-row border-t flex flex-wrap items-center justify-between gap-2 text-terminal-sm">
            <span className="text-text-secondary">
              {filteredEntries.length} {filteredEntries.length === 1 ? 'entry' : 'entries'}
            </span>
            {/* COVERAGE IS DECLARED over the rows shown — the same filteredEntries the
                table renders, derived by coverageOf(), never typed. */}
            <CoverageLine line={coverageOf(filteredEntries.map((e) => ({ source_type: e.source_type, source_id: e.source_id, reverses_entry_id: e.reverses_entry_id }))).line} />
            {/* DOCUMENTS-01: the receipts over the same rows — counted once per posting that can carry one. */}
            <p className="font-mono text-[10px] uppercase tracking-wider text-text-faint" data-receipt-coverage={receiptsRead.state}>
              {receiptsRead.state === 'done' ? receiptCoverage(filteredEntries, receiptsRead.receipts).line
                : receiptsRead.state === 'loading' ? RECEIPTS_LOADING_WORDS
                : receiptsFailedWords(receiptsRead.reason)}
            </p>
            <span className="text-text-secondary">
              Total Debits:{' '}
              <span className="font-semibold text-brand-red">{functionalMoneyWords(totalDebits)}</span>
            </span>
            <span className="text-text-secondary">
              Total Credits:{' '}
              <span className="font-semibold text-brand-green">{functionalMoneyWords(totalCredits)}</span>
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
