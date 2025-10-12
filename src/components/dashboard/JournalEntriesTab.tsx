'use client';

import { useState, useEffect } from 'react';

interface LedgerEntry {
  id: string;
  accountCode: string;
  entryType: 'D' | 'C';
  amount: number;
  chartOfAccount?: {
    code: string;
    name: string;
  };
}

interface JournalEntry {
  id: string;
  date: Date;
  description: string;
  createdAt: Date;
  ledgerEntries: LedgerEntry[];
}

export default function JournalEntriesTab() {
  const [entries, setEntries] = useState<JournalEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedEntry, setExpandedEntry] = useState<string | null>(null);

  useEffect(() => {
    loadEntries();
  }, []);

  const loadEntries = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/journal-entries');
      if (res.ok) {
        const data = await res.json();
        setEntries(data.entries || []);
      }
    } catch (error) {
      console.error('Error loading journal entries:', error);
    }
    setLoading(false);
  };

  const getTotalDebits = (entry: JournalEntry) => {
    return entry.ledgerEntries
      .filter(le => le.entryType === 'D')
      .reduce((sum, le) => sum + le.amount, 0);
  };

  const getTotalCredits = (entry: JournalEntry) => {
    return entry.ledgerEntries
      .filter(le => le.entryType === 'C')
      .reduce((sum, le) => sum + le.amount, 0);
  };

  const isBalanced = (entry: JournalEntry) => {
    return Math.abs(getTotalDebits(entry) - getTotalCredits(entry)) < 0.01;
  };

  if (loading) {
    return <div className="p-8 text-center">Loading journal entries...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold">Journal Entries</h2>
          <p className="text-sm text-gray-600 mt-1">{entries.length} total entries</p>
        </div>
        <button 
          onClick={loadEntries}
          className="px-4 py-2 bg-[#b4b237] text-white rounded-lg text-sm"
        >
          Refresh
        </button>
      </div>

      <div className="bg-white border rounded-xl overflow-hidden">
        <div className="overflow-auto" style={{maxHeight: '700px'}}>
          <table className="w-full">
            <thead className="bg-gray-50 sticky top-0">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600">Date</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600">Description</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600">Total Debits</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600">Total Credits</th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600">Status</th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600"></th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {entries.map((entry) => {
                const totalDebits = getTotalDebits(entry);
                const totalCredits = getTotalCredits(entry);
                const balanced = isBalanced(entry);
                const isExpanded = expandedEntry === entry.id;

                return (
                  <React.Fragment key={entry.id}>
                    <tr className="hover:bg-gray-50 cursor-pointer" onClick={() => setExpandedEntry(isExpanded ? null : entry.id)}>
                      <td className="px-4 py-3 text-sm">
                        {new Date(entry.date).toLocaleDateString()}
                      </td>
                      <td className="px-4 py-3 text-sm">{entry.description}</td>
                      <td className="px-4 py-3 text-right text-sm font-semibold text-blue-600">
                        ${(totalDebits / 100).toFixed(2)}
                      </td>
                      <td className="px-4 py-3 text-right text-sm font-semibold text-green-600">
                        ${(totalCredits / 100).toFixed(2)}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className={`px-2 py-1 rounded text-xs font-medium ${
                          balanced ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                        }`}>
                          {balanced ? 'Balanced' : 'Unbalanced'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <button className="text-gray-400 hover:text-gray-600">
                          {isExpanded ? '▼' : '▶'}
                        </button>
                      </td>
                    </tr>
                    
                    {isExpanded && (
                      <tr>
                        <td colSpan={6} className="bg-gray-50 px-4 py-4">
                          <div className="ml-8">
                            <h4 className="text-xs font-semibold text-gray-600 mb-2">Ledger Entries:</h4>
                            <table className="w-full">
                              <thead>
                                <tr className="text-xs text-gray-600">
                                  <th className="text-left pb-2">Account</th>
                                  <th className="text-right pb-2">Debit</th>
                                  <th className="text-right pb-2">Credit</th>
                                </tr>
                              </thead>
                              <tbody className="text-sm">
                                {entry.ledgerEntries.map((le) => (
                                  <tr key={le.id} className="border-t">
                                    <td className="py-2">
                                      <span className="font-mono text-xs mr-2">{le.accountCode}</span>
                                      <span className="text-gray-600">{le.chartOfAccount?.name}</span>
                                    </td>
                                    <td className="py-2 text-right font-semibold text-blue-600">
                                      {le.entryType === 'D' ? `$${(le.amount / 100).toFixed(2)}` : '—'}
                                    </td>
                                    <td className="py-2 text-right font-semibold text-green-600">
                                      {le.entryType === 'C' ? `$${(le.amount / 100).toFixed(2)}` : '—'}
                                    </td>
                                  </tr>
                                ))}
                                <tr className="border-t-2 font-bold">
                                  <td className="py-2">Total</td>
                                  <td className="py-2 text-right text-blue-600">
                                    ${(totalDebits / 100).toFixed(2)}
                                  </td>
                                  <td className="py-2 text-right text-green-600">
                                    ${(totalCredits / 100).toFixed(2)}
                                  </td>
                                </tr>
                              </tbody>
                            </table>
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <div className="text-sm text-gray-500 text-center">
        Click any entry to expand and view details
      </div>
    </div>
  );
}

import React from 'react';
