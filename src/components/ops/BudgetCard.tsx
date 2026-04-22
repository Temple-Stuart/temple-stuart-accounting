'use client';

import { useState } from 'react';
import { DailyPlan } from './types';

interface BudgetCardProps {
  budgetTarget: number | null;
  budgetActual: number | null;
  onUpdate: (field: keyof DailyPlan, value: DailyPlan[keyof DailyPlan]) => void;
}

export default function BudgetCard({ budgetTarget, budgetActual, onUpdate }: BudgetCardProps) {
  const [targetStr, setTargetStr] = useState(budgetTarget?.toString() ?? '');
  const [actualStr, setActualStr] = useState(budgetActual?.toString() ?? '');

  const commitNumber = (field: keyof DailyPlan, raw: string) => {
    const parsed = parseFloat(raw);
    onUpdate(field, isNaN(parsed) ? null : parsed);
  };

  const hasStatus = budgetTarget != null && budgetTarget > 0 && budgetActual != null;
  const delta = hasStatus ? ((budgetActual! - budgetTarget!) / budgetTarget!) * 100 : 0;
  const isUnder = hasStatus && budgetActual! <= budgetTarget!;

  return (
    <div className="bg-white rounded border border-border shadow-sm overflow-hidden">
      <div className="flex items-center justify-between px-3 py-2 border-b border-border">
        <span className="text-terminal-lg font-semibold text-text-primary">Budget</span>
      </div>

      <div className="px-3 py-3 space-y-3">
        {/* Target */}
        <div className="flex items-center gap-2">
          <span className="text-terminal-sm text-text-muted font-mono w-14">Target</span>
          <span className="text-terminal-base text-text-muted font-mono">$</span>
          <input
            type="number"
            value={targetStr}
            onChange={(e) => setTargetStr(e.target.value)}
            onBlur={() => commitNumber('budgetTarget', targetStr)}
            placeholder="0.00"
            className="flex-1 bg-transparent border-none outline-none text-terminal-base font-mono text-text-primary px-1 py-0.5 hover:bg-gray-50 focus:bg-gray-50 rounded transition-colors placeholder:text-text-faint [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
          />
        </div>

        {/* Actual */}
        <div className="flex items-center gap-2">
          <span className="text-terminal-sm text-text-muted font-mono w-14">Actual</span>
          <span className="text-terminal-base text-text-muted font-mono">$</span>
          <input
            type="number"
            value={actualStr}
            onChange={(e) => setActualStr(e.target.value)}
            onBlur={() => commitNumber('budgetActual', actualStr)}
            placeholder="0.00"
            className="flex-1 bg-transparent border-none outline-none text-terminal-base font-mono text-text-primary px-1 py-0.5 hover:bg-gray-50 focus:bg-gray-50 rounded transition-colors placeholder:text-text-faint [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
          />
        </div>

        {/* Status */}
        <div className="flex items-center gap-2 pt-1 border-t border-border-light">
          <span className="text-terminal-sm text-text-muted font-mono w-14">Status</span>
          {hasStatus ? (
            <span className={`text-terminal-base font-mono font-medium ${isUnder ? 'text-emerald-600' : 'text-red-500'}`}>
              {isUnder ? '✓ Under budget' : 'Over budget'}{' '}
              {isUnder ? '▼' : '▲'}{Math.abs(delta).toFixed(0)}%
            </span>
          ) : (
            <span className="text-terminal-base text-text-faint font-mono">&mdash;</span>
          )}
        </div>
      </div>
    </div>
  );
}
