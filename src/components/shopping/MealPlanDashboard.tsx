'use client';

import { useState, useMemo } from 'react';
import type { MealPlan, Ingredient, Meal } from './MealPlannerForm';

interface Props {
  plan: MealPlan;
  onUpdatePrices: (shoppingList: Ingredient[]) => void;
  onReset: () => void;
  committedAt?: string | null;
  onCommit?: () => void;
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

export default function MealPlanDashboard({ plan, onUpdatePrices, onReset, committedAt, onCommit }: Props) {
  const [shoppingList, setShoppingList] = useState<Ingredient[]>(plan.shoppingList || []);

  // ─────────────────────────────────────────────────────────────────────────
  // METRICS
  // ─────────────────────────────────────────────────────────────────────────

  const metrics = useMemo(() => {
    const totalEstimated = shoppingList.reduce((sum, item) => sum + (Number(item.estimatedPrice) || 0), 0);
    const totalActual = shoppingList.reduce((sum, item) => sum + (Number(item.actualPrice) || 0), 0);
    const itemsWithPrices = shoppingList.filter(item => item.actualPrice !== null).length;
    const totalItems = shoppingList.length;

    return { totalEstimated, totalActual, itemsWithPrices, totalItems };
  }, [shoppingList]);

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

  const getMealsForDay = (day: number): Meal[] => {
    return (plan.meals || []).filter(m => m.day === day).sort((a, b) => {
      const order = { breakfast: 0, lunch: 1, dinner: 2, snack: 3 };
      return (order[a.mealType] || 4) - (order[b.mealType] || 4);
    });
  };

  // ─────────────────────────────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-4">

      {/* Summary + Clear */}
      <div className="flex items-center justify-between bg-gray-50 border border-gray-200 px-4 py-3">
        <div className="text-xs text-gray-600">
          <span className="font-semibold text-gray-900">{(plan.meals || []).length}</span> meals &middot;{' '}
          <span className="font-semibold text-gray-900">{metrics.totalItems}</span> shopping items &middot;{' '}
          Est. <span className="font-mono font-semibold text-gray-900">{fmt(metrics.totalEstimated)}</span>
        </div>
        <div className="flex items-center gap-2">
          {committedAt ? (
            <span className="px-3 py-1.5 text-xs font-medium bg-emerald-100 text-emerald-700 border border-emerald-200">
              Committed &#10003;
            </span>
          ) : onCommit ? (
            <button
              onClick={onCommit}
              className="px-3 py-1.5 text-xs font-medium bg-emerald-600 text-white hover:bg-emerald-700 transition-colors"
            >
              Commit to Budget
            </button>
          ) : null}
          <button
            onClick={onReset}
            className="px-3 py-1.5 text-xs text-red-600 border border-red-200 hover:bg-red-50 transition-colors"
          >
            Clear Plan
          </button>
        </div>
      </div>

      {/* 7 Days of Meals */}
      {DAYS.map((dayName, i) => {
        const dayNum = i + 1;
        const meals = getMealsForDay(dayNum);
        return (
          <div key={dayName} className="bg-white border border-gray-200">
            <div className="bg-[#2d1b4e] text-white px-4 py-2 text-sm font-semibold flex justify-between">
              <span>{dayName}</span>
              <span className="text-gray-300">{meals.length} meals</span>
            </div>

            {meals.length > 0 ? (
              <div className="divide-y divide-gray-100">
                {meals.map(meal => (
                  <div key={meal.id} className="px-4 py-3">
                    {/* Meal Header */}
                    <div className="flex items-center justify-between mb-2">
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
                          {meal.mealType} · {(Number(meal.prepTime) || 0) + (Number(meal.cookTime) || 0)} min · {meal.calories} cal · {meal.protein}g protein
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <span className="text-[10px] bg-gray-200 px-2 py-1 text-gray-600">P: {meal.protein}g</span>
                        <span className="text-[10px] bg-gray-200 px-2 py-1 text-gray-600">C: {meal.carbs}g</span>
                        <span className="text-[10px] bg-gray-200 px-2 py-1 text-gray-600">F: {meal.fat}g</span>
                      </div>
                    </div>

                    {meal.description && (
                      <p className="text-xs text-gray-600 mb-2">{meal.description}</p>
                    )}

                    {/* Ingredients */}
                    <div className="mb-2">
                      <div className="text-[10px] text-gray-500 uppercase tracking-wider mb-1">Ingredients</div>
                      <ul className="space-y-0.5">
                        {(meal.ingredients || []).map((ing, j) => (
                          <li key={j} className="text-xs text-gray-600">• {ing.quantity} {ing.unit} {ing.name}</li>
                        ))}
                      </ul>
                    </div>

                    {/* Instructions */}
                    <div>
                      <div className="text-[10px] text-gray-500 uppercase tracking-wider mb-1">Instructions</div>
                      <ol className="space-y-0.5">
                        {(meal.instructions || []).map((step, j) => (
                          <li key={j} className="text-xs text-gray-600">
                            <span className="font-medium text-gray-900">{j + 1}.</span> {step}
                          </li>
                        ))}
                      </ol>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="px-4 py-6 text-center text-gray-400 text-xs">No meals planned</div>
            )}
          </div>
        );
      })}

      {/* Shopping List */}
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
                        ? Number(item.actualPrice) > Number(item.estimatedPrice) * 1.1
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
    </div>
  );
}
