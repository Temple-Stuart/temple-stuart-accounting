'use client';

import { useState } from 'react';

interface ManualTransactionFormProps {
  onSuccess?: () => void;
  onCancel?: () => void;
}

const CATEGORIES = [
  'Food & Dining',
  'Groceries',
  'Transportation',
  'Gas',
  'Utilities',
  'Rent / Mortgage',
  'Insurance',
  'Healthcare',
  'Entertainment',
  'Shopping',
  'Travel',
  'Education',
  'Subscriptions',
  'Income',
  'Transfer',
  'Business Expense',
  'Other',
];

const ACCOUNT_TYPES = [
  { value: 'depository', label: 'Cash / Checking' },
  { value: 'credit', label: 'Credit Card' },
  { value: 'loan', label: 'Loan' },
  { value: 'other', label: 'Other' },
];

export default function ManualTransactionForm({ onSuccess, onCancel }: ManualTransactionFormProps) {
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [isExpense, setIsExpense] = useState(true);
  const [category, setCategory] = useState('');
  const [accountName, setAccountName] = useState('');
  const [accountType, setAccountType] = useState('depository');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError('');
    setSuccess('');

    const parsedAmount = parseFloat(amount);
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      setError('Enter a valid positive amount');
      setSubmitting(false);
      return;
    }

    // Plaid convention: positive = money out (expense), negative = money in (income)
    const finalAmount = isExpense ? parsedAmount : -parsedAmount;

    try {
      const res = await fetch('/api/transactions/manual', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          date,
          description,
          amount: finalAmount,
          category: category || undefined,
          accountName: accountName || undefined,
          accountType,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error || 'Failed to save');
        return;
      }

      setSuccess('Transaction saved');
      setDescription('');
      setAmount('');
      setCategory('');
      onSuccess?.();
    } catch {
      setError('Network error');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-900">Add Transaction</h3>
        {onCancel && (
          <button onClick={onCancel} className="text-sm text-gray-400 hover:text-gray-600">
            Cancel
          </button>
        )}
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Expense / Income Toggle */}
        <div className="flex rounded-lg overflow-hidden border border-gray-200">
          <button
            type="button"
            onClick={() => setIsExpense(true)}
            className={`flex-1 py-2 text-sm font-medium transition-colors ${
              isExpense
                ? 'bg-red-50 text-red-700 border-r border-gray-200'
                : 'bg-white text-gray-500 hover:bg-gray-50 border-r border-gray-200'
            }`}
          >
            Expense
          </button>
          <button
            type="button"
            onClick={() => setIsExpense(false)}
            className={`flex-1 py-2 text-sm font-medium transition-colors ${
              !isExpense
                ? 'bg-green-50 text-green-700'
                : 'bg-white text-gray-500 hover:bg-gray-50'
            }`}
          >
            Income
          </button>
        </div>

        {/* Date + Amount Row */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Date</label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#2d1b4e]/20 focus:border-[#2d1b4e]"
              required
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Amount ($)</label>
            <input
              type="number"
              step="0.01"
              min="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0.00"
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#2d1b4e]/20 focus:border-[#2d1b4e]"
              required
            />
          </div>
        </div>

        {/* Description */}
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Description</label>
          <input
            type="text"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Coffee at Blue Bottle"
            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#2d1b4e]/20 focus:border-[#2d1b4e]"
            required
          />
        </div>

        {/* Category */}
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Category</label>
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#2d1b4e]/20 focus:border-[#2d1b4e] bg-white"
          >
            <option value="">Select category...</option>
            {CATEGORIES.map(c => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </div>

        {/* Account */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Account Name</label>
            <input
              type="text"
              value={accountName}
              onChange={(e) => setAccountName(e.target.value)}
              placeholder="Manual Cash"
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#2d1b4e]/20 focus:border-[#2d1b4e]"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Account Type</label>
            <select
              value={accountType}
              onChange={(e) => setAccountType(e.target.value)}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#2d1b4e]/20 focus:border-[#2d1b4e] bg-white"
            >
              {ACCOUNT_TYPES.map(t => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Error / Success */}
        {error && <p className="text-sm text-red-600">{error}</p>}
        {success && <p className="text-sm text-green-600">{success}</p>}

        {/* Submit */}
        <button
          type="submit"
          disabled={submitting}
          className="w-full py-2.5 bg-[#2d1b4e] text-white rounded-lg text-sm font-medium hover:bg-[#3d2b5e] transition-colors disabled:opacity-50"
        >
          {submitting ? 'Saving...' : `Add ${isExpense ? 'Expense' : 'Income'}`}
        </button>
      </form>
    </div>
  );
}
