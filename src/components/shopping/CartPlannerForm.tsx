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
  { value: 'semi-annual', label: 'Semi-Annual', desc: 'Stock up every 6 months' },
  { value: 'annual', label: 'Annual', desc: 'Yearly bulk purchase, max savings' },
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
        <div className="text-[10px] text-text-muted uppercase tracking-wider">Step {step} of {totalSteps}</div>
        <div className="flex-1 bg-border h-1">
          <div className="bg-brand-purple h-1 transition-all" style={{ width: `${(step / totalSteps) * 100}%` }} />
        </div>
      </div>

      {/* Step 1: Budget & Preferences */}
      {step === 1 && (
        <div className="space-y-4">
          <div className="bg-brand-purple text-white px-4 py-2 text-sm font-semibold">
            Step 1: {categoryLabel} — Budget & Preferences
          </div>

          <div className="p-4 space-y-4">
            <div>
              <div className="text-[10px] text-text-muted uppercase tracking-wider mb-2">Budget Range</div>
              <div className="grid grid-cols-2 gap-2">
                {BUDGET_OPTIONS.map((opt, i) => (
                  <button
                    key={opt.value}
                    onClick={() => setBudgetIdx(i)}
                    className={`p-4 text-left border transition-colors ${
                      budgetIdx === i
                        ? 'bg-brand-purple text-white border-brand-purple'
                        : 'bg-white text-text-secondary border-border hover:bg-bg-row'
                    }`}
                  >
                    <div className="font-bold text-terminal-lg">{opt.label}</div>
                    <div className={`text-xs ${budgetIdx === i ? 'text-text-faint' : 'text-text-faint'}`}>{opt.desc}</div>
                  </button>
                ))}
              </div>
            </div>

            <div>
              <div className="text-[10px] text-text-muted uppercase tracking-wider mb-2">Household Size</div>
              <div className="flex gap-2">
                {[1, 2, 3, 4, 5, 6].map(n => (
                  <button
                    key={n}
                    onClick={() => setHouseholdSize(n)}
                    className={`flex-1 py-2 text-sm font-medium border transition-colors ${
                      householdSize === n
                        ? 'bg-brand-purple text-white border-brand-purple'
                        : 'bg-white text-text-secondary border-border hover:bg-bg-row'
                    }`}
                  >
                    {n}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <div className="text-[10px] text-text-muted uppercase tracking-wider mb-2">Replenishment Cadence</div>
              <div className="space-y-2">
                {CADENCE_OPTIONS.map(opt => (
                  <button
                    key={opt.value}
                    onClick={() => setCadence(opt.value)}
                    className={`w-full p-3 text-left border transition-colors ${
                      cadence === opt.value
                        ? 'bg-brand-purple text-white border-brand-purple'
                        : 'bg-white text-text-secondary border-border hover:bg-bg-row'
                    }`}
                  >
                    <div className="font-medium text-sm">{opt.label}</div>
                    <div className={`text-xs ${cadence === opt.value ? 'text-text-faint' : 'text-text-faint'}`}>{opt.desc}</div>
                  </button>
                ))}
              </div>
            </div>

            <div>
              <div className="text-[10px] text-text-muted uppercase tracking-wider mb-2">
                Preferences / Must-Haves <span className="text-text-faint">(optional)</span>
              </div>
              <input
                type="text"
                value={preferences}
                onChange={e => setPreferences(e.target.value)}
                placeholder="e.g., unscented products, eco-friendly, specific brands"
                className="w-full border border-border px-3 py-2 text-sm"
              />
            </div>

            <div>
              <div className="text-[10px] text-text-muted uppercase tracking-wider mb-2">
                Items to Exclude <span className="text-text-faint">(optional)</span>
              </div>
              <input
                type="text"
                value={excludeItems}
                onChange={e => setExcludeItems(e.target.value)}
                placeholder="e.g., bleach, fabric softener, scented candles"
                className="w-full border border-border px-3 py-2 text-sm"
              />
            </div>
          </div>
        </div>
      )}

      {/* Step 2: Review & Generate */}
      {step === 2 && (
        <div className="space-y-4">
          <div className="bg-brand-purple text-white px-4 py-2 text-sm font-semibold">
            Step 2: Review & Generate
          </div>

          <div className="p-4 space-y-4">
            <div className="bg-bg-row border border-border p-4">
              <div className="text-[10px] text-text-muted uppercase tracking-wider mb-3">Plan Summary</div>
              <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
                <div className="text-text-muted">Category:</div>
                <div className="font-medium text-text-primary">{categoryLabel}</div>

                <div className="text-text-muted">Budget:</div>
                <div className="font-medium text-text-primary">{budget.label} ({budget.desc})</div>

                <div className="text-text-muted">Household:</div>
                <div className="font-medium text-text-primary">{householdSize} person{householdSize > 1 ? 's' : ''}</div>

                <div className="text-text-muted">Cadence:</div>
                <div className="font-medium text-text-primary capitalize">{cadence.replace('-', ' ')}</div>

                {preferences && (
                  <>
                    <div className="text-text-muted">Preferences:</div>
                    <div className="font-medium text-emerald-700">{preferences}</div>
                  </>
                )}

                {excludeItems && (
                  <>
                    <div className="text-text-muted">Exclude:</div>
                    <div className="font-medium text-brand-red">{excludeItems}</div>
                  </>
                )}
              </div>
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 p-3 text-brand-red text-sm">
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
            className="flex-1 px-4 py-2 text-sm font-medium bg-bg-row text-text-secondary hover:bg-border transition-colors"
          >
            &larr; Back
          </button>
        )}
        {step < totalSteps ? (
          <button
            onClick={() => setStep(s => s + 1)}
            className="flex-1 px-4 py-2 text-sm font-medium bg-brand-purple text-white hover:bg-brand-purple-hover transition-colors"
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
