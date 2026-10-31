'use client';

/**
 * ACCOUNTS-01 — STEP 1's screen: every connected account, grouped by what it IS.
 *
 * It replaces a legacy page that threw on production. Two habits it does not
 * inherit: it never renders a number the data did not carry (a null balance is
 * "—", never NaN and never $0), and it never invents a word (a missing type or
 * subtype says "unknown — reported by the institution"). The grouping, the money
 * and the words are all src/lib/accountsView.ts, which the tests pin.
 *
 * Connect · Sync · Reconnect are the SHARED hook (useBankConnection) — the same
 * link token, the same Plaid Link, the same exchange-token / sync-complete /
 * reconnect-complete routes the cockpit bar and Books' Source Accounts drive. No
 * new Plaid code, no new route.
 *
 * Fail-loud: the read prints its HTTP status and the route's own error (a locked
 * tab prints the gate's own message, including the lapse line); a sync prints the
 * declared outcome; an entity change that fails reverts to the TRUE prior value.
 * Nothing here retries, defaults, or shows a figure it could not read.
 */
import { useCallback, useEffect, useState } from 'react';
import Script from 'next/script';
import { useBankConnection } from '@/components/bank/useBankConnection';
// SHELL-02: an entitlement refusal is a LOCK, never a red HTTP box.
import RoomLock from '@/components/shell/RoomLock';
import { navToolByName } from '@/lib/nav';
import { TOOL_GATE } from '@/lib/offer';
import ToolOpener from '@/components/shell/ToolOpener';
import {
  ACCOUNT_GROUPS, groupAccounts, isReported, money, rowsOf, describeWord, when,
  type AccountRow, type ApiItem,
} from '@/lib/accountsView';

/** The entity words /api/accounts/update-entity accepts (its own validTypes list). */
const ENTITY_OPTIONS: readonly string[] = ['personal', 'business', 'trading', 'retirement'];

const CARD = 'rounded-lg border border-border bg-white';
const TH = 'px-3 py-2 text-left font-medium';

// LOCK-01: the viewerId / offerAvailability props left with the offer card — a
// locked viewer sees the room, and the room needs neither an id nor a price.
export default function AccountsClient() {
  const [state, setState] = useState<'loading' | 'error' | 'ok' | 'locked'>('loading');
  const [failure, setFailure] = useState<string | null>(null);
  const [items, setItems] = useState<ApiItem[]>([]);
  const [entityBusy, setEntityBusy] = useState<string | null>(null);
  const [entityError, setEntityError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setState('loading');
    try {
      const res = await fetch('/api/accounts', { cache: 'no-store' });
      if (!res.ok) {
        // The route's own words — a 403 from the tab gate carries its message (and, since
        // LAUNCH-01, the lapse line). Never rewritten, never reduced to "failed".
        let detail = '';
        try {
          const body = (await res.json()) as { error?: unknown; message?: unknown };
          detail = [body.message, body.error].filter((v): v is string => typeof v === 'string')[0] ?? '';
        } catch {
          detail = 'no error body';
        }
        // SHELL-02: 403 is the tab gate refusing — a lock, not a fault. The
        // status and the route's words never reach the viewer; the lock card
        // says which module unlocks the step and offers the door.
        if (res.status === 403) {
          setState('locked');
          return;
        }
        setFailure(`HTTP ${res.status}${detail ? ` · ${detail}` : ''}`);
        setState('error');
        return;
      }
      const body = (await res.json()) as { items?: ApiItem[] };
      if (!Array.isArray(body.items)) {
        setFailure('the accounts read answered without an items list — nothing is assumed');
        setState('error');
        return;
      }
      setItems(body.items);
      setState('ok');
    } catch (e) {
      setFailure(`network — ${e instanceof Error ? e.message : String(e)}`);
      setState('error');
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const bank = useBankConnection({ onChanged: load });

  // Optimistic entity assignment with revert-on-failure — the revert restores the TRUE
  // prior value (Books' own pattern), never a fabricated default.
  const setEntity = async (row: AccountRow, entityType: string) => {
    const previous = row.entityType;
    setEntityBusy(row.id);
    setEntityError(null);
    setItems((prev) => prev.map((it) => ({ ...it, accounts: it.accounts.map((a) => (a.id === row.id ? { ...a, entityType } : a)) })));
    try {
      const res = await fetch('/api/accounts/update-entity', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accountId: row.id, entityType }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
    } catch (e) {
      setItems((prev) => prev.map((it) => ({ ...it, accounts: it.accounts.map((a) => (a.id === row.id ? { ...a, entityType: previous } : a)) })));
      setEntityError(`${row.name}: the entity change did not save (${e instanceof Error ? e.message : String(e)}) — it is back to what it was.`);
    } finally {
      setEntityBusy(null);
    }
  };

  // LOCK-01: a 403 shows the room's EMPTY state — the same groups an entitled
  // viewer with no accounts sees — never an error and never an HTTP status.
  const shown = state === 'ok' || state === 'locked';
  const rows = state === 'ok' ? rowsOf(items) : [];
  const groups = groupAccounts(rows);
  const connected = rows.length;

  return (
    <div data-accounts>
      {/* Plaid Link — the same CDN script the cockpit loads for the same flow. */}
      <Script src="https://cdn.plaid.com/link/v2/stable/link-initialize.js" strategy="lazyOnload" />

      {/* LOCK-01: the room renders for a locked viewer too — frozen, under one
          inline note. RoomLock is the one mechanism; nothing here is a pitch. */}
      <RoomLock locked={state === 'locked'} stepName="Accounts">
        <>
      {/* NAV-25: the opener names the TOOL — /accounts is Banking's screen. */}
      <ToolOpener
        tools={[navToolByName('Banking', TOOL_GATE)]}
        line={`Every account you have connected, grouped by what it is.${state === 'ok' ? ` ${connected} connected.` : ''}`}
        actions={<>
          <button
            type="button"
            onClick={bank.linkAccount}
            disabled={!bank.ready}
            data-connect
            className="rounded border border-brand-purple px-3 py-1.5 font-mono text-[10px] uppercase tracking-wider text-brand-purple hover:bg-brand-purple-wash disabled:opacity-50"
          >
            {bank.ready ? '+ Connect an account' : 'Connect — loading Plaid…'}
          </button>
          <button
            type="button"
            onClick={bank.syncAccounts}
            disabled={bank.syncing}
            data-sync
            className="rounded border border-border px-3 py-1.5 font-mono text-[10px] uppercase tracking-wider text-text-secondary hover:bg-bg-row disabled:opacity-50"
          >
            {bank.syncing ? 'Syncing…' : 'Sync'}
          </button>
        </>}
      />
      {bank.message && (
          <div
            role={bank.message.tone === 'ok' ? 'status' : 'alert'}
            data-sync-line
            className={`mt-2 rounded border p-2 text-xs ${bank.message.tone === 'ok' ? 'border-border bg-bg-row text-text-secondary' : 'border-brand-red/40 bg-brand-red/5 text-brand-red'}`}
          >
            {/* One line per failed bank above one line for what succeeded — one dead bank never reads as "sync failed". */}
            {bank.message.lines.map((line, i) => <div key={i}>{line}</div>)}
          </div>
        )}
      {entityError && <p role="alert" className="mt-2 text-xs text-brand-red" data-entity-error>{entityError}</p>}

      {state === 'loading' && <p className="font-mono text-xs text-text-faint" data-read="loading">Reading your accounts…</p>}

      {state === 'error' && (
        <div role="alert" className={`${CARD} border-brand-red/40 p-4`} data-read="failed">
          <p className="text-sm font-semibold text-brand-red">Your accounts could not be read.</p>
          <p className="mt-1 font-mono text-xs text-text-secondary">{failure}</p>
          <p className="mt-2 text-xs text-text-muted">Nothing is assumed — no list is shown rather than a wrong one.</p>
          <button type="button" onClick={load} className="mt-3 rounded border border-border px-3 py-1.5 font-mono text-[10px] uppercase tracking-wider text-text-secondary hover:bg-bg-row">Try again</button>
        </div>
      )}

      {shown && (
        <div className="space-y-4">
          {groups.map((group) => (
            <section key={group.key} className={`${CARD} p-3`} data-group={group.key} data-group-count={group.rows.length}>
              <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
                <h2 className="font-mono text-[10px] uppercase tracking-wider text-brand-purple">{group.label}</h2>
                <p className="font-mono text-[10px] text-text-faint">
                  {group.rows.length} {group.rows.length === 1 ? 'account' : 'accounts'}
                  {group.rows.length > 0 && <> <span className="text-text-muted">·</span> <span data-group-total>{money(group.total)}</span></>}
                </p>
              </div>

              {group.noFeed ? (
                <p className="text-xs text-text-muted" data-no-feed>{group.noFeed}</p>
              ) : group.rows.length === 0 ? (
                <p className="text-xs text-text-muted" data-empty>{group.empty}</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead className="bg-bg-row text-text-secondary">
                      <tr>
                        <th className={TH}>Institution</th>
                        <th className={TH}>Account</th>
                        <th className={TH}>Type</th>
                        <th className={TH}>Entity</th>
                        <th className={`${TH} text-right`}>Balance</th>
                        <th className={`${TH} text-right`}>Last updated</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {group.rows.map((row) => (
                        <tr key={row.id} data-account={row.id} data-item-error={row.lastErrorCode ?? undefined}>
                          <td className="px-3 py-2 font-medium text-text-primary">
                            {row.institutionName ?? <span className="text-text-muted">{describeWord(null)}</span>}
                            {(row.lastErrorCode || bank.reconnectNote?.itemId === row.itemId) && (
                              <div className="mt-1 flex flex-wrap items-center gap-2">
                                {row.lastErrorCode && (
                                  <>
                                    <span className="font-mono text-[10px] uppercase tracking-wider text-rose-700">needs reconnecting · {row.lastErrorCode}</span>
                                    <button
                                      type="button"
                                      data-reconnect={row.itemId}
                                      onClick={() => bank.reconnect(row.itemId, row.institutionName ?? '')}
                                      disabled={bank.reconnecting === row.itemId}
                                      className="rounded border border-brand-purple px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider text-brand-purple hover:bg-brand-purple-wash disabled:opacity-60"
                                    >
                                      {bank.reconnecting === row.itemId ? 'Opening…' : 'Reconnect'}
                                    </button>
                                  </>
                                )}
                                {bank.reconnectNote?.itemId === row.itemId && (
                                  <span role={bank.reconnectNote.tone === 'error' ? 'alert' : 'status'} className={`text-[10px] ${bank.reconnectNote.tone === 'ok' ? 'text-emerald-700' : bank.reconnectNote.tone === 'error' ? 'text-rose-700' : 'text-text-secondary'}`}>
                                    {bank.reconnectNote.text}
                                  </span>
                                )}
                              </div>
                            )}
                          </td>
                          <td className="px-3 py-2 text-text-secondary">
                            {row.name}
                            <span className="ml-2 font-mono text-text-faint">•••• {row.mask ?? '----'}</span>
                          </td>
                          <td className="px-3 py-2">
                            <span className={isReported(row.type) ? 'text-text-secondary' : 'text-text-muted italic'}>{describeWord(row.type)}</span>
                            <span className="text-text-faint"> · </span>
                            <span className={isReported(row.subtype) ? 'text-text-secondary' : 'text-text-muted italic'}>{describeWord(row.subtype)}</span>
                          </td>
                          <td className="px-3 py-2">
                            <select
                              value={row.entityType ?? ''}
                              disabled={entityBusy === row.id}
                              onChange={(e) => setEntity(row, e.target.value)}
                              data-entity={row.entityType ?? ''}
                              className="rounded border border-border px-2 py-0.5 text-[10px] uppercase disabled:opacity-50"
                            >
                              {!row.entityType && <option value="" disabled>unassigned</option>}
                              {ENTITY_OPTIONS.map((o) => <option key={o} value={o}>{o}</option>)}
                            </select>
                          </td>
                          <td className="px-3 py-2 text-right font-mono font-semibold text-text-primary" data-balance>{money(row.balance)}</td>
                          <td className="px-3 py-2 text-right font-mono text-text-muted">{when(row.updatedAt)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          ))}
          <p className="font-mono text-[10px] leading-relaxed text-text-faint">
            Balance is what the institution last reported; “—” means it reported none. “Last updated” is when the
            row last changed — a sync, or an entity assignment. The product records no per-account sync time, so
            none is shown. Groups come from the account’s own type and subtype ({ACCOUNT_GROUPS.map((g) => g.label).join(' · ')}).
          </p>
        </div>
      )}
        </>
      </RoomLock>
    </div>
  );
}
