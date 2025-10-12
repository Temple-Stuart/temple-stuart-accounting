'use client';

import { useState } from 'react';
import CommittedInvestmentsTable from "./CommittedInvestmentsTable";

interface InvestmentsTabProps {
  investmentTransactions: any[];
  committedInvestments: any[];
  onReload: () => Promise<void>;
}

export default function InvestmentsTab({ investmentTransactions, committedInvestments, onReload }: InvestmentsTabProps) {
  const [dateFilter, setDateFilter] = useState<string>('');
  const [symbolFilter, setSymbolFilter] = useState<string>('');
  const [positionFilter, setPositionFilter] = useState<string>('');
  const [investmentRowChanges, setInvestmentRowChanges] = useState<{[key: string]: {strategy?: string; coa?: string; sub?: string; tradeNum?: string}}>({});
  const [selectedCommittedInvestments, setSelectedCommittedInvestments] = useState<string[]>([]);

  const commitSelectedInvestmentRows = async () => {
    const updates = Object.entries(investmentRowChanges).filter(([id, values]) => values.coa && values.strategy);
    if (updates.length === 0) {
      alert('Investments need both Strategy and COA assigned');
      return;
    }
    try {
      const transactionIds = updates.map(([id]) => id);
      const firstUpdate = updates[0][1];
      
      const res = await fetch('/api/investment-transactions/commit-to-ledger', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          transactionIds,
          accountCode: firstUpdate.coa,
          subAccount: firstUpdate.sub || null,
          strategy: firstUpdate.strategy,
          tradeNum: firstUpdate.tradeNum || null
        })
      });
      
      const result = await res.json();
      
      if (result.success) {
        await onReload();
        setInvestmentRowChanges({});
        alert(`✅ Committed ${result.committed} investments with journal entries`);
      } else {
        alert(`❌ Errors: ${result.errors.length}`);
      }
    } catch (error) {
      alert('Failed to commit investment transactions');
    }
  };

  const massUncommitInvestments = async () => {
    if (selectedCommittedInvestments.length === 0) {
      alert('Select investment transactions to uncommit');
      return;
    }
    try {
      for (const txnId of selectedCommittedInvestments) {
        await fetch('/api/investment-transactions/assign-coa', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            transactionIds: [txnId],
            accountCode: null,
            subAccount: null,
            tradeNum: null,
            strategy: null
          })
        });
      }
      await onReload();
      setSelectedCommittedInvestments([]);
      alert(`✅ Uncommitted ${selectedCommittedInvestments.length} investment transactions`);
    } catch (error) {
      alert('Failed to uncommit');
    }
  };

  return (
    <>
      <div className="space-y-4">
        <div className="flex gap-3 p-4 bg-white border rounded-lg">
          <div className="flex-1">
            <label className="block text-xs font-medium text-gray-700 mb-1">Date</label>
            <input 
              type="date"
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value)}
              className="w-full px-3 py-2 border rounded-md text-sm"
            />
          </div>
          <div className="flex-1">
            <label className="block text-xs font-medium text-gray-700 mb-1">Symbol</label>
            <input 
              type="text"
              placeholder="e.g. INTC, SPY"
              value={symbolFilter}
              onChange={(e) => setSymbolFilter(e.target.value.toUpperCase())}
              className="w-full px-3 py-2 border rounded-md text-sm"
            />
          </div>
          <div className="flex-1">
            <label className="block text-xs font-medium text-gray-700 mb-1">Position</label>
            <select
              value={positionFilter}
              onChange={(e) => setPositionFilter(e.target.value)}
              className="w-full px-3 py-2 border rounded-md text-sm"
            >
              <option value="">All Positions</option>
              <option value="open">Open</option>
              <option value="close">Close</option>
            </select>
          </div>
        </div>
        
        <div className="p-4 bg-gray-50 flex justify-between items-center">
          <span className="text-sm">Investment Transactions: {investmentTransactions.filter((txn: any) => new Date(txn.date) >= new Date("2025-06-10")).length} uncommitted, {committedInvestments.length} committed</span>
          <button 
            onClick={commitSelectedInvestmentRows}
            className="px-4 py-2 bg-blue-600 text-white rounded text-sm"
          >
            Commit Investments
          </button>
        </div>
      </div>
      
      <div className="overflow-auto" style={{maxHeight: '600px'}}>
        <table className="w-full text-xs">
          <thead className="bg-gray-50 sticky top-0">
            <tr>
              <th className="px-2 py-2 text-left">Date</th>
              <th className="px-2 py-2 text-left">Symbol</th>
              <th className="px-2 py-2 text-left">Name</th>
              <th className="px-2 py-2 text-left">Type</th>
              <th className="px-2 py-2 text-left">Subtype</th>
              <th className="px-2 py-2 text-left">Position</th>
              <th className="px-2 py-2 text-right">Qty</th>
              <th className="px-2 py-2 text-right">Price</th>
              <th className="px-2 py-2 text-right">Amount</th>
              <th className="px-2 py-2 text-right">Fees</th>
              <th className="px-2 py-2 text-left bg-yellow-50 min-w-[120px]">Strategy</th>
              <th className="px-2 py-2 text-left bg-yellow-50 min-w-[180px]">COA</th>
              <th className="px-2 py-2 text-center bg-blue-50 min-w-[60px]">Trade #</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {investmentTransactions.filter(txn => {
              const txnDate = new Date(txn.date).toISOString().split('T')[0];
              const symbol = txn.name?.split(' ').find((part: string) => part.match(/^[A-Z]+$/)) || '';
              const position = txn.name?.toLowerCase().includes('close') ? 'close' : 'open';
              
              const cutoffDate = new Date("2025-06-10");
              const transactionDate = new Date(txn.date);
              return transactionDate >= cutoffDate &&
                     (!dateFilter || txnDate === dateFilter) &&
                     (!symbolFilter || symbol.includes(symbolFilter)) &&
                     (!positionFilter || position === positionFilter);
            }).map((txn: any) => {
              const txnId = txn.id || txn.investment_transaction_id;
              let symbol = '-';
              const nameParts = txn.name?.split(' ') || [];
              for (let j = 0; j < nameParts.length; j++) {
                if (nameParts[j].match(/^[A-Z]+$/)) {
                  symbol = nameParts[j];
                  break;
                }
              }
              if (symbol === '-' && txn.security?.ticker_symbol) {
                symbol = txn.security.ticker_symbol;
              }

              return (
                <tr key={txnId} className="hover:bg-gray-50">
                  <td className="px-2 py-2">{new Date(txn.date).toLocaleDateString()}</td>
                  <td className="px-2 py-2 font-medium">{symbol}</td>
                  <td className="px-2 py-2">{txn.name}</td>
                  <td className="px-2 py-2">{txn.type}</td>
                  <td className="px-2 py-2">{txn.subtype}</td>
                  <td className="px-2 py-2">
                    <span className={`px-2 py-1 rounded text-xs ${
                      txn.name?.toLowerCase().includes('close') ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'
                    }`}>
                      {txn.name?.toLowerCase().includes('close') ? 'Close' : 'Open'}
                    </span>
                  </td>
                  <td className="px-2 py-2 text-right">{txn.quantity || '-'}</td>
                  <td className="px-2 py-2 text-right">${txn.price || 0}</td>
                  <td className={`px-2 py-2 text-right font-medium ${
                    txn.amount < 0 ? 'text-red-600' : 'text-green-600'
                  }`}>
                    ${Math.abs(txn.amount || 0).toFixed(2)}
                  </td>
                  <td className="px-2 py-2 text-right">${txn.fees || 0}</td>
                  <td className="px-2 py-1 bg-yellow-50">
                    <select 
                      value={investmentRowChanges[txnId]?.strategy || ""}
                      onChange={(e) => setInvestmentRowChanges(prev => ({
                        ...prev,
                        [txnId]: {...(prev[txnId] || {}), strategy: e.target.value}
                      }))}
                      className="text-xs border rounded px-1 py-0.5 w-full">
                      <option value="">Select</option>
                      <optgroup label="Credit Spreads">
                        <option value="call-credit">Call Credit</option>
                        <option value="put-credit">Put Credit</option>
                        <option value="iron-condor">Iron Condor</option>
                      </optgroup>
                      <optgroup label="Debit Spreads">
                        <option value="call-debit">Call Debit</option>
                        <option value="put-debit">Put Debit</option>
                      </optgroup>
                      <optgroup label="Volatility">
                        <option value="straddle">Straddle</option>
                        <option value="strangle">Strangle</option>
                      </optgroup>
                      <optgroup label="Single Options">
                        <option value="long-call">Long Call</option>
                        <option value="long-put">Long Put</option>
                        <option value="short-call">Short Call</option>
                        <option value="short-put">Short Put</option>
                        <option value="covered-call">Covered Call</option>
                        <option value="csp">Cash Secured Put</option>
                      </optgroup>
                      <optgroup label="Stock">
                        <option value="buy">Buy Stock</option>
                        <option value="sell">Sell Stock</option>
                      </optgroup>
                    </select>
                  </td>
                  <td className="px-2 py-1 bg-yellow-50">
                    <select 
                      value={investmentRowChanges[txnId]?.coa || ''}
                      onChange={(e) => setInvestmentRowChanges(prev => ({
                        ...prev,
                        [txnId]: {...(prev[txnId] || {}), coa: e.target.value}
                      }))}
                      className="text-xs border rounded px-1 py-0.5 w-full">
                        <option value="">- Select COA -</option>
                      <optgroup label="Income (Credit received)">
                        <option value="P-4100">P-4100 - Options Trading Income</option>
                        <option value="P-4400">P-4400 - Dividend Income</option>
                      </optgroup>
                      <optgroup label="Losses (Debit paid)">
                        <option value="P-5100">P-5100 - Options Trading Losses</option>
                      </optgroup>
                      <optgroup label="Assets (Holdings)">
                        <option value="P-1210">P-1210 - Options Positions - Open</option>
                        <option value="P-1250">P-1250 - Stock Investment</option>
                        <option value="P-1300">P-1300 - Cryptocurrency</option>
                      </optgroup>
                      <optgroup label="Liabilities (Written)">
                        <option value="P-2100">P-2100 - Options Positions - Written</option>
                      </optgroup>
                      <optgroup label="Fees">
                        <option value="P-5200">P-5200 - Brokerage Commissions & Fees</option>
                      </optgroup>
                    </select>
                  </td>
                  <td className="px-2 py-1 bg-blue-50">
                    <input
                      type="text"
                      value={investmentRowChanges[txnId]?.tradeNum || ""}
                      onChange={(e) => setInvestmentRowChanges(prev => ({
                        ...prev,
                        [txnId]: {...(prev[txnId] || {}), tradeNum: e.target.value}
                      }))}
                      className="text-xs border rounded px-1 py-0.5 w-full text-center"
                      placeholder="#"
                    />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <div className="p-4 bg-gray-50 text-sm">
          Total Investment Transactions: {investmentTransactions.filter((txn: any) => new Date(txn.date) >= new Date("2025-06-10")).length}
        </div>
      </div>

      <CommittedInvestmentsTable 
        committedInvestments={committedInvestments}
        selectedCommittedInvestments={selectedCommittedInvestments}
        setSelectedCommittedInvestments={setSelectedCommittedInvestments}
        massUncommitInvestments={massUncommitInvestments}
      />
    </>
  );
}
