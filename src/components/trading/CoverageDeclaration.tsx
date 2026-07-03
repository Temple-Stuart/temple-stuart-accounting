'use client';

import { useState, useEffect, useCallback } from 'react';

/**
 * RISK-1 — coverage declaration for the Trade tab.
 *
 * States what the tab actually reflects: how many synced transactions, over what date
 * range, and how many closed positions are excluded from card stats (unlinked). Trades
 * never synced from the broker are NOT visible here — stated plainly.
 *
 * Self-fetches /api/trading/coverage (auth-gated, user-scoped, DB-only). Three explicit
 * states: loading / error+Retry / loaded truth. A failed fetch is NEVER rendered as
 * coverage or stats. "Zero data" is a true state (0 transactions), not an error.
 */

interface Coverage {
  investment_txn_count: number;
  earliest_txn_date: string | null;
  latest_txn_date: string | null;
  closed_position_count: number;
  linked_card_count: number;
  unlinked_closed_count: number;
  sync_window_start: string;
}

function fmtDate(iso: string | null): string {
  if (!iso) return '—';
  // Date-only, locale-independent (avoid TZ drift on a bare date display).
  return iso.slice(0, 10);
}

export default function CoverageDeclaration() {
  const [state, setState] = useState<'loading' | 'error' | 'ok'>('loading');
  const [data, setData] = useState<Coverage | null>(null);

  const load = useCallback(async () => {
    setState('loading');
    try {
      const res = await fetch('/api/trading/coverage');
      if (!res.ok) throw new Error('coverage fetch failed');
      const json: Coverage = await res.json();
      setData(json);
      setState('ok');
    } catch {
      setData(null);
      setState('error');
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  if (state === 'loading') {
    return (
      <div className="rounded-lg border border-border bg-white px-3 py-2 text-xs text-text-muted">
        Checking synced coverage…
      </div>
    );
  }

  if (state === 'error') {
    return (
      <div role="alert" className="rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-xs text-red-700 flex items-center justify-between gap-3">
        <span>Couldn&rsquo;t load coverage. Nothing is assumed — no coverage or stats are shown until it loads.</span>
        <button
          type="button"
          onClick={load}
          className="shrink-0 rounded border border-red-400 px-2 py-1 text-[11px] font-semibold text-red-700 hover:bg-red-100"
        >
          Retry
        </button>
      </div>
    );
  }

  if (!data) return null; // unreachable in 'ok', keeps types honest

  return (
    <div className="rounded-lg border border-border bg-white px-3 py-2 text-xs text-text-secondary">
      This tab reflects <span className="font-semibold text-text-primary">{data.investment_txn_count}</span> synced
      transactions from <span className="font-mono">{fmtDate(data.earliest_txn_date)}</span> to{' '}
      <span className="font-mono">{fmtDate(data.latest_txn_date)}</span>.{' '}
      <span className="font-semibold text-text-primary">{data.unlinked_closed_count}</span> closed position
      {data.unlinked_closed_count === 1 ? ' is' : 's are'} not linked to a card and{' '}
      {data.unlinked_closed_count === 1 ? 'is' : 'are'} excluded from card statistics. Trades never synced from
      your broker are not visible here — stats below describe only what has been synced (sync window starts{' '}
      <span className="font-mono">{data.sync_window_start}</span>).
    </div>
  );
}
