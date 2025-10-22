'use client';

import { useState, useEffect } from 'react';

interface Trade {
  tradeNum: string;
  strategy: string;
  symbol: string;
  entryDate: string;
  exitDate: string;
  legs: number;
  totalPL: number;
  totalFees: number;
  netPL: number;
  isWinner: boolean;
  trades: any[];
}

export default function TradingJournalTab() {
  const [trades, setTrades] = useState<Trade[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedTrade, setExpandedTrade] = useState<string | null>(null);

  useEffect(() => {
    loadTrades();
  }, []);

  const loadTrades = async () => {
    try {
      const res = await fetch('/api/trading-journal');
      const data = await res.json();
      setTrades(data);
    } catch (error) {
      console.error('Failed to load trading journal:', error);
    } finally {
      setLoading(false);
    }
  };

  const totalTrades = trades.length;
  const winners = trades.filter(t => t.isWinner).length;
  const losers = trades.filter(t => !t.isWinner).length;
  const winRate = totalTrades > 0 ? ((winners / totalTrades) * 100).toFixed(1) : '0.0';
  const totalNetPL = trades.reduce((sum, t) => sum + t.netPL, 0);

  if (loading) {
    return <div className="p-4">Loading trading journal...</div>;
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-4 gap-4">
        <div className="p-4 bg-white border rounded-lg">
          <div className="text-sm text-gray-600">Total Trades</div>
          <div className="text-2xl font-bold">{totalTrades}</div>
        </div>
        <div className="p-4 bg-white border rounded-lg">
          <div className="text-sm text-gray-600">Win Rate</div>
          <div className="text-2xl font-bold">{winRate}%</div>
          <div className="text-xs text-gray-500">{winners}W / {losers}L</div>
        </div>
        <div className="p-4 bg-white border rounded-lg">
          <div className="text-sm text-gray-600">Total P&L</div>
          <div className={`text-2xl font-bold ${totalNetPL >= 0 ? 'text-green-600' : 'text-red-600'}`}>
            ${totalNetPL.toFixed(2)}
          </div>
        </div>
        <div className="p-4 bg-white border rounded-lg">
          <div className="text-sm text-gray-600">Avg P&L per Trade</div>
          <div className={`text-2xl font-bold ${totalNetPL >= 0 ? 'text-green-600' : 'text-red-600'}`}>
            ${totalTrades > 0 ? (totalNetPL / totalTrades).toFixed(2) : '0.00'}
          </div>
        </div>
      </div>

      <div className="bg-white border rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left">Trade #</th>
              <th className="px-4 py-3 text-left">Symbol</th>
              <th className="px-4 py-3 text-left">Strategy</th>
              <th className="px-4 py-3 text-left">Entry Date</th>
              <th className="px-4 py-3 text-left">Exit Date</th>
              <th className="px-4 py-3 text-center">Legs</th>
              <th className="px-4 py-3 text-right">Fees</th>
              <th className="px-4 py-3 text-right">Net P&L</th>
              <th className="px-4 py-3 text-center">Result</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {trades.map(trade => (
              <>
                <tr 
                  key={trade.tradeNum}
                  className="hover:bg-gray-50 cursor-pointer"
                  onClick={() => setExpandedTrade(expandedTrade === trade.tradeNum ? null : trade.tradeNum)}
                >
                  <td className="px-4 py-3 font-medium">{trade.tradeNum}</td>
                  <td className="px-4 py-3">{trade.symbol}</td>
                  <td className="px-4 py-3">
                    <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded text-xs">
                      {trade.strategy}
                    </span>
                  </td>
                  <td className="px-4 py-3">{new Date(trade.entryDate).toLocaleDateString()}</td>
                  <td className="px-4 py-3">{new Date(trade.exitDate).toLocaleDateString()}</td>
                  <td className="px-4 py-3 text-center">{trade.legs}</td>
                  <td className="px-4 py-3 text-right">${Math.abs(trade.totalFees).toFixed(2)}</td>
                  <td className={`px-4 py-3 text-right font-bold ${trade.netPL >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    ${trade.netPL.toFixed(2)}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                      trade.isWinner ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                    }`}>
                      {trade.isWinner ? 'WIN' : 'LOSS'}
                    </span>
                  </td>
                </tr>
                {expandedTrade === trade.tradeNum && (
                  <tr>
                    <td colSpan={9} className="px-4 py-4 bg-gray-50">
                      <div className="text-xs font-semibold mb-2">Trade Legs:</div>
                      <table className="w-full text-xs">
                        <thead className="bg-white">
                          <tr>
                            <th className="px-2 py-1 text-left">Date</th>
                            <th className="px-2 py-1 text-left">Description</th>
                            <th className="px-2 py-1 text-right">Qty</th>
                            <th className="px-2 py-1 text-right">Price</th>
                            <th className="px-2 py-1 text-right">Amount</th>
                            <th className="px-2 py-1 text-right">Fees</th>
                          </tr>
                        </thead>
                        <tbody>
                          {trade.trades.map((leg: any) => (
                            <tr key={leg.id} className="border-t">
                              <td className="px-2 py-1">{new Date(leg.date).toLocaleDateString()}</td>
                              <td className="px-2 py-1">{leg.name}</td>
                              <td className="px-2 py-1 text-right">{leg.quantity || '-'}</td>
                              <td className="px-2 py-1 text-right">${leg.price || 0}</td>
                              <td className={`px-2 py-1 text-right ${leg.amount >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                ${leg.amount.toFixed(2)}
                              </td>
                              <td className="px-2 py-1 text-right">${leg.fees || 0}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </td>
                  </tr>
                )}
              </>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
