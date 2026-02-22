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
    trade_num: string;
    grade: string | null;
    actual_pl: number | null;
  } | null;
}

const LEGACY_CUTOFF = '2026-02-23';

export default function TradeLabPanel() {
  const [cards, setCards] = useState<TradeCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>('all');

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
    } catch { /* ignore */ }
  };

  const fmtDollar = (v: number | null) => {
    if (v == null) return '\u2014';
    return v >= 0 ? `$${Math.abs(v).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}` : `-$${Math.abs(v).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
  };

  const fmtDate = (d: string) => {
    return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
  };

  const dirColor = (d: string) => {
    const u = d.toUpperCase();
    if (u === 'BULLISH') return { bg: '#065F46', text: '#34D399' };
    if (u === 'BEARISH') return { bg: '#7F1D1D', text: '#FCA5A5' };
    return { bg: '#334155', text: '#94A3B8' };
  };

  const statusBadge = (status: string) => {
    switch (status) {
      case 'queued': return { bg: '#4F46E5', text: 'Queued' };
      case 'entered': return { bg: '#D97706', text: 'Entered' };
      case 'linked': return { bg: '#059669', text: 'Linked' };
      case 'graded': return { bg: '#7C3AED', text: 'Graded' };
      default: return { bg: '#6B7280', text: status };
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

            return (
              <div key={card.id} className="px-4 py-3 hover:bg-gray-50 transition-colors">
                <div className="flex items-start justify-between gap-4">
                  {/* Left: symbol + strategy */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-base font-bold font-mono text-gray-900">{card.symbol}</span>
                      <span className="text-xs font-medium text-gray-600">{card.strategy_name}</span>
                      <span className="px-1.5 py-0.5 rounded text-[9px] font-bold" style={{ background: dir.bg, color: dir.text }}>
                        {card.direction.toUpperCase()}
                      </span>
                      <span className="px-1.5 py-0.5 rounded text-[9px] font-bold text-white" style={{ background: badge.bg }}>
                        {badge.text}
                      </span>
                    </div>

                    {/* Legs */}
                    <div className="flex gap-3 text-[11px] text-gray-500 mb-1">
                      {legs.map((leg, i) => (
                        <span key={i} className="font-mono">
                          <span className={leg.side === 'sell' ? 'text-red-600' : 'text-green-600'}>{leg.side.toUpperCase()}</span>
                          {' '}{leg.type.toUpperCase()}{' '}${leg.strike}{' '}@{' '}${leg.price.toFixed(2)}
                        </span>
                      ))}
                    </div>

                    {/* Meta row */}
                    <div className="flex items-center gap-4 text-[10px] text-gray-400">
                      <span>Queued {fmtDate(card.generated_at)}</span>
                      {card.dte != null && <span>{card.dte} DTE</span>}
                      {card.expiration_date && <span>Exp {new Date(card.expiration_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>}
                    </div>

                    {/* Thesis points */}
                    {card.thesis_points && card.thesis_points.length > 0 && (
                      <div className="mt-2 space-y-0.5">
                        {(card.thesis_points as string[]).slice(0, 3).map((pt, i) => (
                          <div key={i} className="text-[10px] text-gray-500 flex gap-1">
                            <span className="text-gray-400 shrink-0">{i + 1}.</span>
                            <span className="line-clamp-1">{pt}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Right: key numbers + actions */}
                  <div className="shrink-0 text-right space-y-1">
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

                    {/* Delete button — only for queued/entered */}
                    {(card.status === 'queued' || card.status === 'entered') && (
                      <button
                        onClick={() => deleteCard(card.id)}
                        className="text-[10px] text-gray-400 hover:text-red-600 transition-colors mt-1"
                      >
                        Remove
                      </button>
                    )}

                    {/* Linked info */}
                    {card.link && (
                      <div className="text-[10px] mt-1">
                        <span className="text-gray-400">Trade #{card.link.trade_num}</span>
                        {card.link.grade && <span className="ml-1 font-bold text-purple-600">{card.link.grade}</span>}
                        {card.link.actual_pl != null && (
                          <span className={`ml-1 font-mono font-bold ${Number(card.link.actual_pl) >= 0 ? 'text-green-700' : 'text-red-700'}`}>
                            {fmtDollar(Number(card.link.actual_pl))}
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
