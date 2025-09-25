'use client';

import { useState, useEffect } from 'react';

export function DataDebugSection() {
  const [investmentData, setInvestmentData] = useState<any>(null);
  const [transactionData, setTransactionData] = useState<any>(null);

  useEffect(() => {
    // Fetch investment transactions
    fetch('/api/investment-transactions')
      .then(res => res.json())
      .then(data => {
        console.log('Investment API Response:', data);
        setInvestmentData(data);
      });

    // Fetch regular transactions
    fetch('/api/transactions')
      .then(res => res.json())
      .then(data => {
        console.log('Transaction API Response:', data);
        setTransactionData(data);
      });
  }, []);

  // Get all unique keys from the data
  const getTableColumns = (dataArray: any[]) => {
    if (!Array.isArray(dataArray) || dataArray.length === 0) return [];
    const allKeys = new Set<string>();
    dataArray.forEach(item => {
      Object.keys(item).forEach(key => allKeys.add(key));
    });
    return Array.from(allKeys);
  };

  const renderDataTable = (data: any[], title: string) => {
    if (!Array.isArray(data) || data.length === 0) {
      return <div>No {title} data available</div>;
    }

    const columns = getTableColumns(data);

    return (
      <div>
        <h3 className="font-medium mb-2">{title} ({data.length} records)</h3>
        <div className="overflow-x-auto border rounded">
          <table className="w-full text-xs">
            <thead className="bg-gray-100">
              <tr>
                {columns.map(col => (
                  <th key={col} className="px-2 py-1 text-left border-r">
                    {col}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.slice(0, 10).map((row, idx) => (
                <tr key={idx} className="border-t hover:bg-gray-50">
                  {columns.map(col => (
                    <td key={col} className="px-2 py-1 border-r text-xs">
                      {typeof row[col] === 'object' 
                        ? JSON.stringify(row[col]).substring(0, 50) + '...'
                        : String(row[col] || '-').substring(0, 50)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6 p-4">
      <h2 className="text-xl font-bold">Raw Data Debug View</h2>
      
      {/* Show raw investment data */}
      {investmentData && (
        <div>
          <h3 className="font-medium">Investment API Raw Response:</h3>
          <pre className="bg-gray-100 p-2 rounded text-xs overflow-auto max-h-40">
            {JSON.stringify(investmentData, null, 2).substring(0, 2000)}...
          </pre>
          
          {/* If it's an array, show table */}
          {Array.isArray(investmentData) && renderDataTable(investmentData, 'Investment Transactions')}
        </div>
      )}

      {/* Show raw transaction data */}
      {transactionData && Array.isArray(transactionData) && (
        renderDataTable(transactionData.slice(0, 10), 'Regular Transactions')
      )}
    </div>
  );
}
