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
  
  // PDF Upload state
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [uploadFiles, setUploadFiles] = useState<File[]>([]);
  const [uploadProgress, setUploadProgress] = useState({ current: 0, total: 0 });
  const [matchedData, setMatchedData] = useState<any[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);

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

  const handlePDFUpload = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    
    const fileArray = Array.from(files);
    setUploadFiles(fileArray);
    setIsProcessing(true);
    setUploadProgress({ current: 0, total: fileArray.length });

    try {
      const formData = new FormData();
      fileArray.forEach(file => formData.append('pdfs', file));

      const res = await fetch('/api/investment-transactions/upload-pdfs', {
        method: 'POST',
        body: formData
      });

      const result = await res.json();
      
      if (result.success) {
        setMatchedData(result.matches);
        setUploadProgress({ current: result.processed, total: result.total });
        alert(`✅ Processed ${result.processed} PDFs`);
      } else {
        alert(`❌ Error: ${result.error}`);
      }
    } catch (error) {
      alert('Failed to upload PDFs');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <>
      {/* Upload Modal */}
      {showUploadModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-2xl w-full mx-4">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold">Upload Robinhood Trade Confirmations</h3>
              <button onClick={() => setShowUploadModal(false)} className="text-gray-500 hover:text-gray-700">✕</button>
            </div>
            
            <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center">
              <input
                type="file"
                accept=".pdf"
                multiple
                onChange={(e) => handlePDFUpload(e.target.files)}
                className="hidden"
                id="pdf-upload"
                disabled={isProcessing}
              />
              <label htmlFor="pdf-upload" className="cursor-pointer">
                <div className="text-4xl mb-2">📄</div>
                <div className="text-sm text-gray-600">
                  {isProcessing ? (
                    <>Processing {uploadProgress.current} / {uploadProgress.total} PDFs...</>
                  ) : (
                    <>Click to upload or drag and drop<br/>Robinhood trade confirmation PDFs</>
                  )}
                </div>
              </label>
            </div>

            {matchedData.length > 0 && (
              <div className="mt-4 max-h-96 overflow-auto">
                <h4 className="font-medium mb-2">Matched Transactions ({matchedData.length})</h4>
                <table className="w-full text-xs">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-2 py-1 text-left">Symbol</th>
                      <th className="px-2 py-1 text-left">Date</th>
                      <th className="px-2 py-1 text-right">RH Qty</th>
                      <th className="px-2 py-1 text-right">RH Fees</th>
                      <th className="px-2 py-1 text-center">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {matchedData.map((match, idx) => (
                      <tr key={idx}>
                        <td className="px-2 py-1">{match.robinhoodData.symbol}</td>
                        <td className="px-2 py-1">{new Date(match.robinhoodData.tradeDate).toLocaleDateString()}</td>
                        <td className="px-2 py-1 text-right">{match.robinhoodData.quantity}</td>
                        <td className="px-2 py-1 text-right">${match.robinhoodData.fees?.toFixed(2)}</td>
                        <td className="px-2 py-1 text-center">
                          {match.matchStatus === 'matched' && '✅'}
                          {match.matchStatus === 'fee_mismatch' && '⚠️'}
                          {match.matchStatus === 'missing_from_plaid' && '❌'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <div className="mt-4 flex justify-end gap-2">
              <button
                onClick={() => setShowUploadModal(false)}
                className="px-4 py-2 border rounded text-sm"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

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
          <div className="flex items-end">
            <button
              onClick={() => setShowUploadModal(true)}
              className="px-4 py-2 bg-purple-600 text-white rounded text-sm hover:bg-purple-700 whitespace-nowrap"
            >
              📄 Upload RH PDFs
            </button>
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
              <th className="px-2 py-2 text-right bg-purple-50">Strike</th>
              <th className="px-2 py-2 text-left bg-purple-50">Expiry</th>
              <th className="px-2 py-2 text-center bg-purple-50">Type</th>
              <th className="px-2 py-2 text-left">Name</th>
              <th className="px-2 py-2 text-left">Type</th>
              <th className="px-2 py-2 text-left">Subtype</th>
              <th className="px-2 py-2 text-left">Position</th>
              <th className="px-2 py-2 text-right">Qty</th>
              <th className="px-2 py-2 text-right">Price</th>
              <th className="px-2 py-2 text-right">Amount</th>
              <th className="px-2 py-2 text-right">Fees</th>
              <th className="px-2 py-2 text-right bg-blue-50">RH Fees</th>
              <th className="px-2 py-2 text-right bg-blue-50">RH Tran</th>
              <th className="px-2 py-2 text-right bg-blue-50">RH Contr</th>
              <th className="px-2 py-2 text-center bg-blue-50">RH Action</th>
              <th className="px-2 py-2 text-center bg-blue-50">Recon</th>
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
                  <td className="px-2 py-2 text-right bg-purple-50">
                    {txn.security?.option_strike_price ? `$${txn.security.option_strike_price.toFixed(2)}` : '-'}
                  </td>
                  <td className="px-2 py-2 bg-purple-50">
                    {txn.security?.option_expiration_date 
                      ? new Date(txn.security.option_expiration_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: '2-digit' })
                      : '-'
                    }
                  </td>
                  <td className="px-2 py-2 text-center bg-purple-50">
                    {txn.security?.option_contract_type ? (
                      <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                        txn.security.option_contract_type === 'call' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                      }`}>
                        {txn.security.option_contract_type.toUpperCase()}
                      </span>
                    ) : '-'}
                  </td>
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
                  <td className="px-2 py-2 text-right bg-blue-50">${txn.rhFees ? txn.rhFees.toFixed(4) : "-"}</td>
                  <td className="px-2 py-2 text-right bg-blue-50">${txn.rhTranFee ? txn.rhTranFee.toFixed(4) : "-"}</td>
                  <td className="px-2 py-2 text-right bg-blue-50">${txn.rhContrFee ? txn.rhContrFee.toFixed(4) : "-"}</td>
                  <td className="px-2 py-2 text-center bg-blue-50">{txn.rhAction || "-"}</td>
                  <td className="px-2 py-2 text-center bg-blue-50">
                    {txn.reconciliationStatus ? (
                      <span className={`px-2 py-0.5 rounded text-xs ${
                        txn.reconciliationStatus === "matched" ? "bg-green-100 text-green-700" : "bg-yellow-100 text-yellow-700"
                      }`}>
                        {txn.reconciliationStatus}
                      </span>
                    ) : "-"}
                  </td>
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
                      <optgroup label="Revenue (Gains)">
                        <option value="T-4100">T-4100 - Options Trading Gains</option>
                        <option value="T-4110">T-4110 - Short-term Stock Gains</option>
                        <option value="T-4120">T-4120 - Long-term Stock Gains</option>
                        <option value="T-4200">T-4200 - Cryptocurrency Gains</option>
                        <option value="T-4300">T-4300 - Dividend Income</option>
                        <option value="T-4400">T-4400 - Interest Income</option>
                      </optgroup>
                      <optgroup label="Expense (Losses)">
                        <option value="T-5100">T-5100 - Options Trading Losses</option>
                        <option value="T-5110">T-5110 - Short-term Stock Losses</option>
                        <option value="T-5120">T-5120 - Long-term Stock Losses</option>
                        <option value="T-5200">T-5200 - Cryptocurrency Losses</option>
                        <option value="T-5300">T-5300 - Brokerage Commissions</option>
                        <option value="T-5310">T-5310 - Exchange Fees</option>
                        <option value="T-5320">T-5320 - Regulatory Fees</option>
                        <option value="T-5400">T-5400 - Margin Interest</option>
                      </optgroup>
                      <optgroup label="Assets (Positions)">
                        <option value="T-1100">T-1100 - Brokerage Cash</option>
                        <option value="T-1200">T-1200 - Stock Positions</option>
                        <option value="T-1210">T-1210 - Options Positions - Long</option>
                        <option value="T-1300">T-1300 - Cryptocurrency Holdings</option>
                        <option value="T-1400">T-1400 - Unrealized Gains</option>
                      </optgroup>
                      <optgroup label="Liabilities">
                        <option value="T-2100">T-2100 - Options Positions - Short</option>
                        <option value="T-2200">T-2200 - Margin Debt</option>
                        <option value="T-2300">T-2300 - Unrealized Losses</option>
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
