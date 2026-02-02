'use client';

import { useState, useMemo } from 'react';
import type { MealPlan, Ingredient, Meal } from './MealPlannerForm';

interface Props {
  plan: MealPlan;
  onUpdatePrices: (shoppingList: Ingredient[]) => void;
  onReset: () => void;
}

const CATEGORY_CONFIG: Record<string, { label: string }> = {
  produce: { label: 'Produce' },
  dairy: { label: 'Dairy & Eggs' },
  meat: { label: 'Meat & Poultry' },
  seafood: { label: 'Seafood' },
  grains: { label: 'Grains & Bread' },
  pantry: { label: 'Pantry' },
  frozen: { label: 'Frozen' },
  beverages: { label: 'Beverages' },
  spices: { label: 'Spices & Seasonings' },
};

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

export default function MealPlanDashboard({ plan, onUpdatePrices, onReset }: Props) {
  const [shoppingList, setShoppingList] = useState<Ingredient[]>(plan.shoppingList);
  const [selectedDay, setSelectedDay] = useState<number>(1);
  const [expandedMeal, setExpandedMeal] = useState<string | null>(null);
  const [view, setView] = useState<'dashboard' | 'prep' | 'meals' | 'shopping'>('dashboard');

  const isMealPrep = plan.profile.cookingStyle === 'meal-prep';

  // ─────────────────────────────────────────────────────────────────────────
  // METRICS
  // ─────────────────────────────────────────────────────────────────────────

  const metrics = useMemo(() => {
    const totalEstimated = shoppingList.reduce((sum, item) => sum + item.estimatedPrice, 0);
    const totalActual = shoppingList.reduce((sum, item) => sum + (item.actualPrice || 0), 0);
    const itemsWithPrices = shoppingList.filter(item => item.actualPrice !== null).length;
    const completionRate = shoppingList.length > 0 ? (itemsWithPrices / shoppingList.length) * 100 : 0;
    const variance = totalActual - totalEstimated;
    const variancePercent = totalEstimated > 0 ? (variance / totalEstimated) * 100 : 0;

    const byCategory: Record<string, { estimated: number; actual: number; count: number }> = {};
    shoppingList.forEach(item => {
      const cat = item.category || 'other';
      if (!byCategory[cat]) byCategory[cat] = { estimated: 0, actual: 0, count: 0 };
      byCategory[cat].estimated += item.estimatedPrice;
      byCategory[cat].actual += item.actualPrice || 0;
      byCategory[cat].count++;
    });

    const overBudgetItems = shoppingList.filter(
      item => item.actualPrice !== null && item.actualPrice > item.estimatedPrice * 1.1
    );

    const totalCalories = plan.meals.reduce((sum, m) => sum + (m.calories || 0), 0);
    const totalProtein = plan.meals.reduce((sum, m) => sum + (m.protein || 0), 0);

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
      avgCaloriesPerDay: Math.round(totalCalories / 7),
      avgProtein: Math.round(totalProtein / 7),
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

  const getMealsForDay = (day: number): Meal[] => {
    return plan.meals.filter(m => m.day === day).sort((a, b) => {
      const order = { breakfast: 0, lunch: 1, dinner: 2, snack: 3 };
      return (order[a.mealType] || 4) - (order[b.mealType] || 4);
    });
  };

  const getMealsByPrepDay = (prepDay: number): Meal[] => {
    return plan.meals.filter(m => m.prepDay === prepDay);
  };

  // ─────────────────────────────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-4">
      {/* Sub-tabs */}
      <div className="flex border-b border-gray-200">
        <button
          onClick={() => setView('dashboard')}
          className={`px-4 py-2 text-xs font-medium transition-colors ${
            view === 'dashboard' ? 'bg-[#2d1b4e] text-white' : 'bg-gray-50 text-gray-600 hover:bg-gray-100'
          }`}
        >
          Dashboard
        </button>
        {isMealPrep && (
          <button
            onClick={() => setView('prep')}
            className={`px-4 py-2 text-xs font-medium transition-colors ${
              view === 'prep' ? 'bg-[#2d1b4e] text-white' : 'bg-gray-50 text-gray-600 hover:bg-gray-100'
            }`}
          >
            Prep Schedule
          </button>
        )}
        <button
          onClick={() => setView('meals')}
          className={`px-4 py-2 text-xs font-medium transition-colors ${
            view === 'meals' ? 'bg-[#2d1b4e] text-white' : 'bg-gray-50 text-gray-600 hover:bg-gray-100'
          }`}
        >
          7-Day Meals
        </button>
        <button
          onClick={() => setView('shopping')}
          className={`px-4 py-2 text-xs font-medium transition-colors ${
            view === 'shopping' ? 'bg-[#2d1b4e] text-white' : 'bg-gray-50 text-gray-600 hover:bg-gray-100'
          }`}
        >
          Shopping List
        </button>
      </div>

      {/* Dashboard View */}
      {view === 'dashboard' && (
        <div className="space-y-4">
          {/* Plan Info */}
          <div className="bg-gray-50 border border-gray-200 p-3">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-[10px] text-gray-500 uppercase tracking-wider">Cooking Style</span>
                <div className="font-medium text-gray-900 capitalize">{plan.profile.cookingStyle.replace('-', ' ')}</div>
              </div>
              <div>
                <span className="text-[10px] text-gray-500 uppercase tracking-wider">Cooking Days</span>
                <div className="font-medium text-gray-900">{plan.profile.cookingDays}/week</div>
              </div>
              <div>
                <span className="text-[10px] text-gray-500 uppercase tracking-wider">Meals Planned</span>
                <div className="font-medium text-gray-900">{metrics.mealsCount}</div>
              </div>
              <div>
                <span className="text-[10px] text-gray-500 uppercase tracking-wider">Eating Out</span>
                <div className="font-medium text-gray-900">{plan.profile.eatOutMeals}/week</div>
              </div>
            </div>
          </div>

          {/* KPI Cards */}
          <div className="grid grid-cols-4 gap-3">
            <div className="bg-white border border-gray-200 p-3">
              <div className="text-[10px] text-gray-500 uppercase tracking-wider">Budget</div>
              <div className="text-xl font-bold font-mono text-gray-900">{fmt(metrics.totalEstimated)}</div>
              <div className="text-[10px] text-gray-400">estimated</div>
            </div>
            <div className="bg-white border border-gray-200 p-3">
              <div className="text-[10px] text-gray-500 uppercase tracking-wider">Actual</div>
              <div className={`text-xl font-bold font-mono ${metrics.totalActual > 0 ? 'text-gray-900' : 'text-gray-400'}`}>
                {metrics.totalActual > 0 ? fmt(metrics.totalActual) : '—'}
              </div>
              <div className="text-[10px] text-gray-400">{metrics.itemsWithPrices}/{metrics.totalItems} priced</div>
            </div>
            <div className="bg-white border border-gray-200 p-3">
              <div className="text-[10px] text-gray-500 uppercase tracking-wider">Variance</div>
              <div className={`text-xl font-bold font-mono ${
                metrics.variance === 0 ? 'text-gray-400' :
                metrics.variance < 0 ? 'text-emerald-700' : 'text-red-700'
              }`}>
                {metrics.itemsWithPrices > 0 ? fmtVar(metrics.variance) : '—'}
              </div>
              <div className={`text-[10px] ${metrics.variancePercent <= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                {metrics.itemsWithPrices > 0 ? `${metrics.variancePercent.toFixed(1)}%` : 'enter prices'}
              </div>
            </div>
            <div className="bg-white border border-gray-200 p-3">
              <div className="text-[10px] text-gray-500 uppercase tracking-wider">Completion</div>
              <div className="text-xl font-bold font-mono text-gray-900">{metrics.completionRate.toFixed(0)}%</div>
              <div className="w-full bg-gray-200 h-1 mt-1">
                <div className="bg-[#2d1b4e] h-1 transition-all" style={{ width: `${metrics.completionRate}%` }} />
              </div>
            </div>
          </div>

          {/* Category Breakdown Table */}
          <div className="bg-white border border-gray-200">
            <div className="bg-[#2d1b4e] text-white px-4 py-2 text-sm font-semibold">
              Category Breakdown
            </div>
            <table className="w-full text-xs">
              <thead className="bg-[#3d2b5e] text-white">
                <tr>
                  <th className="px-3 py-2 text-left font-medium">Category</th>
                  <th className="px-3 py-2 text-center font-medium">Items</th>
                  <th className="px-3 py-2 text-right font-medium">Estimated</th>
                  <th className="px-3 py-2 text-right font-medium">Actual</th>
                  <th className="px-3 py-2 text-right font-medium">Variance</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {Object.entries(metrics.byCategory)
                  .sort(([,a], [,b]) => b.estimated - a.estimated)
                  .map(([category, data]) => {
                    const variance = data.actual - data.estimated;
                    return (
                      <tr key={category} className="hover:bg-gray-50">
                        <td className="px-3 py-2 font-medium text-gray-900 capitalize">
                          {CATEGORY_CONFIG[category]?.label || category}
                        </td>
                        <td className="px-3 py-2 text-center text-gray-600">{data.count}</td>
                        <td className="px-3 py-2 text-right font-mono">{fmt(data.estimated)}</td>
                        <td className="px-3 py-2 text-right font-mono">
                          {data.actual > 0 ? fmt(data.actual) : '—'}
                        </td>
                        <td className={`px-3 py-2 text-right font-mono font-medium ${
                          data.actual === 0 ? 'text-gray-400' :
                          variance <= 0 ? 'text-emerald-700' : 'text-red-700'
                        }`}>
                          {data.actual > 0 ? fmtVar(variance) : '—'}
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
              <tfoot className="bg-gray-50 border-t border-gray-200">
                <tr>
                  <td className="px-3 py-2 font-semibold text-gray-900">Total</td>
                  <td className="px-3 py-2 text-center font-semibold">{metrics.totalItems}</td>
                  <td className="px-3 py-2 text-right font-mono font-bold">{fmt(metrics.totalEstimated)}</td>
                  <td className="px-3 py-2 text-right font-mono font-bold">
                    {metrics.totalActual > 0 ? fmt(metrics.totalActual) : '—'}
                  </td>
                  <td className={`px-3 py-2 text-right font-mono font-bold ${
                    metrics.variance <= 0 ? 'text-emerald-700' : 'text-red-700'
                  }`}>
                    {metrics.itemsWithPrices > 0 ? fmtVar(metrics.variance) : '—'}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>

          {/* Over Budget Alert */}
          {metrics.overBudgetItems.length > 0 && (
            <div className="bg-red-50 border border-red-200 p-3">
              <div className="text-[10px] text-red-600 uppercase tracking-wider mb-2">Over Budget Items ({metrics.overBudgetItems.length})</div>
              <div className="space-y-1">
                {metrics.overBudgetItems.map(item => (
                  <div key={item.id} className="flex justify-between text-xs">
                    <span className="text-gray-700">{item.name}</span>
                    <span className="text-red-700 font-mono">{fmt(item.actualPrice!)} vs {fmt(item.estimatedPrice)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Nutrition Summary */}
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-white border border-gray-200 p-3 text-center">
              <div className="text-[10px] text-gray-500 uppercase tracking-wider">Avg Calories/Day</div>
              <div className="text-xl font-bold font-mono text-gray-900">{metrics.avgCaloriesPerDay}</div>
            </div>
            <div className="bg-white border border-gray-200 p-3 text-center">
              <div className="text-[10px] text-gray-500 uppercase tracking-wider">Avg Protein/Day</div>
              <div className="text-xl font-bold font-mono text-gray-900">{metrics.avgProtein}g</div>
            </div>
            <div className="bg-white border border-gray-200 p-3 text-center">
              <div className="text-[10px] text-gray-500 uppercase tracking-wider">Total Meals</div>
              <div className="text-xl font-bold font-mono text-gray-900">{metrics.mealsCount}</div>
            </div>
          </div>
        </div>
      )}

      {/* Prep Schedule View */}
      {view === 'prep' && (
        <div className="space-y-4">
          <div className="bg-amber-50 border border-amber-200 p-3">
            <div className="text-sm text-amber-800">
              <strong>Meal Prep Mode:</strong> Cook on {plan.profile.cookingDays} day(s), eat all week. 
              Below is your prep schedule showing what to cook each cooking day.
            </div>
          </div>

          {plan.prepSchedule && plan.prepSchedule.length > 0 ? (
            <div className="space-y-4">
              {plan.prepSchedule.map((prepDay, idx) => (
                <div key={idx} className="bg-white border border-gray-200">
                  <div className="bg-[#2d1b4e] text-white px-4 py-2 text-sm font-semibold flex justify-between">
                    <span>Prep Day: {prepDay.dayName}</span>
                    <span className="text-gray-300">{prepDay.meals.length} items to prep</span>
                  </div>
                  <div className="p-4">
                    <ul className="space-y-2">
                      {prepDay.meals.map((meal, mIdx) => (
                        <li key={mIdx} className="flex items-start gap-2">
                          <span className="text-emerald-600 mt-0.5">✓</span>
                          <span className="text-sm text-gray-700">{meal}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            // Fallback: group meals by prepDay
            <div className="space-y-4">
              {[1, 2, 3, 4, 5, 6, 7].map(prepDay => {
                const mealsForPrepDay = getMealsByPrepDay(prepDay);
                if (mealsForPrepDay.length === 0) return null;
                return (
                  <div key={prepDay} className="bg-white border border-gray-200">
                    <div className="bg-[#2d1b4e] text-white px-4 py-2 text-sm font-semibold flex justify-between">
                      <span>Prep Day: {DAYS[prepDay - 1]}</span>
                      <span className="text-gray-300">{mealsForPrepDay.length} meals</span>
                    </div>
                    <div className="divide-y divide-gray-100">
                      {mealsForPrepDay.map(meal => (
                        <div key={meal.id} className="px-4 py-3">
                          <div className="flex justify-between items-start">
                            <div>
                              <div className="font-medium text-gray-900 text-sm">{meal.name}</div>
                              <div className="text-xs text-gray-500">
                                For {DAYS[meal.day - 1]} {meal.mealType} · {meal.servings} servings
                              </div>
                            </div>
                            <div className="text-xs text-gray-500">
                              {meal.prepTime + meal.cookTime} min
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

          {/* Prep Tips */}
          <div className="bg-gray-50 border border-gray-200 p-4">
            <div className="text-[10px] text-gray-500 uppercase tracking-wider mb-2">Meal Prep Tips</div>
            <ul className="space-y-1 text-xs text-gray-600">
              <li>• Start with items that take longest to cook (proteins, grains)</li>
              <li>• Prep vegetables while proteins are cooking</li>
              <li>• Let food cool before storing to prevent condensation</li>
              <li>• Label containers with meal name and date</li>
              <li>• Most prepped meals last 4-5 days refrigerated</li>
            </ul>
          </div>
        </div>
      )}

      {/* Meals View */}
      {view === 'meals' && (
        <div className="space-y-4">
          {/* Day Selector */}
          <div className="flex gap-1 bg-white border border-gray-200">
            {DAYS.map((day, i) => (
              <button
                key={day}
                onClick={() => setSelectedDay(i + 1)}
                className={`flex-1 px-2 py-2 text-xs font-medium transition-colors ${
                  selectedDay === i + 1
                    ? 'bg-[#2d1b4e] text-white'
                    : 'text-gray-600 hover:bg-gray-100'
                }`}
              >
                {day.slice(0, 3)}
              </button>
            ))}
          </div>

          {/* Meals Table */}
          <div className="bg-white border border-gray-200">
            <div className="bg-[#2d1b4e] text-white px-4 py-2 text-sm font-semibold">
              {DAYS[selectedDay - 1]} Meals
            </div>
            <div className="divide-y divide-gray-100">
              {getMealsForDay(selectedDay).map(meal => (
                <div key={meal.id}>
                  <button
                    onClick={() => setExpandedMeal(expandedMeal === meal.id ? null : meal.id)}
                    className="w-full px-4 py-3 flex items-center justify-between text-left hover:bg-gray-50"
                  >
                    <div>
                      <div className="font-medium text-gray-900 text-sm">
                        {meal.name}
                        {meal.isMealPrep && (
                          <span className="ml-2 text-[10px] bg-amber-100 text-amber-700 px-1.5 py-0.5 uppercase">
                            Prepped
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-gray-500 capitalize">
                        {meal.mealType} · {meal.prepTime + meal.cookTime} min
                        {meal.prepDay && <span> · Prep on {DAYS[meal.prepDay - 1]}</span>}
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="text-right">
                        <div className="text-sm font-mono font-medium text-gray-900">{meal.calories} cal</div>
                        <div className="text-[10px] text-gray-500">{meal.protein}g protein</div>
                      </div>
                      <span className={`text-gray-400 transition-transform ${expandedMeal === meal.id ? 'rotate-180' : ''}`}>▼</span>
                    </div>
                  </button>

                  {expandedMeal === meal.id && (
                    <div className="px-4 pb-4 bg-gray-50 border-t border-gray-100">
                      <p className="text-sm text-gray-600 py-3">{meal.description}</p>
                      
                      <div className="flex gap-3 mb-3">
                        <span className="text-[10px] bg-gray-200 px-2 py-1 text-gray-600">P: {meal.protein}g</span>
                        <span className="text-[10px] bg-gray-200 px-2 py-1 text-gray-600">C: {meal.carbs}g</span>
                        <span className="text-[10px] bg-gray-200 px-2 py-1 text-gray-600">F: {meal.fat}g</span>
                      </div>

                      <div className="mb-3">
                        <div className="text-[10px] text-gray-500 uppercase tracking-wider mb-2">Ingredients</div>
                        <ul className="space-y-1">
                          {meal.ingredients.map((ing, i) => (
                            <li key={i} className="text-xs text-gray-600">• {ing.quantity} {ing.unit} {ing.name}</li>
                          ))}
                        </ul>
                      </div>

                      <div>
                        <div className="text-[10px] text-gray-500 uppercase tracking-wider mb-2">Instructions</div>
                        <ol className="space-y-1">
                          {meal.instructions.map((step, i) => (
                            <li key={i} className="text-xs text-gray-600">
                              <span className="font-medium text-gray-900">{i + 1}.</span> {step}
                            </li>
                          ))}
                        </ol>
                      </div>
                    </div>
                  )}
                </div>
              ))}
              {getMealsForDay(selectedDay).length === 0 && (
                <div className="px-4 py-8 text-center text-gray-400 text-sm">No meals planned for this day</div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Shopping List View */}
      {view === 'shopping' && (
        <div className="bg-white border border-gray-200">
          <div className="bg-[#2d1b4e] text-white px-4 py-2 flex items-center justify-between">
            <span className="text-sm font-semibold">Shopping List</span>
            <span className="text-xs text-gray-300">{metrics.itemsWithPrices}/{metrics.totalItems} priced · Est: {fmt(metrics.totalEstimated)}</span>
          </div>

          <table className="w-full text-xs">
            <thead className="bg-[#3d2b5e] text-white">
              <tr>
                <th className="px-3 py-2 text-left font-medium">Item</th>
                <th className="px-3 py-2 text-left font-medium">Package</th>
                <th className="px-3 py-2 text-left font-medium">Category</th>
                <th className="px-3 py-2 text-right font-medium">Est.</th>
                <th className="px-3 py-2 text-right font-medium w-24">Actual</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {shoppingList.map(item => (
                <tr key={item.id} className="hover:bg-gray-50">
                  <td className="px-3 py-2">
                    <div className="font-medium text-gray-900">{item.name}</div>
                    <div className="text-[10px] text-gray-400">{item.notes}</div>
                  </td>
                  <td className="px-3 py-2 text-gray-600">{item.packageSize}</td>
                  <td className="px-3 py-2 text-gray-600 capitalize">{CATEGORY_CONFIG[item.category]?.label || item.category}</td>
                  <td className="px-3 py-2 text-right font-mono text-gray-600">{fmt(item.estimatedPrice)}</td>
                  <td className="px-3 py-2 text-right">
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      placeholder="0.00"
                      value={item.actualPrice ?? ''}
                      onChange={e => updatePrice(item.id, e.target.value ? parseFloat(e.target.value) : null)}
                      className={`w-full border px-2 py-1 text-right font-mono text-sm ${
                        item.actualPrice !== null
                          ? item.actualPrice > item.estimatedPrice * 1.1
                            ? 'border-red-300 bg-red-50 text-red-700'
                            : 'border-emerald-300 bg-emerald-50 text-emerald-700'
                          : 'border-gray-300'
                      }`}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot className="bg-gray-50 border-t border-gray-200">
              <tr>
                <td colSpan={3} className="px-3 py-2 font-semibold text-gray-900">Total</td>
                <td className="px-3 py-2 text-right font-mono font-bold text-gray-900">{fmt(metrics.totalEstimated)}</td>
                <td className="px-3 py-2 text-right font-mono font-bold">
                  <span className={metrics.totalActual > metrics.totalEstimated ? 'text-red-700' : 'text-emerald-700'}>
                    {metrics.totalActual > 0 ? fmt(metrics.totalActual) : '—'}
                  </span>
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </div>
  );
}
