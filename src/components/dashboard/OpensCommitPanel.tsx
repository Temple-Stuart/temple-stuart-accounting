'use client';

import { useState, useEffect } from 'react';

interface OpenTransaction {
  id: string;
  date: string;
  name: string;
  security_id: string;
  ticker: string;
  underlying: string;
  isOption: boolean;
  optionType: 'call' | 'put' | null;
  strike: number | null;
  expiration: string | null;
  action: 'buy_to_open' | 'sell_to_open';
  quantity: number;
  price: number;
  amount: number;
}

interface SpreadGroup {
  date: string;
  underlying: string;
  legs: OpenTransaction[];
  detectedStrategy: string;
  selectedStrategy: string;
  confirmed: boolean;
}

function detectStrategy(legs: OpenTransaction[]): string {
  if (legs.length === 0) return 'unknown';
  
  const allOptions = legs.every(l => l.isOption);
  if (!allOptions) {
    const buys = legs.filter(l => l.action === 'buy_to_open');
    return buys.length > 0 ? 'buy' : 'sell';
  }
  
  if (legs.length === 1) {
    const leg = legs[0];
    if (leg.action === 'buy_to_open') {
      return leg.optionType === 'call' ? 'long-call' : 'long-put';
    } else {
      return leg.optionType === 'call' ? 'short-call' : 'short-put';
    }
  }
  
  if (legs.length === 2) {
    const [a, b] = legs;
    const sameType = a.optionType === b.optionType;
    const sameExp = a.expiration === b.expiration;
    const sameStrike = a.strike === b.strike;
    
    if (sameType && sameExp && a.strike && b.strike) {
      const sellLeg = legs.find(l => l.action === 'sell_to_open');
      const buyLeg = legs.find(l => l.action === 'buy_to_open');
      
      if (sellLeg && buyLeg && sellLeg.strike && buyLeg.strike) {
        if (a.optionType === 'call') {
          return sellLeg.strike > buyLeg.strike ? 'call-credit' : 'call-debit';
        } else {
          return sellLeg.strike < buyLeg.strike ? 'put-credit' : 'put-debit';
        }
      }
    }
    
    if (!sameType && sameExp) {
      return sameStrike ? 'straddle' : 'strangle';
    }
  }
  
  if (legs.length === 4) {
    const puts = legs.filter(l => l.optionType === 'put');
    const calls = legs.filter(l => l.optionType === 'call');
    if (puts.length === 2 && calls.length === 2) {
      return 'iron-condor';
    }
  }
  
  return 'unknown';
}

const STRATEGY_OPTIONS = [
  { value: '', label: '-- Select --' },
  { group: 'Credit Spreads', options: [
    { value: 'call-credit', label: 'Call Credit Spread' },
    { value: 'put-credit', label: 'Put Credit Spread' },
    { value: 'iron-condor', label: 'Iron Condor' },
  ]},
  { group: 'Debit Spreads', options: [
    { value: 'call-debit', label: 'Call Debit Spread' },
    { value: 'put-debit', label: 'Put Debit Spread' },
  ]},
  { group: 'Volatility', options: [
    { value: 'straddle', label: 'Straddle' },
    { value: 'strangle', label: 'Strangle' },
  ]},
  { group: 'Single Options', options: [
    { value: 'long-call', label: 'Long Call' },
    { value: 'long-put', label: 'Long Put' },
    { value: 'short-call', label: 'Short Call' },
    { value: 'short-put', label: 'Short Put' },
  ]},
  { group: 'Stock', options: [
    { value: 'buy', label: 'Buy Stock' },
    { value: 'sell', label: 'Sell Stock' },
  ]},
];

interface OpensCommitPanelProps {
  onReload: () => Promise<void>;
}

export default function OpensCommitPanel({ onReload }: OpensCommitPanelProps) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [groups, setGroups] = useState<SpreadGroup[]>([]);
  const [nextTradeNum, setNextTradeNum] = useState(1);
  const [commitStatus, setCommitStatus] = useState<{ loading: boolean; message: string } | null>(null);

  useEffect(() => {
    fetchOpens();
  }, []);

  const fetchOpens = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/investment-transactions/opens');
      const data = await res.json();
      
      if (data.error) {
        setError(data.error);
        return;
      }

      const spreadGroups: SpreadGroup[] = [];
      const dateKeys = Object.keys(data.byDateAndUnderlying).sort();
      
      for (const dateKey of dateKeys) {
        const underlyings = data.byDateAndUnderlying[dateKey];
        for (const [underlying, legs] of Object.entries(underlyings)) {
          const typedLegs = legs as OpenTransaction[];
          const detected = detectStrategy(typedLegs);
          spreadGroups.push({
            date: dateKey,
            underlying,
            legs: typedLegs,
            detectedStrategy: detected,
            selectedStrategy: detected,
            confirmed: false,
          });
        }
      }
      
      setGroups(spreadGroups);
      
      const committedRes = await fetch('/api/investment-transactions/max-trade-num');
      const committedData = await committedRes.json();
      setNextTradeNum((committedData.maxTradeNum || 0) + 1);
      
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch opens');
    } finally {
      setLoading(false);
    }
  };

  const updateGroupStrategy = (index: number, strategy: string) => {
    setGroups(prev => prev.map((g, i) => 
      i === index ? { ...g, selectedStrategy: strategy } : g
    ));
  };

  const toggleGroupConfirmed = (index: number) => {
    setGroups(prev => prev.map((g, i) => 
      i === index ? { ...g, confirmed: !g.confirmed } : g
    ));
  };

  const confirmAll = () => {
    setGroups(prev => prev.map(g => ({ ...g, confirmed: true })));
  };

  const commitConfirmed = async () => {
    const confirmedGroups = groups.filter(g => g.confirmed && g.selectedStrategy);
    
    if (confirmedGroups.length === 0) {
      alert('No confirmed groups to commit. Confirm spreads first.');
      return;
    }

    setCommitStatus({ loading: true, message: 'Starting commit...' });
    
    let currentTradeNum = nextTradeNum;
    let committed = 0;
    const errors: string[] = [];

    for (const group of confirmedGroups) {
      try {
        const transactionIds = group.legs.map(l => l.id);
        
        setCommitStatus({ 
          loading: true, 
          message: `Committing Trade #${currentTradeNum}: ${group.underlying} ${group.selectedStrategy}...` 
        });

        const res = await fetch('/api/investment-transactions/commit-to-ledger', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            transactionIds,
            accountCode: 'T-1210',
            strategy: group.selectedStrategy,
            tradeNum: String(currentTradeNum),
          }),
        });

        const result = await res.json();
        
        if (result.success) {
          committed++;
          currentTradeNum++;
        } else {
          errors.push(`Trade #${currentTradeNum} (${group.underlying}): ${result.error}`);
        }
      } catch (err) {
        errors.push(`Trade #${currentTradeNum} (${group.underlying}): ${err instanceof Error ? err.message : 'Unknown error'}`);
      }
    }

    setCommitStatus(null);
    
    if (errors.length === 0) {
      alert(`✅ Successfully committed ${committed} trades (Trade #${nextTradeNum} - #${currentTradeNum - 1})`);
    } else {
      alert(`⚠️ Committed ${committed}/${confirmedGroups.length} trades.\n\nErrors:\n${errors.join('\n')}`);
    }

    await onReload();
    await fetchOpens();
  };

  const confirmedCount = groups.filter(g => g.confirmed).length;
  const totalLegs = groups.reduce((sum, g) => sum + g.legs.length, 0);

  if (loading) {
    return (
      <div className="p-6 bg-white border rounded-lg mb-4">
        <div className="animate-pulse">Loading opens...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 bg-red-50 border border-red-200 rounded-lg mb-4">
        <div className="text-red-600">Error: {error}</div>
        <button onClick={fetchOpens} className="mt-2 text-sm text-blue-600 underline">Retry</button>
      </div>
    );
  }

  return (
    <div className="space-y-4 mb-6">
      <div className="p-4 bg-gradient-to-r from-blue-50 to-indigo-50 border-2 border-blue-200 rounded-lg">
        <div className="flex justify-between items-center">
          <div>
            <h3 className="font-bold text-lg">📈 Phase 1: Commit Opening Positions</h3>
            <p className="text-sm text-gray-600">
              {groups.length} spread groups • {totalLegs} total legs • Next Trade #: {nextTradeNum}
            </p>
            {confirmedCount > 0 && (
              <p className="text-sm text-green-600 font-medium mt-1">
                ✓ {confirmedCount} groups confirmed, ready to commit
              </p>
            )}
          </div>
          <div className="flex gap-2">
            <button
              onClick={confirmAll}
              className="px-4 py-2 bg-gray-100 text-gray-700 rounded text-sm hover:bg-gray-200"
            >
              Confirm All
            </button>
            <button
              onClick={commitConfirmed}
              disabled={confirmedCount === 0 || commitStatus?.loading}
              className="px-4 py-2 bg-blue-600 text-white rounded text-sm hover:bg-blue-700 disabled:bg-gray-400"
            >
              {commitStatus?.loading ? commitStatus.message : `Commit ${confirmedCount} Trades`}
            </button>
          </div>
        </div>
      </div>

      <div className="space-y-3 max-h-96 overflow-y-auto">
        {groups.map((group, idx) => (
          <div 
            key={`${group.date}-${group.underlying}-${idx}`}
            className={`p-4 border rounded-lg ${
              group.confirmed ? 'bg-green-50 border-green-300' : 'bg-white border-gray-200'
            }`}
          >
            <div className="flex justify-between items-start mb-3">
              <div className="flex items-center gap-3">
                <input
                  type="checkbox"
                  checked={group.confirmed}
                  onChange={() => toggleGroupConfirmed(idx)}
                  className="w-5 h-5 rounded"
                />
                <div>
                  <div className="font-bold text-lg">
                    {group.underlying}
                    <span className="ml-2 text-sm font-normal text-gray-500">
                      {new Date(group.date).toLocaleDateString('en-US', { 
                        weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' 
                      })}
                    </span>
                  </div>
                  <div className="text-sm text-gray-600">
                    {group.legs.length} leg{group.legs.length > 1 ? 's' : ''} • 
                    Detected: <span className="font-medium">{group.detectedStrategy}</span>
                  </div>
                </div>
              </div>
              
              <div className="flex items-center gap-2">
                <label className="text-sm text-gray-600">Strategy:</label>
                <select
                  value={group.selectedStrategy}
                  onChange={(e) => updateGroupStrategy(idx, e.target.value)}
                  className="px-3 py-1.5 border rounded text-sm"
                >
                  {STRATEGY_OPTIONS.map((item, i) => 
                    'group' in item ? (
                      <optgroup key={item.group} label={item.group}>
                        {item.options && item.options.map(opt => (
                          <option key={opt.value} value={opt.value}>{opt.label}</option>
                        ))}
                      </optgroup>
                    ) : (
                      <option key={i} value={item.value}>{item.label}</option>
                    )
                  )}
                </select>
              </div>
            </div>

            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-2 py-1 text-left">Action</th>
                  <th className="px-2 py-1 text-left">Type</th>
                  <th className="px-2 py-1 text-right">Strike</th>
                  <th className="px-2 py-1 text-left">Expiration</th>
                  <th className="px-2 py-1 text-right">Qty</th>
                  <th className="px-2 py-1 text-right">Price</th>
                  <th className="px-2 py-1 text-right">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {group.legs.map(leg => (
                  <tr key={leg.id} className="hover:bg-gray-50">
                    <td className="px-2 py-1">
                      <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                        leg.action === 'sell_to_open' 
                          ? 'bg-red-100 text-red-700' 
                          : 'bg-green-100 text-green-700'
                      }`}>
                        {leg.action === 'sell_to_open' ? 'SELL' : 'BUY'}
                      </span>
                    </td>
                    <td className="px-2 py-1">
                      {leg.isOption ? (
                        <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                          leg.optionType === 'call' 
                            ? 'bg-blue-100 text-blue-700' 
                            : 'bg-purple-100 text-purple-700'
                        }`}>
                          {leg.optionType?.toUpperCase()}
                        </span>
                      ) : 'STOCK'}
                    </td>
                    <td className="px-2 py-1 text-right font-mono">
                      {leg.strike ? `$${leg.strike}` : '-'}
                    </td>
                    <td className="px-2 py-1">{leg.expiration || '-'}</td>
                    <td className="px-2 py-1 text-right">{leg.quantity}</td>
                    <td className="px-2 py-1 text-right">${leg.price?.toFixed(2)}</td>
                    <td className={`px-2 py-1 text-right font-medium ${
                      leg.amount < 0 ? 'text-green-600' : 'text-red-600'
                    }`}>
                      ${Math.abs(leg.amount).toFixed(2)}
                      <span className="text-xs text-gray-400 ml-1">
                        {leg.amount < 0 ? 'CR' : 'DR'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ))}
      </div>

      {groups.length === 0 && (
        <div className="p-8 text-center text-gray-500 bg-gray-50 rounded-lg">
          No uncommitted opening positions found.
        </div>
      )}
    </div>
  );
}
