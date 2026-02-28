'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';

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

type TxnSortField = 'date' | 'ticker' | 'action' | 'quantity' | 'price' | 'amount';
type TxnSortDir = 'asc' | 'desc';

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

function sortTransactions(txns: Transaction[], field: TxnSortField, dir: TxnSortDir): Transaction[] {
  const sorted = [...txns];
  sorted.sort((a, b) => {
    let cmp = 0;
    switch (field) {
      case 'date': cmp = new Date(a.date).getTime() - new Date(b.date).getTime(); break;
      case 'ticker': cmp = (a.underlying || a.ticker || '').localeCompare(b.underlying || b.ticker || ''); break;
      case 'action': cmp = a.action.localeCompare(b.action); break;
      case 'quantity': cmp = a.quantity - b.quantity; break;
      case 'price': cmp = a.price - b.price; break;
      case 'amount': cmp = Math.abs(a.amount) - Math.abs(b.amount); break;
    }
    return dir === 'asc' ? cmp : -cmp;
  });
  return sorted;
}

function matchTxnSearch(t: Transaction, term: string): boolean {
  const lower = term.toLowerCase();
  return (
    t.name.toLowerCase().includes(lower) ||
    (t.ticker || '').toLowerCase().includes(lower) ||
    (t.underlying || '').toLowerCase().includes(lower) ||
    t.action.toLowerCase().includes(lower)
  );
}

export default function TradeCommitWorkflow({ onReload }: TradeCommitWorkflowProps) {
  const [activeTab, setActiveTab] = useState<'opens' | 'closes' | 'trades' | 'corporate-actions'>('opens');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Data
  const [opens, setOpens] = useState<Transaction[]>([]);
  const [closes, setCloses] = useState<Transaction[]>([]);
  const [openTrades, setOpenTrades] = useState<OpenTrade[]>([]);
  const [stockLots, setStockLots] = useState<StockLotGroup[]>([]);
  const [corporateActions, setCorporateActions] = useState<any[]>([]);
  const [showCorpActionModal, setShowCorpActionModal] = useState(false);
  const [corpActionForm, setCorpActionForm] = useState({
    symbol: '',
    action_type: 'REVERSE_SPLIT',
    effective_date: '',
    ratio_from: 1,
    ratio_to: 1,
    pre_split_shares: '',
    post_split_shares: '',
    notes: '',
    source: '',
    add_pre_split_lot: false,
    lot_cost_basis: 0,
    lot_acquired_date: ''
  });
  const [nextTradeNum, setNextTradeNum] = useState(1);

  // Selection state
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [strategy, setStrategy] = useState('');
  const [tradeNum, setTradeNum] = useState('');
  const [linkedTradeId, setLinkedTradeId] = useState('');
  const [expandedTicker, setExpandedTicker] = useState<string | null>(null);
  const [committing, setCommitting] = useState(false);

  // Search + Sort state
  const [txnSearch, setTxnSearch] = useState('');
  const [txnSortField, setTxnSortField] = useState<TxnSortField>('date');
  const [txnSortDir, setTxnSortDir] = useState<TxnSortDir>('asc');
  const opensScrollRef = useRef<HTMLDivElement>(null);
  const closesScrollRef = useRef<HTMLDivElement>(null);

  const handleTxnSort = (field: TxnSortField) => {
    if (txnSortField === field) setTxnSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setTxnSortField(field); setTxnSortDir(field === 'date' ? 'asc' : 'asc'); }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [opensRes, tradesRes, maxRes, lotsRes, corpActionsRes] = await Promise.all([
        fetch('/api/investment-transactions/opens'),
        fetch('/api/trading-positions/open'),
        fetch('/api/investment-transactions/max-trade-num'),
        fetch('/api/stock-lots?status=OPEN'),
        fetch('/api/corporate-actions')
      ]);
      
      const opensData = await opensRes.json();
      const tradesData = await tradesRes.json();
      const maxData = await maxRes.json();
      const lotsData = await lotsRes.json();
      const corpActionsData = await corpActionsRes.json();
      
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
      setCorporateActions(corpActionsData.actions || []);
      
      setNextTradeNum((maxData.maxTradeNum || 0) + 1);
      
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  };

  // Filter + Sort transactions, then group by ticker
  const filteredOpens = useMemo(() => {
    let result = opens;
    if (txnSearch) result = result.filter(t => matchTxnSearch(t, txnSearch));
    return sortTransactions(result, txnSortField, txnSortDir);
  }, [opens, txnSearch, txnSortField, txnSortDir]);

  const filteredCloses = useMemo(() => {
    let result = closes;
    if (txnSearch) result = result.filter(t => matchTxnSearch(t, txnSearch));
    return sortTransactions(result, txnSortField, txnSortDir);
  }, [closes, txnSearch, txnSortField, txnSortDir]);

  const groupByTicker = (txns: Transaction[]) => {
    const groups: { [ticker: string]: Transaction[] } = {};
    txns.forEach(t => {
      const key = t.underlying || t.ticker || 'UNKNOWN';
      if (!groups[key]) groups[key] = [];
      groups[key].push(t);
    });
    return groups;
  };

  const groupedOpens = useMemo(() => groupByTicker(filteredOpens), [filteredOpens]);
  const groupedCloses = useMemo(() => groupByTicker(filteredCloses), [filteredCloses]);
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

  // Derive ticker from selected transactions for TICKER-XXXX format
  const selectedTicker = useMemo(() => {
    if (selectedTransactions.length === 0) return '';
    const first = selectedTransactions[0];
    return (first.underlying || first.ticker || 'UNKNOWN').toUpperCase();
  }, [selectedTransactions]);

  // Auto-populate tradeNum in TICKER-XXXX format when selection or number changes
  useEffect(() => {
    if (selectedTicker) {
      setTradeNum(`${selectedTicker}-${String(nextTradeNum).padStart(4, '0')}`);
    }
  }, [selectedTicker, nextTradeNum]);

  // Commit OPENS
  const commitOpens = async () => {
    if (selectedIds.size === 0) return alert('Select transactions to commit');
    if (!strategy) return alert('Select a strategy');
    if (!tradeNum) return alert('Enter a trade number');

    // Stock lots use different workflow
    if (strategy === 'stock-long' || strategy === 'stock-short' || strategy === 'crypto') {
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
        alert(`✅ Trade ${tradeNum} OPENED (${result.committed} legs)${skippedCount > 0 ? `\n⚠️ ${skippedCount} skipped` : ''}`);
        clearSelection();
        setNextTradeNum(prev => prev + 1);
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
        alert(`✅ Trade ${result.tradeNum}: Created ${result.committed} stock lot(s) with journal entries`);
        clearSelection();
        // Extract number from returned TICKER-XXXX and increment
        const match = (result.tradeNum || '').match(/-(\d+)$/);
        const returnedNum = match ? parseInt(match[1], 10) : parseInt(result.tradeNum || '0', 10);
        setNextTradeNum(returnedNum + 1);
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

  // Sort header helper for transaction tables
  const TxnSortHeader = ({ label, field, className = '' }: { label: string; field: TxnSortField; className?: string }) => {
    const isActive = txnSortField === field;
    return (
      <th className={`py-1 px-2 text-terminal-xs uppercase tracking-widest font-mono font-semibold cursor-pointer select-none hover:bg-brand-purple-hover transition-colors ${className}`}
        onClick={() => handleTxnSort(field)}>
        <span className="flex items-center gap-1">
          {label}
          {isActive && <span className="text-terminal-xs">{txnSortDir === 'asc' ? '\u25B2' : '\u25BC'}</span>}
        </span>
      </th>
    );
  };

  if (loading) {
    return <div className="p-3 bg-white border border-border rounded"><div className="animate-pulse text-terminal-sm text-text-muted">Loading...</div></div>;
  }

  if (error) {
    return (
      <div className="p-3 bg-red-50 border border-red-200 rounded">
        <div className="text-brand-red">Error: {error}</div>
        <button onClick={fetchData} className="mt-2 text-blue-600 underline">Retry</button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header with Tabs */}
      <div className="flex items-center justify-between px-3 py-1.5 bg-gradient-to-r from-indigo-50 to-purple-50 border-2 border-indigo-200 rounded">
        <div>
          <h3 className="font-semibold text-terminal-lg">Trade Commit Workflow</h3>
          <p className="text-terminal-sm text-text-muted">
            {opens.length} opens • {closes.length} closes • {openTrades.length} open trades • Next #: {nextTradeNum}
          </p>
        </div>
        
        <div className="flex gap-1 bg-white rounded p-1 border border-border">
          <button
            onClick={() => { setActiveTab('opens'); clearSelection(); setTxnSearch(''); }}
            className={`px-4 py-2 rounded text-terminal-sm font-medium transition-colors ${
              activeTab === 'opens' ? 'bg-green-100 text-brand-green' : 'bg-bg-row text-text-muted'
            }`}
          >
            1. Opens ({opens.length})
          </button>
          <button
            onClick={() => { setActiveTab('closes'); clearSelection(); setTxnSearch(''); }}
            className={`px-4 py-2 rounded text-terminal-sm font-medium transition-colors ${
              activeTab === 'closes' ? 'bg-red-100 text-red-700' : 'bg-bg-row text-text-muted'
            }`}
          >
            2. Closes ({closes.length})
          </button>
          <button
            onClick={() => { setActiveTab('trades'); clearSelection(); setTxnSearch(''); }}
            className={`px-4 py-2 rounded text-terminal-sm font-medium transition-colors ${
              activeTab === 'trades' ? 'bg-brand-purple-wash text-brand-purple' : 'bg-bg-row text-text-muted'
            }`}
          >
            3. Trades ({openTrades.length})
          </button>
          <button
            onClick={() => { setActiveTab('corporate-actions'); clearSelection(); setTxnSearch(''); }}
            className={`px-4 py-2 rounded text-terminal-sm font-medium transition-colors ${
              activeTab === 'corporate-actions' ? 'bg-purple-100 text-purple-700' : 'bg-bg-row text-text-muted'
            }`}
          >
            4. Corp Actions ({corporateActions.length})
          </button>
        </div>
      </div>

      {/* OPENS TAB */}
      {activeTab === 'opens' && (
        <>
          {/* Commit Controls */}
          {selectedIds.size > 0 && (
            <div className="p-3 bg-green-50 border border-green-200 rounded sticky top-0 z-10">
              <div className="flex items-center justify-between">
                <div>
                  <span className="font-medium text-terminal-sm">{selectedIds.size} legs selected</span>
                  <span className={`ml-3 font-mono font-semibold ${selectedTotal < 0 ? 'text-brand-green' : 'text-brand-red'}`}>
                    Net: ${Math.abs(selectedTotal).toFixed(2)} {selectedTotal < 0 ? 'CR' : 'DR'}
                  </span>
                </div>
                <div className="flex gap-2 items-center">
                  <select value={strategy} onChange={e => setStrategy(e.target.value)} className="border border-border rounded h-7 px-2 text-terminal-base font-mono">
                    <option value="">Strategy...</option>
                    {STRATEGY_OPTIONS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                  </select>
                  <input
                    type="text"
                    value={tradeNum}
                    onChange={e => setTradeNum(e.target.value)}
                    placeholder="TICK-0001"
                    className="border border-border rounded h-7 px-2 text-terminal-base font-mono w-32 text-center"
                  />
                  <button
                    onClick={commitOpens}
                    disabled={committing || !strategy || !tradeNum}
                    className="px-4 py-2 bg-green-600 text-white rounded text-terminal-sm font-medium hover:bg-green-700 disabled:bg-text-faint"
                  >
                    {committing ? 'Committing...' : 'Open Position'}
                  </button>
                  <button onClick={clearSelection} className="px-3 py-2 text-text-muted hover:text-text-primary text-terminal-sm">Clear</button>
                </div>
              </div>
            </div>
          )}

          {/* Search */}
          <div className="mb-2">
            <input type="text" placeholder="Search by symbol, name, action..."
              value={txnSearch} onChange={e => setTxnSearch(e.target.value)}
              className="w-full h-7 px-2 text-terminal-base font-mono border border-border rounded outline-none focus:border-brand-purple focus:ring-1 focus:ring-brand-purple" />
          </div>

          {/* Opens Table */}
          <div ref={opensScrollRef} className="overflow-auto border border-border rounded" style={{ maxHeight: '500px' }}>
            <table className="w-full text-terminal-base border-collapse min-w-[800px]">
              <thead className="bg-brand-purple text-white/70 sticky top-0 z-10">
                <tr>
                  <th className="py-1 px-2 w-10"></th>
                  <TxnSortHeader label="Date" field="date" className="w-24" />
                  <TxnSortHeader label="Symbol" field="ticker" className="w-20" />
                  <TxnSortHeader label="Action" field="action" className="w-20" />
                  <th className="py-1 px-2 text-terminal-xs uppercase tracking-widest font-mono font-semibold text-left">Details</th>
                  <TxnSortHeader label="Qty" field="quantity" className="w-16 text-right" />
                  <TxnSortHeader label="Price" field="price" className="w-20 text-right" />
                  <TxnSortHeader label="Amount" field="amount" className="w-24 text-right" />
                </tr>
              </thead>
              <tbody>
                {filteredOpens.map((t, i) => {
                  const isSelected = selectedIds.has(t.id);
                  const ticker = t.underlying || t.ticker || 'UNKNOWN';
                  const rowBg = isSelected ? 'bg-brand-purple-wash' : i % 2 === 0 ? 'bg-white' : 'bg-bg-row';
                  return (
                    <tr key={t.id} className={`${rowBg} hover:bg-bg-row cursor-pointer transition-colors border-b border-border-light`}
                      style={{ height: 40 }}
                      onClick={() => toggleSelect(t.id)}>
                      <td className="py-1 px-2">
                        <input type="checkbox" checked={isSelected} onChange={() => toggleSelect(t.id)} className="w-3.5 h-3.5 rounded" />
                      </td>
                      <td className="py-1 px-2 font-mono text-text-muted whitespace-nowrap">
                        {new Date(t.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                      </td>
                      <td className="py-1 px-2 font-medium text-terminal-base text-text-primary">{ticker}</td>
                      <td className="py-1 px-2">
                        <span className={`text-terminal-xs font-medium px-1.5 py-0.5 rounded ${
                          t.action.includes('sell') ? 'bg-orange-100 text-orange-700' : 'bg-brand-purple-wash text-brand-purple'
                        }`}>
                          {t.action.includes('sell') ? 'SELL' : 'BUY'}
                        </span>
                      </td>
                      <td className="py-1 px-2 text-terminal-base text-text-primary">
                        {t.isOption ? (
                          <span className="flex items-center gap-1">
                            <span className="font-mono">${t.strike}</span>
                            <span className={`text-[9px] px-1 rounded ${
                              t.optionType === 'call' ? 'bg-blue-50 text-blue-600' : 'bg-purple-50 text-purple-600'
                            }`}>{t.optionType?.toUpperCase()}</span>
                            <span className="text-text-muted text-terminal-xs">{t.expiration}</span>
                          </span>
                        ) : (
                          <span className="text-text-muted truncate text-terminal-base">{t.name}</span>
                        )}
                      </td>
                      <td className="py-1 px-2 text-right font-mono text-terminal-base text-text-primary">{t.quantity}</td>
                      <td className="py-1 px-2 text-right font-mono text-terminal-base text-text-primary">${t.price?.toFixed(2)}</td>
                      <td className="py-1 px-2 text-right font-mono font-semibold whitespace-nowrap">
                        <span className={t.amount < 0 ? 'text-brand-green' : 'text-brand-red'}>
                          ${Math.abs(t.amount).toFixed(2)}
                          <span className="text-terminal-xs text-text-muted ml-1">{t.amount < 0 ? 'CR' : 'DR'}</span>
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {filteredOpens.length === 0 && (
              <div className="p-8 text-center text-text-muted text-terminal-sm">
                {txnSearch ? 'No opens match your search.' : 'No uncommitted opening transactions.'}
              </div>
            )}
          </div>
          {filteredOpens.length > 0 && (
            <div className="text-terminal-xs text-text-muted mt-1 px-1">
              {filteredOpens.length}{filteredOpens.length !== opens.length ? ` of ${opens.length}` : ''} transactions
              {' \u00B7 '}
              {sortedOpenTickers.length} symbols
            </div>
          )}
        </>
      )}

      {/* CLOSES TAB */}
      {activeTab === 'closes' && (
        <>
          {/* Commit Controls */}
          {selectedIds.size > 0 && (
            <div className="p-3 bg-red-50 border border-red-200 rounded sticky top-0 z-10">
              <div className="flex items-center justify-between">
                <div>
                  <span className="font-medium text-terminal-sm">{selectedIds.size} closing legs selected</span>
                  <span className={`ml-3 font-mono font-semibold ${selectedTotal < 0 ? 'text-brand-green' : 'text-brand-red'}`}>
                    Net: ${Math.abs(selectedTotal).toFixed(2)} {selectedTotal < 0 ? 'CR' : 'DR'}
                  </span>
                </div>
                <div className="flex gap-2 items-center">
                  <select value={linkedTradeId} onChange={e => setLinkedTradeId(e.target.value)} className="border border-border rounded h-7 px-2 text-terminal-base font-mono min-w-[250px]">
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
                    className="px-4 py-2 bg-red-600 text-white rounded text-terminal-sm font-medium hover:bg-red-700 disabled:bg-text-faint"
                  >
                    {committing ? 'Closing...' : 'Close Position'}
                  </button>
                  <button onClick={clearSelection} className="px-3 py-2 text-text-muted hover:text-text-primary text-terminal-sm">Clear</button>
                </div>
              </div>
            </div>
          )}

          {/* Search */}
          <div className="mb-2">
            <input type="text" placeholder="Search by symbol, name, action..."
              value={txnSearch} onChange={e => setTxnSearch(e.target.value)}
              className="w-full h-7 px-2 text-terminal-base font-mono border border-border rounded outline-none focus:border-brand-purple focus:ring-1 focus:ring-brand-purple" />
          </div>

          {/* Closes Table */}
          <div ref={closesScrollRef} className="overflow-auto border border-border rounded" style={{ maxHeight: '500px' }}>
            <table className="w-full text-terminal-base border-collapse min-w-[800px]">
              <thead className="bg-brand-purple text-white/70 sticky top-0 z-10">
                <tr>
                  <th className="py-1 px-2 w-10"></th>
                  <TxnSortHeader label="Date" field="date" className="w-24" />
                  <TxnSortHeader label="Symbol" field="ticker" className="w-20" />
                  <TxnSortHeader label="Action" field="action" className="w-20" />
                  <th className="py-1 px-2 text-terminal-xs uppercase tracking-widest font-mono font-semibold text-left">Details</th>
                  <TxnSortHeader label="Qty" field="quantity" className="w-16 text-right" />
                  <TxnSortHeader label="Price" field="price" className="w-20 text-right" />
                  <TxnSortHeader label="Amount" field="amount" className="w-24 text-right" />
                </tr>
              </thead>
              <tbody>
                {filteredCloses.map((t, i) => {
                  const isSelected = selectedIds.has(t.id);
                  const ticker = t.underlying || t.ticker || 'UNKNOWN';
                  const rowBg = isSelected ? 'bg-brand-purple-wash' : i % 2 === 0 ? 'bg-white' : 'bg-bg-row';
                  return (
                    <tr key={t.id} className={`${rowBg} hover:bg-bg-row cursor-pointer transition-colors border-b border-border-light`}
                      style={{ height: 40 }}
                      onClick={() => toggleSelect(t.id)}>
                      <td className="py-1 px-2">
                        <input type="checkbox" checked={isSelected} onChange={() => toggleSelect(t.id)} className="w-3.5 h-3.5 rounded" />
                      </td>
                      <td className="py-1 px-2 font-mono text-text-muted whitespace-nowrap">
                        {new Date(t.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                      </td>
                      <td className="py-1 px-2 font-medium text-terminal-base text-text-primary">{ticker}</td>
                      <td className="py-1 px-2">
                        <span className={`text-terminal-xs font-medium px-1.5 py-0.5 rounded ${
                          t.action.includes('sell') ? 'bg-orange-100 text-orange-700' :
                          t.action.includes('exercise') || t.action.includes('assignment') ? 'bg-purple-100 text-purple-700' :
                          'bg-brand-purple-wash text-brand-purple'
                        }`}>
                          {t.action.includes('sell') ? 'SELL' :
                           t.action.includes('exercise') ? 'EXERCISE' :
                           t.action.includes('assignment') ? 'ASSIGN' : 'BUY'}
                        </span>
                      </td>
                      <td className="py-1 px-2 text-terminal-base text-text-primary">
                        {t.isOption ? (
                          <span className="flex items-center gap-1">
                            <span className="font-mono">${t.strike}</span>
                            <span className={`text-[9px] px-1 rounded ${
                              t.optionType === 'call' ? 'bg-blue-50 text-blue-600' : 'bg-purple-50 text-purple-600'
                            }`}>{t.optionType?.toUpperCase()}</span>
                            <span className="text-text-muted text-terminal-xs">{t.expiration}</span>
                          </span>
                        ) : (
                          <span className="text-text-muted truncate text-terminal-base">{t.name}</span>
                        )}
                      </td>
                      <td className="py-1 px-2 text-right font-mono text-terminal-base text-text-primary">{t.quantity}</td>
                      <td className="py-1 px-2 text-right font-mono text-terminal-base text-text-primary">${t.price?.toFixed(2)}</td>
                      <td className="py-1 px-2 text-right font-mono font-semibold whitespace-nowrap">
                        <span className={t.amount < 0 ? 'text-brand-green' : 'text-brand-red'}>
                          ${Math.abs(t.amount).toFixed(2)}
                          <span className="text-terminal-xs text-text-muted ml-1">{t.amount < 0 ? 'CR' : 'DR'}</span>
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {filteredCloses.length === 0 && (
              <div className="p-8 text-center text-text-muted text-terminal-sm">
                {txnSearch ? 'No closes match your search.' : 'No uncommitted closing transactions.'}
              </div>
            )}
          </div>
          {filteredCloses.length > 0 && (
            <div className="text-terminal-xs text-text-muted mt-1 px-1">
              {filteredCloses.length}{filteredCloses.length !== closes.length ? ` of ${closes.length}` : ''} transactions
              {' \u00B7 '}
              {sortedCloseTickers.length} symbols
            </div>
          )}
        </>
      )}

      {/* TRADES TAB */}
      {activeTab === 'trades' && (
        <div>
          {openTrades.length === 0 ? (
            <div className="p-8 text-center text-text-muted bg-bg-row rounded text-terminal-sm">
              No open trades. Commit some opening positions first.
            </div>
          ) : (
            <div className="overflow-auto border border-border rounded">
              <table className="w-full text-terminal-base border-collapse min-w-[700px]">
                <thead className="bg-brand-purple text-white/70 sticky top-0 z-10">
                  <tr>
                    <th className="py-1 px-2 text-terminal-xs uppercase tracking-widest font-mono text-left font-semibold">Trade #</th>
                    <th className="py-1 px-2 text-terminal-xs uppercase tracking-widest font-mono text-left font-semibold">Symbol</th>
                    <th className="py-1 px-2 text-terminal-xs uppercase tracking-widest font-mono text-left font-semibold">Strategy</th>
                    <th className="py-1 px-2 text-terminal-xs uppercase tracking-widest font-mono text-left font-semibold">Status</th>
                    <th className="py-1 px-2 text-terminal-xs uppercase tracking-widest font-mono text-left font-semibold">Opened</th>
                    <th className="py-1 px-2 text-terminal-xs uppercase tracking-widest font-mono text-right font-semibold">Cost Basis</th>
                    <th className="py-1 px-2 text-terminal-xs uppercase tracking-widest font-mono text-center font-semibold">Legs</th>
                    <th className="py-1 px-2 text-terminal-xs uppercase tracking-widest font-mono text-left font-semibold">Leg Details</th>
                  </tr>
                </thead>
                <tbody>
                  {openTrades.map((trade, i) => (
                    <tr key={trade.id} className={`${i % 2 === 0 ? 'bg-white' : 'bg-bg-row'} hover:bg-bg-row transition-colors border-b border-border-light`}>
                      <td className="py-1 px-2 font-mono font-bold text-brand-purple">#{trade.trade_num}</td>
                      <td className="py-1 px-2 font-medium text-terminal-base text-text-primary">{trade.symbol}</td>
                      <td className="py-1 px-2">
                        <span className="text-terminal-xs font-medium px-1.5 py-0.5 rounded bg-brand-purple-wash text-brand-purple">
                          {trade.strategy}
                        </span>
                      </td>
                      <td className="py-1 px-2">
                        <span className={`text-terminal-xs font-medium px-1.5 py-0.5 rounded ${
                          trade.status === 'OPEN' ? 'bg-green-100 text-brand-green' : 'bg-bg-row text-text-muted'
                        }`}>{trade.status}</span>
                      </td>
                      <td className="py-1 px-2 font-mono text-text-muted">
                        {new Date(trade.open_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: '2-digit' })}
                      </td>
                      <td className="py-1 px-2 text-right font-mono font-semibold">
                        ${trade.cost_basis.toFixed(2)}
                      </td>
                      <td className="py-1 px-2 text-center font-mono text-text-muted">
                        {trade.legs?.length || 0}
                      </td>
                      <td className="py-1 px-2 text-text-muted">
                        {trade.legs && trade.legs.length > 0 ? (
                          <div className="flex flex-wrap gap-1">
                            {trade.legs.map((leg, li) => (
                              <span key={li} className={`text-[9px] px-1.5 py-0.5 rounded ${
                                leg.option_type === 'call' ? 'bg-blue-50 text-blue-600' : 'bg-purple-50 text-purple-600'
                              }`}>
                                {leg.quantity}x ${leg.strike_price} {leg.option_type?.toUpperCase()} {leg.expiration_date ? new Date(leg.expiration_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : ''}
                              </span>
                            ))}
                          </div>
                        ) : (
                          <span className="text-text-muted">{'\u2014'}</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* CORPORATE ACTIONS TAB */}
      {activeTab === 'corporate-actions' && (
        <>
          <div className="mb-4">
            <button
              onClick={() => setShowCorpActionModal(true)}
              className="px-4 py-2 bg-purple-600 text-white rounded text-terminal-sm font-medium hover:bg-purple-700"
            >
              + Record Corporate Action
            </button>
          </div>

          <div className="space-y-3">
            <h3 className="font-semibold text-text-primary">Corporate Actions History</h3>
            {corporateActions.length === 0 ? (
              <div className="p-8 text-center text-text-muted bg-bg-row rounded text-terminal-sm">
                <p>No corporate actions recorded.</p>
                <p className="text-terminal-sm mt-2">Stock splits, dividends, mergers, and spinoffs will appear here.</p>
              </div>
            ) : (
              corporateActions.map((action: any) => (
                <div key={action.id} className="border border-border rounded p-3 bg-white">
                  <div className="flex justify-between items-start">
                    <div>
                      <span className="font-bold text-terminal-lg">{action.symbol}</span>
                      <span className={`ml-2 text-terminal-xs px-2 py-0.5 rounded ${
                        action.action_type === 'REVERSE_SPLIT' ? 'bg-orange-100 text-orange-700' :
                        action.action_type === 'SPLIT' ? 'bg-green-100 text-brand-green' :
                        'bg-bg-row text-text-muted'
                      }`}>
                        {action.action_type.replace('_', ' ')}
                      </span>
                    </div>
                    <div className="text-right text-terminal-sm text-text-muted">
                      {new Date(action.effective_date).toLocaleDateString()}
                    </div>
                  </div>
                  <div className="mt-2 grid grid-cols-2 gap-4 text-terminal-sm">
                    <div>
                      <span className="text-text-muted">Ratio:</span>
                      <span className="ml-2 font-medium">{action.ratio_from}:{action.ratio_to}</span>
                    </div>
                    {action.pre_split_shares && (
                      <div>
                        <span className="text-text-muted">Shares:</span>
                        <span className="ml-2 font-medium">{action.pre_split_shares} → {action.post_split_shares}</span>
                      </div>
                    )}
                  </div>
                  {action.notes && (
                    <div className="mt-2 text-terminal-sm text-text-muted italic">&quot;{action.notes}&quot;</div>
                  )}
                  {action.source && (
                    <div className="mt-1 text-terminal-xs text-text-muted">Source: {action.source}</div>
                  )}
                </div>
              ))
            )}
          </div>

          {showCorpActionModal && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
              <div className="bg-white rounded p-3 w-full max-w-lg max-h-[90vh] overflow-y-auto">
                <h2 className="text-sm font-bold mb-4">Record Corporate Action</h2>
                
                <div className="space-y-4">
                  <div>
                    <label className="block text-terminal-sm font-medium text-text-primary mb-1">Symbol *</label>
                    <input
                      type="text"
                      value={corpActionForm.symbol}
                      onChange={e => setCorpActionForm({...corpActionForm, symbol: e.target.value.toUpperCase()})}
                      className="w-full border border-border rounded h-7 px-2 text-terminal-base font-mono"
                      placeholder="e.g., UAVS"
                    />
                  </div>

                  <div>
                    <label className="block text-terminal-sm font-medium text-text-primary mb-1">Action Type *</label>
                    <select
                      value={corpActionForm.action_type}
                      onChange={e => setCorpActionForm({...corpActionForm, action_type: e.target.value})}
                      className="w-full border border-border rounded h-7 px-2 text-terminal-base font-mono"
                    >
                      <option value="REVERSE_SPLIT">Reverse Split (fewer shares)</option>
                      <option value="SPLIT">Forward Split (more shares)</option>
                      <option value="STOCK_DIVIDEND">Stock Dividend</option>
                      <option value="MERGER">Merger</option>
                      <option value="SPINOFF">Spinoff</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-terminal-sm font-medium text-text-primary mb-1">Effective Date *</label>
                    <input
                      type="date"
                      value={corpActionForm.effective_date}
                      onChange={e => setCorpActionForm({...corpActionForm, effective_date: e.target.value})}
                      className="w-full border border-border rounded h-7 px-2 text-terminal-base font-mono"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-terminal-sm font-medium text-text-primary mb-1">Ratio From *</label>
                      <input
                        type="number"
                        value={corpActionForm.ratio_from}
                        onChange={e => setCorpActionForm({...corpActionForm, ratio_from: parseInt(e.target.value) || 1})}
                        className="w-full border border-border rounded h-7 px-2 text-terminal-base font-mono"
                        min="1"
                      />
                    </div>
                    <div>
                      <label className="block text-terminal-sm font-medium text-text-primary mb-1">Ratio To *</label>
                      <input
                        type="number"
                        value={corpActionForm.ratio_to}
                        onChange={e => setCorpActionForm({...corpActionForm, ratio_to: parseInt(e.target.value) || 1})}
                        className="w-full border border-border rounded h-7 px-2 text-terminal-base font-mono"
                        min="1"
                      />
                    </div>
                  </div>
                  <p className="text-terminal-xs text-text-muted -mt-2">
                    For 1:50 reverse split, enter 1 and 50. For 2:1 forward split, enter 2 and 1.
                  </p>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-terminal-sm font-medium text-text-primary mb-1">Pre-Split Shares</label>
                      <input
                        type="number"
                        value={corpActionForm.pre_split_shares}
                        onChange={e => setCorpActionForm({...corpActionForm, pre_split_shares: e.target.value})}
                        className="w-full border border-border rounded h-7 px-2 text-terminal-base font-mono"
                        placeholder="e.g., 555"
                        step="0.0001"
                      />
                    </div>
                    <div>
                      <label className="block text-terminal-sm font-medium text-text-primary mb-1">Post-Split Shares</label>
                      <input
                        type="number"
                        value={corpActionForm.post_split_shares}
                        onChange={e => setCorpActionForm({...corpActionForm, post_split_shares: e.target.value})}
                        className="w-full border border-border rounded h-7 px-2 text-terminal-base font-mono"
                        placeholder="e.g., 11.1"
                        step="0.0001"
                      />
                    </div>
                  </div>

                  <div className="border-t pt-4">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={corpActionForm.add_pre_split_lot}
                        onChange={e => setCorpActionForm({...corpActionForm, add_pre_split_lot: e.target.checked})}
                        className="rounded"
                      />
                      <span className="text-terminal-sm font-medium text-text-primary">Add missing pre-split lot</span>
                    </label>
                    <p className="text-terminal-xs text-text-muted mt-1 ml-6">
                      Check this if you had shares before the split that are not in the system yet.
                    </p>
                  </div>

                  {corpActionForm.add_pre_split_lot && (
                    <div className="ml-6 space-y-3 p-3 bg-bg-row rounded">
                      <div>
                        <label className="block text-terminal-sm font-medium text-text-primary mb-1">Original Cost Basis ($)</label>
                        <input
                          type="number"
                          value={corpActionForm.lot_cost_basis}
                          onChange={e => setCorpActionForm({...corpActionForm, lot_cost_basis: parseFloat(e.target.value) || 0})}
                          className="w-full border border-border rounded h-7 px-2 text-terminal-base font-mono"
                          placeholder="0 if unknown"
                          step="0.01"
                        />
                        <p className="text-terminal-xs text-text-muted mt-1">Enter $0 if original cost is unknown.</p>
                      </div>
                      <div>
                        <label className="block text-terminal-sm font-medium text-text-primary mb-1">Original Acquisition Date</label>
                        <input
                          type="date"
                          value={corpActionForm.lot_acquired_date}
                          onChange={e => setCorpActionForm({...corpActionForm, lot_acquired_date: e.target.value})}
                          className="w-full border border-border rounded h-7 px-2 text-terminal-base font-mono"
                        />
                        <p className="text-terminal-xs text-text-muted mt-1">Leave blank to use split date.</p>
                      </div>
                    </div>
                  )}

                  <div>
                    <label className="block text-terminal-sm font-medium text-text-primary mb-1">Notes</label>
                    <input
                      type="text"
                      value={corpActionForm.notes}
                      onChange={e => setCorpActionForm({...corpActionForm, notes: e.target.value})}
                      className="w-full border border-border rounded h-7 px-2 text-terminal-base font-mono"
                      placeholder="e.g., 1:50 reverse split per SEC filing"
                    />
                  </div>
                  <div>
                    <label className="block text-terminal-sm font-medium text-text-primary mb-1">Source Documentation</label>
                    <input
                      type="text"
                      value={corpActionForm.source}
                      onChange={e => setCorpActionForm({...corpActionForm, source: e.target.value})}
                      className="w-full border border-border rounded h-7 px-2 text-terminal-base font-mono"
                      placeholder="e.g., Broker statement - Robinhood"
                    />
                  </div>
                </div>

                <div className="flex gap-3 mt-6">
                  <button
                    onClick={() => {
                      setShowCorpActionModal(false);
                      setCorpActionForm({
                        symbol: '', action_type: 'REVERSE_SPLIT', effective_date: '',
                        ratio_from: 1, ratio_to: 1, pre_split_shares: '', post_split_shares: '',
                        notes: '', source: '', add_pre_split_lot: false, lot_cost_basis: 0, lot_acquired_date: ''
                      });
                    }}
                    className="flex-1 px-4 py-2 border border-border rounded text-terminal-sm text-text-primary hover:bg-bg-row"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={async () => {
                      if (!corpActionForm.symbol || !corpActionForm.effective_date) {
                        alert('Symbol and Effective Date are required');
                        return;
                      }
                      try {
                        const res = await fetch('/api/corporate-actions', {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({
                            ...corpActionForm,
                            pre_split_shares: corpActionForm.pre_split_shares ? parseFloat(String(corpActionForm.pre_split_shares)) : undefined,
                            post_split_shares: corpActionForm.post_split_shares ? parseFloat(String(corpActionForm.post_split_shares)) : undefined,
                            lot_acquired_date: corpActionForm.lot_acquired_date || corpActionForm.effective_date
                          })
                        });
                        const result = await res.json();
                        if (result.success) {
                          alert('Corporate action recorded successfully');
                          setShowCorpActionModal(false);
                          setCorpActionForm({
                            symbol: '', action_type: 'REVERSE_SPLIT', effective_date: '',
                            ratio_from: 1, ratio_to: 1, pre_split_shares: '', post_split_shares: '',
                            notes: '', source: '', add_pre_split_lot: false, lot_cost_basis: 0, lot_acquired_date: ''
                          });
                          await fetchData();
                          await onReload();
                        } else {
                          alert('Error: ' + result.error);
                        }
                      } catch (err) {
                        alert('Failed: ' + (err instanceof Error ? err.message : 'Unknown error'));
                      }
                    }}
                    className="flex-1 px-4 py-2 bg-purple-600 text-white rounded text-terminal-sm font-medium hover:bg-purple-700"
                  >
                    Record Corporate Action
                  </button>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
