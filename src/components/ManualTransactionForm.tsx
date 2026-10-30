'use client';

import { useMemo, useState } from 'react';
import { ISO_4217_CODE, runtimeCurrencyCodes } from '@/lib/books/functionalCurrency';

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

/**
 * FX-01 (Alex, 2026-10-30, ruling G): the currency a manual account is kept in — chosen by the customer,
 * NEVER preselected (a pre-filled code is a default). The route refuses anything but an ISO 4217 code by name.
 * The books post only an account in the functional currency (functionalCurrency.ts); a manual account in
 * another currency waits for FX-02.
 *
 * FX-01b (ruling C): THE LIST IS THE RUNTIME'S — runtimeCurrencyCodes() reads Intl.supportedValuesOf('currency')
 * at render (the browser's own ISO 4217 list), never a hand-picked list. A runtime without that list gets a
 * typed three-letter field under the route's own rule (ISO_4217_CODE). The field says which path rendered
 * (data-currency-source="runtime-list" | "typed"); neither preselects a code.
 */
export const CHOOSE_CURRENCY_WORDS = '— choose the currency —';
export const CURRENCY_NOT_CHOSEN_WORDS = 'choose the currency this account is kept in';
export const CURRENCY_NOT_A_CODE_WORDS = 'the currency is a three-letter ISO 4217 code in capitals (USD, PHP, …)';
export const TYPED_CURRENCY_PLACEHOLDER = 'three letters, e.g. PHP';

export default function ManualTransactionForm({ onSuccess, onCancel }: ManualTransactionFormProps) {
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [isExpense, setIsExpense] = useState(true);
  const [category, setCategory] = useState('');
  const [accountName, setAccountName] = useState('');
  const [accountType, setAccountType] = useState('depository');
  // FX-01: no preselected currency — '' until the customer chooses.
  const [currency, setCurrency] = useState('');
  // FX-01b: the runtime's own list, read at render; null when the runtime has none (the typed path).
  const currencies = useMemo(() => runtimeCurrencyCodes(), []);
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
    if (currency === '') {
      setError(CURRENCY_NOT_CHOSEN_WORDS);
      setSubmitting(false);
      return;
    }
    if (!ISO_4217_CODE.test(currency)) {
      setError(CURRENCY_NOT_A_CODE_WORDS);
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
          currency,
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
    <div className="bg-white border border-border rounded p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-terminal-lg font-semibold text-text-primary">Add Transaction</h3>
        {onCancel && (
          <button onClick={onCancel} className="text-sm text-text-faint hover:text-text-secondary">
            Cancel
          </button>
        )}
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Expense / Income Toggle */}
        <div className="flex rounded overflow-hidden border border-border">
          <button
            type="button"
            onClick={() => setIsExpense(true)}
            className={`flex-1 py-2 text-sm font-medium transition-colors ${
              isExpense
                ? 'bg-red-50 text-brand-red border-r border-border'
                : 'bg-white text-text-muted hover:bg-bg-row border-r border-border'
            }`}
          >
            Expense
          </button>
          <button
            type="button"
            onClick={() => setIsExpense(false)}
            className={`flex-1 py-2 text-sm font-medium transition-colors ${
              !isExpense
                ? 'bg-green-50 text-brand-green'
                : 'bg-white text-text-muted hover:bg-bg-row'
            }`}
          >
            Income
          </button>
        </div>

        {/* Date + Amount Row */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-text-secondary mb-1">Date</label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full px-3 py-2 border border-border rounded text-sm focus:outline-none focus:ring-2 focus:ring-brand-purple/20 focus:border-brand-purple"
              required
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-text-secondary mb-1">Amount{currency ? ` (${currency})` : ''}</label>
            <input
              type="number"
              step="0.01"
              min="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0.00"
              className="w-full px-3 py-2 border border-border rounded text-sm focus:outline-none focus:ring-2 focus:ring-brand-purple/20 focus:border-brand-purple"
              required
            />
          </div>
        </div>

        {/* Currency — FX-01 (ruling G): required, nothing preselected; FX-01b (ruling C): the runtime's list, or a typed code */}
        <div>
          <label className="block text-xs font-medium text-text-secondary mb-1">Currency</label>
          {currencies !== null ? (
            <select
              value={currency}
              onChange={(e) => setCurrency(e.target.value)}
              required
              data-manual-currency
              data-currency-source="runtime-list"
              className="w-full px-3 py-2 border border-border rounded text-sm focus:outline-none focus:ring-2 focus:ring-brand-purple/20 focus:border-brand-purple bg-white"
            >
              <option value="" disabled>{CHOOSE_CURRENCY_WORDS}</option>
              {currencies.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          ) : (
            <input
              type="text"
              value={currency}
              onChange={(e) => setCurrency(e.target.value)}
              required
              maxLength={3}
              pattern="[A-Z]{3}"
              placeholder={TYPED_CURRENCY_PLACEHOLDER}
              data-manual-currency
              data-currency-source="typed"
              className="w-full px-3 py-2 border border-border rounded text-sm focus:outline-none focus:ring-2 focus:ring-brand-purple/20 focus:border-brand-purple"
            />
          )}
        </div>

        {/* Description */}
        <div>
          <label className="block text-xs font-medium text-text-secondary mb-1">Description</label>
          <input
            type="text"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Coffee at Blue Bottle"
            className="w-full px-3 py-2 border border-border rounded text-sm focus:outline-none focus:ring-2 focus:ring-brand-purple/20 focus:border-brand-purple"
            required
          />
        </div>

        {/* Category */}
        <div>
          <label className="block text-xs font-medium text-text-secondary mb-1">Category</label>
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="w-full px-3 py-2 border border-border rounded text-sm focus:outline-none focus:ring-2 focus:ring-brand-purple/20 focus:border-brand-purple bg-white"
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
            <label className="block text-xs font-medium text-text-secondary mb-1">Account Name</label>
            <input
              type="text"
              value={accountName}
              onChange={(e) => setAccountName(e.target.value)}
              placeholder="Manual Cash"
              className="w-full px-3 py-2 border border-border rounded text-sm focus:outline-none focus:ring-2 focus:ring-brand-purple/20 focus:border-brand-purple"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-text-secondary mb-1">Account Type</label>
            <select
              value={accountType}
              onChange={(e) => setAccountType(e.target.value)}
              className="w-full px-3 py-2 border border-border rounded text-sm focus:outline-none focus:ring-2 focus:ring-brand-purple/20 focus:border-brand-purple bg-white"
            >
              {ACCOUNT_TYPES.map(t => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Error / Success */}
        {error && <p className="text-sm text-brand-red">{error}</p>}
        {success && <p className="text-sm text-brand-green">{success}</p>}

        {/* Submit */}
        <button
          type="submit"
          disabled={submitting}
          className="w-full py-2.5 bg-brand-purple text-white rounded text-sm font-medium hover:bg-brand-purple-hover transition-colors disabled:opacity-50"
        >
          {submitting ? 'Saving...' : `Add ${isExpense ? 'Expense' : 'Income'}`}
        </button>
      </form>
    </div>
  );
}
