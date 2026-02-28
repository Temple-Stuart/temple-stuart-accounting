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
          <h2 className="text-sm font-bold">Journal Entries</h2>
          <p className="text-sm text-text-secondary mt-1">{entries.length} total entries</p>
        </div>
        <button 
          onClick={loadEntries}
          className="px-4 py-2 bg-brand-purple text-white rounded text-sm"
        >
          Refresh
        </button>
      </div>

      <div className="bg-white border rounded overflow-hidden">
        <div className="overflow-auto" style={{maxHeight: '700px'}}>
          <table className="w-full">
            <thead className="bg-bg-row sticky top-0">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold text-text-secondary">Date</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-text-secondary">Description</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-text-secondary">Total Debits</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-text-secondary">Total Credits</th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-text-secondary">Status</th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-text-secondary"></th>
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
                    <tr className="hover:bg-bg-row cursor-pointer" onClick={() => setExpandedEntry(isExpanded ? null : entry.id)}>
                      <td className="px-4 py-3 text-sm">
                        {new Date(entry.date).toLocaleDateString()}
                      </td>
                      <td className="px-4 py-3 text-sm">{entry.description}</td>
                      <td className="px-4 py-3 text-right text-sm font-semibold text-brand-purple">
                        ${(totalDebits / 100).toFixed(2)}
                      </td>
                      <td className="px-4 py-3 text-right text-sm font-semibold text-brand-green">
                        ${(totalCredits / 100).toFixed(2)}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className={`px-2 py-1 rounded text-xs font-medium ${
                          balanced ? 'bg-green-100 text-brand-green' : 'bg-red-100 text-brand-red'
                        }`}>
                          {balanced ? 'Balanced' : 'Unbalanced'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <button className="text-text-faint hover:text-text-secondary">
                          {isExpanded ? '▼' : '▶'}
                        </button>
                      </td>
                    </tr>
                    
                    {isExpanded && (
                      <tr>
                        <td colSpan={6} className="bg-bg-row px-4 py-4">
                          <div className="ml-8">
                            <h4 className="text-xs font-semibold text-text-secondary mb-2">Ledger Entries:</h4>
                            <table className="w-full">
                              <thead>
                                <tr className="text-xs text-text-secondary">
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
                                      <span className="text-text-secondary">{le.chartOfAccount?.name}</span>
                                    </td>
                                    <td className="py-2 text-right font-semibold text-brand-purple">
                                      {le.entryType === 'D' ? `$${(le.amount / 100).toFixed(2)}` : '—'}
                                    </td>
                                    <td className="py-2 text-right font-semibold text-brand-green">
                                      {le.entryType === 'C' ? `$${(le.amount / 100).toFixed(2)}` : '—'}
                                    </td>
                                  </tr>
                                ))}
                                <tr className="border-t-2 font-bold">
                                  <td className="py-2">Total</td>
                                  <td className="py-2 text-right text-brand-purple">
                                    ${(totalDebits / 100).toFixed(2)}
                                  </td>
                                  <td className="py-2 text-right text-brand-green">
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

      <div className="text-sm text-text-muted text-center">
        Click any entry to expand and view details
      </div>
    </div>
  );
}

import React from 'react';
