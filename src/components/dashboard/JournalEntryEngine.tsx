'use client';

import { useState, useMemo } from 'react';

interface JournalEntryLine {
  id?: string;
  accountCode: string;
  description: string;
  debit: string;
  credit: string;
}

interface JournalEntry {
  id: string;
  entryNumber: number;
  date: string;
  type: string;
  memo: string | null;
  status: string;
  lines: JournalEntryLine[];
}

interface CoaOption {
  id: string;
  code: string;
  name: string;
  accountType: string;
}

interface JournalEntryEngineProps {
  entries: JournalEntry[];
  coaOptions: CoaOption[];
  onSave: (entry: any) => Promise<void>;
  onReload: () => void;
}

const ENTRY_TYPES = [
  { value: 'adjusting', label: 'Adjusting Entry' },
  { value: 'reclassify', label: 'Reclassification' },
  { value: 'correction', label: 'Correction' },
  { value: 'accrual', label: 'Accrual' },
  { value: 'closing', label: 'Closing Entry' },
];

const emptyLine = (): JournalEntryLine => ({
  accountCode: '',
  description: '',
  debit: '',
  credit: ''
});

export default function JournalEntryEngine({ entries, coaOptions, onSave, onReload }: JournalEntryEngineProps) {
  const [showForm, setShowForm] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [filterType, setFilterType] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');
  const [saving, setSaving] = useState(false);

  // New entry form state
  const [newDate, setNewDate] = useState(new Date().toISOString().split('T')[0]);
  const [newType, setNewType] = useState('adjusting');
  const [newMemo, setNewMemo] = useState('');
  const [newLines, setNewLines] = useState<JournalEntryLine[]>([emptyLine(), emptyLine()]);

  // Group COA by type
  const coaGrouped = useMemo(() => {
    const g: Record<string, CoaOption[]> = {};
    coaOptions.forEach(o => {
      if (!g[o.accountType]) g[o.accountType] = [];
      g[o.accountType].push(o);
    });
    return g;
  }, [coaOptions]);

  const getCoaName = (code: string) => coaOptions.find(c => c.code === code)?.name || code;

  // Filter entries
  const filtered = useMemo(() => {
    return entries.filter(e => {
      if (filterType !== 'all' && e.type !== filterType) return false;
      if (filterStatus !== 'all' && e.status !== filterStatus) return false;
      return true;
    });
  }, [entries, filterType, filterStatus]);

  // Calculate totals for new entry
  const totalDebits = newLines.reduce((sum, l) => sum + (parseFloat(l.debit) || 0), 0);
  const totalCredits = newLines.reduce((sum, l) => sum + (parseFloat(l.credit) || 0), 0);
  const isBalanced = Math.abs(totalDebits - totalCredits) < 0.01 && totalDebits > 0;

  const updateLine = (index: number, field: keyof JournalEntryLine, value: string) => {
    const updated = [...newLines];
    updated[index] = { ...updated[index], [field]: value };
    setNewLines(updated);
  };

  const addLine = () => {
    setNewLines([...newLines, emptyLine()]);
  };

  const removeLine = (index: number) => {
    if (newLines.length > 2) {
      setNewLines(newLines.filter((_, i) => i !== index));
    }
  };

  const resetForm = () => {
    setNewDate(new Date().toISOString().split('T')[0]);
    setNewType('adjusting');
    setNewMemo('');
    setNewLines([emptyLine(), emptyLine()]);
  };

  const handleSave = async (status: 'draft' | 'posted') => {
    if (!isBalanced) return;
    
    const validLines = newLines.filter(l => l.accountCode && (l.debit || l.credit));
    if (validLines.length < 2) return;

    setSaving(true);
    await onSave({
      date: newDate,
      type: newType,
      memo: newMemo || null,
      status,
      lines: validLines
    });
    resetForm();
    setShowForm(false);
    setSaving(false);
    onReload();
  };

  const getEntryTotals = (entry: JournalEntry) => {
    const debits = entry.lines.reduce((sum, l) => sum + (parseFloat(l.debit) || 0), 0);
    const credits = entry.lines.reduce((sum, l) => sum + (parseFloat(l.credit) || 0), 0);
    return { debits, credits };
  };

  return (
    <div className="bg-white rounded-xl border overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 border-b bg-gray-50 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            className="px-3 py-1.5 border rounded-lg text-sm"
          >
            <option value="all">All Types</option>
            {ENTRY_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="px-3 py-1.5 border rounded-lg text-sm"
          >
            <option value="all">All Status</option>
            <option value="draft">Draft</option>
            <option value="posted">Posted</option>
            <option value="voided">Voided</option>
          </select>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="px-4 py-1.5 bg-[#2d1b4e] text-white rounded-lg text-sm font-medium"
        >
          {showForm ? '✕ Cancel' : '+ New Entry'}
        </button>
      </div>

      {/* New Entry Form */}
      {showForm && (
        <div className="p-4 border-b bg-blue-50">
          <h4 className="font-semibold mb-3">New Journal Entry</h4>
          
          {/* Entry Header */}
          <div className="flex flex-wrap gap-3 mb-4">
            <div>
              <label className="block text-xs text-gray-500 mb-1">Date</label>
              <input
                type="date"
                value={newDate}
                onChange={(e) => setNewDate(e.target.value)}
                className="px-3 py-2 border rounded-lg text-sm"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Type</label>
              <select
                value={newType}
                onChange={(e) => setNewType(e.target.value)}
                className="px-3 py-2 border rounded-lg text-sm"
              >
                {ENTRY_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </div>
            <div className="flex-1 min-w-[200px]">
              <label className="block text-xs text-gray-500 mb-1">Memo</label>
              <input
                type="text"
                value={newMemo}
                onChange={(e) => setNewMemo(e.target.value)}
                placeholder="Description of this entry..."
                className="w-full px-3 py-2 border rounded-lg text-sm"
              />
            </div>
          </div>

          {/* Entry Lines */}
          <table className="w-full text-sm mb-3">
            <thead className="bg-gray-100">
              <tr>
                <th className="px-2 py-2 text-left font-medium">Account</th>
                <th className="px-2 py-2 text-left font-medium">Description</th>
                <th className="px-2 py-2 text-right font-medium w-28">Debit</th>
                <th className="px-2 py-2 text-right font-medium w-28">Credit</th>
                <th className="w-8"></th>
              </tr>
            </thead>
            <tbody>
              {newLines.map((line, idx) => (
                <tr key={idx} className="border-b">
                  <td className="px-2 py-2">
                    <select
                      value={line.accountCode}
                      onChange={(e) => updateLine(idx, 'accountCode', e.target.value)}
                      className="w-full px-2 py-1 border rounded text-sm"
                    >
                      <option value="">Select account...</option>
                      {Object.entries(coaGrouped).map(([type, opts]) => (
                        <optgroup key={type} label={type}>
                          {opts.map(o => <option key={o.id} value={o.code}>{o.code} - {o.name}</option>)}
                        </optgroup>
                      ))}
                    </select>
                  </td>
                  <td className="px-2 py-2">
                    <input
                      type="text"
                      value={line.description}
                      onChange={(e) => updateLine(idx, 'description', e.target.value)}
                      placeholder="Line description..."
                      className="w-full px-2 py-1 border rounded text-sm"
                    />
                  </td>
                  <td className="px-2 py-2">
                    <input
                      type="number"
                      step="0.01"
                      value={line.debit}
                      onChange={(e) => updateLine(idx, 'debit', e.target.value)}
                      placeholder="0.00"
                      className="w-full px-2 py-1 border rounded text-sm text-right"
                      disabled={!!line.credit}
                    />
                  </td>
                  <td className="px-2 py-2">
                    <input
                      type="number"
                      step="0.01"
                      value={line.credit}
                      onChange={(e) => updateLine(idx, 'credit', e.target.value)}
                      placeholder="0.00"
                      className="w-full px-2 py-1 border rounded text-sm text-right"
                      disabled={!!line.debit}
                    />
                  </td>
                  <td className="px-1">
                    {newLines.length > 2 && (
                      <button onClick={() => removeLine(idx)} className="text-red-400 hover:text-red-600">✕</button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot className="bg-gray-50 font-semibold">
              <tr>
                <td className="px-2 py-2" colSpan={2}>
                  <button onClick={addLine} className="text-[#2d1b4e] text-sm hover:underline">+ Add Line</button>
                </td>
                <td className="px-2 py-2 text-right">${totalDebits.toFixed(2)}</td>
                <td className="px-2 py-2 text-right">${totalCredits.toFixed(2)}</td>
                <td className="px-1">
                  {isBalanced ? (
                    <span className="text-green-600">✓</span>
                  ) : (
                    <span className="text-red-600">≠</span>
                  )}
                </td>
              </tr>
            </tfoot>
          </table>

          {/* Actions */}
          <div className="flex items-center justify-between">
            <div className="text-sm">
              {!isBalanced && totalDebits > 0 && (
                <span className="text-red-600">
                  Out of balance by ${Math.abs(totalDebits - totalCredits).toFixed(2)}
                </span>
              )}
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => handleSave('draft')}
                disabled={!isBalanced || saving}
                className="px-4 py-2 border rounded-lg text-sm disabled:opacity-50"
              >
                Save as Draft
              </button>
              <button
                onClick={() => handleSave('posted')}
                disabled={!isBalanced || saving}
                className="px-4 py-2 bg-[#2d1b4e] text-white rounded-lg text-sm font-medium disabled:opacity-50"
              >
                {saving ? 'Saving...' : 'Post Entry'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Entries List */}
      <div className="divide-y">
        {filtered.length === 0 ? (
          <div className="p-8 text-center text-gray-400">
            No journal entries yet. Click "+ New Entry" to create one.
          </div>
        ) : (
          filtered.map(entry => {
            const { debits, credits } = getEntryTotals(entry);
            const isExpanded = expandedId === entry.id;

            return (
              <div key={entry.id}>
                <button
                  onClick={() => setExpandedId(isExpanded ? null : entry.id)}
                  className="w-full px-4 py-3 flex items-center justify-between hover:bg-gray-50 text-left"
                >
                  <div className="flex items-center gap-4">
                    <span className={`text-xs transition-transform ${isExpanded ? 'rotate-90' : ''}`}>▶</span>
                    <span className="font-mono text-sm text-gray-500">JE-{String(entry.entryNumber).padStart(3, '0')}</span>
                    <span className="text-sm">{new Date(entry.date).toLocaleDateString()}</span>
                    <span className="px-2 py-0.5 bg-gray-100 rounded text-xs capitalize">{entry.type}</span>
                    <span className="text-sm text-gray-600 truncate max-w-[200px]">{entry.memo || '-'}</span>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className="text-sm font-mono">${debits.toFixed(2)}</span>
                    <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                      entry.status === 'posted' ? 'bg-green-100 text-green-700' :
                      entry.status === 'voided' ? 'bg-red-100 text-red-700' :
                      'bg-yellow-100 text-yellow-700'
                    }`}>
                      {entry.status}
                    </span>
                  </div>
                </button>

                {isExpanded && (
                  <div className="px-4 pb-4 bg-gray-50">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-100">
                        <tr>
                          <th className="px-3 py-2 text-left font-medium">Account</th>
                          <th className="px-3 py-2 text-left font-medium">Description</th>
                          <th className="px-3 py-2 text-right font-medium">Debit</th>
                          <th className="px-3 py-2 text-right font-medium">Credit</th>
                        </tr>
                      </thead>
                      <tbody>
                        {entry.lines.map((line, idx) => (
                          <tr key={idx} className="border-b border-gray-200">
                            <td className="px-3 py-2">
                              <span className="font-mono text-xs">{line.accountCode}</span>
                              <span className="ml-2 text-gray-600">{getCoaName(line.accountCode)}</span>
                            </td>
                            <td className="px-3 py-2 text-gray-600">{line.description || '-'}</td>
                            <td className="px-3 py-2 text-right font-mono">
                              {line.debit ? `$${parseFloat(line.debit).toFixed(2)}` : '-'}
                            </td>
                            <td className="px-3 py-2 text-right font-mono">
                              {line.credit ? `$${parseFloat(line.credit).toFixed(2)}` : '-'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot className="bg-gray-100 font-semibold">
                        <tr>
                          <td colSpan={2} className="px-3 py-2">Total</td>
                          <td className="px-3 py-2 text-right font-mono">${debits.toFixed(2)}</td>
                          <td className="px-3 py-2 text-right font-mono">${credits.toFixed(2)}</td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
