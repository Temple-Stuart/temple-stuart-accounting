'use client';

import { useState, useEffect, useMemo } from 'react';

interface Transaction {
  id: string;
  date: string;
  name: string;
  ticker: string | null;
  underlying: string | null;
  isOption: boolean;
  optionType: 'call' | 'put' | null;
  strike: number | null;
  expiration: string | null;
  action: string;
  positionType: 'open' | 'close' | 'unknown';
  quantity: number;
  price: number;
  amount: number;
}

interface OpenTrade {
  id: string;
  trade_num: string;
  symbol: string;
  strategy: string;
  status: string;
  open_date: string;
  cost_basis: number;
  legs: Array<{
    option_type: string;
    strike_price: number;
    expiration_date: string;
    position_type: string;
    quantity: number;
  }>;
}

interface StockLotGroup {
  symbol: string;
  totalShares: number;
  totalCostBasis: number;
  avgCostPerShare: number;
  lotCount: number;
  lots: Array<{
    id: string;
    acquired_date: string;
    remaining_quantity: number;
    cost_per_share: number;
  }>;
}

interface TradeCommitWorkflowProps {
  onReload: () => Promise<void>;
}

const STRATEGY_OPTIONS = [
  { value: 'call-credit', label: 'Call Credit Spread', positionAccount: 'T-1220' },
  { value: 'put-credit', label: 'Put Credit Spread', positionAccount: 'T-1230' },
  { value: 'call-debit', label: 'Call Debit Spread', positionAccount: 'T-1220' },
  { value: 'put-debit', label: 'Put Debit Spread', positionAccount: 'T-1230' },
  { value: 'iron-condor', label: 'Iron Condor', positionAccount: 'T-1240' },
  { value: 'strangle', label: 'Strangle', positionAccount: 'T-1250' },
  { value: 'straddle', label: 'Straddle', positionAccount: 'T-1250' },
  { value: 'long-call', label: 'Long Call', positionAccount: 'T-1200' },
  { value: 'long-put', label: 'Long Put', positionAccount: 'T-1210' },
  { value: 'short-call', label: 'Short Call (Naked)', positionAccount: 'T-2100' },
  { value: 'short-put', label: 'Short Put (CSP)', positionAccount: 'T-2110' },
  { value: 'covered-call', label: 'Covered Call', positionAccount: 'T-2100' },
  { value: 'stock-long', label: 'Stock (Long)', positionAccount: 'T-1100' },
  { value: 'stock-short', label: 'Stock (Short)', positionAccount: 'T-2200' },
  { value: 'crypto', label: 'Cryptocurrency', positionAccount: 'T-1300' },
];

export default function TradeCommitWorkflow({ onReload }: TradeCommitWorkflowProps) {
  const [activeTab, setActiveTab] = useState<'opens' | 'closes' | 'trades'>('opens');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Data
  const [opens, setOpens] = useState<Transaction[]>([]);
  const [closes, setCloses] = useState<Transaction[]>([]);
  const [openTrades, setOpenTrades] = useState<OpenTrade[]>([]);
  const [stockLots, setStockLots] = useState<StockLotGroup[]>([]);
  const [nextTradeNum, setNextTradeNum] = useState(1);
  
  // Selection state
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [strategy, setStrategy] = useState('');
  const [tradeNum, setTradeNum] = useState('');
  const [linkedTradeId, setLinkedTradeId] = useState('');
  const [expandedTicker, setExpandedTicker] = useState<string | null>(null);
  const [committing, setCommitting] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [opensRes, tradesRes, maxRes, lotsRes] = await Promise.all([
        fetch('/api/investment-transactions/opens'),
        fetch('/api/trading-positions/open'),
        fetch('/api/investment-transactions/max-trade-num'),
        fetch('/api/stock-lots?status=OPEN')
      ]);
      
      const opensData = await opensRes.json();
      const tradesData = await tradesRes.json();
      const maxData = await maxRes.json();
      const lotsData = await lotsRes.json();
      
      if (opensData.error) throw new Error(opensData.error);
      
      setOpens(opensData.opens || []);
      setCloses(opensData.closes || []);
      setOpenTrades(tradesData.trades || []);
      
      // Group stock lots by symbol for the dropdown
      const lots = lotsData.lots || [];
      const lotsBySymbol: Record<string, StockLotGroup> = {};
      lots.forEach((lot: any) => {
        if (!lotsBySymbol[lot.symbol]) {
          lotsBySymbol[lot.symbol] = {
            symbol: lot.symbol,
            totalShares: 0,
            totalCostBasis: 0,
            avgCostPerShare: 0,
            lotCount: 0,
            lots: []
          };
        }
        const group = lotsBySymbol[lot.symbol];
        group.totalShares += lot.remaining_quantity;
        group.totalCostBasis += (lot.remaining_quantity / lot.original_quantity) * lot.total_cost_basis;
        group.lotCount++;
        group.lots.push({
          id: lot.id,
          acquired_date: lot.acquired_date,
          remaining_quantity: lot.remaining_quantity,
          cost_per_share: lot.cost_per_share
        });
      });
      // Calculate avg cost and convert to array
      const stockLotGroups = Object.values(lotsBySymbol).map(g => ({
        ...g,
        avgCostPerShare: g.totalShares > 0 ? g.totalCostBasis / g.totalShares : 0
      }));
      setStockLots(stockLotGroups);
      
      setNextTradeNum((maxData.maxTradeNum || 0) + 1);
      setTradeNum(String((maxData.maxTradeNum || 0) + 1));
      
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  };

  // Group transactions by ticker
  const groupByTicker = (txns: Transaction[]) => {
    const groups: { [ticker: string]: Transaction[] } = {};
    txns.forEach(t => {
      const key = t.underlying || t.ticker || 'UNKNOWN';
      if (!groups[key]) groups[key] = [];
      groups[key].push(t);
    });
    Object.keys(groups).forEach(key => {
      groups[key].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    });
    return groups;
  };

  const groupedOpens = useMemo(() => groupByTicker(opens), [opens]);
  const groupedCloses = useMemo(() => groupByTicker(closes), [closes]);
  const sortedOpenTickers = useMemo(() => Object.keys(groupedOpens).sort(), [groupedOpens]);
  const sortedCloseTickers = useMemo(() => Object.keys(groupedCloses).sort(), [groupedCloses]);

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const clearSelection = () => {
    setSelectedIds(new Set());
    setStrategy('');
    setLinkedTradeId('');
  };

  const selectedTransactions = useMemo(() => {
    const source = activeTab === 'opens' ? opens : closes;
    return source.filter(t => selectedIds.has(t.id));
  }, [activeTab, opens, closes, selectedIds]);

  const selectedTotal = useMemo(() => {
    return selectedTransactions.reduce((sum, t) => sum + (t.amount || 0), 0);
  }, [selectedTransactions]);

  // Commit OPENS
  const commitOpens = async () => {
    if (selectedIds.size === 0) return alert('Select transactions to commit');
    if (!strategy) return alert('Select a strategy');
    if (!tradeNum) return alert('Enter a trade number');

    // Stock lots use different workflow
    if (strategy === 'stock-long' || strategy === 'stock-short') {
      return commitStockLots();
    }

    setCommitting(true);
    try {
      const res = await fetch('/api/investment-transactions/commit-to-ledger', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          transactionIds: Array.from(selectedIds),
          strategy,
          tradeNum
        })
      });

      const result = await res.json();
      
      if (result.success) {
        const skippedCount = result.details?.skipped?.length || 0;
        alert(`✅ Trade #${tradeNum} OPENED (${result.committed} legs)${skippedCount > 0 ? `\n⚠️ ${skippedCount} skipped` : ''}`);
        clearSelection();
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

  // Commit STOCK LOTS (each buy becomes a separate lot for FIFO/LIFO tracking)
  const commitStockLots = async () => {
    setCommitting(true);
    try {
      const res = await fetch('/api/stock-lots', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          transactionIds: Array.from(selectedIds),
          strategy,
          tradeNum
        })
      });

      const result = await res.json();
      
      if (result.success) {
        alert(`✅ Trade #${result.tradeNum}: Created ${result.committed} stock lot(s) with journal entries`);
        clearSelection();
        setTradeNum(String(Number(result.tradeNum) + 1));
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

  // Commit STOCK CLOSE - fetch tax scenarios and let user choose
  const commitStockClose = async (symbol: string) => {
    // Get the selected closing transactions to find sale details
    const selectedTxns = closes.filter(c => selectedIds.has(c.id));
    if (selectedTxns.length === 0) return alert('No closing transactions selected');
    
    // Calculate total sale quantity and average price from selected transactions
    const totalQuantity = selectedTxns.reduce((sum, t) => sum + (t.quantity || 0), 0);
    const totalProceeds = selectedTxns.reduce((sum, t) => sum + Math.abs(t.amount || 0), 0);
    const avgPrice = totalQuantity > 0 ? totalProceeds / totalQuantity : 0;
    const saleDate = selectedTxns[0]?.date || new Date().toISOString();

    setCommitting(true);
    try {
      // Fetch tax scenarios from the match API
      const res = await fetch('/api/stock-lots/match', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          symbol,
          saleQuantity: totalQuantity,
          salePrice: avgPrice,
          saleDate
        })
      });

      const scenarios = await res.json();
      
      if (scenarios.error) {
        alert(`❌ Error: ${scenarios.error}`);
        setCommitting(false);
        return;
      }

      // Format the scenarios for display
      const formatPL = (val: number) => {
        const sign = val >= 0 ? '+' : '';
        return `${sign}$${val.toFixed(2)}`;
      };
      const formatTax = (val: number) => {
        const sign = val >= 0 ? '' : '-';
        return `${sign}$${Math.abs(val).toFixed(2)}`;
      };

      // Build comparison message
      let message = `📊 TAX SCENARIO COMPARISON\n`;
      message += `Selling ${totalQuantity.toFixed(2)} ${symbol} @ $${avgPrice.toFixed(2)}\n`;
      message += `Total Proceeds: $${totalProceeds.toFixed(2)}\n\n`;
      message += `Method       | P&L        | Est. Tax\n`;
      message += `-------------|------------|----------\n`;
      
      const methods = ['fifo', 'lifo', 'hifo', 'minTax'];
      const labels: Record<string, string> = { fifo: 'FIFO', lifo: 'LIFO', hifo: 'HIFO', minTax: 'MIN TAX' };
      
      methods.forEach(m => {
        const s = scenarios.scenarios[m];
        if (s) {
          const isBest = m === scenarios.bestMethod;
          message += `${labels[m].padEnd(12)} | ${formatPL(s.summary.totalGainLoss).padEnd(10)} | ${formatTax(s.summary.estimatedTax)}${isBest ? ' ⭐' : ''}\n`;
        }
      });
      
      message += `\nBest method: ${labels[scenarios.bestMethod] || scenarios.bestMethod}\n`;
      message += `\nWhich method do you want to use?`;

      // Ask user to choose (for now, use prompt - later we can make a modal)
      const choice = prompt(message + '\n\nEnter: fifo, lifo, hifo, or mintax', scenarios.bestMethod);
      
      if (!choice) {
        setCommitting(false);
        return;
      }

      const methodMap: Record<string, string> = { 
        fifo: 'FIFO', lifo: 'LIFO', hifo: 'HIFO', mintax: 'MIN_TAX', 'min tax': 'MIN_TAX' 
      };
      const selectedMethod = methodMap[choice.toLowerCase()] || 'FIFO';

      // Commit with selected method
      const commitRes = await fetch('/api/stock-lots/commit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          saleTxnId: selectedTxns[0]?.id,
          symbol,
          saleQuantity: totalQuantity,
          salePrice: avgPrice,
          saleDate,
          matchingMethod: selectedMethod
        })
      });

      const commitResult = await commitRes.json();

      if (commitResult.success) {
        const pl = commitResult.summary.totalGainLoss;
        const plSign = pl >= 0 ? '+' : '';
        alert(`✅ Stock position closed with ${selectedMethod}\nP&L: ${plSign}$${pl.toFixed(2)}\nST: $${commitResult.summary.shortTermGain.toFixed(2)}\nLT: $${commitResult.summary.longTermGain.toFixed(2)}`);
        clearSelection();
        await fetchData();
        await onReload();
      } else {
        alert(`❌ Error: ${commitResult.error}`);
      }
    } catch (err) {
      alert(`❌ Failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setCommitting(false);
    }
  };

  // Commit CLOSES (links to open trade OR stock lots)
  const commitCloses = async () => {
    if (selectedIds.size === 0) return alert('Select closing transactions');
    if (!linkedTradeId) return alert('Select an open position to close');

    // Parse the selection - could be "trade:uuid" or "stock:SYMBOL"
    const [type, id] = linkedTradeId.split(':');
    
    if (type === 'stock') {
      // Stock lot close - show tax scenario comparison
      return commitStockClose(id);
    }

    // Option trade close (existing logic)
    const linkedTrade = openTrades.find(t => t.id === id);
    if (!linkedTrade) return alert('Invalid trade selection');

    setCommitting(true);
    try {
      const res = await fetch('/api/investment-transactions/commit-to-ledger', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          transactionIds: Array.from(selectedIds),
          strategy: linkedTrade.strategy,
          tradeNum: linkedTrade.trade_num
        })
      });

      const result = await res.json();
      
      if (result.success) {
        const totalPL = result.details?.results
          ?.filter((r: any) => r.action === 'CLOSE')
          ?.reduce((sum: number, r: any) => sum + (r.realizedPL || 0), 0) || 0;
        const plDisplay = (totalPL / 100).toFixed(2);
        const plSign = totalPL >= 0 ? '+' : '';
        
        alert(`✅ Trade #${linkedTrade.trade_num} CLOSED\nP&L: ${plSign}$${plDisplay}`);
        clearSelection();
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

  // Render transaction row
  const renderTransaction = (t: Transaction) => {
    const isSelected = selectedIds.has(t.id);
    return (
      <div
        key={t.id}
        onClick={() => toggleSelect(t.id)}
        className={`flex items-center gap-3 px-4 py-2 cursor-pointer transition-colors ${
          isSelected ? 'bg-indigo-50 border-l-4 border-indigo-500' : 'hover:bg-gray-50'
        }`}
      >
        <input type="checkbox" checked={isSelected} onChange={() => toggleSelect(t.id)} className="w-4 h-4" />
        
        <span className="text-xs text-gray-500 w-20">
          {new Date(t.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
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
            <span className="text-xs text-gray-400 w-24">{t.expiration}</span>
          </>
        )}
        
        <span className="text-sm w-12 text-right">{t.quantity}</span>
        <span className="text-sm w-20 text-right">${t.price?.toFixed(2)}</span>
        
        <span className={`text-sm font-medium w-24 text-right ${
          t.amount < 0 ? 'text-green-600' : 'text-red-600'
        }`}>
          ${Math.abs(t.amount).toFixed(2)}
          <span className="text-xs text-gray-400 ml-1">{t.amount < 0 ? 'CR' : 'DR'}</span>
        </span>
      </div>
    );
  };

  if (loading) {
    return <div className="p-6 bg-white border rounded-lg"><div className="animate-pulse">Loading...</div></div>;
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
      {/* Header with Tabs */}
      <div className="flex items-center justify-between p-4 bg-gradient-to-r from-indigo-50 to-purple-50 border-2 border-indigo-200 rounded-lg">
        <div>
          <h3 className="font-bold text-lg">📊 Trade Commit Workflow</h3>
          <p className="text-sm text-gray-600">
            {opens.length} opens • {closes.length} closes • {openTrades.length} open trades • Next #: {nextTradeNum}
          </p>
        </div>
        
        <div className="flex gap-1 bg-white rounded-lg p-1 border">
          <button
            onClick={() => { setActiveTab('opens'); clearSelection(); }}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              activeTab === 'opens' ? 'bg-green-100 text-green-700' : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            1. Opens ({opens.length})
          </button>
          <button
            onClick={() => { setActiveTab('closes'); clearSelection(); }}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              activeTab === 'closes' ? 'bg-red-100 text-red-700' : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            2. Closes ({closes.length})
          </button>
          <button
            onClick={() => { setActiveTab('trades'); clearSelection(); }}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              activeTab === 'trades' ? 'bg-blue-100 text-blue-700' : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            3. Trades ({openTrades.length})
          </button>
        </div>
      </div>

      {/* OPENS TAB */}
      {activeTab === 'opens' && (
        <>
          {/* Commit Controls */}
          {selectedIds.size > 0 && (
            <div className="p-4 bg-green-50 border border-green-200 rounded-lg sticky top-0 z-10">
              <div className="flex items-center justify-between">
                <div>
                  <span className="font-medium">{selectedIds.size} legs selected</span>
                  <span className={`ml-3 ${selectedTotal < 0 ? 'text-green-600' : 'text-red-600'}`}>
                    Net: ${Math.abs(selectedTotal).toFixed(2)} {selectedTotal < 0 ? 'CR' : 'DR'}
                  </span>
                </div>
                <div className="flex gap-2 items-center">
                  <select value={strategy} onChange={e => setStrategy(e.target.value)} className="border rounded px-3 py-2 text-sm">
                    <option value="">Strategy...</option>
                    {STRATEGY_OPTIONS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                  </select>
                  <input
                    type="text"
                    value={tradeNum}
                    onChange={e => setTradeNum(e.target.value)}
                    placeholder="Trade #"
                    className="border rounded px-3 py-2 text-sm w-20 text-center"
                  />
                  <button
                    onClick={commitOpens}
                    disabled={committing || !strategy || !tradeNum}
                    className="px-4 py-2 bg-green-600 text-white rounded text-sm font-medium hover:bg-green-700 disabled:bg-gray-400"
                  >
                    {committing ? 'Committing...' : 'Open Position'}
                  </button>
                  <button onClick={clearSelection} className="px-3 py-2 text-gray-500 hover:text-gray-700 text-sm">Clear</button>
                </div>
              </div>
            </div>
          )}

          {/* Opens List */}
          <div className="space-y-2">
            {sortedOpenTickers.map(ticker => {
              const txns = groupedOpens[ticker];
              const isExpanded = expandedTicker === ticker;
              const selectedCount = txns.filter(t => selectedIds.has(t.id)).length;
              
              return (
                <div key={ticker} className="border rounded-lg overflow-hidden">
                  <button
                    onClick={() => setExpandedTicker(isExpanded ? null : ticker)}
                    className="w-full flex justify-between items-center px-4 py-3 bg-gray-50 hover:bg-gray-100"
                  >
                    <span className="flex items-center gap-3">
                      <span className="font-bold text-lg">{ticker}</span>
                      <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded">{txns.length} opens</span>
                      {selectedCount > 0 && (
                        <span className="text-xs bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded">✓ {selectedCount}</span>
                      )}
                    </span>
                    <span className={`transition-transform ${isExpanded ? 'rotate-180' : ''}`}>▼</span>
                  </button>
                  
                  {isExpanded && (
                    <div className="border-t divide-y">
                      {txns.map(renderTransaction)}
                    </div>
                  )}
                </div>
              );
            })}
            
            {opens.length === 0 && (
              <div className="p-8 text-center text-gray-500 bg-gray-50 rounded-lg">
                No uncommitted opening transactions.
              </div>
            )}
          </div>
        </>
      )}

      {/* CLOSES TAB */}
      {activeTab === 'closes' && (
        <>
          {/* Commit Controls */}
          {selectedIds.size > 0 && (
            <div className="p-4 bg-red-50 border border-red-200 rounded-lg sticky top-0 z-10">
              <div className="flex items-center justify-between">
                <div>
                  <span className="font-medium">{selectedIds.size} closing legs selected</span>
                  <span className={`ml-3 ${selectedTotal < 0 ? 'text-green-600' : 'text-red-600'}`}>
                    Net: ${Math.abs(selectedTotal).toFixed(2)} {selectedTotal < 0 ? 'CR' : 'DR'}
                  </span>
                </div>
                <div className="flex gap-2 items-center">
                  <select value={linkedTradeId} onChange={e => setLinkedTradeId(e.target.value)} className="border rounded px-3 py-2 text-sm min-w-[250px]">
                    <option value="">Link to open position...</option>
                    {openTrades.length > 0 && (
                      <optgroup label="Option Trades">
                        {openTrades.map(t => (
                          <option key={t.id} value={`trade:${t.id}`}>
                            #{t.trade_num} - {t.symbol} {t.strategy} (${t.cost_basis.toFixed(2)})
                          </option>
                        ))}
                      </optgroup>
                    )}
                    {stockLots.length > 0 && (
                      <optgroup label="Stock Lots (FIFO/LIFO)">
                        {stockLots.map(g => (
                          <option key={g.symbol} value={`stock:${g.symbol}`}>
                            {g.symbol} - {g.totalShares.toFixed(2)} shares ({g.lotCount} lots, avg ${g.avgCostPerShare.toFixed(2)})
                          </option>
                        ))}
                      </optgroup>
                    )}
                  </select>
                  <button
                    onClick={commitCloses}
                    disabled={committing || !linkedTradeId}
                    className="px-4 py-2 bg-red-600 text-white rounded text-sm font-medium hover:bg-red-700 disabled:bg-gray-400"
                  >
                    {committing ? 'Closing...' : 'Close Position'}
                  </button>
                  <button onClick={clearSelection} className="px-3 py-2 text-gray-500 hover:text-gray-700 text-sm">Clear</button>
                </div>
              </div>
            </div>
          )}

          {/* Closes List */}
          <div className="space-y-2">
            {sortedCloseTickers.map(ticker => {
              const txns = groupedCloses[ticker];
              const isExpanded = expandedTicker === ticker;
              const selectedCount = txns.filter(t => selectedIds.has(t.id)).length;
              
              return (
                <div key={ticker} className="border rounded-lg overflow-hidden">
                  <button
                    onClick={() => setExpandedTicker(isExpanded ? null : ticker)}
                    className="w-full flex justify-between items-center px-4 py-3 bg-gray-50 hover:bg-gray-100"
                  >
                    <span className="flex items-center gap-3">
                      <span className="font-bold text-lg">{ticker}</span>
                      <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded">{txns.length} closes</span>
                      {selectedCount > 0 && (
                        <span className="text-xs bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded">✓ {selectedCount}</span>
                      )}
                    </span>
                    <span className={`transition-transform ${isExpanded ? 'rotate-180' : ''}`}>▼</span>
                  </button>
                  
                  {isExpanded && (
                    <div className="border-t divide-y">
                      {txns.map(renderTransaction)}
                    </div>
                  )}
                </div>
              );
            })}
            
            {closes.length === 0 && (
              <div className="p-8 text-center text-gray-500 bg-gray-50 rounded-lg">
                No uncommitted closing transactions.
              </div>
            )}
          </div>
        </>
      )}

      {/* TRADES TAB */}
      {activeTab === 'trades' && (
        <div className="space-y-2">
          {openTrades.length === 0 ? (
            <div className="p-8 text-center text-gray-500 bg-gray-50 rounded-lg">
              No open trades. Commit some opening positions first.
            </div>
          ) : (
            openTrades.map(trade => (
              <div key={trade.id} className="border rounded-lg p-4 bg-white">
                <div className="flex justify-between items-start">
                  <div>
                    <span className="font-bold text-lg">Trade #{trade.trade_num}</span>
                    <span className="ml-3 text-sm text-gray-600">{trade.symbol}</span>
                    <span className="ml-2 text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded">{trade.strategy}</span>
                  </div>
                  <div className="text-right">
                    <div className={`text-sm font-medium ${trade.status === 'OPEN' ? 'text-green-600' : 'text-gray-500'}`}>
                      {trade.status}
                    </div>
                    <div className="text-xs text-gray-500">
                      Opened: {new Date(trade.open_date).toLocaleDateString()}
                    </div>
                  </div>
                </div>
                <div className="mt-2 text-sm text-gray-600">
                  Cost Basis: <span className="font-medium">${trade.cost_basis.toFixed(2)}</span>
                  {trade.legs && trade.legs.length > 0 && (
                    <span className="ml-4">{trade.legs.length} legs</span>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
