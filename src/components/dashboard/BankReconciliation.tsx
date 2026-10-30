'use client';

/**
 * DOCUMENTS-02 (Alex, 2026-10-30) — THE BANK RECONCILIATION: a bank account's month, reconciled to the BOOKS.
 *
 * Mounted by src/components/home/BooksPipeline.tsx (the /books page, the Reconcile phase). Reworked in place:
 *   · the account (depository only, as before) and the MONTH ('YYYY-MM' — the previous calendar month by
 *     default, chosen, never a Date parsed in a zone);
 *   · the STATEMENT line — "Statement: <name> · <size> · PDF — open · replace" or "No statement — attach" —
 *     with the shared DocumentPanel at the address { account_id, period } (ruling A);
 *   · the BOOK SIDE from the server (/api/bank-reconciliations/book-side): the GL balance of the chart-of-
 *     accounts row the account posts to, as of the month's last day — or the server's refusal by name. The
 *     Plaid balance appears nowhere here (ruling B);
 *   · the statement balance and the reconciling items, typed in; the figures are the lib's one arithmetic over
 *     the SERVER's book balance (reconciliation.ts reconcile) — shown, never stored from here (ruling C);
 *   · "Mark reconciled" gated by the server's own reasons (reconciledGate: the books, the difference, the
 *     statement — ruling E); "Save draft"; "Re-open" on a reconciled current row (reopen=true — ruling D);
 *   · the list by month: the current row, and the superseded rows under it, read-only ("superseded <day> —
 *     final"); a failed save shows the server's words in place (ruling H).
 * No `|| 0`, no toLocaleDateString of an instant, no alert(). Nothing is kept in the browser — React state only.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { DocumentPanel } from '@/components/books/DocumentPanel';
import { ATTACH_WORDS, OPEN_WORDS, REPLACE_WORDS, STATEMENT_KIND_WORDS, type ReceiptMeta, type Refusal } from '@/lib/books/sourceDocuments';
import { periodRule, previousMonthOf, type Period } from '@/lib/books/period';
import {
  BANK_SIDE_LOADING_WORDS, ITEM_TYPES, ITEM_TYPE_WORDS, finiteNumber, isBalanced, itemsRule, moneyWords, reconcile, reconciledGate,
  statementBalanceRule, supersededWords, type ItemType, type ReconciliationItem, type ReconciliationRow,
} from '@/lib/books/reconciliation';

/** What the screen needs of an account — no balance: the bank's own number is not the book side. */
export interface ReconciliationAccountOption {
  readonly id: string;
  readonly name: string;
  readonly mask: string | null;
  readonly type: string;
  readonly institutionName: string | null;
}

/** The body /api/bank-reconciliations takes. */
export interface ReconciliationSave {
  readonly accountId: string;
  readonly period: string;
  readonly statementBalance: number;
  readonly items: readonly ReconciliationItem[];
  readonly status: 'draft' | 'reconciled';
  readonly reopen?: true;
}

export type SaveAnswer = { readonly ok: true } | Refusal;

/** The book side as the server answers it. */
interface BookSide {
  readonly book_balance: number;
  readonly as_of: string;
  readonly period: string;
  readonly words: string;
  readonly coa: { readonly code: string; readonly name: string; readonly entity_type: string };
  readonly statement: ReceiptMeta | null;
}
type BookSideRead = { state: 'idle' } | { state: 'loading' } | { state: 'ok'; side: BookSide } | { state: 'refused'; error: string };

/** An item as typed — the amount a string until the rule reads it. */
interface ItemDraft { readonly type: ItemType; readonly description: string; readonly amount: string; readonly cleared: boolean }

interface BankReconciliationProps {
  accounts: readonly ReconciliationAccountOption[];
  reconciliations: readonly ReconciliationRow[];
  /** 'YYYY-MM-DD', the UTC day — the default month is the calendar month before it. */
  today: string;
  onSave: (body: ReconciliationSave) => Promise<SaveAnswer>;
  onReload: () => void;
}

const accountWords = (a: Pick<ReconciliationAccountOption, 'name' | 'mask' | 'institutionName'>): string =>
  `${a.institutionName === null ? a.name : `${a.institutionName} · ${a.name}`}${a.mask === null ? '' : ` •••• ${a.mask}`}`;

export default function BankReconciliation({ accounts, reconciliations, today, onSave, onReload }: BankReconciliationProps) {
  const depository = useMemo(() => accounts.filter((a) => a.type === 'depository'), [accounts]);
  const [accountId, setAccountId] = useState<string>('');
  const [period, setPeriod] = useState<string>(previousMonthOf(today).period);
  const [statementBalance, setStatementBalance] = useState('');
  const [items, setItems] = useState<ItemDraft[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveWords, setSaveWords] = useState<string | null>(null);
  const [bookSide, setBookSide] = useState<BookSideRead>({ state: 'idle' });
  const [statementPanel, setStatementPanel] = useState<{ replacing: boolean } | null>(null);

  const month: Period | null = useMemo(() => { const p = periodRule(period); return p.ok ? p.value : null; }, [period]);
  const current = useMemo(() => reconciliations.find((r) => r.accountId === accountId && r.period === period) ?? null, [reconciliations, accountId, period]);
  const frozen = current !== null && current.status === 'reconciled';

  // The book side, from the server, whenever the account or the month changes.
  const readBookSide = useCallback(async () => {
    if (accountId === '' || month === null) { setBookSide({ state: 'idle' }); return; }
    setBookSide({ state: 'loading' });
    const res = await fetch(`/api/bank-reconciliations/book-side?accountId=${encodeURIComponent(accountId)}&period=${month.period}`);
    const body = await res.json().catch(() => ({}));
    if (!res.ok) { setBookSide({ state: 'refused', error: typeof body.error === 'string' ? body.error : `the book side answered ${res.status}` }); return; }
    setBookSide({ state: 'ok', side: body as BookSide });
  }, [accountId, month]);
  useEffect(() => { void readBookSide(); }, [readBookSide]);

  // The current row's figures fill the form when the account-month is chosen; a month with none starts empty.
  useEffect(() => {
    setSaveWords(null);
    setStatementPanel(null);
    if (current === null) { setStatementBalance(''); setItems([]); return; }
    setStatementBalance(String(current.statementBalance));
    setItems(current.items.map((i) => ({ type: i.type, description: i.description, amount: String(i.amount) })).map((i) => ({ ...i, cleared: current.items.find((c) => c.description === i.description && String(c.amount) === i.amount)?.cleared ?? false })));
  }, [current]);

  // The figures: the lib's one arithmetic over the SERVER's book balance — or the first thing that is not a number, said.
  const stmt = statementBalanceRule(statementBalance);
  const read = itemsRule(items.map((i) => ({ type: i.type, description: i.description, amount: finiteNumber(i.amount) ?? i.amount, cleared: i.cleared })));
  const figures = bookSide.state === 'ok' && stmt.ok && read.ok ? reconcile(stmt.value, bookSide.side.book_balance, read.value) : null;
  const figuresWords = !stmt.ok ? (statementBalance.trim() === '' ? null : stmt.error) : !read.ok ? read.error : null;
  const gate = month === null ? null : reconciledGate({
    bookSide: bookSide.state === 'ok' ? { ok: true } : bookSide.state === 'refused' ? { ok: false, status: 409, error: bookSide.error } : { ok: false, status: 409, error: BANK_SIDE_LOADING_WORDS },
    difference: figures === null ? null : figures.difference,
    statement: bookSide.state === 'ok' ? bookSide.side.statement : null,
    period: month,
  });

  const save = async (status: 'draft' | 'reconciled', reopen = false) => {
    if (accountId === '' || month === null || !stmt.ok || !read.ok) return;
    setSaving(true);
    setSaveWords(null);
    const answer = await onSave({ accountId, period: month.period, statementBalance: stmt.value, items: read.value, status, ...(reopen ? { reopen: true as const } : {}) });
    setSaving(false);
    if (!answer.ok) { setSaveWords(answer.error); return; }
    onReload();
  };

  const addItem = (type: ItemType) => setItems([...items, { type, description: '', amount: '', cleared: false }]);
  const updateItem = (index: number, patch: Partial<ItemDraft>) => setItems(items.map((it, i) => (i === index ? { ...it, ...patch } : it)));
  const removeItem = (index: number) => setItems(items.filter((_, i) => i !== index));
  const open = (row: ReconciliationRow) => { setAccountId(row.accountId); setPeriod(row.period); setShowForm(true); };

  const statementMeta = bookSide.state === 'ok' ? bookSide.side.statement : null;
  const panelId = `${accountId}:${period}`;

  return (
    <div className="bg-white overflow-hidden" data-bank-reconciliation>
      {/* Actions */}
      <div className="px-3 py-2 border-b border-border flex items-center justify-between">
        <span className="text-terminal-sm text-text-muted font-mono" data-reconciled-count>
          {reconciliations.filter((r) => r.status === 'reconciled').length} reconciled months
        </span>
        <button
          onClick={() => setShowForm(!showForm)}
          className="px-3 py-1 bg-brand-purple text-white rounded text-terminal-sm font-medium hover:bg-brand-purple-hover transition-colors"
          data-reconciliation-toggle
        >
          {showForm ? '✕ Cancel' : '+ New Reconciliation'}
        </button>
      </div>

      {showForm && (
        <div className="p-4 border-b bg-bg-row" data-reconciliation-form>
          {/* Account & month */}
          <div className="flex flex-wrap gap-3 mb-4">
            <div>
              <label className="block text-xs text-text-muted mb-1">Account</label>
              <select value={accountId} onChange={(e) => setAccountId(e.target.value)} className="px-3 py-2 border rounded text-sm min-w-[200px]" data-reconciliation-account>
                <option value="">Select account...</option>
                {depository.map((acc) => <option key={acc.id} value={acc.id}>{accountWords(acc)}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs text-text-muted mb-1">Month</label>
              <input type="month" value={period} onChange={(e) => setPeriod(e.target.value)} className="px-3 py-2 border rounded text-sm" data-reconciliation-period />
            </div>
            <div>
              <label className="block text-xs text-text-muted mb-1">Statement Balance</label>
              <input type="number" step="0.01" value={statementBalance} onChange={(e) => setStatementBalance(e.target.value)} placeholder="0.00"
                disabled={frozen} className="px-3 py-2 border rounded text-sm w-32" data-reconciliation-statement-balance />
            </div>
          </div>

          {accountId !== '' && month !== null && (
            <>
              {/* The statement document on its month (ruling A). */}
              <div className="mb-4 text-xs" data-statement-line={panelId} data-statement-state={bookSide.state === 'ok' ? (statementMeta === null ? 'none' : 'kept') : bookSide.state}>
                {bookSide.state === 'ok' && statementMeta !== null ? (
                  <div className="flex items-baseline gap-1 min-w-0">
                    <span className="truncate text-text-secondary" title={STATEMENT_KIND_WORDS.line(statementMeta)}>{STATEMENT_KIND_WORDS.line(statementMeta)}</span>
                    <span className="shrink-0 text-text-faint">—</span>
                    <a href={`/api/books/documents/${encodeURIComponent(statementMeta.id)}/file`} className="shrink-0 text-brand-purple underline decoration-dotted underline-offset-2 hover:text-brand-purple-hover" data-statement-open={statementMeta.id}>{OPEN_WORDS}</a>
                    <button type="button" onClick={() => setStatementPanel({ replacing: true })} className="shrink-0 text-brand-purple underline decoration-dotted underline-offset-2 hover:text-brand-purple-hover" data-statement-replace>{REPLACE_WORDS}</button>
                  </div>
                ) : bookSide.state === 'ok' ? (
                  <div className="flex items-baseline gap-1 min-w-0">
                    <span className="text-text-faint">{STATEMENT_KIND_WORDS.none} —</span>
                    <button type="button" onClick={() => setStatementPanel({ replacing: false })} className="shrink-0 text-brand-purple underline decoration-dotted underline-offset-2 hover:text-brand-purple-hover" data-statement-attach>{ATTACH_WORDS}</button>
                  </div>
                ) : bookSide.state === 'loading' ? (
                  <span className="text-text-faint">{STATEMENT_KIND_WORDS.loading}</span>
                ) : null}
                {statementPanel !== null && (
                  <DocumentPanel
                    key={`${panelId}:${statementPanel.replacing}`}
                    address={{ account_id: accountId, period: month.period }}
                    kind={STATEMENT_KIND_WORDS}
                    panelId={panelId}
                    replacing={statementPanel.replacing}
                    onKept={() => { setStatementPanel(null); void readBookSide(); onReload(); }}
                    onClose={() => setStatementPanel(null)}
                  />
                )}
              </div>

              {/* Bank Side / Book Side — the book side the server's (ruling B). */}
              <div className="grid grid-cols-2 gap-4 mb-4">
                <div className="bg-white p-4 rounded border" data-bank-side>
                  <h5 className="text-xs text-text-muted uppercase mb-2">Bank Side</h5>
                  <div className="space-y-1 text-sm">
                    <div className="flex justify-between"><span>Statement Balance:</span><span className="font-mono">{stmt.ok ? moneyWords(stmt.value) : '—'}</span></div>
                    <div className="flex justify-between text-brand-green"><span>+ Deposits in Transit:</span><span className="font-mono">{figures === null ? '—' : moneyWords(figures.depositsInTransit)}</span></div>
                    <div className="flex justify-between text-brand-red"><span>- Outstanding Checks:</span><span className="font-mono">{figures === null ? '—' : moneyWords(figures.outstandingChecks)}</span></div>
                    <div className="flex justify-between font-semibold border-t pt-1"><span>Adjusted Bank Balance:</span><span className="font-mono" data-adjusted-bank>{figures === null ? '—' : moneyWords(figures.adjustedBank)}</span></div>
                  </div>
                </div>
                <div className="bg-white p-4 rounded border" data-book-side data-book-side-state={bookSide.state}>
                  <h5 className="text-xs text-text-muted uppercase mb-2">Book Side</h5>
                  <div className="space-y-1 text-sm">
                    {bookSide.state === 'ok' ? (
                      <>
                        <div className="flex justify-between"><span>Book Balance ({bookSide.side.coa.code} {bookSide.side.coa.name}, as of {bookSide.side.as_of}):</span><span className="font-mono" data-book-balance>{moneyWords(bookSide.side.book_balance)}</span></div>
                        <div className="flex justify-between text-brand-red"><span>- Bank Fees:</span><span className="font-mono">{figures === null ? '—' : moneyWords(figures.bankFees)}</span></div>
                        <div className="flex justify-between text-brand-green"><span>+ Interest Earned:</span><span className="font-mono">{figures === null ? '—' : moneyWords(figures.interest)}</span></div>
                        <div className="flex justify-between font-semibold border-t pt-1"><span>Adjusted Book Balance:</span><span className="font-mono" data-adjusted-book>{figures === null ? '—' : moneyWords(figures.adjustedBook)}</span></div>
                      </>
                    ) : bookSide.state === 'refused' ? (
                      <p className="text-brand-red" role="alert" data-book-side-refusal>{bookSide.error}</p>
                    ) : (
                      <p className="text-text-faint">{BANK_SIDE_LOADING_WORDS}</p>
                    )}
                  </div>
                </div>
              </div>

              {/* Difference — the same arithmetic the server stores; the gate's reason when it is not reconciled. */}
              <div className={`p-3 rounded mb-4 text-center ${figures !== null && isBalanced(figures.difference) ? 'bg-green-100' : 'bg-red-100'}`} data-difference-box>
                <span className="font-semibold" data-difference>
                  {figures === null ? (figuresWords ?? 'Difference: —') : `Difference: ${moneyWords(figures.difference)}`}
                  {figures !== null && (isBalanced(figures.difference) ? ' ✓ RECONCILED' : ' ≠ NOT BALANCED')}
                </span>
                {gate !== null && !gate.ok && (
                  <p className="text-xs text-text-secondary mt-1" data-reconciled-gate>{gate.error}</p>
                )}
              </div>

              {/* Reconciling items */}
              <div className="mb-4">
                <div className="flex items-center justify-between mb-2">
                  <h5 className="font-medium text-sm">Reconciling Items</h5>
                  {!frozen && (
                    <div className="flex gap-2">
                      {ITEM_TYPES.map((t) => (
                        <button key={t} type="button" onClick={() => addItem(t)} className="text-xs px-2 py-1 bg-bg-row border rounded" data-add-item={t}>+ {ITEM_TYPE_WORDS[t]}</button>
                      ))}
                    </div>
                  )}
                </div>
                {items.length > 0 && (
                  <table className="w-full text-sm bg-white rounded border">
                    <thead className="bg-bg-row">
                      <tr>
                        <th className="px-3 py-2 text-left">Type</th>
                        <th className="px-3 py-2 text-left">Description</th>
                        <th className="px-3 py-2 text-right">Amount</th>
                        <th className="px-3 py-2 text-center">Cleared</th>
                        <th className="w-8"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {items.map((item, idx) => (
                        <tr key={idx} className="border-t" data-reconciliation-item={idx + 1}>
                          <td className="px-3 py-2"><span className="text-xs px-2 py-0.5 rounded bg-bg-row">{ITEM_TYPE_WORDS[item.type]}</span></td>
                          <td className="px-3 py-2">
                            <input type="text" value={item.description} onChange={(e) => updateItem(idx, { description: e.target.value })} placeholder="Description..." disabled={frozen} className="w-full px-2 py-1 border rounded text-sm" />
                          </td>
                          <td className="px-3 py-2">
                            <input type="number" step="0.01" value={item.amount} onChange={(e) => updateItem(idx, { amount: e.target.value })} placeholder="0.00" disabled={frozen} className="w-24 px-2 py-1 border rounded text-sm text-right" />
                          </td>
                          <td className="px-3 py-2 text-center">
                            <input type="checkbox" checked={item.cleared} onChange={(e) => updateItem(idx, { cleared: e.target.checked })} disabled={frozen} />
                          </td>
                          <td className="px-1">{!frozen && <button type="button" onClick={() => removeItem(idx)} className="text-red-400 hover:text-brand-red">✕</button>}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>

              {/* Actions — the server is the gate either way; its words show in place. */}
              {saveWords !== null && <p className="text-brand-red text-sm mb-2" role="alert" data-save-refusal>{saveWords}</p>}
              <div className="flex justify-end gap-2">
                {frozen ? (
                  <button type="button" onClick={() => save('draft', true)} disabled={saving} className="px-4 py-2 border rounded text-sm" data-reconciliation-reopen>
                    {saving ? 'Re-opening...' : 'Re-open'}
                  </button>
                ) : (
                  <>
                    <button type="button" onClick={() => save('draft')} disabled={saving || !stmt.ok || !read.ok} className="px-4 py-2 border rounded text-sm" data-reconciliation-save-draft>
                      Save draft
                    </button>
                    <button type="button" onClick={() => save('reconciled')} disabled={saving || gate === null || !gate.ok}
                      title={gate !== null && !gate.ok ? gate.error : undefined}
                      className="px-4 py-2 bg-brand-purple text-white rounded text-sm font-medium disabled:opacity-50" data-reconciliation-mark>
                      {saving ? 'Saving...' : 'Mark reconciled'}
                    </button>
                  </>
                )}
              </div>
            </>
          )}
        </div>
      )}

      {/* The months: each current row, its superseded rows under it. */}
      <div className="divide-y" data-reconciliation-list>
        {reconciliations.length === 0 ? (
          <div className="p-8 text-center text-text-faint">No reconciliations yet. Click &quot;+ New Reconciliation&quot; to start.</div>
        ) : (
          reconciliations.map((recon) => (
            <div key={recon.id} data-reconciliation-row={recon.id} data-reconciliation-status={recon.status}>
              <div onClick={() => open(recon)} className="px-4 py-3 flex items-center justify-between hover:bg-bg-row cursor-pointer">
                <div className="flex items-center gap-4">
                  <span className={`px-2 py-0.5 rounded text-xs font-medium ${recon.status === 'reconciled' ? 'bg-green-100 text-brand-green' : 'bg-yellow-100 text-yellow-700'}`}>
                    {recon.status === 'reconciled' ? '✓ reconciled' : recon.status}
                  </span>
                  <span className="font-medium">{accountWords({ name: recon.account.name, mask: recon.account.mask, institutionName: recon.account.institution })}</span>
                  <span className="text-sm text-text-muted" data-reconciliation-month>{recon.words}</span>
                  <span className="text-xs text-text-faint">{recon.statement === null ? STATEMENT_KIND_WORDS.none : STATEMENT_KIND_WORDS.line(recon.statement)}</span>
                </div>
                <div className="flex items-center gap-4 text-sm">
                  <span className="text-text-secondary">Stmt: {moneyWords(recon.statementBalance)}</span>
                  <span className="text-text-secondary">Book: {moneyWords(recon.bookBalance)}</span>
                  <span className={isBalanced(recon.difference) ? 'text-brand-green' : 'text-brand-red'}>Diff: {moneyWords(recon.difference)}</span>
                </div>
              </div>
              {recon.history.map((old) => (
                <div key={old.id} className="px-8 py-2 flex items-center justify-between text-xs text-text-muted bg-bg-row" data-reconciliation-superseded={old.id}>
                  <span>{old.status === 'reconciled' ? '✓ reconciled' : old.status} · {supersededWords(old.supersededOn ?? '')}</span>
                  <span className="flex gap-4"><span>Stmt: {moneyWords(old.statementBalance)}</span><span>Book: {moneyWords(old.bookBalance)}</span><span>Diff: {moneyWords(old.difference)}</span></span>
                </div>
              ))}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
