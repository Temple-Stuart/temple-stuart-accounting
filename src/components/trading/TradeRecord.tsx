'use client';

import { useState, useEffect, useCallback } from 'react';
import { chip, SECTION_HEADER, STATE, themed } from '@/lib/ds';

/**
 * TRACK-1 — the scanner's public track record: claimed-vs-actual, honest win rate.
 *
 * Every stat is computed deterministically from rows the user owns — no estimates.
 * Data sources (both existing, auth-gated, user-scoped):
 *   - GET /api/trade-cards  -> { cards: [...] }, each card includes its `link`
 *     (trade_card_links: actual_pl, grade, trade_num). This is the card+outcome data.
 *   - GET /api/trading/coverage -> { unlinked_closed_count } (RISK-1) for the honest
 *     denominator disclosure (closed positions never linked to a card).
 *
 * TRUTH-FIRST: three explicit states — loading / error+Retry / loaded. Zero linked
 * cards is a TRUE state (honest guidance, no fabricated stats). A failed fetch renders
 * an explicit error, never empty-stats. Win rate is never shown without its denominator.
 *
 * Decimal note: Prisma Decimal fields serialize to strings over JSON — every numeric
 * field is wrapped in Number() before math (same pattern as TradeLabPanel:447).
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type CardLink = { actual_pl: string | number | null; grade: string | null; trade_num: string } | null;
interface Card {
  id: string;
  symbol: string;
  generated_at: string;
  status: string;
  max_loss: string | number | null;
  link: CardLink;
}

const fmtDate = (iso: string): string => (iso ? iso.slice(0, 10) : '—');
const fmtMoney = (n: number): string =>
  (n < 0 ? '-' : '') + '$' + Math.abs(Math.round(n)).toLocaleString('en-US');

export default function TradeRecord() {
  // TRADE-DS-1: single-consumer (the ML Trade tab) — always dark.
  const dk = true;
  const [state, setState] = useState<'loading' | 'error' | 'ok'>('loading');
  const [cards, setCards] = useState<Card[]>([]);
  const [unlinkedClosed, setUnlinkedClosed] = useState(0);
  const [showTable, setShowTable] = useState(false);

  const load = useCallback(async () => {
    setState('loading');
    try {
      const [cardsRes, covRes] = await Promise.all([
        fetch('/api/trade-cards'),        // all of the user's cards, each with its link
        fetch('/api/trading/coverage'),   // unlinked_closed_count for the denominator line
      ]);
      // Fail-loud: any non-OK response -> explicit error state (never empty-stats).
      if (!cardsRes.ok || !covRes.ok) throw new Error('track-record fetch failed');
      const cardsJson = await cardsRes.json();
      const covJson = await covRes.json();
      setCards(Array.isArray(cardsJson.cards) ? cardsJson.cards : []);
      setUnlinkedClosed(Number(covJson.unlinked_closed_count) || 0);
      setState('ok');
    } catch {
      setCards([]);
      setState('error');
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  if (state === 'loading') {
    return (
      <div className={themed('rounded-lg border border-border bg-white px-3 py-2 text-xs text-text-muted', dk)}>
        Building your track record…
      </div>
    );
  }
  if (state === 'error') {
    return (
      <div role="alert" className={`${STATE.errorCard} flex items-center justify-between gap-3`}>
        <span>Couldn&rsquo;t load your track record. Nothing is assumed — no stats are shown until it loads.</span>
        <button
          type="button"
          onClick={load}
          className="shrink-0 rounded border border-status-danger/40 px-2 py-1 text-[11px] font-semibold text-status-danger hover:bg-status-danger/15"
        >
          Retry
        </button>
      </div>
    );
  }

  // ── Deterministic stats (each traceable to rows) ───────────────────────────────
  // linked = cards that have a trade_card_links row (card.link != null).
  const linked = cards.filter((c) => c.link != null);
  // queued-not-linked = cards with no link yet.
  const queuedNotLinked = cards.length - linked.length;
  // decided = linked trades whose position has closed (actual_pl known). A linked-but-open
  // trade has actual_pl == null and is NOT counted as a win/loss/BE (unknown outcome).
  const decided = linked.filter((c) => c.link!.actual_pl != null);
  const openLinked = linked.length - decided.length;

  // Honest win rate: wins/losses/breakevens over DECIDED linked trades only.
  const wins = decided.filter((c) => Number(c.link!.actual_pl) > 0).length;
  const losses = decided.filter((c) => Number(c.link!.actual_pl) < 0).length;
  const breakevens = decided.filter((c) => Number(c.link!.actual_pl) === 0).length;

  // Net P&L over decided linked trades = sum(actual_pl).
  const netPl = decided.reduce((s, c) => s + Number(c.link!.actual_pl), 0);

  // Integrity (forensic Q2 as living UI): over decided trades with a stated max_loss,
  // a trade "stayed within" its claim iff actual_pl >= -max_loss (max_loss stored positive;
  // a loss is a negative actual_pl). Rows failing this are listed explicitly.
  const withMaxLoss = decided.filter((c) => c.max_loss != null);
  const exceeded = withMaxLoss.filter((c) => Number(c.link!.actual_pl) < -Number(c.max_loss));
  const withinClaim = withMaxLoss.length - exceeded.length;

  // Grade distribution over linked trades that carry a grade.
  const gradeCounts: Record<string, number> = { A: 0, B: 0, C: 0, D: 0, F: 0 };
  for (const c of linked) {
    const g = c.link!.grade;
    if (g && g in gradeCounts) gradeCounts[g] += 1;
  }

  // Per-trade table: losses lead (actual_pl ascending); open trades (null) sort last.
  const tableRows = [...linked].sort((a, b) => {
    const av = a.link!.actual_pl == null ? Infinity : Number(a.link!.actual_pl);
    const bv = b.link!.actual_pl == null ? Infinity : Number(b.link!.actual_pl);
    return av - bv;
  });

  return (
    <div className="rounded-lg border border-panel-border bg-panel-surface text-xs text-white/60">
      <div className={`${SECTION_HEADER} rounded-t-lg`}>Track record</div>

      {/* RECORD-BOOM: the HERO VERDICT — rows (b)/(c)/(d) at stat scale,
          every string byte-identical (the big stats compose the same
          dynamic values; qualifiers/sentences render beneath). */}
      {linked.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-3 border-b border-panel-border">
          {/* (b) HONEST WIN RATE — never a bare percentage without n. */}
          <div className="rounded-lg bg-white/5 p-3">
            <div className="font-mono text-2xl font-bold text-white">{wins}W – {losses}L – {breakevens}BE</div>
            <div className="text-white/50">
              of <span className="font-mono font-semibold text-white/90">{decided.length}</span> decided
              {openLinked > 0 && <span className="text-white/40"> ({openLinked} still open, outcome unknown)</span>}
            </div>
          </div>
          {/* (c) NET P&L — linked trades only. */}
          <div className="rounded-lg bg-white/5 p-3">
            <div className={`font-mono text-2xl font-bold ${netPl >= 0 ? 'text-brand-green' : 'text-brand-red'}`}>{fmtMoney(netPl)}</div>
            <div className="text-white/50">Net P&amp;L:<span className="text-white/40"> (linked trades only)</span></div>
          </div>
          {/* (d) INTEGRITY — the flagship: claimed vs actual max loss. */}
          <div className="rounded-lg bg-white/5 p-3">
            <div className="font-mono text-2xl font-bold text-white">{withinClaim} of {withMaxLoss.length}</div>
            <div className="text-white/50">
              Max-loss model: <span className="font-mono font-semibold text-white/90">{withinClaim}</span> of{' '}
              <span className="font-mono font-semibold text-white/90">{withMaxLoss.length}</span> linked trades stayed within their card&rsquo;s stated max loss.
            </div>
            {exceeded.length > 0 && (
              <ul className="mt-1 space-y-0.5">
                {exceeded.map((c) => (
                  <li key={c.id} className="text-brand-red font-mono">
                    {c.symbol}: claimed max loss {fmtMoney(-Number(c.max_loss))}, actual {fmtMoney(Number(c.link!.actual_pl))}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}

      {/* (a)+(e) — RECORD-BOOM: the supporting strip under the hero; counts
          as neutral chips (the ' · ' separators became chip gaps), grade
          chips as-is. Renders always — denominator honesty survives the
          zero state. */}
      <div className="px-3 py-2 border-b border-panel-border">
        <span className="inline-flex flex-wrap items-center gap-1">
          Record:{' '}
          <span className={chip()}>{linked.length} linked trades</span>
          <span className={chip()}>{unlinkedClosed} closed positions unlinked (excluded)</span>
          <span className={chip()}>{queuedNotLinked} cards queued, not yet linked</span>
          {linked.length > 0 && (
            <>
              Grades:{' '}
              {(['A', 'B', 'C', 'D', 'F'] as const).map((g) => (
                <span key={g} className={chip(g === 'A' || g === 'B' ? 'success' : g === 'C' ? 'warning' : 'danger')}>
                  {g} {gradeCounts[g]}
                </span>
              ))}
            </>
          )}
        </span>
      </div>

      {linked.length === 0 ? (
        // Honest zero-state — no fabricated stats.
        <div className="px-3 py-3 text-white/50">
          No linked trades yet — link queued cards to closed positions in Trade Lab to build your record.
        </div>
      ) : (
        <>
          {/* (f) PER-TRADE TABLE (collapsible) — losses lead. */}
          <div className="px-3 py-2">
            <button
              type="button"
              onClick={() => setShowTable((s) => !s)}
              className="text-[11px] font-medium text-brand-purple-pop hover:underline"
            >
              {showTable ? 'Hide' : 'Show'} per-trade detail ({linked.length})
            </button>
            {showTable && (
              <div className="mt-2 overflow-x-auto">
                <table className="w-full text-[11px]">
                  <thead className="text-white/50">
                    <tr>
                      <th className="px-2 py-1 text-left font-mono text-[10px] uppercase tracking-wider">Symbol</th>
                      <th className="px-2 py-1 text-left font-mono text-[10px] uppercase tracking-wider">Generated</th>
                      <th className="px-2 py-1 text-right font-mono text-[10px] uppercase tracking-wider">Claimed max loss</th>
                      <th className="px-2 py-1 text-right font-mono text-[10px] uppercase tracking-wider">Actual P&amp;L</th>
                      <th className="px-2 py-1 text-center font-mono text-[10px] uppercase tracking-wider">Grade</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-panel-border">
                    {tableRows.map((c) => {
                      const pl = c.link!.actual_pl;
                      return (
                        <tr key={c.id}>
                          <td className="px-2 py-1 font-mono font-semibold text-white/90">{c.symbol}</td>
                          <td className="px-2 py-1 font-mono text-white/50">{fmtDate(c.generated_at)}</td>
                          <td className="px-2 py-1 text-right font-mono">{c.max_loss != null ? fmtMoney(-Number(c.max_loss)) : '—'}</td>
                          <td className={`px-2 py-1 text-right font-mono font-semibold ${pl == null ? 'text-white/40' : Number(pl) >= 0 ? 'text-brand-green' : 'text-brand-red'}`}>
                            {pl == null ? 'Open' : fmtMoney(Number(pl))}
                          </td>
                          <td className="px-2 py-1 text-center">{c.link!.grade ? <span className={chip(c.link!.grade === 'A' || c.link!.grade === 'B' ? 'success' : c.link!.grade === 'C' ? 'warning' : 'danger')}>{c.link!.grade}</span> : '—'}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
