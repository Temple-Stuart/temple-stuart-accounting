'use client';

import { useState, useEffect, useCallback } from 'react';

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
      <div className="rounded-lg border border-border bg-white px-3 py-2 text-xs text-text-muted">
        Building your track record…
      </div>
    );
  }
  if (state === 'error') {
    return (
      <div role="alert" className="rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-xs text-red-700 flex items-center justify-between gap-3">
        <span>Couldn&rsquo;t load your track record. Nothing is assumed — no stats are shown until it loads.</span>
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
    <div className="rounded-lg border border-border bg-white text-xs text-text-secondary">
      <div className="border-b border-border px-3 py-2 font-semibold text-text-primary">Track record</div>

      {/* (a) HEADLINE COUNTS — denominator first, always. */}
      <div className="px-3 py-2 border-b border-border">
        Record: <span className="font-mono font-semibold text-text-primary">{linked.length}</span> linked trades
        {' · '}<span className="font-mono font-semibold text-text-primary">{unlinkedClosed}</span> closed positions unlinked (excluded)
        {' · '}<span className="font-mono font-semibold text-text-primary">{queuedNotLinked}</span> cards queued, not yet linked
      </div>

      {linked.length === 0 ? (
        // Honest zero-state — no fabricated stats.
        <div className="px-3 py-3 text-text-muted">
          No linked trades yet — link queued cards to closed positions in Trade Lab to build your record.
        </div>
      ) : (
        <>
          {/* (b) HONEST WIN RATE — never a bare percentage without n. */}
          <div className="px-3 py-2 border-b border-border">
            <span className="font-mono font-semibold text-text-primary">{wins}W – {losses}L – {breakevens}BE</span>{' '}
            of <span className="font-mono font-semibold text-text-primary">{decided.length}</span> decided
            {openLinked > 0 && <span className="text-text-faint"> ({openLinked} still open, outcome unknown)</span>}
          </div>

          {/* (c) NET P&L — linked trades only. */}
          <div className="px-3 py-2 border-b border-border">
            Net P&amp;L: <span className={`font-mono font-semibold ${netPl >= 0 ? 'text-brand-green' : 'text-brand-red'}`}>{fmtMoney(netPl)}</span>
            <span className="text-text-faint"> (linked trades only)</span>
          </div>

          {/* (d) INTEGRITY LINE — the flagship: claimed vs actual max loss. */}
          <div className="px-3 py-2 border-b border-border">
            Max-loss model: <span className="font-mono font-semibold text-text-primary">{withinClaim}</span> of{' '}
            <span className="font-mono font-semibold text-text-primary">{withMaxLoss.length}</span> linked trades stayed within their card&rsquo;s stated max loss.
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

          {/* (e) GRADE DISTRIBUTION over linked trades that carry a grade. */}
          <div className="px-3 py-2 border-b border-border">
            Grades:{' '}
            {(['A', 'B', 'C', 'D', 'F'] as const).map((g, i) => (
              <span key={g} className="font-mono">
                {i > 0 && ' · '}{g} <span className="font-semibold text-text-primary">{gradeCounts[g]}</span>
              </span>
            ))}
          </div>

          {/* (f) PER-TRADE TABLE (collapsible) — losses lead. */}
          <div className="px-3 py-2">
            <button
              type="button"
              onClick={() => setShowTable((s) => !s)}
              className="text-[11px] font-medium text-brand-purple hover:underline"
            >
              {showTable ? 'Hide' : 'Show'} per-trade detail ({linked.length})
            </button>
            {showTable && (
              <div className="mt-2 overflow-x-auto">
                <table className="w-full text-[11px]">
                  <thead className="text-text-muted">
                    <tr>
                      <th className="px-2 py-1 text-left font-medium">Symbol</th>
                      <th className="px-2 py-1 text-left font-medium">Generated</th>
                      <th className="px-2 py-1 text-right font-medium">Claimed max loss</th>
                      <th className="px-2 py-1 text-right font-medium">Actual P&amp;L</th>
                      <th className="px-2 py-1 text-center font-medium">Grade</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {tableRows.map((c) => {
                      const pl = c.link!.actual_pl;
                      return (
                        <tr key={c.id}>
                          <td className="px-2 py-1 font-mono font-semibold text-text-primary">{c.symbol}</td>
                          <td className="px-2 py-1 font-mono text-text-muted">{fmtDate(c.generated_at)}</td>
                          <td className="px-2 py-1 text-right font-mono">{c.max_loss != null ? fmtMoney(-Number(c.max_loss)) : '—'}</td>
                          <td className={`px-2 py-1 text-right font-mono font-semibold ${pl == null ? 'text-text-faint' : Number(pl) >= 0 ? 'text-brand-green' : 'text-brand-red'}`}>
                            {pl == null ? 'Open' : fmtMoney(Number(pl))}
                          </td>
                          <td className="px-2 py-1 text-center font-mono">{c.link!.grade ?? '—'}</td>
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
