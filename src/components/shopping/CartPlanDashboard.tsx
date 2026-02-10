'use client';

import { useState, useMemo } from 'react';
import type { CartItem, CartPlan } from './CartPlannerForm';

interface Props {
  plan: CartPlan;
  onUpdatePrices: (items: CartItem[]) => void;
  onReset: () => void;
}

const PRIORITY_STYLE: Record<string, { bg: string; text: string }> = {
  essential: { bg: 'bg-red-100', text: 'text-red-700' },
  recommended: { bg: 'bg-amber-100', text: 'text-amber-700' },
  optional: { bg: 'bg-gray-100', text: 'text-gray-600' },
};

export default function CartPlanDashboard({ plan, onUpdatePrices, onReset }: Props) {
  const [items, setItems] = useState<CartItem[]>(plan.items || []);

  const metrics = useMemo(() => {
    const totalEstimated = items.reduce((sum, item) => sum + (Number(item.estimatedPrice) || 0), 0);
    const totalActual = items.reduce((sum, item) => sum + (Number(item.actualPrice) || 0), 0);
    const itemsWithPrices = items.filter(item => item.actualPrice !== null).length;
    const totalItems = items.length;
    const essentialCount = items.filter(item => item.priority === 'essential').length;

    return { totalEstimated, totalActual, itemsWithPrices, totalItems, essentialCount };
  }, [items]);

  const updatePrice = (id: string, price: number | null) => {
    const updated = items.map(item =>
      item.id === id ? { ...item, actualPrice: price } : item
    );
    setItems(updated);
    onUpdatePrices(updated);
  };

  const fmt = (n: number) => '$' + n.toFixed(2);

  return (
    <div className="space-y-4">

      {/* Summary + Clear */}
      <div className="flex items-center justify-between bg-gray-50 border border-gray-200 px-4 py-3">
        <div className="text-xs text-gray-600">
          <span className="font-semibold text-gray-900">{metrics.totalItems}</span> items
          {' '}({metrics.essentialCount} essential) &middot;{' '}
          Est. <span className="font-mono font-semibold text-gray-900">{fmt(metrics.totalEstimated)}</span>
          {metrics.totalActual > 0 && (
            <>
              {' '}&middot; Actual{' '}
              <span className={`font-mono font-semibold ${metrics.totalActual > metrics.totalEstimated ? 'text-red-700' : 'text-emerald-700'}`}>
                {fmt(metrics.totalActual)}
              </span>
            </>
          )}
        </div>
        <button
          onClick={onReset}
          className="px-3 py-1.5 text-xs text-red-600 border border-red-200 hover:bg-red-50 transition-colors"
        >
          Clear Plan
        </button>
      </div>

      {/* Items Table */}
      <div className="bg-white border border-gray-200">
        <div className="bg-[#2d1b4e] text-white px-4 py-2 flex items-center justify-between">
          <span className="text-sm font-semibold">{plan.categoryLabel}</span>
          <span className="text-xs text-gray-300">
            {metrics.itemsWithPrices}/{metrics.totalItems} priced &middot;{' '}
            {plan.cadence} &middot; {plan.householdSize} person{plan.householdSize > 1 ? 's' : ''}
          </span>
        </div>

        <table className="w-full text-xs">
          <thead className="bg-[#3d2b5e] text-white">
            <tr>
              <th className="px-3 py-2 text-left font-medium">Item</th>
              <th className="px-3 py-2 text-left font-medium">Package</th>
              <th className="px-3 py-2 text-left font-medium">Priority</th>
              <th className="px-3 py-2 text-right font-medium">Est.</th>
              <th className="px-3 py-2 text-right font-medium w-24">Actual</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {items.map(item => {
              const ps = PRIORITY_STYLE[item.priority] || PRIORITY_STYLE.optional;
              return (
                <tr key={item.id} className="hover:bg-gray-50">
                  <td className="px-3 py-2">
                    <div className="font-medium text-gray-900">{item.name}</div>
                    {item.notes && <div className="text-[10px] text-gray-400">{item.notes}</div>}
                  </td>
                  <td className="px-3 py-2 text-gray-600">{item.packageSize}</td>
                  <td className="px-3 py-2">
                    <span className={`px-2 py-0.5 text-[10px] uppercase font-medium ${ps.bg} ${ps.text}`}>
                      {item.priority}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-right font-mono text-gray-600">{fmt(Number(item.estimatedPrice) || 0)}</td>
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
              );
            })}
          </tbody>
          <tfoot className="bg-gray-50 border-t border-gray-200">
            <tr>
              <td colSpan={3} className="px-3 py-2 font-semibold text-gray-900">Total</td>
              <td className="px-3 py-2 text-right font-mono font-bold text-gray-900">{fmt(metrics.totalEstimated)}</td>
              <td className="px-3 py-2 text-right font-mono font-bold">
                <span className={metrics.totalActual > metrics.totalEstimated ? 'text-red-700' : 'text-emerald-700'}>
                  {metrics.totalActual > 0 ? fmt(metrics.totalActual) : '\u2014'}
                </span>
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}
