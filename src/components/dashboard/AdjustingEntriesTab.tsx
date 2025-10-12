'use client';

import { useState, useEffect } from 'react';

interface CoaOption {
  id: string;
  code: string;
  name: string;
  accountType: string;
}

interface EntryLine {
  accountCode: string;
  entryType: 'D' | 'C';
  amount: string;
}

export default function AdjustingEntriesTab() {
  const [coaOptions, setCoaOptions] = useState<CoaOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [description, setDescription] = useState('');
  const [lines, setLines] = useState<EntryLine[]>([
    { accountCode: '', entryType: 'D', amount: '' },
    { accountCode: '', entryType: 'C', amount: '' }
  ]);

  useEffect(() => {
    loadCoaOptions();
  }, []);

  const loadCoaOptions = async () => {
    try {
      const res = await fetch('/api/chart-of-accounts');
      if (res.ok) {
        const data = await res.json();
        setCoaOptions(data.accounts || []);
      }
    } catch (error) {
      console.error('Error loading COA:', error);
    }
  };

  const addLine = () => {
    setLines([...lines, { accountCode: '', entryType: 'D', amount: '' }]);
  };

  const removeLine = (index: number) => {
    if (lines.length > 2) {
      setLines(lines.filter((_, i) => i !== index));
    }
  };

  const updateLine = (index: number, field: keyof EntryLine, value: string) => {
    const newLines = [...lines];
    newLines[index] = { ...newLines[index], [field]: value };
    setLines(newLines);
  };

  const getTotalDebits = () => {
    return lines
      .filter(l => l.entryType === 'D' && l.amount)
      .reduce((sum, l) => sum + parseFloat(l.amount), 0);
  };

  const getTotalCredits = () => {
    return lines
      .filter(l => l.entryType === 'C' && l.amount)
      .reduce((sum, l) => sum + parseFloat(l.amount), 0);
  };

  const isBalanced = () => {
    const debits = getTotalDebits();
    const credits = getTotalCredits();
    return debits > 0 && credits > 0 && Math.abs(debits - credits) < 0.01;
  };

  const canSubmit = () => {
    return (
      date &&
      description &&
      lines.length >= 2 &&
      lines.every(l => l.accountCode && l.amount && parseFloat(l.amount) > 0) &&
      isBalanced()
    );
  };

  const handleSubmit = async () => {
    if (!canSubmit()) {
      alert('Please fill all fields and ensure debits equal credits');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/journal-entries/manual', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          date,
          description,
          lines: lines.map(l => ({
            accountCode: l.accountCode,
            entryType: l.entryType,
            amount: Math.round(parseFloat(l.amount) * 100) // Convert to cents
          }))
        })
      });

      const result = await res.json();

      if (res.ok) {
        alert('✅ Adjusting entry created successfully!');
        // Reset form
        setDescription('');
        setLines([
          { accountCode: '', entryType: 'D', amount: '' },
          { accountCode: '', entryType: 'C', amount: '' }
        ]);
      } else {
        alert(`❌ Error: ${result.error || 'Failed to create entry'}`);
      }
    } catch (error) {
      alert('Failed to create adjusting entry');
    }
    setLoading(false);
  };

  const groupCoaByType = () => {
    const grouped: {[key: string]: CoaOption[]} = {};
    coaOptions.forEach(opt => {
      if (!grouped[opt.accountType]) grouped[opt.accountType] = [];
      grouped[opt.accountType].push(opt);
    });
    return grouped;
  };

  const coaGrouped = groupCoaByType();
  const totalDebits = getTotalDebits();
  const totalCredits = getTotalCredits();
  const balanced = isBalanced();

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Adjusting Entries</h2>
        <p className="text-sm text-gray-600 mt-1">Create manual journal entries for adjustments and corrections</p>
      </div>

      <div className="bg-white border rounded-xl p-6">
        <h3 className="text-lg font-semibold mb-4">New Adjusting Entry</h3>

        {/* Date and Description */}
        <div className="grid grid-cols-2 gap-4 mb-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Date</label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full px-3 py-2 border rounded-lg"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
            <input
              type="text"
              placeholder="e.g. Accrued rent expense"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full px-3 py-2 border rounded-lg"
            />
          </div>
        </div>

        {/* Entry Lines */}
        <div className="mb-4">
          <div className="flex justify-between items-center mb-2">
            <label className="block text-sm font-medium text-gray-700">Journal Entry Lines</label>
            <button
              onClick={addLine}
              className="px-3 py-1 bg-gray-600 text-white rounded text-sm"
            >
              + Add Line
            </button>
          </div>

          <div className="space-y-2">
            {lines.map((line, index) => (
              <div key={index} className="flex gap-2 items-center">
                <div className="flex-1">
                  <select
                    value={line.accountCode}
                    onChange={(e) => updateLine(index, 'accountCode', e.target.value)}
                    className="w-full px-3 py-2 border rounded-lg text-sm"
                  >
                    <option value="">Select Account</option>
                    {Object.keys(coaGrouped).map(type => (
                      <optgroup key={type} label={type}>
                        {coaGrouped[type].map(opt => (
                          <option key={opt.id} value={opt.code}>
                            {opt.code} - {opt.name}
                          </option>
                        ))}
                      </optgroup>
                    ))}
                  </select>
                </div>
                <div className="w-32">
                  <select
                    value={line.entryType}
                    onChange={(e) => updateLine(index, 'entryType', e.target.value as 'D' | 'C')}
                    className="w-full px-3 py-2 border rounded-lg text-sm"
                  >
                    <option value="D">Debit</option>
                    <option value="C">Credit</option>
                  </select>
                </div>
                <div className="w-40">
                  <input
                    type="number"
                    step="0.01"
                    placeholder="0.00"
                    value={line.amount}
                    onChange={(e) => updateLine(index, 'amount', e.target.value)}
                    className="w-full px-3 py-2 border rounded-lg text-sm"
                  />
                </div>
                {lines.length > 2 && (
                  <button
                    onClick={() => removeLine(index)}
                    className="px-3 py-2 text-red-600 hover:bg-red-50 rounded"
                  >
                    ✕
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Totals */}
        <div className="border-t pt-4 mb-4">
          <div className="flex justify-end gap-8 text-sm">
            <div>
              <span className="text-gray-600">Total Debits:</span>
              <span className="ml-2 font-semibold text-blue-600">${totalDebits.toFixed(2)}</span>
            </div>
            <div>
              <span className="text-gray-600">Total Credits:</span>
              <span className="ml-2 font-semibold text-green-600">${totalCredits.toFixed(2)}</span>
            </div>
            <div>
              <span className="text-gray-600">Difference:</span>
              <span className={`ml-2 font-semibold ${balanced ? 'text-green-600' : 'text-red-600'}`}>
                ${Math.abs(totalDebits - totalCredits).toFixed(2)}
              </span>
            </div>
          </div>
          {balanced && (
            <div className="text-right mt-2">
              <span className="text-sm text-green-600 font-medium">✓ Entry is balanced</span>
            </div>
          )}
        </div>

        {/* Submit Button */}
        <div className="flex justify-end">
          <button
            onClick={handleSubmit}
            disabled={!canSubmit() || loading}
            className={`px-6 py-2 rounded-lg text-sm font-medium ${
              canSubmit() && !loading
                ? 'bg-[#b4b237] text-white hover:bg-[#9a9730]'
                : 'bg-gray-300 text-gray-500 cursor-not-allowed'
            }`}
          >
            {loading ? 'Creating...' : 'Create Adjusting Entry'}
          </button>
        </div>
      </div>

      {/* Help Text */}
      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
        <h3 className="text-sm font-semibold text-yellow-900 mb-2">About Adjusting Entries</h3>
        <p className="text-sm text-yellow-800">
          Adjusting entries are manual journal entries used to record accruals, deferrals, corrections, and other 
          adjustments that aren't captured by automatic transaction imports. Common examples include depreciation, 
          prepaid expenses, accrued revenues, and error corrections.
        </p>
      </div>
    </div>
  );
}
