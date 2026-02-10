'use client';

import { useState } from 'react';

// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────

export type CartCategory = 'clothing' | 'hygiene' | 'cleaning' | 'kitchen';

export interface CartItem {
  id: string;
  name: string;
  quantity: number;
  unit: string;
  packageSize: string;
  estimatedPrice: number;
  actualPrice: number | null;
  category: string;
  priority: 'essential' | 'recommended' | 'optional';
  notes: string;
}

export interface CartPlan {
  id: string;
  createdAt: string;
  category: CartCategory;
  categoryLabel: string;
  coaCode: string;
  householdSize: number;
  cadence: string;
  budgetMin: number;
  budgetMax: number;
  items: CartItem[];
  totalEstimated: number;
  totalActual: number;
}

interface Props {
  category: CartCategory;
  onPlanGenerated: (plan: CartPlan) => void;
}

// ─────────────────────────────────────────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────────────────────────────────────────

const CATEGORY_LABELS: Record<CartCategory, string> = {
  clothing: 'Clothing & Personal Care',
  hygiene: 'Hygiene & Toiletries',
  cleaning: 'Cleaning Supplies',
  kitchen: 'Kitchen & Household',
};

const BUDGET_OPTIONS = [
  { value: 'budget', min: 25, max: 50, label: '$25-50', desc: 'Essentials only' },
  { value: 'moderate', min: 50, max: 100, label: '$50-100', desc: 'Balanced coverage' },
  { value: 'premium', min: 100, max: 175, label: '$100-175', desc: 'Full restock' },
  { value: 'luxury', min: 175, max: 300, label: '$175-300', desc: 'Premium brands' },
];

const CADENCE_OPTIONS = [
  { value: 'monthly', label: 'Monthly', desc: 'Standard refill cycle' },
  { value: 'quarterly', label: 'Quarterly', desc: 'Bulk buy every 3 months' },
  { value: 'as-needed', label: 'As Needed', desc: 'Minimum restock now' },
];

// ─────────────────────────────────────────────────────────────────────────────
// COMPONENT
// ─────────────────────────────────────────────────────────────────────────────

export default function CartPlannerForm({ category, onPlanGenerated }: Props) {
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [budgetIdx, setBudgetIdx] = useState(1); // default 'moderate'
  const [householdSize, setHouseholdSize] = useState(1);
  const [cadence, setCadence] = useState('monthly');
  const [preferences, setPreferences] = useState('');
  const [excludeItems, setExcludeItems] = useState('');

  const totalSteps = 2;
  const budget = BUDGET_OPTIONS[budgetIdx];
  const categoryLabel = CATEGORY_LABELS[category];

  const generate = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/ai/cart-plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          category,
          budgetMin: budget.min,
          budgetMax: budget.max,
          householdSize,
          cadence,
          preferences,
          excludeItems,
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to generate cart plan');
      }
      const plan = await res.json();
      onPlanGenerated(plan);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Request failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Progress Bar */}
      <div className="flex items-center gap-2 mb-4">
        <div className="text-[10px] text-gray-500 uppercase tracking-wider">Step {step} of {totalSteps}</div>
        <div className="flex-1 bg-gray-200 h-1">
          <div className="bg-[#2d1b4e] h-1 transition-all" style={{ width: `${(step / totalSteps) * 100}%` }} />
        </div>
      </div>

      {/* Step 1: Budget & Preferences */}
      {step === 1 && (
        <div className="space-y-4">
          <div className="bg-[#2d1b4e] text-white px-4 py-2 text-sm font-semibold">
            Step 1: {categoryLabel} — Budget & Preferences
          </div>

          <div className="p-4 space-y-4">
            <div>
              <div className="text-[10px] text-gray-500 uppercase tracking-wider mb-2">Budget Range</div>
              <div className="grid grid-cols-2 gap-2">
                {BUDGET_OPTIONS.map((opt, i) => (
                  <button
                    key={opt.value}
                    onClick={() => setBudgetIdx(i)}
                    className={`p-4 text-left border transition-colors ${
                      budgetIdx === i
                        ? 'bg-[#2d1b4e] text-white border-[#2d1b4e]'
                        : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'
                    }`}
                  >
                    <div className="font-bold text-lg">{opt.label}</div>
                    <div className={`text-xs ${budgetIdx === i ? 'text-gray-300' : 'text-gray-400'}`}>{opt.desc}</div>
                  </button>
                ))}
              </div>
            </div>

            <div>
              <div className="text-[10px] text-gray-500 uppercase tracking-wider mb-2">Household Size</div>
              <div className="flex gap-2">
                {[1, 2, 3, 4, 5, 6].map(n => (
                  <button
                    key={n}
                    onClick={() => setHouseholdSize(n)}
                    className={`flex-1 py-2 text-sm font-medium border transition-colors ${
                      householdSize === n
                        ? 'bg-[#2d1b4e] text-white border-[#2d1b4e]'
                        : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'
                    }`}
                  >
                    {n}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <div className="text-[10px] text-gray-500 uppercase tracking-wider mb-2">Replenishment Cadence</div>
              <div className="space-y-2">
                {CADENCE_OPTIONS.map(opt => (
                  <button
                    key={opt.value}
                    onClick={() => setCadence(opt.value)}
                    className={`w-full p-3 text-left border transition-colors ${
                      cadence === opt.value
                        ? 'bg-[#2d1b4e] text-white border-[#2d1b4e]'
                        : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'
                    }`}
                  >
                    <div className="font-medium text-sm">{opt.label}</div>
                    <div className={`text-xs ${cadence === opt.value ? 'text-gray-300' : 'text-gray-400'}`}>{opt.desc}</div>
                  </button>
                ))}
              </div>
            </div>

            <div>
              <div className="text-[10px] text-gray-500 uppercase tracking-wider mb-2">
                Preferences / Must-Haves <span className="text-gray-400">(optional)</span>
              </div>
              <input
                type="text"
                value={preferences}
                onChange={e => setPreferences(e.target.value)}
                placeholder="e.g., unscented products, eco-friendly, specific brands"
                className="w-full border border-gray-300 px-3 py-2 text-sm"
              />
            </div>

            <div>
              <div className="text-[10px] text-gray-500 uppercase tracking-wider mb-2">
                Items to Exclude <span className="text-gray-400">(optional)</span>
              </div>
              <input
                type="text"
                value={excludeItems}
                onChange={e => setExcludeItems(e.target.value)}
                placeholder="e.g., bleach, fabric softener, scented candles"
                className="w-full border border-gray-300 px-3 py-2 text-sm"
              />
            </div>
          </div>
        </div>
      )}

      {/* Step 2: Review & Generate */}
      {step === 2 && (
        <div className="space-y-4">
          <div className="bg-[#2d1b4e] text-white px-4 py-2 text-sm font-semibold">
            Step 2: Review & Generate
          </div>

          <div className="p-4 space-y-4">
            <div className="bg-gray-50 border border-gray-200 p-4">
              <div className="text-[10px] text-gray-500 uppercase tracking-wider mb-3">Plan Summary</div>
              <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
                <div className="text-gray-500">Category:</div>
                <div className="font-medium text-gray-900">{categoryLabel}</div>

                <div className="text-gray-500">Budget:</div>
                <div className="font-medium text-gray-900">{budget.label} ({budget.desc})</div>

                <div className="text-gray-500">Household:</div>
                <div className="font-medium text-gray-900">{householdSize} person{householdSize > 1 ? 's' : ''}</div>

                <div className="text-gray-500">Cadence:</div>
                <div className="font-medium text-gray-900 capitalize">{cadence.replace('-', ' ')}</div>

                {preferences && (
                  <>
                    <div className="text-gray-500">Preferences:</div>
                    <div className="font-medium text-emerald-700">{preferences}</div>
                  </>
                )}

                {excludeItems && (
                  <>
                    <div className="text-gray-500">Exclude:</div>
                    <div className="font-medium text-red-700">{excludeItems}</div>
                  </>
                )}
              </div>
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 p-3 text-red-700 text-sm">
                {error}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Navigation */}
      <div className="flex gap-2 pt-2">
        {step > 1 && (
          <button
            onClick={() => setStep(s => s - 1)}
            className="flex-1 px-4 py-2 text-sm font-medium bg-gray-100 text-gray-600 hover:bg-gray-200 transition-colors"
          >
            &larr; Back
          </button>
        )}
        {step < totalSteps ? (
          <button
            onClick={() => setStep(s => s + 1)}
            className="flex-1 px-4 py-2 text-sm font-medium bg-[#2d1b4e] text-white hover:bg-[#3d2b5e] transition-colors"
          >
            Next &rarr;
          </button>
        ) : (
          <button
            onClick={generate}
            disabled={loading}
            className="flex-1 px-4 py-2 text-sm font-medium bg-emerald-600 text-white hover:bg-emerald-700 transition-colors disabled:opacity-50"
          >
            {loading ? 'Generating...' : `Generate ${categoryLabel} List`}
          </button>
        )}
      </div>
    </div>
  );
}
