'use client';

import { Meal } from './types';

const MEAL_EMOJI: Record<Meal['name'], string> = {
  Breakfast: '\u{1F305}',
  Lunch: '\u{1F31E}',
  Dinner: '\u{1F319}',
  Snack: '\u{1F34E}',
};

const MEAL_NAMES: Meal['name'][] = ['Breakfast', 'Lunch', 'Dinner', 'Snack'];

interface MealsCardProps {
  meals: Meal[];
  onAdd: () => void;
  onUpdate: (mealId: string, updates: Partial<Meal>) => void;
  onRemove: (mealId: string) => void;
}

export default function MealsCard({ meals, onAdd, onUpdate, onRemove }: MealsCardProps) {
  const totalCalories = meals.reduce((s, m) => s + (m.calories || 0), 0);
  const totalProtein = meals.reduce((s, m) => s + (m.protein || 0), 0);

  return (
    <div className="bg-white rounded border border-border shadow-sm overflow-hidden">
      <div className="flex items-center justify-between px-3 py-2 border-b border-border">
        <span className="text-terminal-lg font-semibold text-text-primary">Meals</span>
        <span className="text-terminal-sm text-text-muted font-mono">
          {totalCalories} cal &middot; {totalProtein}g protein
        </span>
      </div>

      <div>
        {meals.length === 0 && (
          <p className="px-3 py-4 text-center text-terminal-base text-text-faint font-mono">
            No meals logged
          </p>
        )}

        {meals.map((meal) => (
          <div
            key={meal.id}
            className="flex items-center gap-2 px-3 py-1.5 group hover:bg-bg-row/50 transition-colors"
          >
            <span className="w-6 text-center flex-shrink-0">{MEAL_EMOJI[meal.name]}</span>
            <select
              value={meal.name}
              onChange={(e) => onUpdate(meal.id, { name: e.target.value as Meal['name'] })}
              className="font-mono text-terminal-sm bg-transparent border-none outline-none cursor-pointer w-20 text-text-secondary hover:bg-gray-50 focus:bg-gray-50 rounded transition-colors flex-shrink-0"
            >
              {MEAL_NAMES.map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
            <input
              type="text"
              value={meal.description}
              onChange={(e) => onUpdate(meal.id, { description: e.target.value })}
              placeholder="What did you eat?"
              className="flex-1 bg-transparent border-none outline-none text-terminal-base font-mono text-text-primary px-1 py-0.5 hover:bg-gray-50 focus:bg-gray-50 rounded transition-colors placeholder:text-text-faint min-w-0"
            />
            <input
              type="number"
              value={meal.calories || ''}
              onChange={(e) => onUpdate(meal.id, { calories: parseInt(e.target.value, 10) || 0 })}
              placeholder="0"
              className="w-14 bg-transparent border-none outline-none text-terminal-sm font-mono text-text-primary text-right px-1 py-0.5 hover:bg-gray-50 focus:bg-gray-50 rounded transition-colors placeholder:text-text-faint [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none flex-shrink-0"
            />
            <span className="text-terminal-sm text-text-faint font-mono flex-shrink-0">cal</span>
            <input
              type="number"
              value={meal.protein || ''}
              onChange={(e) => onUpdate(meal.id, { protein: parseInt(e.target.value, 10) || 0 })}
              placeholder="0"
              className="w-12 bg-transparent border-none outline-none text-terminal-sm font-mono text-text-primary text-right px-1 py-0.5 hover:bg-gray-50 focus:bg-gray-50 rounded transition-colors placeholder:text-text-faint [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none flex-shrink-0"
            />
            <span className="text-terminal-sm text-text-faint font-mono flex-shrink-0">g</span>
            <button
              onClick={() => onRemove(meal.id)}
              className="text-text-faint hover:text-brand-red text-terminal-base opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0 px-1"
            >
              &times;
            </button>
          </div>
        ))}
      </div>

      <button
        onClick={onAdd}
        className="w-full px-3 py-2 text-terminal-sm text-text-muted hover:text-text-secondary font-mono text-left transition-colors"
      >
        + Add Meal
      </button>
    </div>
  );
}
