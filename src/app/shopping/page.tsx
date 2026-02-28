'use client';

import { useState, useEffect } from 'react';
import { AppLayout } from '@/components/ui';
import MealPlannerForm, { MealPlan, Ingredient } from '@/components/shopping/MealPlannerForm';
import MealPlanDashboard from '@/components/shopping/MealPlanDashboard';
import CartPlannerForm, { CartPlan, CartItem, CartCategory } from '@/components/shopping/CartPlannerForm';
import CartPlanDashboard from '@/components/shopping/CartPlanDashboard';

function getEmail(): string {
  return document.cookie.split('; ').find(c => c.startsWith('userEmail='))?.split('=')[1] || 'default';
}
function getMealPlanKey(): string { return `mealPlan_${getEmail()}`; }
function getCartPlanKey(category: CartCategory): string { return `cartPlan_${category}_${getEmail()}`; }

type PlannerCategory = 'meals' | CartCategory;

const ALL_CATEGORIES: { key: PlannerCategory; label: string; coaCode: string }[] = [
  { key: 'meals', label: 'Meals', coaCode: 'P-8120' },
  { key: 'clothing', label: 'Clothing', coaCode: 'P-8150' },
  { key: 'hygiene', label: 'Hygiene', coaCode: 'P-8310' },
  { key: 'cleaning', label: 'Cleaning', coaCode: 'P-8320' },
  { key: 'kitchen', label: 'Kitchen', coaCode: 'P-8330' },
];

export default function ShoppingPage() {
  const [loading, setLoading] = useState(true);
  const [mealPlan, setMealPlan] = useState<MealPlan | null>(null);
  const [cartPlans, setCartPlans] = useState<Record<CartCategory, CartPlan | null>>({
    clothing: null, hygiene: null, cleaning: null, kitchen: null,
  });
  const [activeCategory, setActiveCategory] = useState<PlannerCategory>('meals');
  const [userTier, setUserTier] = useState<string>('free');
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [commitLoading, setCommitLoading] = useState(false);

  useEffect(() => {
    fetch('/api/auth/me').then(res => res.ok ? res.json() : null).then(data => {
      if (data?.user?.tier) setUserTier(data.user.tier);
    }).finally(() => setLoading(false));

    const saved = localStorage.getItem(getMealPlanKey());
    if (saved) {
      try { setMealPlan(JSON.parse(saved)); } catch { console.error('Failed to load saved meal plan'); }
    }

    const loadedCarts: Record<CartCategory, CartPlan | null> = { clothing: null, hygiene: null, cleaning: null, kitchen: null };
    for (const cat of ALL_CATEGORIES) {
      if (cat.key === 'meals') continue;
      const cartSaved = localStorage.getItem(getCartPlanKey(cat.key as CartCategory));
      if (cartSaved) {
        try { loadedCarts[cat.key as CartCategory] = JSON.parse(cartSaved); } catch { console.error(`Failed to load ${cat.key} cart plan`); }
      }
    }
    setCartPlans(loadedCarts);
  }, []);

  // ─── Meal Plan Handlers ──────────────────────────────────────────────────

  const handleMealGenerated = (plan: MealPlan) => {
    setMealPlan(plan);
    localStorage.setItem(getMealPlanKey(), JSON.stringify(plan));
  };

  const handleMealUpdatePrices = (shoppingList: Ingredient[]) => {
    if (!mealPlan) return;
    const updated = { ...mealPlan, shoppingList, totalActual: shoppingList.reduce((sum, item) => sum + (Number(item.actualPrice) || 0), 0) };
    setMealPlan(updated);
    localStorage.setItem(getMealPlanKey(), JSON.stringify(updated));
  };

  const handleMealReset = () => {
    setMealPlan(null);
    localStorage.removeItem(getMealPlanKey());
  };

  // ─── Cart Plan Handlers ──────────────────────────────────────────────────

  const handleCartGenerated = (category: CartCategory, plan: CartPlan) => {
    setCartPlans(prev => ({ ...prev, [category]: plan }));
    localStorage.setItem(getCartPlanKey(category), JSON.stringify(plan));
  };

  const handleCartUpdatePrices = (category: CartCategory, items: CartItem[]) => {
    const plan = cartPlans[category];
    if (!plan) return;
    const updated = { ...plan, items, totalActual: items.reduce((sum, item) => sum + (Number(item.actualPrice) || 0), 0) };
    setCartPlans(prev => ({ ...prev, [category]: updated }));
    localStorage.setItem(getCartPlanKey(category), JSON.stringify(updated));
  };

  const handleCartReset = (category: CartCategory) => {
    setCartPlans(prev => ({ ...prev, [category]: null }));
    localStorage.removeItem(getCartPlanKey(category));
  };

  // ─── Commit Handler ──────────────────────────────────────────────────────

  const handleCommit = async (plannerCategory: PlannerCategory) => {
    const catConfig = ALL_CATEGORIES.find(c => c.key === plannerCategory);
    if (!catConfig) return;

    let amount: number;
    let cadence: string;
    if (plannerCategory === 'meals') {
      if (!mealPlan) return;
      amount = Number(mealPlan.totalEstimated) || 0;
      cadence = 'weekly';
    } else {
      const plan = cartPlans[plannerCategory as CartCategory];
      if (!plan) return;
      amount = Number(plan.totalEstimated) || 0;
      cadence = plan.cadence || 'monthly';
    }

    setCommitLoading(true);
    try {
      const res = await fetch('/api/shopping/commit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: `${catConfig.label} — AI Plan`,
          coaCode: catConfig.coaCode,
          amount,
          cadence,
        }),
      });
      if (!res.ok) throw new Error('Commit failed');

      const now = new Date().toISOString();
      if (plannerCategory === 'meals') {
        const updated = { ...mealPlan!, committedAt: now };
        setMealPlan(updated);
        localStorage.setItem(getMealPlanKey(), JSON.stringify(updated));
      } else {
        const cat = plannerCategory as CartCategory;
        const updated = { ...cartPlans[cat]!, committedAt: now };
        setCartPlans(prev => ({ ...prev, [cat]: updated }));
        localStorage.setItem(getCartPlanKey(cat), JSON.stringify(updated));
      }
    } catch (err) {
      console.error('Commit error:', err);
      alert('Failed to commit budget. Please try again.');
    } finally {
      setCommitLoading(false);
    }
  };

  // ─── Derived Values ──────────────────────────────────────────────────────

  const fmt = (n: number) => '$' + Math.abs(n).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 });

  const mealBudget = Number(mealPlan?.totalEstimated) || 0;
  const cartBudgetTotal = Object.values(cartPlans).reduce((sum, p) => sum + (Number(p?.totalEstimated) || 0), 0);
  const planCount = (mealPlan ? 1 : 0) + Object.values(cartPlans).filter(Boolean).length;

  // Check if a category has a plan
  const hasPlan = (cat: PlannerCategory): boolean => {
    if (cat === 'meals') return !!mealPlan;
    return !!cartPlans[cat as CartCategory];
  };

  if (loading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center py-20">
          <div className="w-6 h-6 border-2 border-brand-purple border-t-transparent rounded-full animate-spin" />
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="min-h-screen bg-bg-terminal">
        <div className="p-4 lg:p-6 max-w-[1600px] mx-auto">

          {/* Header */}
          <div className="mb-4 bg-brand-purple text-white p-4">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-terminal-lg font-semibold tracking-tight">Shopping Planner</h1>
                <p className="text-text-faint text-xs font-mono">
                  {planCount} plan{planCount !== 1 ? 's' : ''} active
                </p>
              </div>
            </div>
          </div>

          {/* Quick Stats */}
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 mb-4">
            <div className="bg-white border border-border p-3">
              <div className="text-[10px] text-text-muted uppercase tracking-wider">Meal Budget</div>
              <div className="text-sm font-bold font-mono text-text-primary">{fmt(mealBudget)}</div>
              <div className="text-[10px] text-text-faint">weekly estimate</div>
            </div>
            <div className="bg-white border border-border p-3">
              <div className="text-[10px] text-text-muted uppercase tracking-wider">Cart Plans</div>
              <div className="text-sm font-bold font-mono text-text-primary">{fmt(cartBudgetTotal)}</div>
              <div className="text-[10px] text-text-faint">{Object.values(cartPlans).filter(Boolean).length} categories</div>
            </div>
            <div className="bg-white border border-border p-3">
              <div className="text-[10px] text-text-muted uppercase tracking-wider">Total Budget</div>
              <div className="text-sm font-bold font-mono text-text-primary">{fmt(mealBudget + cartBudgetTotal)}</div>
              <div className="text-[10px] text-text-faint">all categories</div>
            </div>
          </div>

          {/* Category Selector + Content */}
          <div className="bg-white border border-border">
            <div className="bg-brand-purple text-white px-4 py-2 text-sm font-semibold">
              AI Shopping Planner
            </div>

            {/* Category Buttons */}
            <div className="flex gap-1 p-3 border-b border-border bg-bg-row">
              {ALL_CATEGORIES.map(cat => (
                <button
                  key={cat.key}
                  onClick={() => setActiveCategory(cat.key)}
                  className={`px-4 py-2 text-xs font-medium transition-colors ${
                    activeCategory === cat.key
                      ? 'bg-brand-purple text-white'
                      : hasPlan(cat.key)
                        ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                        : 'bg-white text-text-secondary border border-border hover:bg-bg-row'
                  }`}
                >
                  {cat.label}
                  {hasPlan(cat.key) && activeCategory !== cat.key && ' \u2713'}
                </button>
              ))}
            </div>

            {/* Content */}
            <div className="p-4">
              {/* Meals */}
              {activeCategory === 'meals' && (
                mealPlan ? (
                  <MealPlanDashboard
                    plan={mealPlan}
                    onUpdatePrices={handleMealUpdatePrices}
                    onReset={handleMealReset}
                    committedAt={(mealPlan as any).committedAt || null}
                    onCommit={commitLoading ? undefined : () => handleCommit('meals')}
                  />
                ) : (
                  userTier === 'free' ? (
                    <div className="text-center py-8">
                      <div className="text-sm font-medium text-text-primary mb-2">AI Shopping Planner requires Pro+</div>
                      <div className="text-xs text-text-muted mb-4">Upgrade to Pro+ ($40/mo) to unlock AI-powered planning.</div>
                      <button onClick={() => setShowUpgradeModal(true)} className="px-6 py-2 text-xs bg-brand-purple text-white font-medium hover:bg-brand-purple-hover">View Plans</button>
                    </div>
                  ) : (
                    <MealPlannerForm onPlanGenerated={handleMealGenerated} />
                  )
                )
              )}

              {/* Cart Categories */}
              {activeCategory !== 'meals' && (() => {
                const cat = activeCategory as CartCategory;
                const plan = cartPlans[cat];
                return plan ? (
                  <CartPlanDashboard
                    plan={plan}
                    onUpdatePrices={(items) => handleCartUpdatePrices(cat, items)}
                    onReset={() => handleCartReset(cat)}
                    committedAt={(plan as any).committedAt || null}
                    onCommit={commitLoading ? undefined : () => handleCommit(cat)}
                  />
                ) : (
                  userTier === 'free' ? (
                    <div className="text-center py-8">
                      <div className="text-sm font-medium text-text-primary mb-2">AI Shopping Planner requires Pro+</div>
                      <div className="text-xs text-text-muted mb-4">Upgrade to Pro+ ($40/mo) to unlock AI-powered planning.</div>
                      <button onClick={() => setShowUpgradeModal(true)} className="px-6 py-2 text-xs bg-brand-purple text-white font-medium hover:bg-brand-purple-hover">View Plans</button>
                    </div>
                  ) : (
                    <CartPlannerForm
                      category={cat}
                      onPlanGenerated={(plan) => handleCartGenerated(cat, plan)}
                    />
                  )
                );
              })()}
            </div>
          </div>
        </div>
      </div>

      {showUpgradeModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setShowUpgradeModal(false)} />
          <div className="relative z-10 bg-white border border-border p-6 max-w-md">
            <div className="text-sm font-medium text-text-primary mb-2">AI Shopping Planner requires Pro+</div>
            <div className="text-xs text-text-muted mb-4">Upgrade to Pro+ ($40/mo) to unlock AI-powered planning.</div>
            <div className="flex gap-2">
              <button onClick={() => window.location.href = "/pricing"} className="flex-1 px-4 py-2 text-xs bg-brand-purple text-white font-medium hover:bg-brand-purple-hover">View Plans</button>
              <button onClick={() => setShowUpgradeModal(false)} className="flex-1 px-4 py-2 text-xs border border-border text-text-secondary font-medium hover:bg-bg-row">Not Now</button>
            </div>
          </div>
        </div>
      )}
    </AppLayout>
  );
}
