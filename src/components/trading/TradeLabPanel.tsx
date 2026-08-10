'use client';

import { useState, useEffect, useCallback } from 'react';
import { formatMoney, moneyColorClass } from '@/lib/money';
import { chip, CHIP_VARIANTS, type ChipVariant, SECTION_HEADER, themed, type Surface } from '@/lib/ds';

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
  key_stats: Record<string, unknown> | null;
  macro_regime: string | null;
  sentiment: string | null;
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

export default function TradeLabPanel({ onCardsChange, surface = 'light' }: { onCardsChange?: () => void; surface?: Surface }) {
  const dk = surface === 'dark';
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
            className="rounded border border-panel-border bg-panel px-2 py-1 text-xs text-white"
          >
            <option value="all">All</option>
            <option value="queued">Queued</option>
            <option value="entered">Entered</option>
            <option value="linked">Linked</option>
            <option value="graded">Graded</option>
          </select>
          <button onClick={loadCards} className="rounded border border-white/30 px-3 py-1 text-xs hover:bg-white/10">
            Refresh
          </button>
        </div>
      </div>

      {/* RISK-1: coverage stats strip — denominator always visible (no win-rate without it).
          Renders only when coverage loaded; never fabricated on failure. */}
      {coverage && (
        <div className={themed('border-b border-border bg-white px-4 py-1.5 text-[11px] text-text-muted', dk)}>
          Linked cards: <span className={themed('font-mono font-semibold text-text-primary', dk)}>{coverage.linked_card_count}</span>
          {' · '}Closed positions: <span className={themed('font-mono font-semibold text-text-primary', dk)}>{coverage.closed_position_count}</span>
          {' · '}Unlinked: <span className={themed('font-mono font-semibold text-text-primary', dk)}>{coverage.unlinked_closed_count}</span>
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
              className="rounded border border-panel-border bg-panel px-1 py-0.5 text-xs text-white"
            />
            <button
              onClick={() => saveScannerStartDate(startDateInput)}
              className="text-xs font-bold text-status-success hover:underline"
            >
              Save
            </button>
            <button
              onClick={() => setEditingStartDate(false)}
              className="text-xs text-white/50 hover:text-white/70"
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
        <div className={themed('p-8 text-center text-sm text-text-muted', dk)}>Loading trade cards...</div>
      ) : cards.length === 0 ? (
        <div className="p-12 text-center">
          <div className={themed('text-text-faint text-sm mb-2', dk)}>No trade cards {filter !== 'all' ? `with status "${filter}"` : 'yet'}</div>
          <div className={themed('text-text-faint text-xs', dk)}>
            Use Market Intelligence to scan for opportunities, then click &ldquo;Enter Trade&rdquo; on any strategy card to save it here.
          </div>
        </div>
      ) : (
        <div className={themed('divide-y divide-border', dk)}>
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
                  className={themed(`px-4 py-3 transition-colors cursor-pointer ${
                    card.status === 'graded' && card.link?.grade
                      ? Number(card.link.actual_pl) >= 0 ? 'bg-status-success/10 hover:bg-status-success/15' : 'bg-status-danger/10 hover:bg-status-danger/15'
                      : 'hover:bg-bg-row'
                  }`, dk)}
                  onClick={() => setExpandedCardId(isExpanded ? null : card.id)}
                >
                  <div className="flex items-start justify-between gap-4">
                    {/* Left: symbol + strategy */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <span className={themed('text-base font-bold font-mono text-text-primary', dk)}>{card.symbol}</span>
                        <span className={themed('text-xs font-medium text-text-secondary', dk)}>{card.strategy_name}</span>
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
                      <div className={themed('flex gap-3 text-[11px] text-text-muted mb-1 flex-wrap', dk)}>
                        {legs.map((leg, i) => (
                          <span key={i} className="font-mono">
                            <span className={leg.side === 'sell' ? 'text-status-danger' : 'text-status-success'}>{leg.side.toUpperCase()}</span>
                            {' '}{leg.type.toUpperCase()}{' '}${leg.strike}{' '}@{' '}${leg.price.toFixed(2)}
                          </span>
                        ))}
                      </div>

                      {/* Meta row */}
                      <div className={themed('flex items-center gap-4 text-[10px] text-text-faint flex-wrap', dk)}>
                        <span>Queued {fmtDate(card.generated_at)}</span>
                        {card.dte != null && <span>{card.dte} DTE</span>}
                        {card.expiration_date && <span>Exp {fmtDateShort(card.expiration_date)}</span>}
                        {card.link && <span className="text-brand-purple-pop font-medium">Trade #{card.link.trade_num}</span>}
                        {card.link?.linked_at && <span>Linked {fmtDateShort(card.link.linked_at)}</span>}
                      </div>
                    </div>

                    {/* Right: key numbers + actions */}
                    <div className="shrink-0 text-right space-y-1" onClick={e => e.stopPropagation()}>
                      {/* Actual P&L for graded cards */}
                      {card.link?.actual_pl != null && (
                        <div className="mb-1">
                          <div className="text-[9px] text-white/60 uppercase">Actual P&L</div>
                          <div className={`text-terminal-lg font-mono font-black ${moneyColorClass(Number(card.link.actual_pl), 'pnl')}`}>
                            {formatMoney(Number(card.link.actual_pl), { kind: 'pnl', fractionDigits: 0 })}
                          </div>
                        </div>
                      )}

                      <div className="grid grid-cols-2 gap-x-4 gap-y-0.5 text-[11px]">
                        <div className="text-white/60">Max Profit</div>
                        <div className="font-mono font-bold text-brand-green">{fmtDollar(card.max_profit)}</div>
                        <div className="text-white/60">Max Loss</div>
                        <div className="font-mono font-bold text-brand-red">{fmtDollar(card.max_loss)}</div>
                        <div className="text-white/60" title="Estimated Probability of Profit based on delta approximation">Est. PoP</div>
                        {/* TRADE-UX-1: the anchor leads the queue row \u2014 size +
                            weight within the grid idiom. Same field/format. */}
                        <div className="font-mono font-black text-sm text-white/80">{card.win_rate != null ? `${Number(card.win_rate).toFixed(1)}%` : '\u2014'}</div>
                        <div className="text-white/60">R:R</div>
                        <div className="font-mono font-bold text-white/80">{card.risk_reward != null ? Number(card.risk_reward).toFixed(2) : '\u2014'}</div>
                      </div>

                      {/* Actions by status */}
                      <div className="flex items-center justify-end gap-2 mt-1.5">
                        {/* Queued/Entered: Link + Delete */}
                        {(card.status === 'queued' || card.status === 'entered') && (
                          <>
                            <button
                              onClick={() => startLinking(card)}
                              className="text-[10px] font-medium text-brand-purple-pop hover:underline transition-colors"
                            >
                              {isLinking ? 'Cancel' : 'Link to Position'}
                            </button>
                            <button
                              onClick={() => deleteCard(card.id)}
                              className="text-[10px] text-white/40 hover:text-status-danger transition-colors"
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
                              className="text-[10px] font-medium text-brand-purple-pop hover:underline transition-colors disabled:opacity-50"
                            >
                              {isGrading ? 'Grading...' : 'Check Grade'}
                            </button>
                            <button
                              onClick={() => unlinkCard(card.link!.id)}
                              className="text-[10px] text-white/40 hover:text-status-danger transition-colors"
                            >
                              Unlink
                            </button>
                          </>
                        )}

                        {/* Graded: Unlink */}
                        {card.status === 'graded' && card.link && (
                          <button
                            onClick={() => unlinkCard(card.link!.id)}
                            className="text-[10px] text-white/40 hover:text-status-danger transition-colors"
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
                  <div className="px-4 py-3 bg-blue-50 border-t border-blue-200" onClick={e => e.stopPropagation()}>
                    <div className="text-xs font-medium text-blue-800 mb-2">
                      Select a position to link to:
                    </div>
                    {linkError && (
                      <div className="text-xs text-brand-red mb-2">{linkError}</div>
                    )}
                    {loadingPositions ? (
                      <div className={themed('text-xs text-text-muted', dk)}>Loading positions...</div>
                    ) : matchablePositions.length === 0 ? (
                      <div className={themed('text-xs text-text-muted', dk)}>
                        No matching positions yet &mdash; execute the trade and commit it in Books first.
                      </div>
                    ) : (
                      <div className="space-y-1">
                        {matchablePositions.map(pos => (
                          <button
                            key={pos.trade_num}
                            onClick={() => linkToPosition(card.id, pos.trade_num)}
                            className={themed('w-full text-left px-3 py-2 rounded bg-white border border-blue-200 hover:border-blue-400 hover:bg-blue-50 transition-colors', dk)}
                          >
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2 text-xs">
                                <span className={themed('font-mono font-bold text-text-primary', dk)}>#{pos.trade_num}</span>
                                <span className={themed('font-medium text-text-secondary', dk)}>{pos.symbol}</span>
                                {pos.strategy && <span className={themed('text-text-muted', dk)}>{pos.strategy}</span>}
                                {pos.option_type && (
                                  <span className={themed('text-text-faint', dk)}>
                                    {pos.option_type} {pos.strike_price ? `$${pos.strike_price}` : ''}
                                  </span>
                                )}
                              </div>
                              <div className={themed('flex items-center gap-2 text-[10px] text-text-faint', dk)}>
                                <span>{fmtDateShort(pos.open_date)}</span>
                                <span className={themed(`px-1.5 py-0.5 rounded font-bold ${pos.status === 'OPEN' ? 'bg-green-100 text-brand-green' : 'bg-bg-row text-text-secondary'}`, dk)}>
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
                  <div className={themed('px-4 py-3 bg-bg-row border-t border-border', dk)}>
                    <div className="grid grid-cols-2 gap-4">
                      {/* Left: Predicted */}
                      <div>
                        <div className={themed('text-[10px] text-text-muted uppercase tracking-wider font-bold mb-2', dk)}>Predicted</div>
                        <div className="space-y-1 text-xs">
                          <div className="flex justify-between">
                            <span className="text-white/60">Max Profit</span>
                            <span className="font-mono font-bold text-brand-green">{fmtDollar(card.max_profit)}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-white/60">Max Loss</span>
                            <span className="font-mono font-bold text-brand-red">{fmtDollar(card.max_loss)}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-white/60" title="Estimated Probability of Profit based on delta approximation">Est. PoP</span>
                            <span className="font-mono font-bold text-white/80">{card.win_rate != null ? `${Number(card.win_rate).toFixed(1)}%` : '\u2014'}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-white/60">R:R</span>
                            <span className="font-mono font-bold text-white/80">{card.risk_reward != null ? Number(card.risk_reward).toFixed(2) : '\u2014'}</span>
                          </div>
                          {card.entry_price != null && (
                            <div className="flex justify-between">
                              <span className="text-white/60">Entry Price</span>
                              <span className="font-mono font-bold text-white/80">${Number(card.entry_price).toFixed(2)}</span>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Right: Actual (if linked/graded) */}
                      <div>
                        {card.link ? (
                          <>
                            <div className={themed('text-[10px] text-text-muted uppercase tracking-wider font-bold mb-2', dk)}>Actual</div>
                            <div className="space-y-1 text-xs">
                              <div className="flex justify-between">
                                <span className="text-white/60">P&L</span>
                                <span className={themed(`font-mono font-bold ${card.link.actual_pl != null ? moneyColorClass(Number(card.link.actual_pl), 'pnl') : 'text-text-secondary'}`, dk)}>
                                  {card.link.actual_pl != null ? formatMoney(Number(card.link.actual_pl), { kind: 'pnl', fractionDigits: 0 }) : 'Open'}
                                </span>
                              </div>
                              {card.link.actual_entry_price != null && (
                                <div className="flex justify-between">
                                  <span className="text-white/60">Entry Price</span>
                                  <span className="font-mono font-bold text-white/80">${Number(card.link.actual_entry_price).toFixed(2)}</span>
                                </div>
                              )}
                              {card.link.actual_exit_price != null && (
                                <div className="flex justify-between">
                                  <span className="text-white/60">Exit Price</span>
                                  <span className="font-mono font-bold text-white/80">${Number(card.link.actual_exit_price).toFixed(2)}</span>
                                </div>
                              )}
                              {card.link.grade && (
                                <div className="flex justify-between items-center mt-2">
                                  <span className="text-white/60">Grade</span>
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
                            <div className={themed('text-[10px] text-text-muted uppercase tracking-wider font-bold mb-2', dk)}>Actual</div>
                            <div className="text-xs text-white/40">Not yet linked to a position</div>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Thesis points with checkmarks */}
                    {card.thesis_points && card.thesis_points.length > 0 && (
                      <div className={themed('mt-3 pt-3 border-t border-border', dk)}>
                        <div className={themed('text-[10px] text-text-muted uppercase tracking-wider font-bold mb-1.5', dk)}>Thesis</div>
                        <div className="space-y-1">
                          {(card.thesis_points as string[]).map((pt, i) => {
                            const result = card.link?.thesis_results?.[i];
                            return (
                              <div key={i} className="flex gap-2 text-xs">
                                <span className="shrink-0 w-4 text-center">
                                  {result === true ? <span className="text-brand-green">&#10003;</span> :
                                   result === false ? <span className="text-brand-red">&#10005;</span> :
                                   <span className={themed('text-text-faint', dk)}>&bull;</span>}
                                </span>
                                <span className={themed('text-text-secondary', dk)}>{pt}</span>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* Macro regime */}
                    {card.macro_regime && (
                      <div className={themed('mt-3 pt-3 border-t border-border', dk)}>
                        <div className={themed('text-[10px] text-text-muted uppercase tracking-wider font-bold mb-1', dk)}>Regime</div>
                        <div className={themed('text-xs text-text-secondary', dk)}>{card.macro_regime}</div>
                      </div>
                    )}

                    {/* Link notes */}
                    {card.link?.notes && (
                      <div className={themed('mt-3 pt-3 border-t border-border', dk)}>
                        <div className={themed('text-[10px] text-text-muted uppercase tracking-wider font-bold mb-1', dk)}>Notes</div>
                        <div className={themed('text-xs text-text-secondary', dk)}>{card.link.notes}</div>
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
