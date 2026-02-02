'use client';

import { useState, useMemo } from 'react';
import { Button } from '@/components/ui';
import type { MealPlan, Ingredient, Meal } from './MealPlannerForm';

interface Props {
  plan: MealPlan;
  onUpdatePrices: (shoppingList: Ingredient[]) => void;
  onReset: () => void;
}

const CATEGORY_CONFIG: Record<string, { icon: string; color: string; bg: string }> = {
  produce: { icon: '🥬', color: 'text-green-400', bg: 'bg-green-500/10' },
  dairy: { icon: '🥛', color: 'text-blue-400', bg: 'bg-blue-500/10' },
  meat: { icon: '🥩', color: 'text-red-400', bg: 'bg-red-500/10' },
  seafood: { icon: '🐟', color: 'text-cyan-400', bg: 'bg-cyan-500/10' },
  grains: { icon: '🌾', color: 'text-amber-400', bg: 'bg-amber-500/10' },
  pantry: { icon: '🥫', color: 'text-orange-400', bg: 'bg-orange-500/10' },
  frozen: { icon: '🧊', color: 'text-sky-400', bg: 'bg-sky-500/10' },
  beverages: { icon: '🥤', color: 'text-purple-400', bg: 'bg-purple-500/10' },
  spices: { icon: '🧂', color: 'text-yellow-400', bg: 'bg-yellow-500/10' },
};

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

export default function MealPlanDashboard({ plan, onUpdatePrices, onReset }: Props) {
  const [shoppingList, setShoppingList] = useState<Ingredient[]>(plan.shoppingList);
  const [selectedDay, setSelectedDay] = useState<number>(1);
  const [expandedMeal, setExpandedMeal] = useState<string | null>(null);
  const [view, setView] = useState<'dashboard' | 'meals' | 'shopping'>('dashboard');

  // ─────────────────────────────────────────────────────────────────────────
  // METRICS CALCULATIONS
  // ─────────────────────────────────────────────────────────────────────────

  const metrics = useMemo(() => {
    const totalEstimated = shoppingList.reduce((sum, item) => sum + item.estimatedPrice, 0);
    const totalActual = shoppingList.reduce((sum, item) => sum + (item.actualPrice || 0), 0);
    const itemsWithPrices = shoppingList.filter(item => item.actualPrice !== null).length;
    const completionRate = shoppingList.length > 0 ? (itemsWithPrices / shoppingList.length) * 100 : 0;
    const variance = totalActual - totalEstimated;
    const variancePercent = totalEstimated > 0 ? (variance / totalEstimated) * 100 : 0;

    // Category breakdown
    const byCategory: Record<string, { estimated: number; actual: number; count: number }> = {};
    shoppingList.forEach(item => {
      const cat = item.category || 'other';
      if (!byCategory[cat]) byCategory[cat] = { estimated: 0, actual: 0, count: 0 };
      byCategory[cat].estimated += item.estimatedPrice;
      byCategory[cat].actual += item.actualPrice || 0;
      byCategory[cat].count++;
    });

    // Find problem areas (items over budget)
    const overBudgetItems = shoppingList.filter(
      item => item.actualPrice !== null && item.actualPrice > item.estimatedPrice * 1.1
    );

    // Nutrition summary
    const totalCalories = plan.meals.reduce((sum, m) => sum + (m.calories || 0), 0);
    const totalProtein = plan.meals.reduce((sum, m) => sum + (m.protein || 0), 0);
    const avgCaloriesPerDay = Math.round(totalCalories / 7);

    return {
      totalEstimated,
      totalActual,
      itemsWithPrices,
      totalItems: shoppingList.length,
      completionRate,
      variance,
      variancePercent,
      byCategory,
      overBudgetItems,
      avgCaloriesPerDay,
      totalProtein: Math.round(totalProtein / 7),
      mealsCount: plan.meals.length,
    };
  }, [shoppingList, plan.meals]);

  // ─────────────────────────────────────────────────────────────────────────
  // HANDLERS
  // ─────────────────────────────────────────────────────────────────────────

  const updatePrice = (id: string, price: number | null) => {
    const updated = shoppingList.map(item =>
      item.id === id ? { ...item, actualPrice: price } : item
    );
    setShoppingList(updated);
    onUpdatePrices(updated);
  };

  const fmt = (n: number) => '$' + n.toFixed(2);
  const fmtVar = (n: number) => (n >= 0 ? '+' : '') + '$' + n.toFixed(2);

  // ─────────────────────────────────────────────────────────────────────────
  // RENDER HELPERS
  // ─────────────────────────────────────────────────────────────────────────

  const getMealsForDay = (day: number): Meal[] => {
    return plan.meals.filter(m => m.day === day).sort((a, b) => {
      const order = { breakfast: 0, lunch: 1, dinner: 2, snack: 3 };
      return (order[a.mealType] || 4) - (order[b.mealType] || 4);
    });
  };

  const getVarianceClass = (actual: number, estimated: number) => {
    if (actual === 0) return 'text-zinc-500';
    const diff = actual - estimated;
    if (diff <= 0) return 'text-emerald-400';
    if (diff <= estimated * 0.1) return 'text-amber-400';
    return 'text-red-400';
  };

  // ─────────────────────────────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* Header with Tabs */}
      <div className="bg-zinc-900 rounded-2xl border border-zinc-800 overflow-hidden">
        <div className="bg-gradient-to-r from-emerald-600 via-teal-600 to-cyan-600 p-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-bold text-white">Weekly Meal Plan</h2>
              <p className="text-white/70 text-sm">
                {plan.profile.peopleCount} {plan.profile.peopleCount === 1 ? 'person' : 'people'} • 
                {plan.profile.diet} • 
                {plan.meals.length} meals
              </p>
            </div>
            <Button 
              variant="secondary" 
              onClick={onReset}
              className="bg-white/20 hover:bg-white/30 text-white border-white/20"
            >
              ✏️ New Plan
            </Button>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-zinc-800">
          {(['dashboard', 'meals', 'shopping'] as const).map(tab => (
            <button
              key={tab}
              onClick={() => setView(tab)}
              className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${
                view === tab
                  ? 'text-emerald-400 border-b-2 border-emerald-400 bg-zinc-800/50'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              {tab === 'dashboard' && '📊 Dashboard'}
              {tab === 'meals' && '🍽️ Meals'}
              {tab === 'shopping' && '🛒 Shopping List'}
            </button>
          ))}
        </div>

        {/* Dashboard View */}
        {view === 'dashboard' && (
          <div className="p-6 space-y-6">
            {/* KPI Cards - PE/Hedge Fund Style */}
            <div className="grid grid-cols-4 gap-4">
              {/* Budget vs Actual */}
              <div className="bg-zinc-800/50 rounded-xl p-4 border border-zinc-700">
                <div className="text-xs text-zinc-500 uppercase tracking-wider mb-1">Budget</div>
                <div className="text-2xl font-bold text-white">{fmt(metrics.totalEstimated)}</div>
                <div className="text-xs text-zinc-400 mt-1">estimated total</div>
              </div>

              <div className="bg-zinc-800/50 rounded-xl p-4 border border-zinc-700">
                <div className="text-xs text-zinc-500 uppercase tracking-wider mb-1">Actual</div>
                <div className={`text-2xl font-bold ${metrics.totalActual > 0 ? 'text-white' : 'text-zinc-600'}`}>
                  {metrics.totalActual > 0 ? fmt(metrics.totalActual) : '—'}
                </div>
                <div className="text-xs text-zinc-400 mt-1">
                  {metrics.itemsWithPrices}/{metrics.totalItems} priced
                </div>
              </div>

              <div className="bg-zinc-800/50 rounded-xl p-4 border border-zinc-700">
                <div className="text-xs text-zinc-500 uppercase tracking-wider mb-1">Variance</div>
                <div className={`text-2xl font-bold ${
                  metrics.variance === 0 ? 'text-zinc-600' :
                  metrics.variance < 0 ? 'text-emerald-400' : 'text-red-400'
                }`}>
                  {metrics.itemsWithPrices > 0 ? fmtVar(metrics.variance) : '—'}
                </div>
                <div className={`text-xs mt-1 ${
                  metrics.variancePercent <= 0 ? 'text-emerald-400' : 'text-red-400'
                }`}>
                  {metrics.itemsWithPrices > 0 ? `${metrics.variancePercent.toFixed(1)}% vs budget` : 'enter prices'}
                </div>
              </div>

              <div className="bg-zinc-800/50 rounded-xl p-4 border border-zinc-700">
                <div className="text-xs text-zinc-500 uppercase tracking-wider mb-1">Completion</div>
                <div className="text-2xl font-bold text-white">{metrics.completionRate.toFixed(0)}%</div>
                <div className="w-full bg-zinc-700 rounded-full h-1.5 mt-2">
                  <div 
                    className="bg-emerald-500 h-1.5 rounded-full transition-all"
                    style={{ width: `${metrics.completionRate}%` }}
                  />
                </div>
              </div>
            </div>

            {/* Category Breakdown */}
            <div className="bg-zinc-800/30 rounded-xl border border-zinc-700 overflow-hidden">
              <div className="px-4 py-3 border-b border-zinc-700 flex items-center justify-between">
                <h3 className="font-medium text-white">Category Breakdown</h3>
                <span className="text-xs text-zinc-500">{Object.keys(metrics.byCategory).length} categories</span>
              </div>
              <div className="divide-y divide-zinc-800">
                {Object.entries(metrics.byCategory)
                  .sort(([,a], [,b]) => b.estimated - a.estimated)
                  .map(([category, data]) => {
                    const config = CATEGORY_CONFIG[category] || { icon: '📦', color: 'text-zinc-400', bg: 'bg-zinc-500/10' };
                    const variance = data.actual - data.estimated;
                    return (
                      <div key={category} className="px-4 py-3 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <span className={`w-8 h-8 rounded-lg ${config.bg} flex items-center justify-center`}>
                            {config.icon}
                          </span>
                          <div>
                            <div className="font-medium text-white capitalize">{category}</div>
                            <div className="text-xs text-zinc-500">{data.count} items</div>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="font-medium text-white">{fmt(data.estimated)}</div>
                          {data.actual > 0 && (
                            <div className={`text-xs ${getVarianceClass(data.actual, data.estimated)}`}>
                              {fmtVar(variance)}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
              </div>
            </div>

            {/* Problem Areas */}
            {metrics.overBudgetItems.length > 0 && (
              <div className="bg-red-500/10 rounded-xl border border-red-500/30 p-4">
                <h3 className="font-medium text-red-400 mb-3">⚠️ Over Budget Items ({metrics.overBudgetItems.length})</h3>
                <div className="space-y-2">
                  {metrics.overBudgetItems.map(item => (
                    <div key={item.id} className="flex items-center justify-between text-sm">
                      <span className="text-zinc-300">{item.name}</span>
                      <span className="text-red-400">
                        {fmt(item.actualPrice!)} vs {fmt(item.estimatedPrice)} est
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Nutrition Summary */}
            <div className="grid grid-cols-3 gap-4">
              <div className="bg-zinc-800/50 rounded-xl p-4 border border-zinc-700 text-center">
                <div className="text-3xl mb-1">🔥</div>
                <div className="text-xl font-bold text-white">{metrics.avgCaloriesPerDay}</div>
                <div className="text-xs text-zinc-500">avg cal/day</div>
              </div>
              <div className="bg-zinc-800/50 rounded-xl p-4 border border-zinc-700 text-center">
                <div className="text-3xl mb-1">💪</div>
                <div className="text-xl font-bold text-white">{metrics.totalProtein}g</div>
                <div className="text-xs text-zinc-500">avg protein/day</div>
              </div>
              <div className="bg-zinc-800/50 rounded-xl p-4 border border-zinc-700 text-center">
                <div className="text-3xl mb-1">🍽️</div>
                <div className="text-xl font-bold text-white">{metrics.mealsCount}</div>
                <div className="text-xs text-zinc-500">total meals</div>
              </div>
            </div>
          </div>
        )}

        {/* Meals View */}
        {view === 'meals' && (
          <div className="p-6">
            {/* Day Selector */}
            <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
              {DAYS.map((day, i) => (
                <button
                  key={day}
                  onClick={() => setSelectedDay(i + 1)}
                  className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-all ${
                    selectedDay === i + 1
                      ? 'bg-emerald-500 text-white'
                      : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'
                  }`}
                >
                  {day}
                </button>
              ))}
            </div>

            {/* Meals for Selected Day */}
            <div className="space-y-4">
              {getMealsForDay(selectedDay).map(meal => (
                <div 
                  key={meal.id} 
                  className="bg-zinc-800/50 rounded-xl border border-zinc-700 overflow-hidden"
                >
                  <button
                    onClick={() => setExpandedMeal(expandedMeal === meal.id ? null : meal.id)}
                    className="w-full px-4 py-4 flex items-center justify-between text-left"
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-lg bg-zinc-700 flex items-center justify-center text-xl">
                        {meal.mealType === 'breakfast' && '🍳'}
                        {meal.mealType === 'lunch' && '🥗'}
                        {meal.mealType === 'dinner' && '🍽️'}
                        {meal.mealType === 'snack' && '🍎'}
                      </div>
                      <div>
                        <div className="font-medium text-white">{meal.name}</div>
                        <div className="text-sm text-zinc-400 capitalize">{meal.mealType}</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="text-right">
                        <div className="text-sm text-white">{meal.calories} cal</div>
                        <div className="text-xs text-zinc-500">{meal.prepTime + meal.cookTime} min</div>
                      </div>
                      <span className={`transition-transform ${expandedMeal === meal.id ? 'rotate-180' : ''}`}>
                        ▼
                      </span>
                    </div>
                  </button>

                  {expandedMeal === meal.id && (
                    <div className="px-4 pb-4 border-t border-zinc-700 pt-4">
                      <p className="text-zinc-400 text-sm mb-4">{meal.description}</p>
                      
                      {/* Macros */}
                      <div className="flex gap-4 mb-4">
                        <span className="text-xs bg-zinc-700 px-2 py-1 rounded text-zinc-300">
                          P: {meal.protein}g
                        </span>
                        <span className="text-xs bg-zinc-700 px-2 py-1 rounded text-zinc-300">
                          C: {meal.carbs}g
                        </span>
                        <span className="text-xs bg-zinc-700 px-2 py-1 rounded text-zinc-300">
                          F: {meal.fat}g
                        </span>
                      </div>

                      {/* Ingredients */}
                      <div className="mb-4">
                        <h4 className="text-sm font-medium text-zinc-300 mb-2">Ingredients</h4>
                        <ul className="space-y-1">
                          {meal.ingredients.map((ing, i) => (
                            <li key={i} className="text-sm text-zinc-400">
                              • {ing.quantity} {ing.unit} {ing.name}
                            </li>
                          ))}
                        </ul>
                      </div>

                      {/* Instructions */}
                      <div>
                        <h4 className="text-sm font-medium text-zinc-300 mb-2">Instructions</h4>
                        <ol className="space-y-2">
                          {meal.instructions.map((step, i) => (
                            <li key={i} className="text-sm text-zinc-400 flex gap-2">
                              <span className="text-emerald-400 font-medium">{i + 1}.</span>
                              {step}
                            </li>
                          ))}
                        </ol>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Shopping List View */}
        {view === 'shopping' && (
          <div className="p-6">
            {/* Quick Stats */}
            <div className="flex items-center justify-between mb-4 pb-4 border-b border-zinc-700">
              <div className="text-sm text-zinc-400">
                {metrics.itemsWithPrices} of {metrics.totalItems} items priced
              </div>
              <div className="flex items-center gap-4">
                <div className="text-sm">
                  <span className="text-zinc-500">Est:</span>
                  <span className="text-white font-medium ml-1">{fmt(metrics.totalEstimated)}</span>
                </div>
                {metrics.totalActual > 0 && (
                  <div className="text-sm">
                    <span className="text-zinc-500">Actual:</span>
                    <span className={`font-medium ml-1 ${
                      metrics.variance <= 0 ? 'text-emerald-400' : 'text-red-400'
                    }`}>
                      {fmt(metrics.totalActual)}
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Shopping Items by Category */}
            {Object.entries(
              shoppingList.reduce((acc, item) => {
                const cat = item.category || 'other';
                if (!acc[cat]) acc[cat] = [];
                acc[cat].push(item);
                return acc;
              }, {} as Record<string, Ingredient[]>)
            )
              .sort(([a], [b]) => a.localeCompare(b))
              .map(([category, items]) => {
                const config = CATEGORY_CONFIG[category] || { icon: '📦', color: 'text-zinc-400', bg: 'bg-zinc-500/10' };
                return (
                  <div key={category} className="mb-6">
                    <div className="flex items-center gap-2 mb-3">
                      <span className={`w-6 h-6 rounded ${config.bg} flex items-center justify-center text-sm`}>
                        {config.icon}
                      </span>
                      <h3 className="font-medium text-white capitalize">{category}</h3>
                      <span className="text-xs text-zinc-500">({items.length})</span>
                    </div>

                    <div className="space-y-2">
                      {items.map(item => (
                        <div 
                          key={item.id}
                          className="bg-zinc-800/50 rounded-lg border border-zinc-700 p-3 flex items-center justify-between"
                        >
                          <div className="flex-1">
                            <div className="font-medium text-white">{item.name}</div>
                            <div className="text-xs text-zinc-500">
                              {item.packageSize} • {item.notes}
                            </div>
                          </div>

                          <div className="flex items-center gap-4">
                            <div className="text-right">
                              <div className="text-xs text-zinc-500">Est</div>
                              <div className="text-sm text-zinc-300">{fmt(item.estimatedPrice)}</div>
                            </div>

                            <div className="w-24">
                              <input
                                type="number"
                                step="0.01"
                                min="0"
                                placeholder="Actual"
                                value={item.actualPrice ?? ''}
                                onChange={e => updatePrice(
                                  item.id, 
                                  e.target.value ? parseFloat(e.target.value) : null
                                )}
                                className={`w-full bg-zinc-900 border rounded px-2 py-1.5 text-sm text-right ${
                                  item.actualPrice !== null
                                    ? item.actualPrice > item.estimatedPrice * 1.1
                                      ? 'border-red-500 text-red-400'
                                      : 'border-emerald-500 text-emerald-400'
                                    : 'border-zinc-700 text-white'
                                }`}
                              />
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
          </div>
        )}
      </div>
    </div>
  );
}
