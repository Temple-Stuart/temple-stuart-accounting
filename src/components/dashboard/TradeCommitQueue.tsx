'use client';

import { useState, useEffect, useMemo } from 'react';

interface Transaction {
  id: string;
  date: string;
  name: string;
  ticker: string | null;
  underlying: string | null;
  isOption: boolean;
  isCrypto: boolean;
  isStock: boolean;
  optionType: 'call' | 'put' | null;
  strike: number | null;
  expiration: string | null;
  action: string;
  positionType: 'open' | 'close' | 'unknown';
  quantity: number;
  price: number;
  amount: number;
}

interface GroupedByTicker {
  [ticker: string]: Transaction[];
}

const STRATEGY_OPTIONS = [
  { value: 'call-credit', label: 'Call Credit Spread' },
  { value: 'put-credit', label: 'Put Credit Spread' },
  { value: 'call-debit', label: 'Call Debit Spread' },
  { value: 'put-debit', label: 'Put Debit Spread' },
  { value: 'iron-condor', label: 'Iron Condor' },
  { value: 'straddle', label: 'Straddle' },
  { value: 'strangle', label: 'Strangle' },
  { value: 'long-call', label: 'Long Call' },
  { value: 'long-put', label: 'Long Put' },
  { value: 'short-call', label: 'Short Call' },
  { value: 'short-put', label: 'Short Put' },
  { value: 'covered-call', label: 'Covered Call' },
  { value: 'cash-secured-put', label: 'Cash Secured Put' },
  { value: 'stock-buy', label: 'Stock Buy' },
  { value: 'stock-sell', label: 'Stock Sell' },
  { value: 'crypto-buy', label: 'Crypto Buy' },
  { value: 'crypto-sell', label: 'Crypto Sell' },
];

const COA_OPTIONS = [
  { value: 'T-4100', label: 'T-4100 - Options Trading Gains' },
  { value: 'T-4110', label: 'T-4110 - Short-term Stock Gains' },
  { value: 'T-4200', label: 'T-4200 - Cryptocurrency Gains' },
  { value: 'T-5100', label: 'T-5100 - Options Trading Losses' },
  { value: 'T-5110', label: 'T-5110 - Short-term Stock Losses' },
  { value: 'T-5200', label: 'T-5200 - Cryptocurrency Losses' },
  { value: 'T-1210', label: 'T-1210 - Options Positions (Long)' },
  { value: 'T-2100', label: 'T-2100 - Options Positions (Short)' },
];

interface TradeCommitQueueProps {
  onReload: () => Promise<void>;
}

export default function TradeCommitQueue({ onReload }: TradeCommitQueueProps) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [expandedTicker, setExpandedTicker] = useState<string | null>(null);
  const [strategy, setStrategy] = useState('');
  const [coa, setCoa] = useState('T-1210');
  const [tradeNum, setTradeNum] = useState('');
  const [committing, setCommitting] = useState(false);
  const [nextTradeNum, setNextTradeNum] = useState(1);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [opensRes, maxRes] = await Promise.all([
        fetch('/api/investment-transactions/opens'),
        fetch('/api/investment-transactions/max-trade-num')
      ]);
      
      const opensData = await opensRes.json();
      const maxData = await maxRes.json();
      
      if (opensData.error) throw new Error(opensData.error);
      
      // Combine opens, closes, and unknown
      const all = [
        ...(opensData.opens || []),
        ...(opensData.closes || []),
        ...(opensData.unknown || [])
      ];
      
      setTransactions(all);
      setNextTradeNum((maxData.maxTradeNum || 0) + 1);
      setTradeNum(String((maxData.maxTradeNum || 0) + 1));
      
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  };

  // Group by ticker/underlying
  const groupedByTicker = useMemo(() => {
    const groups: GroupedByTicker = {};
    transactions.forEach(t => {
      const key = t.underlying || t.ticker || 'UNKNOWN';
      if (!groups[key]) groups[key] = [];
      groups[key].push(t);
    });
    // Sort each group by date
    Object.keys(groups).forEach(key => {
      groups[key].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    });
    return groups;
  }, [transactions]);

  // Sort tickers alphabetically
  const sortedTickers = useMemo(() => {
    return Object.keys(groupedByTicker).sort();
  }, [groupedByTicker]);

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAllInTicker = (ticker: string) => {
    const ids = groupedByTicker[ticker]?.map(t => t.id) || [];
    setSelectedIds(prev => {
      const next = new Set(prev);
      ids.forEach(id => next.add(id));
      return next;
    });
  };

  const clearSelection = () => {
    setSelectedIds(new Set());
  };

  const selectedTransactions = useMemo(() => {
    return transactions.filter(t => selectedIds.has(t.id));
  }, [transactions, selectedIds]);

  const selectedTotal = useMemo(() => {
    return selectedTransactions.reduce((sum, t) => sum + (t.amount || 0), 0);
  }, [selectedTransactions]);

  const commitTrade = async () => {
    if (selectedIds.size === 0) {
      alert('Select transactions to commit');
      return;
    }
    if (!strategy) {
      alert('Select a strategy');
      return;
    }
    if (!tradeNum) {
      alert('Enter a trade number');
      return;
    }

    setCommitting(true);
    try {
      const res = await fetch('/api/investment-transactions/commit-to-ledger', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          transactionIds: Array.from(selectedIds),
          accountCode: coa,
          strategy,
          tradeNum
        })
      });

      const result = await res.json();
      
      if (result.success) {
        alert(`✅ Committed Trade #${tradeNum} (${selectedIds.size} legs)`);
        setSelectedIds(new Set());
        setStrategy('');
        setTradeNum(String(Number(tradeNum) + 1));
        await fetchData();
        await onReload();
      } else {
        alert(`❌ Error: ${result.error}`);
      }
    } catch (err) {
      alert(`❌ Failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setCommitting(false);
    }
  };

  if (loading) {
    return (
      <div className="p-6 bg-white border rounded-lg">
        <div className="animate-pulse">Loading transactions...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 bg-red-50 border border-red-200 rounded-lg">
        <div className="text-red-600">Error: {error}</div>
        <button onClick={fetchData} className="mt-2 text-blue-600 underline">Retry</button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header & Commit Controls */}
      <div className="p-4 bg-gradient-to-r from-indigo-50 to-purple-50 border-2 border-indigo-200 rounded-lg sticky top-0 z-10">
        <div className="flex justify-between items-start gap-4">
          <div>
            <h3 className="font-bold text-lg">📊 Trade Commit Queue</h3>
            <p className="text-sm text-gray-600">
              {transactions.length} uncommitted • {sortedTickers.length} tickers • Next Trade #: {nextTradeNum}
            </p>
          </div>
          
          {selectedIds.size > 0 && (
            <div className="flex flex-col gap-2 p-3 bg-white rounded-lg border shadow-sm">
              <div className="text-sm font-medium">
                {selectedIds.size} selected • Net: <span className={selectedTotal < 0 ? 'text-green-600' : 'text-red-600'}>
                  ${Math.abs(selectedTotal).toFixed(2)} {selectedTotal < 0 ? 'CR' : 'DR'}
                </span>
              </div>
              
              <div className="flex gap-2 items-center">
                <select 
                  value={strategy} 
                  onChange={e => setStrategy(e.target.value)}
                  className="border rounded px-2 py-1 text-sm"
                >
                  <option value="">Strategy...</option>
                  {STRATEGY_OPTIONS.map(s => (
                    <option key={s.value} value={s.value}>{s.label}</option>
                  ))}
                </select>
                
                <select 
                  value={coa} 
                  onChange={e => setCoa(e.target.value)}
                  className="border rounded px-2 py-1 text-sm"
                >
                  {COA_OPTIONS.map(c => (
                    <option key={c.value} value={c.value}>{c.label}</option>
                  ))}
                </select>
                
                <input
                  type="text"
                  value={tradeNum}
                  onChange={e => setTradeNum(e.target.value)}
                  placeholder="#"
                  className="border rounded px-2 py-1 text-sm w-16 text-center"
                />
                
                <button
                  onClick={commitTrade}
                  disabled={committing || !strategy || !tradeNum}
                  className="px-4 py-1 bg-indigo-600 text-white rounded text-sm hover:bg-indigo-700 disabled:bg-gray-400"
                >
                  {committing ? '...' : 'Commit'}
                </button>
                
                <button
                  onClick={clearSelection}
                  className="px-2 py-1 text-gray-500 hover:text-gray-700 text-sm"
                >
                  Clear
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Ticker Queues */}
      <div className="space-y-2">
        {sortedTickers.map(ticker => {
          const txns = groupedByTicker[ticker];
          const isExpanded = expandedTicker === ticker;
          const selectedInTicker = txns.filter(t => selectedIds.has(t.id)).length;
          const opens = txns.filter(t => t.positionType === 'open');
          const closes = txns.filter(t => t.positionType === 'close');
          const unknown = txns.filter(t => t.positionType === 'unknown');
          
          return (
            <div key={ticker} className="border rounded-lg overflow-hidden">
              {/* Ticker Header */}
              <button
                onClick={() => setExpandedTicker(isExpanded ? null : ticker)}
                className="w-full flex justify-between items-center px-4 py-3 bg-gray-50 hover:bg-gray-100"
              >
                <span className="flex items-center gap-3">
                  <span className="font-bold text-lg">{ticker}</span>
                  <span className="text-xs bg-gray-200 px-2 py-0.5 rounded">{txns.length} txns</span>
                  {opens.length > 0 && (
                    <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded">{opens.length} opens</span>
                  )}
                  {closes.length > 0 && (
                    <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded">{closes.length} closes</span>
                  )}
                  {selectedInTicker > 0 && (
                    <span className="text-xs bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded">✓ {selectedInTicker} selected</span>
                  )}
                </span>
                <span className={`transition-transform ${isExpanded ? 'rotate-180' : ''}`}>▼</span>
              </button>
              
              {/* Expanded Transaction List */}
              {isExpanded && (
                <div className="border-t">
                  <div className="px-4 py-2 bg-gray-50 border-b flex justify-between items-center">
                    <span className="text-xs text-gray-500">Click rows to select, then commit as a trade</span>
                    <button
                      onClick={() => selectAllInTicker(ticker)}
                      className="text-xs text-indigo-600 hover:text-indigo-800"
                    >
                      Select All
                    </button>
                  </div>
                  
                  <div className="divide-y">
                    {txns.map(t => {
                      const isSelected = selectedIds.has(t.id);
                      return (
                        <div
                          key={t.id}
                          onClick={() => toggleSelect(t.id)}
                          className={`flex items-center gap-3 px-4 py-2 cursor-pointer transition-colors ${
                            isSelected ? 'bg-indigo-50 border-l-4 border-indigo-500' : 'hover:bg-gray-50'
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => toggleSelect(t.id)}
                            className="w-4 h-4"
                          />
                          
                          <span className="text-xs text-gray-500 w-20">
                            {new Date(t.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                          </span>
                          
                          <span className={`text-xs font-medium px-2 py-0.5 rounded w-16 text-center ${
                            t.positionType === 'open' ? 'bg-green-100 text-green-700' :
                            t.positionType === 'close' ? 'bg-red-100 text-red-700' :
                            'bg-gray-100 text-gray-700'
                          }`}>
                            {t.positionType === 'open' ? 'OPEN' : t.positionType === 'close' ? 'CLOSE' : '???'}
                          </span>
                          
                          <span className={`text-xs font-medium px-2 py-0.5 rounded w-12 text-center ${
                            t.action.includes('sell') ? 'bg-orange-100 text-orange-700' : 'bg-blue-100 text-blue-700'
                          }`}>
                            {t.action.includes('sell') ? 'SELL' : 'BUY'}
                          </span>
                          
                          {t.isOption && (
                            <>
                              <span className="text-sm font-mono w-16 text-right">${t.strike}</span>
                              <span className={`text-xs px-2 py-0.5 rounded ${
                                t.optionType === 'call' ? 'bg-blue-50 text-blue-600' : 'bg-purple-50 text-purple-600'
                              }`}>
                                {t.optionType?.toUpperCase()}
                              </span>
                              <span className="text-xs text-gray-400 w-20">{t.expiration}</span>
                            </>
                          )}
                          
                          <span className="text-sm w-12 text-right">{t.quantity}</span>
                          <span className="text-sm w-20 text-right">${t.price?.toFixed(2)}</span>
                          
                          <span className={`text-sm font-medium w-24 text-right ${
                            t.amount < 0 ? 'text-green-600' : 'text-red-600'
                          }`}>
                            ${Math.abs(t.amount).toFixed(2)}
                            <span className="text-xs text-gray-400 ml-1">
                              {t.amount < 0 ? 'CR' : 'DR'}
                            </span>
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {transactions.length === 0 && (
        <div className="p-8 text-center text-gray-500 bg-gray-50 rounded-lg">
          No uncommitted transactions found.
        </div>
      )}
    </div>
  );
}
