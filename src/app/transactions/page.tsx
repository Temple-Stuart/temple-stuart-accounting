'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

interface Transaction {
  account_id: string;
  transaction_id: string;
  amount: number;
  date: string;
  name: string;
  merchant_name?: string;
  category?: string[];
  pending: boolean;
  institution_name?: string;
}

export default function TransactionsPage() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [sortField, setSortField] = useState('date');
  const [sortDirection, setSortDirection] = useState('desc');
  const [filterText, setFilterText] = useState('');
  const router = useRouter();

  useEffect(() => {
    fetchTransactions();
  }, []);

  const fetchTransactions = async () => {
    try {
      const response = await fetch('/api/transactions');
      if (response.ok) {
        const data = await response.json();
        // API returns { transactions: [...] }
        if (data.transactions && Array.isArray(data.transactions)) {
          setTransactions(data.transactions);
        } else {
          console.log('No transactions in response:', data);
          setTransactions([]);
        }
      } else {
        console.error('Failed to fetch transactions');
        setTransactions([]);
      }
    } catch (error) {
      console.error('Error fetching transactions:', error);
      setTransactions([]);
    } finally {
      setLoading(false);
    }
  };

  const handleSort = (field: string) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const sortData = (data: Transaction[]) => {
    if (!Array.isArray(data)) return [];
    
    return [...data].sort((a, b) => {
      let aVal: any = a[sortField as keyof Transaction];
      let bVal: any = b[sortField as keyof Transaction];
      
      if (sortField === 'date') {
        aVal = new Date(aVal).getTime();
        bVal = new Date(bVal).getTime();
      }
      
      if (sortDirection === 'asc') {
        return aVal > bVal ? 1 : -1;
      } else {
        return aVal < bVal ? 1 : -1;
      }
    });
  };

  const filterData = (data: Transaction[]) => {
    if (!Array.isArray(data)) return [];
    if (!filterText) return data;
    
    return data.filter(item => {
      const searchStr = JSON.stringify(item).toLowerCase();
      return searchStr.includes(filterText.toLowerCase());
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-amber-50/30 via-white to-amber-50/20 p-8">
        <div className="text-center">Loading transactions...</div>
      </div>
    );
  }

  const displayData = sortData(filterData(transactions));

  return (
    <div className="min-h-screen bg-gradient-to-b from-amber-50/30 via-white to-amber-50/20 p-8">
      <div className="max-w-7xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold bg-gradient-to-r from-purple-600 to-amber-500 bg-clip-text text-transparent">
            Transaction History
          </h1>
          <button
            onClick={() => router.push('/')}
            className="px-4 py-2 bg-gradient-to-r from-purple-600 to-amber-500 text-white rounded-lg hover:from-purple-700 hover:to-amber-600"
          >
            Back to Home
          </button>
        </div>

        {/* Filter */}
        <div className="mb-6">
          <input
            type="text"
            placeholder="Filter transactions..."
            value={filterText}
            onChange={(e) => setFilterText(e.target.value)}
            className="px-4 py-2 border border-purple-200 rounded-lg w-full max-w-md focus:outline-none focus:ring-2 focus:ring-purple-500"
          />
        </div>

        {/* Summary Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div className="bg-white rounded-lg p-4 border border-purple-200">
            <div className="text-sm font-semibold text-purple-600">Total Transactions</div>
            <div className="text-2xl font-bold">{transactions.length}</div>
          </div>
          <div className="bg-white rounded-lg p-4 border border-purple-200">
            <div className="text-sm font-semibold text-purple-600">Total Amount</div>
            <div className="text-2xl font-bold">
              ${transactions.reduce((sum, t) => sum + Math.abs(t.amount), 0).toFixed(2)}
            </div>
          </div>
          <div className="bg-white rounded-lg p-4 border border-purple-200">
            <div className="text-sm font-semibold text-purple-600">Pending</div>
            <div className="text-2xl font-bold">
              {transactions.filter(t => t.pending).length}
            </div>
          </div>
        </div>

        {/* Data Table */}
        <div className="bg-white rounded-lg shadow-xl overflow-hidden">
          <div className="overflow-x-auto">
            {displayData.length > 0 ? (
              <table className="w-full">
                <thead className="bg-gradient-to-r from-purple-600 to-amber-500 text-white">
                  <tr>
                    <th 
                      className="px-4 py-3 text-left cursor-pointer hover:bg-purple-700"
                      onClick={() => handleSort('date')}
                    >
                      Date {sortField === 'date' && (sortDirection === 'asc' ? '↑' : '↓')}
                    </th>
                    <th 
                      className="px-4 py-3 text-left cursor-pointer hover:bg-purple-700"
                      onClick={() => handleSort('name')}
                    >
                      Description {sortField === 'name' && (sortDirection === 'asc' ? '↑' : '↓')}
                    </th>
                    <th 
                      className="px-4 py-3 text-left cursor-pointer hover:bg-purple-700"
                      onClick={() => handleSort('merchant_name')}
                    >
                      Merchant {sortField === 'merchant_name' && (sortDirection === 'asc' ? '↑' : '↓')}
                    </th>
                    <th className="px-4 py-3 text-left">Category</th>
                    <th 
                      className="px-4 py-3 text-left cursor-pointer hover:bg-purple-700"
                      onClick={() => handleSort('amount')}
                    >
                      Amount {sortField === 'amount' && (sortDirection === 'asc' ? '↑' : '↓')}
                    </th>
                    <th className="px-4 py-3 text-left">Institution</th>
                    <th className="px-4 py-3 text-left">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {displayData.map((transaction, index) => (
                    <tr key={transaction.transaction_id} className={index % 2 === 0 ? 'bg-gray-50' : 'bg-white'}>
                      <td className="px-4 py-3 text-sm">
                        {new Date(transaction.date).toLocaleDateString()}
                      </td>
                      <td className="px-4 py-3 font-semibold">{transaction.name}</td>
                      <td className="px-4 py-3">{transaction.merchant_name || '-'}</td>
                      <td className="px-4 py-3">
                        {transaction.category && transaction.category.length > 0 && (
                          <span className="px-2 py-1 bg-purple-100 text-purple-700 rounded-full text-xs">
                            {transaction.category[0]}
                          </span>
                        )}
                      </td>
                      <td className={`px-4 py-3 font-bold ${
                        transaction.amount < 0 ? 'text-green-600' : 'text-red-600'
                      }`}>
                        ${Math.abs(transaction.amount).toFixed(2)}
                      </td>
                      <td className="px-4 py-3 text-sm">
                        {transaction.institution_name || '-'}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-1 rounded-full text-xs font-semibold ${
                          transaction.pending 
                            ? 'bg-yellow-100 text-yellow-700' 
                            : 'bg-green-100 text-green-700'
                        }`}>
                          {transaction.pending ? 'Pending' : 'Posted'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <div className="text-center py-8 text-gray-500">
                No transactions found. Connect a bank account to see transactions.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
