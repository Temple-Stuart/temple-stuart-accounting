'use client';

import { useState, useEffect } from 'react';

export default function DataExplorerPage() {
  const [transactions, setTransactions] = useState<any[]>([]);
  const [investments, setInvestments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'transactions' | 'investments'>('investments');

  useEffect(() => {
    fetch('/api/data-explorer')
      .then(res => res.json())
      .then(data => {
        setTransactions(data.transactions || []);
        setInvestments(data.investments || []);
        setLoading(false);
      })
      .catch(err => {
        console.error(err);
        setLoading(false);
      });
  }, []);

  const downloadCSV = (data: any[], filename: string) => {
    if (!data.length) return;
    
    const flatData = data.map(row => {
      const flat: Record<string, any> = {};
      
      const flatten = (obj: any, prefix = '') => {
        for (const key in obj) {
          const value = obj[key];
          const newKey = prefix ? `${prefix}_${key}` : key;
          
          if (value && typeof value === 'object' && !Array.isArray(value) && !(value instanceof Date)) {
            flatten(value, newKey);
          } else if (Array.isArray(value)) {
            flat[newKey] = JSON.stringify(value);
          } else {
            flat[newKey] = value;
          }
        }
      };
      
      flatten(row);
      return flat;
    });
    
    const headers = [...new Set(flatData.flatMap(row => Object.keys(row)))];
    const csvRows = [
      headers.join(','),
      ...flatData.map(row => 
        headers.map(h => {
          const val = row[h];
          if (val === null || val === undefined) return '';
          const str = String(val);
          return str.includes(',') || str.includes('"') || str.includes('\n')
            ? `"${str.replace(/"/g, '""')}"`
            : str;
        }).join(',')
      )
    ];
    
    const blob = new Blob([csvRows.join('\n')], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  const downloadJSON = (data: any[], filename: string) => {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (loading) {
    return <div className="p-8 text-white bg-gray-900 min-h-screen">Loading all Plaid data...</div>;
  }

  const activeData = activeTab === 'transactions' ? transactions : investments;
  const columns = activeData.length > 0 
    ? Object.keys(activeData[0]).filter(k => k !== 'accounts' && k !== 'security')
    : [];

  return (
    <div className="min-h-screen bg-gray-900 text-white p-6">
      <h1 className="text-2xl font-bold mb-4">Plaid Data Explorer</h1>
      
      <div className="flex gap-4 mb-4">
        <button
          onClick={() => setActiveTab('transactions')}
          className={`px-4 py-2 rounded ${activeTab === 'transactions' ? 'bg-blue-600' : 'bg-gray-700'}`}
        >
          Transactions ({transactions.length})
        </button>
        <button
          onClick={() => setActiveTab('investments')}
          className={`px-4 py-2 rounded ${activeTab === 'investments' ? 'bg-blue-600' : 'bg-gray-700'}`}
        >
          Investments ({investments.length})
        </button>
      </div>

      <div className="flex gap-2 mb-6">
        <button
          onClick={() => downloadCSV(activeData, `${activeTab}_${Date.now()}.csv`)}
          className="px-4 py-2 bg-green-600 rounded hover:bg-green-700"
        >
          Download CSV
        </button>
        <button
          onClick={() => downloadJSON(activeData, `${activeTab}_${Date.now()}.json`)}
          className="px-4 py-2 bg-purple-600 rounded hover:bg-purple-700"
        >
          Download JSON
        </button>
      </div>

      {activeTab === 'investments' && investments.length > 0 && (
        <div className="mb-4 p-4 bg-gray-800 rounded">
          <h3 className="font-bold mb-2">Security Fields (nested):</h3>
          <pre className="text-xs text-gray-400 overflow-x-auto">
            {JSON.stringify(Object.keys(investments[0]?.security || {}), null, 2)}
          </pre>
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="w-full text-xs border-collapse">
          <thead>
            <tr className="bg-gray-800">
              <th className="p-2 border border-gray-700 text-left">#</th>
              {columns.slice(0, 20).map(col => (
                <th key={col} className="p-2 border border-gray-700 text-left whitespace-nowrap">
                  {col}
                </th>
              ))}
              {activeTab === 'investments' && (
                <>
                  <th className="p-2 border border-gray-700">sec_ticker</th>
                  <th className="p-2 border border-gray-700">sec_underlying</th>
                  <th className="p-2 border border-gray-700">sec_strike</th>
                  <th className="p-2 border border-gray-700">sec_expiry</th>
                  <th className="p-2 border border-gray-700">sec_type</th>
                </>
              )}
            </tr>
          </thead>
          <tbody>
            {activeData.slice(0, 200).map((row, idx) => (
              <tr key={idx} className="hover:bg-gray-800">
                <td className="p-2 border border-gray-700">{idx + 1}</td>
                {columns.slice(0, 20).map(col => (
                  <td key={col} className="p-2 border border-gray-700 max-w-[200px] truncate">
                    {typeof row[col] === 'object' 
                      ? JSON.stringify(row[col])?.substring(0, 50)
                      : String(row[col] ?? '')}
                  </td>
                ))}
                {activeTab === 'investments' && (
                  <>
                    <td className="p-2 border border-gray-700">{row.security?.ticker_symbol}</td>
                    <td className="p-2 border border-gray-700">{row.security?.option_underlying_ticker}</td>
                    <td className="p-2 border border-gray-700">{row.security?.option_strike_price}</td>
                    <td className="p-2 border border-gray-700">{row.security?.option_expiration_date}</td>
                    <td className="p-2 border border-gray-700">{row.security?.option_contract_type}</td>
                  </>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      
      {activeData.length > 200 && (
        <p className="mt-4 text-gray-400">Showing first 200 of {activeData.length} rows. Download for full data.</p>
      )}
    </div>
  );
}
