'use client';

import { useState, useEffect, useCallback } from 'react';

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

export default function TradeLabPanel() {
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

  const dirColor = (d: string) => {
    const u = d.toUpperCase();
    if (u === 'BULLISH') return { bg: '#065F46', text: '#34D399' };
    if (u === 'BEARISH') return { bg: '#7F1D1D', text: '#FCA5A5' };
    return { bg: '#334155', text: '#94A3B8' };
  };

  const statusBadge = (status: string) => {
    switch (status) {
      case 'queued': return { bg: '#D97706', text: 'Queued' };
      case 'entered': return { bg: '#4F46E5', text: 'Entered' };
      case 'linked': return { bg: '#2563EB', text: 'Linked' };
      case 'graded': return { bg: '#7C3AED', text: 'Graded' };
      default: return { bg: '#6B7280', text: status };
    }
  };

  const gradeColor = (g: string | null) => {
    if (!g) return { bg: '#6B7280', text: '#E5E7EB' };
    switch (g) {
      case 'A': return { bg: '#059669', text: '#ECFDF5' };
      case 'B': return { bg: '#2563EB', text: '#EFF6FF' };
      case 'C': return { bg: '#D97706', text: '#FFFBEB' };
      case 'D': return { bg: '#DC2626', text: '#FEF2F2' };
      case 'F': return { bg: '#991B1B', text: '#FEF2F2' };
      default: return { bg: '#6B7280', text: '#E5E7EB' };
    }
  };

  return (
    <div>
      {/* Header */}
      <div className="bg-[#2d1b4e] text-white px-4 py-3 flex items-center justify-between">
        <div>
          <span className="text-sm font-semibold">Trade Lab</span>
          <span className="text-[10px] text-purple-300 ml-2">{cards.length} card{cards.length !== 1 ? 's' : ''}</span>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={filter}
            onChange={e => setFilter(e.target.value)}
            className="bg-[#3d2b5e] text-white border-0 text-xs px-2 py-1 rounded"
          >
            <option value="all">All</option>
            <option value="queued">Queued</option>
            <option value="entered">Entered</option>
            <option value="linked">Linked</option>
            <option value="graded">Graded</option>
          </select>
          <button onClick={loadCards} className="text-xs bg-[#3d2b5e] px-3 py-1 rounded hover:bg-[#4d3b6e]">
            Refresh
          </button>
        </div>
      </div>

      {/* Legacy notice */}
      <div className="bg-amber-50 border-b border-amber-200 px-4 py-2 text-xs text-amber-800">
        Positions opened before Feb 23, 2026 are legacy trades without scanner data. Only new trades can be linked to trade cards.
      </div>

      {loading ? (
        <div className="p-8 text-center text-sm text-gray-500">Loading trade cards...</div>
      ) : cards.length === 0 ? (
        <div className="p-12 text-center">
          <div className="text-gray-400 text-sm mb-2">No trade cards {filter !== 'all' ? `with status "${filter}"` : 'yet'}</div>
          <div className="text-gray-400 text-xs">
            Use Market Intelligence to scan for opportunities, then click &ldquo;Enter Trade&rdquo; on any strategy card to save it here.
          </div>
        </div>
      ) : (
        <div className="divide-y divide-gray-100">
          {cards.map(card => {
            const dir = dirColor(card.direction);
            const badge = statusBadge(card.status);
            const legs = card.legs as { type: string; side: string; strike: number; price: number }[];
            const isExpanded = expandedCardId === card.id;
            const isLinking = linkingCardId === card.id;
            const isGrading = gradingCardId === card.id;
            const gc = gradeColor(card.link?.grade ?? null);

            return (
              <div key={card.id}>
                {/* Card row */}
                <div
                  className={`px-4 py-3 transition-colors cursor-pointer ${
                    card.status === 'graded' && card.link?.grade
                      ? Number(card.link.actual_pl) >= 0 ? 'bg-green-50 hover:bg-green-100' : 'bg-red-50 hover:bg-red-100'
                      : 'hover:bg-gray-50'
                  }`}
                  onClick={() => setExpandedCardId(isExpanded ? null : card.id)}
                >
                  <div className="flex items-start justify-between gap-4">
                    {/* Left: symbol + strategy */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <span className="text-base font-bold font-mono text-gray-900">{card.symbol}</span>
                        <span className="text-xs font-medium text-gray-600">{card.strategy_name}</span>
                        <span className="px-1.5 py-0.5 rounded text-[9px] font-bold" style={{ background: dir.bg, color: dir.text }}>
                          {card.direction.toUpperCase()}
                        </span>
                        <span className="px-1.5 py-0.5 rounded text-[9px] font-bold text-white" style={{ background: badge.bg }}>
                          {badge.text}
                        </span>
                        {/* Grade badge */}
                        {card.link?.grade && (
                          <span className="px-2 py-0.5 rounded text-sm font-black" style={{ background: gc.bg, color: gc.text }}>
                            {card.link.grade}
                          </span>
                        )}
                      </div>

                      {/* Legs */}
                      <div className="flex gap-3 text-[11px] text-gray-500 mb-1 flex-wrap">
                        {legs.map((leg, i) => (
                          <span key={i} className="font-mono">
                            <span className={leg.side === 'sell' ? 'text-red-600' : 'text-green-600'}>{leg.side.toUpperCase()}</span>
                            {' '}{leg.type.toUpperCase()}{' '}${leg.strike}{' '}@{' '}${leg.price.toFixed(2)}
                          </span>
                        ))}
                      </div>

                      {/* Meta row */}
                      <div className="flex items-center gap-4 text-[10px] text-gray-400 flex-wrap">
                        <span>Queued {fmtDate(card.generated_at)}</span>
                        {card.dte != null && <span>{card.dte} DTE</span>}
                        {card.expiration_date && <span>Exp {fmtDateShort(card.expiration_date)}</span>}
                        {card.link && <span className="text-blue-600 font-medium">Trade #{card.link.trade_num}</span>}
                        {card.link?.linked_at && <span>Linked {fmtDateShort(card.link.linked_at)}</span>}
                      </div>
                    </div>

                    {/* Right: key numbers + actions */}
                    <div className="shrink-0 text-right space-y-1" onClick={e => e.stopPropagation()}>
                      {/* Actual P&L for graded cards */}
                      {card.link?.actual_pl != null && (
                        <div className="mb-1">
                          <div className="text-[9px] text-gray-400 uppercase">Actual P&L</div>
                          <div className={`text-lg font-mono font-black ${Number(card.link.actual_pl) >= 0 ? 'text-green-700' : 'text-red-700'}`}>
                            {fmtDollar(Number(card.link.actual_pl))}
                          </div>
                        </div>
                      )}

                      <div className="grid grid-cols-2 gap-x-4 gap-y-0.5 text-[11px]">
                        <div className="text-gray-400">Max Profit</div>
                        <div className="font-mono font-bold text-green-700">{fmtDollar(card.max_profit)}</div>
                        <div className="text-gray-400">Max Loss</div>
                        <div className="font-mono font-bold text-red-700">{fmtDollar(card.max_loss)}</div>
                        <div className="text-gray-400">Win Rate</div>
                        <div className="font-mono font-bold">{card.win_rate != null ? `${Number(card.win_rate).toFixed(1)}%` : '\u2014'}</div>
                        <div className="text-gray-400">R:R</div>
                        <div className="font-mono font-bold">{card.risk_reward != null ? Number(card.risk_reward).toFixed(2) : '\u2014'}</div>
                      </div>

                      {/* Actions by status */}
                      <div className="flex items-center justify-end gap-2 mt-1.5">
                        {/* Queued/Entered: Link + Delete */}
                        {(card.status === 'queued' || card.status === 'entered') && (
                          <>
                            <button
                              onClick={() => startLinking(card)}
                              className="text-[10px] font-medium text-blue-600 hover:text-blue-800 transition-colors"
                            >
                              {isLinking ? 'Cancel' : 'Link to Position'}
                            </button>
                            <button
                              onClick={() => deleteCard(card.id)}
                              className="text-[10px] text-gray-400 hover:text-red-600 transition-colors"
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
                              className="text-[10px] font-medium text-purple-600 hover:text-purple-800 transition-colors disabled:opacity-50"
                            >
                              {isGrading ? 'Grading...' : 'Check Grade'}
                            </button>
                            <button
                              onClick={() => unlinkCard(card.link!.id)}
                              className="text-[10px] text-gray-400 hover:text-red-600 transition-colors"
                            >
                              Unlink
                            </button>
                          </>
                        )}

                        {/* Graded: Unlink */}
                        {card.status === 'graded' && card.link && (
                          <button
                            onClick={() => unlinkCard(card.link!.id)}
                            className="text-[10px] text-gray-400 hover:text-red-600 transition-colors"
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
                      <div className="text-xs text-red-600 mb-2">{linkError}</div>
                    )}
                    {loadingPositions ? (
                      <div className="text-xs text-gray-500">Loading positions...</div>
                    ) : matchablePositions.length === 0 ? (
                      <div className="text-xs text-gray-500">
                        No matching positions yet &mdash; execute the trade and commit it in Books first.
                      </div>
                    ) : (
                      <div className="space-y-1">
                        {matchablePositions.map(pos => (
                          <button
                            key={pos.trade_num}
                            onClick={() => linkToPosition(card.id, pos.trade_num)}
                            className="w-full text-left px-3 py-2 rounded bg-white border border-blue-200 hover:border-blue-400 hover:bg-blue-50 transition-colors"
                          >
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2 text-xs">
                                <span className="font-mono font-bold text-gray-900">#{pos.trade_num}</span>
                                <span className="font-medium text-gray-700">{pos.symbol}</span>
                                {pos.strategy && <span className="text-gray-500">{pos.strategy}</span>}
                                {pos.option_type && (
                                  <span className="text-gray-400">
                                    {pos.option_type} {pos.strike_price ? `$${pos.strike_price}` : ''}
                                  </span>
                                )}
                              </div>
                              <div className="flex items-center gap-2 text-[10px] text-gray-400">
                                <span>{fmtDateShort(pos.open_date)}</span>
                                <span className={`px-1.5 py-0.5 rounded font-bold ${pos.status === 'OPEN' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>
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
                  <div className="px-4 py-3 bg-gray-50 border-t border-gray-200">
                    <div className="grid grid-cols-2 gap-4">
                      {/* Left: Predicted */}
                      <div>
                        <div className="text-[10px] text-gray-500 uppercase tracking-wider font-bold mb-2">Predicted</div>
                        <div className="space-y-1 text-xs">
                          <div className="flex justify-between">
                            <span className="text-gray-500">Max Profit</span>
                            <span className="font-mono font-bold text-green-700">{fmtDollar(card.max_profit)}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-500">Max Loss</span>
                            <span className="font-mono font-bold text-red-700">{fmtDollar(card.max_loss)}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-500">Win Rate</span>
                            <span className="font-mono font-bold">{card.win_rate != null ? `${Number(card.win_rate).toFixed(1)}%` : '\u2014'}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-500">R:R</span>
                            <span className="font-mono font-bold">{card.risk_reward != null ? Number(card.risk_reward).toFixed(2) : '\u2014'}</span>
                          </div>
                          {card.entry_price != null && (
                            <div className="flex justify-between">
                              <span className="text-gray-500">Entry Price</span>
                              <span className="font-mono font-bold">${Number(card.entry_price).toFixed(2)}</span>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Right: Actual (if linked/graded) */}
                      <div>
                        {card.link ? (
                          <>
                            <div className="text-[10px] text-gray-500 uppercase tracking-wider font-bold mb-2">Actual</div>
                            <div className="space-y-1 text-xs">
                              <div className="flex justify-between">
                                <span className="text-gray-500">P&L</span>
                                <span className={`font-mono font-bold ${card.link.actual_pl != null && Number(card.link.actual_pl) >= 0 ? 'text-green-700' : 'text-red-700'}`}>
                                  {card.link.actual_pl != null ? fmtDollar(Number(card.link.actual_pl)) : 'Open'}
                                </span>
                              </div>
                              {card.link.actual_entry_price != null && (
                                <div className="flex justify-between">
                                  <span className="text-gray-500">Entry Price</span>
                                  <span className="font-mono font-bold">${Number(card.link.actual_entry_price).toFixed(2)}</span>
                                </div>
                              )}
                              {card.link.actual_exit_price != null && (
                                <div className="flex justify-between">
                                  <span className="text-gray-500">Exit Price</span>
                                  <span className="font-mono font-bold">${Number(card.link.actual_exit_price).toFixed(2)}</span>
                                </div>
                              )}
                              {card.link.grade && (
                                <div className="flex justify-between items-center mt-2">
                                  <span className="text-gray-500">Grade</span>
                                  <span className="px-3 py-1 rounded text-lg font-black" style={{ background: gradeColor(card.link.grade).bg, color: gradeColor(card.link.grade).text }}>
                                    {card.link.grade}
                                  </span>
                                </div>
                              )}
                            </div>
                          </>
                        ) : (
                          <div>
                            <div className="text-[10px] text-gray-500 uppercase tracking-wider font-bold mb-2">Actual</div>
                            <div className="text-xs text-gray-400 italic">Not yet linked to a position</div>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Thesis points with checkmarks */}
                    {card.thesis_points && card.thesis_points.length > 0 && (
                      <div className="mt-3 pt-3 border-t border-gray-200">
                        <div className="text-[10px] text-gray-500 uppercase tracking-wider font-bold mb-1.5">Thesis</div>
                        <div className="space-y-1">
                          {(card.thesis_points as string[]).map((pt, i) => {
                            const result = card.link?.thesis_results?.[i];
                            return (
                              <div key={i} className="flex gap-2 text-xs">
                                <span className="shrink-0 w-4 text-center">
                                  {result === true ? <span className="text-green-600">&#10003;</span> :
                                   result === false ? <span className="text-red-600">&#10005;</span> :
                                   <span className="text-gray-300">&bull;</span>}
                                </span>
                                <span className="text-gray-600">{pt}</span>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* Macro regime */}
                    {card.macro_regime && (
                      <div className="mt-3 pt-3 border-t border-gray-200">
                        <div className="text-[10px] text-gray-500 uppercase tracking-wider font-bold mb-1">Regime</div>
                        <div className="text-xs text-gray-600">{card.macro_regime}</div>
                      </div>
                    )}

                    {/* Link notes */}
                    {card.link?.notes && (
                      <div className="mt-3 pt-3 border-t border-gray-200">
                        <div className="text-[10px] text-gray-500 uppercase tracking-wider font-bold mb-1">Notes</div>
                        <div className="text-xs text-gray-600">{card.link.notes}</div>
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
