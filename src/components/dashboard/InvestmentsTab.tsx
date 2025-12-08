'use client';

import { useState } from 'react';
import CommittedInvestmentsTable from "./CommittedInvestmentsTable";
import { robinhoodParser } from '@/lib/robinhood-parser';

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
  
  const [autoMapStatus, setAutoMapStatus] = useState<{loading?: boolean; success?: boolean; message?: string} | null>(null);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [uploadFiles, setUploadFiles] = useState<File[]>([]);
  const [uploadProgress, setUploadProgress] = useState({ current: 0, total: 0 });
  const [matchedData, setMatchedData] = useState<any[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [historyText, setHistoryText] = useState('');
  const [historyStatus, setHistoryStatus] = useState<{loading?: boolean; success?: boolean; message?: string} | null>(null);
  const [commitStatus, setCommitStatus] = useState<{loading?: boolean; message?: string} | null>(null);

  const handleAutoMapTrades = async () => {
    setAutoMapStatus({ loading: true, message: 'Fetching Robinhood history...' });
    
    try {
      const response = await fetch('/api/robinhood/get-history');
      const data = await response.json();
      
      if (!data.historyText || data.historyText.length === 0) {
        setAutoMapStatus({
          success: false,
          message: 'No Robinhood history found. Please paste history first.'
        });
        setTimeout(() => setAutoMapStatus(null), 5000);
        return;
      }
      
      setAutoMapStatus({ loading: true, message: 'Parsing history file...' });
      
      console.log('=== AUTO-MAP DEBUG ===');
      console.log('History file length:', data.historyText.length);
      
      robinhoodParser.resetCounter();
      const spreads = robinhoodParser.parseHistory(data.historyText);
      
      console.log('Parsed spreads:', spreads.length);
      if (spreads.length > 0) {
        console.log('First spread:', spreads[0]);
        console.log('First spread legs:', spreads[0].legs);
      }
      
      if (spreads.length === 0) {
        setAutoMapStatus({
          success: false,
          message: 'No spreads found in history file.'
        });
        setTimeout(() => setAutoMapStatus(null), 5000);
        return;
      }
      
      setAutoMapStatus({ loading: true, message: `Found ${spreads.length} spreads. Matching to transactions...` });
      
      const filteredTransactions = investmentTransactions.filter(txn => {
        
        
        return true;
      });
      
      console.log('Filtered transactions:', filteredTransactions.length);
      if (filteredTransactions.length > 0) {
        console.log('First 3 transactions FULL:', filteredTransactions.slice(0, 3));
      }
      
      const mappings = robinhoodParser.matchToPlaid(spreads, filteredTransactions);
      
      console.log('Mappings found:', mappings.length);
      if (mappings.length > 0) {
        console.log('First mapping:', mappings[0]);
      }
      
      if (mappings.length === 0) {
        setAutoMapStatus({
          success: false,
          message: 'No matches found. Check browser console for debug info.'
        });
        setTimeout(() => setAutoMapStatus(null), 5000);
        return;
      }
      
      const newChanges: typeof investmentRowChanges = {};
      
      for (const mapping of mappings) {
        newChanges[mapping.txnId] = {
          strategy: mapping.strategy,
          coa: mapping.coa,
          tradeNum: mapping.tradeNum
        };
      }
      
      setInvestmentRowChanges(prev => ({ ...prev, ...newChanges }));
      
      setAutoMapStatus({
        success: true,
        message: `✅ Auto-mapped ${mappings.length} transactions from ${spreads.length} spreads!`
      });
      
      setTimeout(() => setAutoMapStatus(null), 10000);
      
    } catch (error) {
      console.error('Auto-map error:', error);
      setAutoMapStatus({
        success: false,
        message: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`
      });
      setTimeout(() => setAutoMapStatus(null), 5000);
    }
  };

  const commitSelectedInvestmentRows = async () => {
    const updates = Object.entries(investmentRowChanges).filter(([id, values]) => values.coa && values.strategy && values.tradeNum);
    
    if (updates.length === 0) {
      alert('Investments need Strategy, COA, and Trade # assigned');
      return;
    }
    
    // CRITICAL FIX: Group transactions by trade number
    const tradeGroups: { [tradeNum: string]: Array<[string, any]> } = {};
    
    for (const update of updates) {
      const tradeNum = update[1].tradeNum;
      if (!tradeGroups[tradeNum]) {
        tradeGroups[tradeNum] = [];
      }
      tradeGroups[tradeNum].push(update);
    }
    
    const totalTrades = Object.keys(tradeGroups).length;
    let completedTrades = 0;
    let totalCommitted = 0;
    const errors: string[] = [];
    
    setCommitStatus({ loading: true, message: `Committing 0/${totalTrades} trades...` });
    
    try {
      // Commit each trade separately (grouped by trade number)
      for (const [tradeNum, tradeTransactions] of Object.entries(tradeGroups)) {
        try {
          const transactionIds = tradeTransactions.map(([id]) => id);
          const firstTxn = tradeTransactions[0][1];
          
          console.log(`Committing Trade #${tradeNum} with ${transactionIds.length} legs`);
          
          const res = await fetch('/api/investment-transactions/commit-to-ledger', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              transactionIds,
              accountCode: firstTxn.coa,
              subAccount: firstTxn.sub || null,
              strategy: firstTxn.strategy,
              tradeNum
            })
          });
          
          const result = await res.json();
          
          if (result.success) {
            completedTrades++;
            totalCommitted += result.committed;
            setCommitStatus({ 
              loading: true, 
              message: `Committing ${completedTrades}/${totalTrades} trades (${totalCommitted} legs)...` 
            });
          } else {
            errors.push(`Trade #${tradeNum}: ${result.error || 'Unknown error'}`);
          }
        } catch (error) {
          errors.push(`Trade #${tradeNum}: ${error instanceof Error ? error.message : 'Failed'}`);
        }
      }
      
      await onReload();
      setInvestmentRowChanges({});
      setCommitStatus(null);
      
      if (errors.length === 0) {
        alert(`✅ Successfully committed ${completedTrades} trades (${totalCommitted} legs)!`);
      } else {
        alert(`⚠️ Committed ${completedTrades}/${totalTrades} trades.\n\nErrors:\n${errors.join('\n')}`);
      }
      
    } catch (error) {
      setCommitStatus(null);
      alert(`Failed to commit investments: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  const massUncommitInvestments = async () => {
    if (selectedCommittedInvestments.length === 0) {
      alert('Select investment transactions to uncommit');
      return;
    }
    
    try {
      const res = await fetch('/api/investment-transactions/uncommit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          transactionIds: selectedCommittedInvestments
        })
      });
      
      const result = await res.json();
      
      if (result.success) {
        await onReload();
        setSelectedCommittedInvestments([]);
        alert(`✅ ${result.message}`);
      } else {
        alert(`❌ Error: ${result.error || 'Failed to uncommit'}`);
      }
    } catch (error) {
      alert(`Failed to uncommit: ${error instanceof Error ? error.message : 'Unknown error'}`);
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

  const handleHistoryPaste = async () => {
    if (!historyText.trim()) {
      alert('Please paste some history text first');
      return;
    }
    
    setHistoryStatus({ loading: true });
    
    try {
      const response = await fetch('/api/robinhood/append-history', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ historyText })
      });
      
      const result = await response.json();
      
      if (result.success) {
        setHistoryStatus({ 
          success: true, 
          message: result.message 
        });
        setHistoryText('');
        setTimeout(() => setHistoryStatus(null), 5000);
      } else {
        setHistoryStatus({ 
          success: false, 
          message: result.error || 'Failed to update history' 
        });
      }
    } catch (error) {
      setHistoryStatus({ 
        success: false, 
        message: 'Network error - failed to update history' 
      });
    }
  };

  return (
    <>
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

        <div className="p-4 bg-gradient-to-r from-blue-50 to-purple-50 border-2 border-blue-200 rounded-lg">
          <h3 className="font-bold text-lg mb-2">📋 Paste Robinhood History</h3>
          <p className="text-sm text-gray-600 mb-3">
            Copy from Robinhood → History Tab → Paste here → Click Update. New trades will be added to the top of your history file.
          </p>
          
          <textarea
            className="w-full h-48 p-3 border-2 border-gray-300 rounded-lg font-mono text-xs focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
            placeholder="Paste Robinhood history text here..."
            value={historyText}
            onChange={(e) => setHistoryText(e.target.value)}
            disabled={historyStatus?.loading}
          />
          
          <div className="mt-3 flex justify-between items-center">
            <div className="flex-1">
              {historyStatus?.loading && (
                <span className="text-blue-600 font-medium">⏳ Updating history file...</span>
              )}
              {historyStatus?.success && (
                <span className="text-green-600 font-medium">✅ {historyStatus.message}</span>
              )}
              {historyStatus?.success === false && (
                <span className="text-red-600 font-medium">❌ {historyStatus.message}</span>
              )}
            </div>
            
            <div className="flex gap-2">
              <button
                onClick={() => setHistoryText('')}
                className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg text-sm hover:bg-gray-100"
                disabled={!historyText.trim() || historyStatus?.loading}
              >
                Clear
              </button>
              <button
                onClick={handleHistoryPaste}
                className="px-6 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
                disabled={!historyText.trim() || historyStatus?.loading}
              >
                {historyStatus?.loading ? 'Updating...' : 'Update History'}
              </button>
            </div>
          </div>
        </div>

        <div className="p-4 bg-gradient-to-r from-green-50 to-emerald-50 border-2 border-green-300 rounded-lg">
          <div className="flex justify-between items-center">
            <div>
              <h3 className="font-bold text-lg mb-1">🚀 Auto-Map Trades</h3>
              <p className="text-sm text-gray-600">
                Automatically map transactions using your Robinhood history file
              </p>
              {autoMapStatus && (
                <div className="mt-2">
                  {autoMapStatus.loading && (
                    <span className="text-blue-600 font-medium">⏳ {autoMapStatus.message}</span>
                  )}
                  {autoMapStatus.success && (
                    <span className="text-green-600 font-medium">{autoMapStatus.message}</span>
                  )}
                  {autoMapStatus.success === false && (
                    <span className="text-red-600 font-medium">❌ {autoMapStatus.message}</span>
                  )}
                </div>
              )}
            </div>
            <button
              onClick={handleAutoMapTrades}
              disabled={autoMapStatus?.loading}
              className="px-6 py-3 bg-green-600 text-white rounded-lg font-bold text-base hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed shadow-lg transition-all hover:shadow-xl"
            >
              {autoMapStatus?.loading ? '⏳ Mapping...' : '🚀 Auto-Map All Trades'}
            </button>
          </div>
        </div>
        
        <div className="p-4 bg-gray-50 flex justify-between items-center">
          <span className="text-sm">
            Investment Transactions: {investmentTransactions.length} uncommitted, {committedInvestments.length} committed
            {Object.keys(investmentRowChanges).length > 0 && (
              <span className="ml-2 text-green-600 font-medium">
                ({Object.keys(investmentRowChanges).length} mapped)
              </span>
            )}
            {commitStatus?.loading && (
              <span className="ml-2 text-blue-600 font-medium">⏳ {commitStatus.message}</span>
            )}
          </span>
          <button 
            onClick={commitSelectedInvestmentRows}
            className="px-4 py-2 bg-blue-600 text-white rounded text-sm hover:bg-blue-700 disabled:bg-gray-400"
            disabled={Object.keys(investmentRowChanges).length === 0 || commitStatus?.loading}
          >
            {commitStatus?.loading ? 'Committing...' : 'Commit Investments'}
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
              <th className="px-2 py-2 text-center bg-green-50 min-w-[60px]">Trade #</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {investmentTransactions.filter(txn => {
              const txnDate = new Date(txn.date).toISOString().split('T')[0];
              const symbol = txn.name?.split(' ').find((part: string) => part.match(/^[A-Z]+$/)) || '';
              const position = txn.name?.toLowerCase().includes('close') ? 'close' : 'open';
              
              
              
              return (
                     (!dateFilter || txnDate === dateFilter) &&
                     (!symbolFilter || symbol.includes(symbolFilter)) &&
                     (!positionFilter || position === positionFilter));
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

              const isMapped = !!investmentRowChanges[txnId];

              return (
                <tr key={txnId} className={`hover:bg-gray-50 ${isMapped ? 'bg-green-50' : ''}`}>
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
                  <td className="px-2 py-1 bg-green-50">
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
          Total Investment Transactions: {investmentTransactions.length}
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
