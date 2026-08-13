'use client';

import { useState, useEffect, useCallback } from 'react';
import { formatMoney, moneyColorClass } from '@/lib/money';
import { chip, CHIP_VARIANTS, type ChipVariant, SECTION_HEADER } from '@/lib/ds';

interface TradeCard {
  id: string;
  symbol: string;
  strategy_name: string;
  direction: string;
  legs: { type: string; side: string; strike: number; price: number }[];
  entry_price: number | null;
  max_profit: number | null;
  max_loss: number | null;
  win_rate: number | null;
  risk_reward: number | null;
  thesis_points: string[] | null;
  // CARD-100-RENDER: key_stats' full captured sub-shape (was Record<string,
  // unknown>) — typing only, the payload already carried it.
  key_stats: {
    current_price?: number | string | null; iv_rank?: number | string | null;
    iv_percentile?: number | string | null; iv30?: number | string | null;
    hv30?: number | string | null; iv_hv_spread?: number | string | null;
    vol_cone?: { hv10?: number | null; hv20?: number | null; hv30?: number | null; hv60?: number | null; hv90?: number | null; current_iv?: number | null; candles_used?: number; note?: string } | null;
    forward_vol?: { from_expiry?: string; to_expiry?: string; from_dte?: number; to_dte?: number; forward_iv?: number; note?: string } | null;
    earnings_date?: string | null; days_to_earnings?: number | null;
    earnings_pattern?: { beat_rate?: number | null; avg_surprise_pct?: number | null; total_quarters?: number; consecutive_beats?: number; consecutive_misses?: number; streak?: string; sue_score?: number | null; direction?: string | null } | null;
    market_cap?: number | null; sector?: string | null; beta?: number | null;
    spy_correlation?: number | null; pe_ratio?: number | null;
    dividend_yield?: number | null; liquidity_rating?: number | null;
    lendability?: string | null; borrow_rate?: number | null;
    buzz_ratio?: number | null; sentiment_momentum?: number | null;
    analyst_consensus?: string | null;
  } | null;
  macro_regime: string | null;
  sentiment: string | null;
  insider_activity: string | null;
  convergence_gate: string | null;
  vol_sub_scores: Record<string, number | string | null> | null;
  social_score: number | string | null;
  social_post_count: number | null;
  social_themes: string[] | null;
  social_posts: unknown[] | null;
  headlines: { title: string; source: string; sentiment: string }[] | null;
  dte: number | null;
  expiration_date: string | null;
  generated_at: string;
  status: string;
  link: {
    id: string;
    trade_num: string;
    grade: string | null;
    actual_pl: number | null;
    actual_entry_price: number | null;
    actual_exit_price: number | null;
    thesis_results: boolean[] | null;
    notes: string | null;
    linked_at: string;
  } | null;
  // LAB-FULL-CARD: the captured scanner columns the GET already delivers
  // (route has no select — every column flows; Prisma Decimals serialize as
  // strings). Typing only — presentation reads, zero fetch changes.
  composite_score: number | string | null;
  letter_grade: string | null;
  vol_edge_score: number | string | null;
  quality_score: number | string | null;
  regime_score: number | string | null;
  info_edge_score: number | string | null;
  greeks_delta: number | string | null;
  greeks_gamma: number | string | null;
  greeks_theta: number | string | null;
  greeks_vega: number | string | null;
  ev_per_risk: number | string | null;
  risk_flags: string[] | null;
  /** The full snapshot column — a Json field, so it arrives as an OBJECT
   *  (no JSON.parse needed); setup carries the fields that never became
   *  columns (breakevens, net credit/debit, ev, pop_method, theta/day). */
  full_card_json: {
    setup?: {
      breakevens?: number[] | null;
      net_credit?: number | null;
      net_debit?: number | null;
      ev?: number | null;
      pop_method?: string | null;
      hv_pop?: number | null;
      has_wide_spread?: boolean | null;
      is_unlimited_risk?: boolean | null;
      greeks?: { theta_per_day?: number | null } | null;
    } | null;
    why?: { plain_english_signals?: string[] | null } | null;
  } | null;
}

interface MatchablePosition {
  trade_num: string;
  symbol: string;
  strategy: string | null;
  open_date: string;
  status: string;
  option_type: string | null;
  strike_price: number | null;
  expiration_date: string | null;
}

export default function TradeLabPanel({ onCardsChange }: { onCardsChange?: () => void; }) {
  const [cards, setCards] = useState<TradeCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>('all');

  // Linking state
  const [linkingCardId, setLinkingCardId] = useState<string | null>(null);
  const [matchablePositions, setMatchablePositions] = useState<MatchablePosition[]>([]);
  const [loadingPositions, setLoadingPositions] = useState(false);
  const [linkError, setLinkError] = useState<string | null>(null);

  // Expanded scorecard
  const [expandedCardId, setExpandedCardId] = useState<string | null>(null);

  // Grading in progress
  const [gradingCardId, setGradingCardId] = useState<string | null>(null);

  // LAB-FULL-CARD: presentation-only collapse for the full-intel block
  // (DISCLOSURE-COMPACT precedent) — one boolean; it applies to whichever
  // card is expanded (expandedCardId is single) and carries across cards.
  const [intelOpen, setIntelOpen] = useState(false);

  // RISK-1: coverage stats (linked / closed / unlinked) from /api/trading/coverage.
  // Self-fetched; null until loaded — the strip renders only on success (never fabricated).
  const [coverage, setCoverage] = useState<
    { linked_card_count: number; closed_position_count: number; unlinked_closed_count: number } | null
  >(null);
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/trading/coverage');
        if (res.ok) setCoverage(await res.json());
      } catch { /* leave null — strip simply does not render, no fabricated numbers */ }
    })();
  }, []);

  // Scanner start date (per-user)
  const [scannerStartDate, setScannerStartDate] = useState<string | null>(null);
  const [editingStartDate, setEditingStartDate] = useState(false);
  const [startDateInput, setStartDateInput] = useState('');

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/user/scanner-start-date');
        if (res.ok) {
          const { scanner_start_date } = await res.json();
          if (scanner_start_date) setScannerStartDate(scanner_start_date);
        }
      } catch { /* ignore */ }
    })();
  }, []);

  const saveScannerStartDate = async (dateStr: string) => {
    try {
      const res = await fetch('/api/user/scanner-start-date', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scanner_start_date: dateStr }),
      });
      if (res.ok) {
        const { scanner_start_date } = await res.json();
        setScannerStartDate(scanner_start_date);
        setEditingStartDate(false);
      }
    } catch { /* ignore */ }
  };

  const formatDate = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  const loadCards = useCallback(async () => {
    setLoading(true);
    try {
      const url = filter === 'all' ? '/api/trade-cards' : `/api/trade-cards?status=${filter}`;
      const res = await fetch(url);
      if (res.ok) {
        const { cards: data } = await res.json();
        setCards(data);
      }
    } catch (error) {
      console.error('Failed to load trade cards:', error);
    }
    setLoading(false);
  }, [filter]);

  useEffect(() => {
    loadCards();
  }, [loadCards]);

  const deleteCard = async (id: string) => {
    try {
      const res = await fetch('/api/trade-cards', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      });
      if (res.ok) {
        setCards(prev => prev.filter(c => c.id !== id));
        onCardsChange?.();
      }
    } catch (err) {
      console.error('Delete card error:', err);
    }
  };

  // Open linking dropdown — fetch matchable positions
  const startLinking = async (card: TradeCard) => {
    if (linkingCardId === card.id) {
      setLinkingCardId(null);
      return;
    }
    setLinkingCardId(card.id);
    setLoadingPositions(true);
    setLinkError(null);
    setMatchablePositions([]);

    try {
      const afterDate = card.generated_at;
      const res = await fetch(
        `/api/trade-card-links?positions_for=${encodeURIComponent(card.symbol)}&after=${encodeURIComponent(afterDate)}`
      );
      if (res.ok) {
        const { positions } = await res.json();
        setMatchablePositions(positions);
      } else {
        const data = await res.json().catch(() => ({}));
        setLinkError(data.error || 'Failed to load positions');
      }
    } catch (err) {
      console.error('Load positions error:', err);
      setLinkError('Network error');
    }
    setLoadingPositions(false);
  };

  // Link card to position
  const linkToPosition = async (cardId: string, tradeNum: string) => {
    setLinkError(null);
    try {
      const res = await fetch('/api/trade-card-links', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ trade_card_id: cardId, trade_num: tradeNum }),
      });
      if (res.ok) {
        setLinkingCardId(null);
        await loadCards();
        onCardsChange?.();
      } else {
        const data = await res.json().catch(() => ({}));
        setLinkError(data.error || 'Failed to link');
      }
    } catch (err) {
      console.error('Link error:', err);
      setLinkError('Network error');
    }
  };

  // Unlink card
  const unlinkCard = async (linkId: string) => {
    try {
      const res = await fetch('/api/trade-card-links', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: linkId }),
      });
      if (res.ok) {
        await loadCards();
        onCardsChange?.();
      }
    } catch (err) {
      console.error('Unlink error:', err);
    }
  };

  // Grade a linked card
  const gradeCard = async (cardId: string) => {
    setGradingCardId(cardId);
    try {
      const res = await fetch(`/api/trade-card-links?trade_card_id=${cardId}`);
      if (res.ok) {
        await loadCards();
        onCardsChange?.();
      }
    } catch (err) {
      console.error('Grade error:', err);
    }
    setGradingCardId(null);
  };

  const fmtDollar = (v: number | null) => {
    if (v == null) return '\u2014';
    return v >= 0 ? `$${Math.abs(v).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}` : `-$${Math.abs(v).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
  };

  const fmtDate = (d: string) => {
    return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
  };

  const fmtDateShort = (d: string) => {
    return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  // TRADE-CHIPS: the 25-hex inline-style system died — states map to the DS
  // chip vocabulary (ds.ts CHIP_VARIANTS). The letter/word INSIDE the chip
  // carries any distinction two states sharing a variant would lose.
  const dirVariant = (d: string): ChipVariant => {
    const u = d.toUpperCase();
    if (u === 'BULLISH') return 'success';
    if (u === 'BEARISH') return 'danger';
    return 'neutral';
  };

  // Pipeline stages stay visually DISTINCT (queued→warning, entered→info,
  // linked→accent, graded→success) — no two stages collapse.
  const statusBadge = (status: string): { variant: ChipVariant; text: string } => {
    switch (status) {
      case 'queued': return { variant: 'warning', text: 'Queued' };
      case 'entered': return { variant: 'info', text: 'Entered' };
      case 'linked': return { variant: 'accent', text: 'Linked' };
      case 'graded': return { variant: 'success', text: 'Graded' };
      default: return { variant: 'neutral', text: status };
    }
  };

  // A,B→success · C→warning · D,F→danger (the ruled mapping; the letter is
  // the chip text, so A vs B and D vs F stay distinguishable).
  const gradeVariant = (g: string | null): ChipVariant => {
    switch (g) {
      case 'A': case 'B': return 'success';
      case 'C': return 'warning';
      case 'D': case 'F': return 'danger';
      default: return 'neutral';
    }
  };

  return (
    <div>
      {/* Header */}
      <div className={`${SECTION_HEADER} rounded-t-lg`}>
        <div>
          <span>Trade Lab</span>
          <span className={`${chip()} ml-2`}>{cards.length} card{cards.length !== 1 ? 's' : ''}</span>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={filter}
            onChange={e => setFilter(e.target.value)}
            className="rounded border border-border bg-white px-2 py-1 text-xs text-text-primary"
          >
            <option value="all">All</option>
            <option value="queued">Queued</option>
            <option value="entered">Entered</option>
            <option value="linked">Linked</option>
            <option value="graded">Graded</option>
          </select>
          <button onClick={loadCards} className="rounded border border-border px-3 py-1 text-xs hover:bg-bg-row">
            Refresh
          </button>
        </div>
      </div>

      {/* RISK-1: coverage stats strip — denominator always visible (no win-rate without it).
          Renders only when coverage loaded; never fabricated on failure. */}
      {coverage && (
        <div className="border-b border-border bg-white px-4 py-1.5 text-[11px] text-text-muted">
          Linked cards: <span className="font-mono font-semibold text-text-primary">{coverage.linked_card_count}</span>
          {' · '}Closed positions: <span className="font-mono font-semibold text-text-primary">{coverage.closed_position_count}</span>
          {' · '}Unlinked: <span className="font-mono font-semibold text-text-primary">{coverage.unlinked_closed_count}</span>
        </div>
      )}

      {/* Legacy notice */}
      <div className="border-b border-status-warning/30 bg-status-warning/10 px-4 py-2 text-xs text-status-warning">
        {editingStartDate ? (
          <span className="inline-flex items-center gap-2">
            Scanner start date:{' '}
            <input
              type="date"
              value={startDateInput}
              onChange={e => setStartDateInput(e.target.value)}
              className="rounded border border-border bg-white px-1 py-0.5 text-xs text-text-primary"
            />
            <button
              onClick={() => saveScannerStartDate(startDateInput)}
              className="text-xs font-bold text-status-success hover:underline"
            >
              Save
            </button>
            <button
              onClick={() => setEditingStartDate(false)}
              className="text-xs text-text-faint hover:text-text-secondary"
            >
              Cancel
            </button>
          </span>
        ) : scannerStartDate ? (
          <>
            Positions opened before{' '}
            <button
              onClick={() => {
                setStartDateInput(scannerStartDate.slice(0, 10));
                setEditingStartDate(true);
              }}
              className="underline font-bold cursor-pointer"
            >
              {formatDate(scannerStartDate)}
            </button>
            {' '}are legacy trades without scanner data. Only new trades can be linked to trade cards.
          </>
        ) : (
          <>
            <button
              onClick={() => {
                setStartDateInput('');
                setEditingStartDate(true);
              }}
              className="underline font-bold cursor-pointer"
            >
              Set your scanner start date
            </button>
            {' '}to identify which positions are legacy trades without scanner data.
          </>
        )}
      </div>

      {loading ? (
        <div className="p-8 text-center text-sm text-text-muted">Loading trade cards...</div>
      ) : cards.length === 0 ? (
        <div className="p-12 text-center">
          <div className="text-text-faint text-sm mb-2">No trade cards {filter !== 'all' ? `with status "${filter}"` : 'yet'}</div>
          <div className="text-text-faint text-xs">
            Use Market Intelligence to scan for opportunities, then click &ldquo;Enter Trade&rdquo; on any strategy card to save it here.
          </div>
        </div>
      ) : (
        <div className="divide-y divide-border">
          {cards.map(card => {
            const dir = dirVariant(card.direction);
            const badge = statusBadge(card.status);
            const legs = card.legs as { type: string; side: string; strike: number; price: number }[];
            const isExpanded = expandedCardId === card.id;
            const isLinking = linkingCardId === card.id;
            const isGrading = gradingCardId === card.id;
            const gc = gradeVariant(card.link?.grade ?? null);

            return (
              <div key={card.id}>
                {/* Card row */}
                <div
                  className={`px-4 py-3 transition-colors cursor-pointer ${
                    card.status === 'graded' && card.link?.grade
                      ? Number(card.link.actual_pl) >= 0 ? 'bg-status-success/10 hover:bg-status-success/15' : 'bg-status-danger/10 hover:bg-status-danger/15'
                      : 'hover:bg-bg-row'
                  }`}
                  onClick={() => setExpandedCardId(isExpanded ? null : card.id)}
                >
                  <div className="flex items-start justify-between gap-4">
                    {/* Left: symbol + strategy */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <span className="text-base font-bold font-mono text-text-primary">{card.symbol}</span>
                        <span className="text-xs font-medium text-text-secondary">{card.strategy_name}</span>
                        <span className={chip(dir)}>
                          {card.direction.toUpperCase()}
                        </span>
                        <span className={chip(badge.variant)}>
                          {badge.text}
                        </span>
                        {/* Grade badge */}
                        {card.link?.grade && (
                          <span className={`rounded px-2 py-0.5 text-sm font-black ${CHIP_VARIANTS[gc]}`}>
                            {card.link.grade}
                          </span>
                        )}
                      </div>

                      {/* Legs */}
                      <div className="flex gap-3 text-[11px] text-text-muted mb-1 flex-wrap">
                        {legs.map((leg, i) => (
                          <span key={i} className="font-mono">
                            <span className={leg.side === 'sell' ? 'text-status-danger' : 'text-status-success'}>{leg.side.toUpperCase()}</span>
                            {' '}{leg.type.toUpperCase()}{' '}${leg.strike}{' '}@{' '}${leg.price.toFixed(2)}
                          </span>
                        ))}
                      </div>

                      {/* Meta row */}
                      <div className="flex items-center gap-4 text-[10px] text-text-faint flex-wrap">
                        <span>Queued {fmtDate(card.generated_at)}</span>
                        {card.dte != null && <span>{card.dte} DTE</span>}
                        {card.expiration_date && <span>Exp {fmtDateShort(card.expiration_date)}</span>}
                        {card.link && <span className="text-brand-purple font-medium">Trade #{card.link.trade_num}</span>}
                        {card.link?.linked_at && <span>Linked {fmtDateShort(card.link.linked_at)}</span>}
                      </div>
                    </div>

                    {/* Right: key numbers + actions */}
                    <div className="shrink-0 text-right space-y-1" onClick={e => e.stopPropagation()}>
                      {/* Actual P&L for graded cards */}
                      {card.link?.actual_pl != null && (
                        <div className="mb-1">
                          <div className="text-[9px] text-text-muted uppercase">Actual P&L</div>
                          <div className={`text-terminal-lg font-mono font-black ${moneyColorClass(Number(card.link.actual_pl), 'pnl')}`}>
                            {formatMoney(Number(card.link.actual_pl), { kind: 'pnl', fractionDigits: 0 })}
                          </div>
                        </div>
                      )}

                      <div className="grid grid-cols-2 gap-x-4 gap-y-0.5 text-[11px]">
                        <div className="text-text-muted">Max Profit</div>
                        <div className="font-mono font-bold text-brand-green">{fmtDollar(card.max_profit)}</div>
                        <div className="text-text-muted">Max Loss</div>
                        <div className="font-mono font-bold text-brand-red">{fmtDollar(card.max_loss)}</div>
                        <div className="text-text-muted" title="Estimated Probability of Profit based on delta approximation">Est. PoP</div>
                        {/* TRADE-UX-1: the anchor leads the queue row \u2014 size +
                            weight within the grid idiom. Same field/format. */}
                        <div className="font-mono font-black text-sm text-text-secondary">{card.win_rate != null ? `${Number(card.win_rate).toFixed(1)}%` : '\u2014'}</div>
                        <div className="text-text-muted">R:R</div>
                        <div className="font-mono font-bold text-text-secondary">{card.risk_reward != null ? Number(card.risk_reward).toFixed(2) : '\u2014'}</div>
                      </div>

                      {/* Actions by status */}
                      <div className="flex items-center justify-end gap-2 mt-1.5">
                        {/* Queued/Entered: Link + Delete */}
                        {(card.status === 'queued' || card.status === 'entered') && (
                          <>
                            <button
                              onClick={() => startLinking(card)}
                              className="text-[10px] font-medium text-brand-purple hover:underline transition-colors"
                            >
                              {isLinking ? 'Cancel' : 'Link to Position'}
                            </button>
                            <button
                              onClick={() => deleteCard(card.id)}
                              className="text-[10px] text-text-faint hover:text-status-danger transition-colors"
                            >
                              Remove
                            </button>
                          </>
                        )}

                        {/* Linked: Grade + Unlink */}
                        {card.status === 'linked' && card.link && (
                          <>
                            <button
                              onClick={() => gradeCard(card.id)}
                              disabled={isGrading}
                              className="text-[10px] font-medium text-brand-purple hover:underline transition-colors disabled:opacity-50"
                            >
                              {isGrading ? 'Grading...' : 'Check Grade'}
                            </button>
                            <button
                              onClick={() => unlinkCard(card.link!.id)}
                              className="text-[10px] text-text-faint hover:text-status-danger transition-colors"
                            >
                              Unlink
                            </button>
                          </>
                        )}

                        {/* Graded: Unlink */}
                        {card.status === 'graded' && card.link && (
                          <button
                            onClick={() => unlinkCard(card.link!.id)}
                            className="text-[10px] text-text-faint hover:text-status-danger transition-colors"
                          >
                            Unlink
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Linking dropdown */}
                {isLinking && (
                  <div className="px-4 py-3 bg-bg-row border-t border-border" onClick={e => e.stopPropagation()}>
                    <div className="text-xs font-medium text-text-secondary mb-2">
                      Select a position to link to:
                    </div>
                    {linkError && (
                      <div className="text-xs text-brand-red mb-2">{linkError}</div>
                    )}
                    {loadingPositions ? (
                      <div className="text-xs text-text-muted">Loading positions...</div>
                    ) : matchablePositions.length === 0 ? (
                      <div className="text-xs text-text-muted">
                        No matching positions yet &mdash; execute the trade and commit it in Books first.
                      </div>
                    ) : (
                      <div className="space-y-1">
                        {matchablePositions.map(pos => (
                          <button
                            key={pos.trade_num}
                            onClick={() => linkToPosition(card.id, pos.trade_num)}
                            className="w-full text-left px-3 py-2 rounded border border-border bg-white hover:border-brand-purple hover:bg-bg-row transition-colors"
                          >
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2 text-xs">
                                <span className="font-mono font-bold text-text-primary">#{pos.trade_num}</span>
                                <span className="font-medium text-text-secondary">{pos.symbol}</span>
                                {pos.strategy && <span className="text-text-muted">{pos.strategy}</span>}
                                {pos.option_type && (
                                  <span className="text-text-faint">
                                    {pos.option_type} {pos.strike_price ? `$${pos.strike_price}` : ''}
                                  </span>
                                )}
                              </div>
                              <div className="flex items-center gap-2 text-[10px] text-text-faint">
                                <span>{fmtDateShort(pos.open_date)}</span>
                                <span className={chip(pos.status === 'OPEN' ? 'success' : 'neutral')}>
                                  {pos.status}
                                </span>
                              </div>
                            </div>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* Expanded scorecard */}
                {isExpanded && (
                  <div className="px-4 py-3 bg-bg-row border-t border-border">
                    <div className="grid grid-cols-2 gap-4">
                      {/* Left: Predicted */}
                      <div>
                        <div className="text-[10px] text-text-muted uppercase tracking-wider font-bold mb-2">Predicted</div>
                        <div className="space-y-1 text-xs">
                          <div className="flex justify-between">
                            <span className="text-text-muted">Max Profit</span>
                            <span className="font-mono font-bold text-brand-green">{fmtDollar(card.max_profit)}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-text-muted">Max Loss</span>
                            <span className="font-mono font-bold text-brand-red">{fmtDollar(card.max_loss)}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-text-muted" title="Estimated Probability of Profit based on delta approximation">Est. PoP</span>
                            <span className="font-mono font-bold text-text-secondary">{card.win_rate != null ? `${Number(card.win_rate).toFixed(1)}%` : '\u2014'}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-text-muted">R:R</span>
                            <span className="font-mono font-bold text-text-secondary">{card.risk_reward != null ? Number(card.risk_reward).toFixed(2) : '\u2014'}</span>
                          </div>
                          {card.entry_price != null && (
                            <div className="flex justify-between">
                              <span className="text-text-muted">Entry Price</span>
                              <span className="font-mono font-bold text-text-secondary">${Number(card.entry_price).toFixed(2)}</span>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Right: Actual (if linked/graded) */}
                      <div>
                        {card.link ? (
                          <>
                            <div className="text-[10px] text-text-muted uppercase tracking-wider font-bold mb-2">Actual</div>
                            <div className="space-y-1 text-xs">
                              <div className="flex justify-between">
                                <span className="text-text-muted">P&L</span>
                                <span className={`font-mono font-bold ${card.link.actual_pl != null ? moneyColorClass(Number(card.link.actual_pl), 'pnl') : 'text-text-secondary'}`}>
                                  {card.link.actual_pl != null ? formatMoney(Number(card.link.actual_pl), { kind: 'pnl', fractionDigits: 0 }) : 'Open'}
                                </span>
                              </div>
                              {card.link.actual_entry_price != null && (
                                <div className="flex justify-between">
                                  <span className="text-text-muted">Entry Price</span>
                                  <span className="font-mono font-bold text-text-secondary">${Number(card.link.actual_entry_price).toFixed(2)}</span>
                                </div>
                              )}
                              {card.link.actual_exit_price != null && (
                                <div className="flex justify-between">
                                  <span className="text-text-muted">Exit Price</span>
                                  <span className="font-mono font-bold text-text-secondary">${Number(card.link.actual_exit_price).toFixed(2)}</span>
                                </div>
                              )}
                              {card.link.grade && (
                                <div className="flex justify-between items-center mt-2">
                                  <span className="text-text-muted">Grade</span>
                                  {/* TRADE-CHIPS: hero grade keeps its scale,
                                      wears the chip variant colors (one map). */}
                                  <span className={`rounded px-3 py-1 text-terminal-lg font-black ${CHIP_VARIANTS[gradeVariant(card.link.grade)]}`}>
                                    {card.link.grade}
                                  </span>
                                </div>
                              )}
                            </div>
                          </>
                        ) : (
                          <div>
                            <div className="text-[10px] text-text-muted uppercase tracking-wider font-bold mb-2">Actual</div>
                            <div className="text-xs text-text-faint">Not yet linked to a position</div>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* LAB-FULL-CARD: the scores strip — always visible,
                        captured columns only (letter_grade + composite +
                        the four pillar columns vol_edge/quality/regime/
                        info_edge_score). Letter chip wears the slice-2
                        grade mapping; +/− modifiers strip for variant
                        lookup only (display keeps the exact grade). */}
                    {(card.letter_grade || card.composite_score != null || card.convergence_gate || (Array.isArray(card.risk_flags) && card.risk_flags.length > 0) || card.full_card_json?.setup?.has_wide_spread || card.full_card_json?.setup?.is_unlimited_risk) && (
                      <div className="mt-3 pt-3 border-t border-border">
                        <div className="text-[10px] text-text-muted uppercase tracking-wider font-bold mb-1.5">Scanner scores</div>
                        <div className="flex flex-wrap items-center gap-1.5">
                          {card.letter_grade && (
                            <span className={chip(gradeVariant(card.letter_grade.replace(/[+-]/g, '')))}>
                              {card.letter_grade}{card.composite_score != null ? ` ${Number(card.composite_score).toFixed(1)}` : ''}
                            </span>
                          )}
                          {([['VOL', card.vol_edge_score], ['QUALITY', card.quality_score], ['REGIME', card.regime_score], ['INFO', card.info_edge_score]] as const).map(([name, v]) => (
                            v != null ? <span key={name} className={chip()}>{name} {Number(v).toFixed(0)}</span> : null
                          ))}
                          {/* GATE-ROW: the convergence gate verdict — one
                              chip per ' | ' token (composite.ts builds one
                              sentence, optionally + the survival-brake
                              declaration behind ' | '); GATE prefixes the
                              verdict token only. */}
                          {card.convergence_gate && card.convergence_gate.split(' | ').map((tok, i) => (
                            <span key={`gate-${i}`} className={chip()}>{i === 0 ? `GATE ${tok}` : tok}</span>
                          ))}
                          {/* CARD-100-RENDER: flags PROMOTED from the collapse
                              — always visible with the scores. */}
                          {Array.isArray(card.risk_flags) && card.risk_flags.map((f, i) => (
                            <span key={`rf-${i}`} className={chip('warning')}>{String(f)}</span>
                          ))}
                          {card.full_card_json?.setup?.has_wide_spread ? <span className={chip('warning')}>Wide spread</span> : null}
                          {card.full_card_json?.setup?.is_unlimited_risk ? <span className={chip('warning')}>Unlimited risk</span> : null}
                        </div>
                      </div>
                    )}

                    {/* LAB-FULL-CARD: full scanner intel — collapsible,
                        default closed. Columns + the full_card_json snapshot
                        (a Json field: already an OBJECT on the client, so
                        the sanctioned JSON.parse was unnecessary). Every
                        toFixed below is display formatting only. */}
                    <div className="mt-3 pt-3 border-t border-border">
                      <button
                        type="button"
                        onClick={() => setIntelOpen((v) => !v)}
                        aria-expanded={intelOpen}
                        className="flex w-full items-center justify-between gap-3 rounded-lg border border-border bg-bg-row px-3 py-2 text-left font-mono text-[11px] text-text-faint"
                      >
                        <span>Full scanner intel — details</span>
                        <span aria-hidden="true" className="shrink-0 text-text-faint">{intelOpen ? '▲' : '▼'}</span>
                      </button>
                      {intelOpen && (() => {
                        const setup = card.full_card_json?.setup ?? {};
                        const ks = card.key_stats ?? {};
                        const ep = ks.earnings_pattern ?? {};
                        const cone = ks.vol_cone ?? null;
                        const fwd = ks.forward_vol ?? null;
                        const fmtN = (v: unknown, d = 2) => (v == null ? '\u2014' : Number(v).toFixed(d));
                        const pct = (v: unknown, d = 1) => (v == null ? '\u2014' : `${Number(v).toFixed(d)}%`);
                        // Presentation-only $X.XB/T cap format (mirrors CI's fmtCap).
                        const fmtCap = (v: number | null | undefined) => v == null ? '\u2014' : v >= 1e12 ? `$${(v / 1e12).toFixed(1)}T` : `$${(v / 1e9).toFixed(1)}B`;
                        const row = (label: string, value: string) => (
                          <div key={label} className="flex justify-between text-xs">
                            <span className="text-text-muted">{label}</span>
                            <span className="text-right font-mono text-text-secondary">{value}</span>
                          </div>
                        );
                        const eyebrow = (label: string) => (
                          <div className="text-[10px] text-text-muted uppercase tracking-wider font-bold mb-1.5">{label}</div>
                        );
                        // NARRATIVE dedupe — pure array derivation: signals already
                        // shown as thesis_points are filtered out (R4: thesis_points
                        // IS why.plain_english_signals at save, so this list is
                        // normally empty and the row omits itself — honest, not a bug).
                        const thesisSet = new Set(card.thesis_points ?? []);
                        const freshSignals = (card.full_card_json?.why?.plain_english_signals ?? []).filter((s) => !thesisSet.has(s));
                        const volSubs = card.vol_sub_scores ? Object.entries(card.vol_sub_scores).filter(([, v]) => v != null) : [];
                        const hasVol = [ks.iv_rank, ks.iv_percentile, ks.iv30, ks.hv30, ks.iv_hv_spread].some((v) => v != null) || volSubs.length > 0 || cone != null || fwd != null;
                        const hasFund = [ks.market_cap, ks.sector, ks.pe_ratio, ks.dividend_yield, ks.beta, ks.spy_correlation, ks.liquidity_rating, ks.lendability, ks.borrow_rate].some((v) => v != null);
                        const hasEarn = [ks.earnings_date, ks.days_to_earnings, ep.beat_rate, ep.streak, ep.sue_score, ep.avg_surprise_pct].some((v) => v != null);
                        const hasSocial = [ks.buzz_ratio, ks.sentiment_momentum, ks.analyst_consensus, card.social_score, card.social_post_count].some((v) => v != null) || (card.social_themes?.length ?? 0) > 0 || (card.social_posts?.length ?? 0) > 0;
                        const hasNarrative = freshSignals.length > 0 || !!card.sentiment || !!card.insider_activity;
                        return (
                          <div className="mt-2 space-y-4">
                            <div>
                              {eyebrow('Setup math')}
                              <div className="space-y-1">
                                {row('Breakevens', (setup.breakevens?.length ?? 0) > 0 ? setup.breakevens!.map((b) => `$${Number(b).toFixed(2)}`).join(' / ') : '\u2014')}
                                {row('Net credit', setup.net_credit != null ? `$${fmtN(setup.net_credit)}` : '\u2014')}
                                {row('Net debit', setup.net_debit != null ? `$${fmtN(setup.net_debit)}` : '\u2014')}
                                {row('EV', setup.ev != null ? `$${fmtN(setup.ev)}` : '\u2014')}
                                {row('EV/risk', card.ev_per_risk != null ? fmtN(card.ev_per_risk) : '\u2014')}
                                {row('Theta/day', setup.greeks?.theta_per_day != null ? `$${fmtN(setup.greeks.theta_per_day)}` : '\u2014')}
                                {row('PoP method', setup.pop_method ?? '\u2014')}
                                {row('HV PoP', setup.hv_pop != null ? `${Math.round(Number(setup.hv_pop) * 100)}%` : '\u2014')}
                              </div>
                            </div>
                            <div>
                              {eyebrow('Greeks at entry')}
                              <div className="space-y-1">
                                {row('Delta', fmtN(card.greeks_delta))}
                                {row('Gamma', fmtN(card.greeks_gamma, 4))}
                                {row('Theta', fmtN(card.greeks_theta))}
                                {row('Vega', fmtN(card.greeks_vega))}
                              </div>
                            </div>
                            {hasVol && (
                              <div>
                                {eyebrow('Vol edge')}
                                <div className="space-y-1">
                                  {row('IV rank', fmtN(ks.iv_rank))}
                                  {row('IV percentile', fmtN(ks.iv_percentile))}
                                  {row('IV30', pct(ks.iv30))}
                                  {row('HV30', pct(ks.hv30))}
                                  {row('IV-HV spread', pct(ks.iv_hv_spread))}
                                </div>
                                {volSubs.length > 0 && (
                                  <div className="mt-2 flex flex-wrap gap-1.5">
                                    {volSubs.map(([k, v]) => (
                                      <span key={k} className={chip()}>{k} {Number(v).toFixed(0)}</span>
                                    ))}
                                  </div>
                                )}
                                {cone && (
                                  <div className="mt-2 overflow-x-auto">
                                    <table className="w-full text-xs">
                                      <thead>
                                        <tr className="font-mono text-[10px] uppercase tracking-wider text-text-faint border-b border-border">
                                          <th className="px-2 py-1 text-right">HV10</th>
                                          <th className="px-2 py-1 text-right">HV20</th>
                                          <th className="px-2 py-1 text-right">HV30</th>
                                          <th className="px-2 py-1 text-right">HV60</th>
                                          <th className="px-2 py-1 text-right">HV90</th>
                                          <th className="px-2 py-1 text-right">Current IV</th>
                                        </tr>
                                      </thead>
                                      <tbody>
                                        <tr>
                                          <td className="px-2 py-1 text-right font-mono text-text-secondary">{pct(cone.hv10)}</td>
                                          <td className="px-2 py-1 text-right font-mono text-text-secondary">{pct(cone.hv20)}</td>
                                          <td className="px-2 py-1 text-right font-mono text-text-secondary">{pct(cone.hv30)}</td>
                                          <td className="px-2 py-1 text-right font-mono text-text-secondary">{pct(cone.hv60)}</td>
                                          <td className="px-2 py-1 text-right font-mono text-text-secondary">{pct(cone.hv90)}</td>
                                          <td className="px-2 py-1 text-right font-mono text-text-secondary">{pct(cone.current_iv)}</td>
                                        </tr>
                                      </tbody>
                                    </table>
                                    {cone.candles_used != null && <div className="mt-1 text-[10px] text-text-faint">{cone.candles_used} candles used</div>}
                                  </div>
                                )}
                                {fwd && <div className="mt-2">{row('Forward vol', `${fwd.from_expiry ?? '?'} \u2192 ${fwd.to_expiry ?? '?'} \u00b7 fwd IV ${pct(fwd.forward_iv)}`)}</div>}
                              </div>
                            )}
                            {hasFund && (
                              <div>
                                {eyebrow('Fundamentals')}
                                <div className="space-y-1">
                                  {row('Market cap', fmtCap(ks.market_cap))}
                                  {row('Sector', ks.sector ?? '\u2014')}
                                  {row('P/E', fmtN(ks.pe_ratio, 1))}
                                  {row('Div yield', pct(ks.dividend_yield))}
                                  {row('Beta', fmtN(ks.beta))}
                                  {row('SPY corr', fmtN(ks.spy_correlation))}
                                  {row('Liquidity', ks.liquidity_rating != null ? `${ks.liquidity_rating}/5` : '\u2014')}
                                  {row('Lendability', ks.lendability ?? '\u2014')}
                                  {row('Borrow rate', pct(ks.borrow_rate))}
                                </div>
                              </div>
                            )}
                            {hasEarn && (
                              <div>
                                {eyebrow('Earnings')}
                                <div className="space-y-1">
                                  {row('Date', ks.earnings_date ?? '\u2014')}
                                  {row('Days to', ks.days_to_earnings != null ? String(ks.days_to_earnings) : '\u2014')}
                                  {row('Beat rate', pct(ep.beat_rate, 0))}
                                  {row('Streak', ep.streak ?? '\u2014')}
                                  {row('SUE', fmtN(ep.sue_score))}
                                  {row('Avg surprise', pct(ep.avg_surprise_pct))}
                                </div>
                              </div>
                            )}
                            {hasSocial && (
                              <div>
                                {eyebrow('Social & attention')}
                                <div className="space-y-1">
                                  {row('Buzz ratio', fmtN(ks.buzz_ratio))}
                                  {row('Sentiment momentum', fmtN(ks.sentiment_momentum))}
                                  {row('Analyst consensus', ks.analyst_consensus ?? '\u2014')}
                                  {row('Social score', fmtN(card.social_score))}
                                  {row('Posts', card.social_post_count != null ? `${card.social_post_count}${(card.social_posts?.length ?? 0) > 0 ? ` (${card.social_posts!.length} samples)` : ''}` : '\u2014')}
                                </div>
                                {(card.social_themes?.length ?? 0) > 0 && (
                                  <div className="mt-2 flex flex-wrap gap-1.5">
                                    {card.social_themes!.map((t, i) => (
                                      <span key={i} className={chip()}>{t}</span>
                                    ))}
                                  </div>
                                )}
                              </div>
                            )}
                            {(card.headlines?.length ?? 0) > 0 && (
                              <div>
                                {eyebrow('Headlines')}
                                <div className="space-y-1.5">
                                  {card.headlines!.map((h, i) => (
                                    <div key={i} className="flex items-start justify-between gap-2 text-xs">
                                      <span className="text-text-secondary">{h.title} <span className="text-text-faint">\u2014 {h.source}</span></span>
                                      <span className={chip(h.sentiment?.toLowerCase().includes('bull') || h.sentiment?.toLowerCase().includes('pos') ? 'success' : h.sentiment?.toLowerCase().includes('bear') || h.sentiment?.toLowerCase().includes('neg') ? 'danger' : 'neutral')}>{h.sentiment}</span>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                            {hasNarrative && (
                              <div>
                                {eyebrow('Narrative')}
                                {freshSignals.length > 0 && (
                                  <div className="space-y-1 mb-2">
                                    {freshSignals.map((s, i) => (
                                      <div key={i} className="flex gap-2 text-xs"><span className="shrink-0 text-text-faint">\u2022</span><span className="text-text-secondary">{s}</span></div>
                                    ))}
                                  </div>
                                )}
                                {card.sentiment && (
                                  <div className="mb-2">
                                    {eyebrow('Sentiment')}
                                    <div className="text-xs text-text-secondary">{card.sentiment}</div>
                                  </div>
                                )}
                                {card.insider_activity && (
                                  <div>
                                    {eyebrow('Insider activity')}
                                    <div className="text-xs text-text-secondary">{card.insider_activity}</div>
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        );
                      })()}
                    </div>

                    {/* Thesis points with checkmarks */}
                    {card.thesis_points && card.thesis_points.length > 0 && (
                      <div className="mt-3 pt-3 border-t border-border">
                        <div className="text-[10px] text-text-muted uppercase tracking-wider font-bold mb-1.5">Thesis</div>
                        <div className="space-y-1">
                          {(card.thesis_points as string[]).map((pt, i) => {
                            const result = card.link?.thesis_results?.[i];
                            return (
                              <div key={i} className="flex gap-2 text-xs">
                                <span className="shrink-0 w-4 text-center">
                                  {result === true ? <span className="text-brand-green">&#10003;</span> :
                                   result === false ? <span className="text-brand-red">&#10005;</span> :
                                   <span className="text-text-faint">&bull;</span>}
                                </span>
                                <span className="text-text-secondary">{pt}</span>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* Macro regime */}
                    {card.macro_regime && (
                      <div className="mt-3 pt-3 border-t border-border">
                        <div className="text-[10px] text-text-muted uppercase tracking-wider font-bold mb-1">Regime</div>
                        <div className="text-xs text-text-secondary">{card.macro_regime}</div>
                      </div>
                    )}

                    {/* Link notes */}
                    {card.link?.notes && (
                      <div className="mt-3 pt-3 border-t border-border">
                        <div className="text-[10px] text-text-muted uppercase tracking-wider font-bold mb-1">Notes</div>
                        <div className="text-xs text-text-secondary">{card.link.notes}</div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
