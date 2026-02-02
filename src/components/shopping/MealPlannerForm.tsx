'use client';

import { useState } from 'react';

// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────

export interface MealProfile {
  peopleCount: number;
  cookingFrequency: string;
  diet: string;
  age: number;
  weight: number;
  weightUnit: 'lbs' | 'kg';
  height: number;
  heightUnit: 'in' | 'cm';
  goals: string[];
  allergies: string[];
  cuisinePreferences: string[];
  budget: string;
}

export interface Ingredient {
  id: string;
  name: string;
  quantity: number;
  unit: string;
  packageSize: string;
  packageQuantity: number;
  estimatedPrice: number;
  actualPrice: number | null;
  category: string;
  notes: string;
}

export interface Meal {
  id: string;
  day: number;
  dayName: string;
  mealType: 'breakfast' | 'lunch' | 'dinner' | 'snack';
  name: string;
  description: string;
  prepTime: number;
  cookTime: number;
  servings: number;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  instructions: string[];
  ingredients: Ingredient[];
}

export interface MealPlan {
  id: string;
  createdAt: string;
  profile: MealProfile;
  meals: Meal[];
  shoppingList: Ingredient[];
  totalEstimated: number;
  totalActual: number;
}

interface Props {
  onPlanGenerated: (plan: MealPlan) => void;
}

// ─────────────────────────────────────────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────────────────────────────────────────

const DEFAULT_PROFILE: MealProfile = {
  peopleCount: 1,
  cookingFrequency: 'daily',
  diet: 'omnivore',
  age: 30,
  weight: 150,
  weightUnit: 'lbs',
  height: 68,
  heightUnit: 'in',
  goals: [],
  allergies: [],
  cuisinePreferences: [],
  budget: 'moderate',
};

const COOKING_FREQUENCY = [
  { value: 'daily', label: 'Every Day', desc: '7 days/week' },
  { value: '5-6days', label: '5-6 Days', desc: 'Most days' },
  { value: '3-4days', label: '3-4 Days', desc: 'Half week' },
  { value: '1-2days', label: '1-2 Days', desc: 'Meal prep' },
];

const DIET_OPTIONS = [
  { value: 'omnivore', label: 'Omnivore', desc: 'Eat everything' },
  { value: 'vegetarian', label: 'Vegetarian', desc: 'No meat' },
  { value: 'vegan', label: 'Vegan', desc: 'Plant-based' },
  { value: 'pescatarian', label: 'Pescatarian', desc: 'Fish only' },
  { value: 'keto', label: 'Keto', desc: 'Low carb' },
  { value: 'paleo', label: 'Paleo', desc: 'Whole foods' },
  { value: 'mediterranean', label: 'Mediterranean', desc: 'Olive oil, fish' },
  { value: 'carnivore', label: 'Carnivore', desc: 'Meat-based' },
];

const HEALTH_GOALS = [
  { value: 'weight-loss', label: 'Weight Loss' },
  { value: 'muscle-gain', label: 'Muscle Gain' },
  { value: 'gut-health', label: 'Gut Health' },
  { value: 'skin-health', label: 'Better Skin' },
  { value: 'longevity', label: 'Longevity' },
  { value: 'energy', label: 'More Energy' },
  { value: 'sleep', label: 'Better Sleep' },
  { value: 'heart-health', label: 'Heart Health' },
  { value: 'brain-health', label: 'Brain Health' },
  { value: 'immune', label: 'Immune Support' },
  { value: 'inflammation', label: 'Anti-Inflammatory' },
  { value: 'blood-sugar', label: 'Blood Sugar' },
];

const ALLERGIES = [
  { value: 'gluten', label: 'Gluten' },
  { value: 'dairy', label: 'Dairy' },
  { value: 'nuts', label: 'Tree Nuts' },
  { value: 'peanuts', label: 'Peanuts' },
  { value: 'soy', label: 'Soy' },
  { value: 'eggs', label: 'Eggs' },
  { value: 'shellfish', label: 'Shellfish' },
  { value: 'fish', label: 'Fish' },
  { value: 'sesame', label: 'Sesame' },
];

const CUISINES = [
  { value: 'american', label: 'American' },
  { value: 'mexican', label: 'Mexican' },
  { value: 'italian', label: 'Italian' },
  { value: 'asian', label: 'Asian' },
  { value: 'mediterranean', label: 'Mediterranean' },
  { value: 'indian', label: 'Indian' },
  { value: 'japanese', label: 'Japanese' },
  { value: 'thai', label: 'Thai' },
  { value: 'french', label: 'French' },
  { value: 'middle-eastern', label: 'Middle Eastern' },
];

const BUDGET_OPTIONS = [
  { value: 'budget', label: '$50-75/wk', desc: 'Budget-conscious' },
  { value: 'moderate', label: '$75-125/wk', desc: 'Balanced quality' },
  { value: 'premium', label: '$125-175/wk', desc: 'High quality' },
  { value: 'luxury', label: '$175+/wk', desc: 'Premium ingredients' },
];

// ─────────────────────────────────────────────────────────────────────────────
// COMPONENT
// ─────────────────────────────────────────────────────────────────────────────

export default function MealPlannerForm({ onPlanGenerated }: Props) {
  const [profile, setProfile] = useState<MealProfile>(DEFAULT_PROFILE);
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const totalSteps = 5;

  const toggleGoal = (value: string) => {
    setProfile(p => ({
      ...p,
      goals: p.goals.includes(value) 
        ? p.goals.filter(x => x !== value)
        : p.goals.length < 4 ? [...p.goals, value] : p.goals
    }));
  };

  const toggleAllergy = (value: string) => {
    setProfile(p => ({
      ...p,
      allergies: p.allergies.includes(value) 
        ? p.allergies.filter(x => x !== value)
        : [...p.allergies, value]
    }));
  };

  const toggleCuisine = (value: string) => {
    setProfile(p => ({
      ...p,
      cuisinePreferences: p.cuisinePreferences.includes(value) 
        ? p.cuisinePreferences.filter(x => x !== value)
        : p.cuisinePreferences.length < 4 ? [...p.cuisinePreferences, value] : p.cuisinePreferences
    }));
  };

  const generatePlan = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/ai/meal-plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ profile })
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to generate meal plan');
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

      {/* Step 1: Household */}
      {step === 1 && (
        <div className="space-y-4">
          <div className="bg-[#2d1b4e] text-white px-4 py-2 text-sm font-semibold">
            Step 1: Household Information
          </div>
          
          <div className="p-4 space-y-4">
            <div>
              <div className="text-[10px] text-gray-500 uppercase tracking-wider mb-2">Number of People</div>
              <div className="flex gap-2">
                {[1, 2, 3, 4, 5, 6].map(n => (
                  <button
                    key={n}
                    onClick={() => setProfile(p => ({ ...p, peopleCount: n }))}
                    className={`flex-1 py-2 text-sm font-medium border transition-colors ${
                      profile.peopleCount === n 
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
              <div className="text-[10px] text-gray-500 uppercase tracking-wider mb-2">Cooking Frequency</div>
              <div className="grid grid-cols-2 gap-2">
                {COOKING_FREQUENCY.map(opt => (
                  <button
                    key={opt.value}
                    onClick={() => setProfile(p => ({ ...p, cookingFrequency: opt.value }))}
                    className={`p-3 text-left border transition-colors ${
                      profile.cookingFrequency === opt.value
                        ? 'bg-[#2d1b4e] text-white border-[#2d1b4e]'
                        : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'
                    }`}
                  >
                    <div className="font-medium text-sm">{opt.label}</div>
                    <div className={`text-xs ${profile.cookingFrequency === opt.value ? 'text-gray-300' : 'text-gray-400'}`}>{opt.desc}</div>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Step 2: Body Stats */}
      {step === 2 && (
        <div className="space-y-4">
          <div className="bg-[#2d1b4e] text-white px-4 py-2 text-sm font-semibold">
            Step 2: Body Stats (for calorie calculation)
          </div>
          
          <div className="p-4 space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <div className="text-[10px] text-gray-500 uppercase tracking-wider mb-2">Age</div>
                <input
                  type="number"
                  value={profile.age}
                  onChange={e => setProfile(p => ({ ...p, age: +e.target.value }))}
                  className="w-full border border-gray-300 px-3 py-2 text-sm"
                  min={1}
                  max={120}
                />
              </div>

              <div>
                <div className="text-[10px] text-gray-500 uppercase tracking-wider mb-2">Weight</div>
                <div className="flex gap-2">
                  <input
                    type="number"
                    value={profile.weight}
                    onChange={e => setProfile(p => ({ ...p, weight: +e.target.value }))}
                    className="flex-1 border border-gray-300 px-3 py-2 text-sm"
                    min={1}
                  />
                  <select
                    value={profile.weightUnit}
                    onChange={e => setProfile(p => ({ ...p, weightUnit: e.target.value as 'lbs' | 'kg' }))}
                    className="border border-gray-300 px-2 text-sm"
                  >
                    <option value="lbs">lbs</option>
                    <option value="kg">kg</option>
                  </select>
                </div>
              </div>
            </div>

            <div>
              <div className="text-[10px] text-gray-500 uppercase tracking-wider mb-2">Height</div>
              <div className="flex gap-2">
                <input
                  type="number"
                  value={profile.height}
                  onChange={e => setProfile(p => ({ ...p, height: +e.target.value }))}
                  className="flex-1 border border-gray-300 px-3 py-2 text-sm"
                  min={1}
                />
                <select
                  value={profile.heightUnit}
                  onChange={e => setProfile(p => ({ ...p, heightUnit: e.target.value as 'in' | 'cm' }))}
                  className="border border-gray-300 px-2 text-sm"
                >
                  <option value="in">inches</option>
                  <option value="cm">cm</option>
                </select>
              </div>
            </div>

            <div>
              <div className="text-[10px] text-gray-500 uppercase tracking-wider mb-2">Diet Type</div>
              <div className="grid grid-cols-2 gap-2">
                {DIET_OPTIONS.map(opt => (
                  <button
                    key={opt.value}
                    onClick={() => setProfile(p => ({ ...p, diet: opt.value }))}
                    className={`p-2 text-left border transition-colors ${
                      profile.diet === opt.value
                        ? 'bg-[#2d1b4e] text-white border-[#2d1b4e]'
                        : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'
                    }`}
                  >
                    <div className="font-medium text-xs">{opt.label}</div>
                    <div className={`text-[10px] ${profile.diet === opt.value ? 'text-gray-300' : 'text-gray-400'}`}>{opt.desc}</div>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Step 3: Health Goals */}
      {step === 3 && (
        <div className="space-y-4">
          <div className="bg-[#2d1b4e] text-white px-4 py-2 text-sm font-semibold flex justify-between">
            <span>Step 3: Health Goals</span>
            <span className="text-xs text-gray-300">{profile.goals.length}/4 selected</span>
          </div>
          
          <div className="p-4">
            <div className="grid grid-cols-3 gap-2">
              {HEALTH_GOALS.map(goal => (
                <button
                  key={goal.value}
                  onClick={() => toggleGoal(goal.value)}
                  className={`p-2 text-center border transition-colors text-xs font-medium ${
                    profile.goals.includes(goal.value)
                      ? 'bg-[#2d1b4e] text-white border-[#2d1b4e]'
                      : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'
                  }`}
                >
                  {goal.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Step 4: Allergies & Preferences */}
      {step === 4 && (
        <div className="space-y-4">
          <div className="bg-[#2d1b4e] text-white px-4 py-2 text-sm font-semibold">
            Step 4: Allergies & Cuisine Preferences
          </div>
          
          <div className="p-4 space-y-4">
            <div>
              <div className="text-[10px] text-gray-500 uppercase tracking-wider mb-2">Allergies / Intolerances</div>
              <div className="flex flex-wrap gap-2">
                {ALLERGIES.map(a => (
                  <button
                    key={a.value}
                    onClick={() => toggleAllergy(a.value)}
                    className={`px-3 py-1.5 border text-xs font-medium transition-colors ${
                      profile.allergies.includes(a.value)
                        ? 'bg-red-100 text-red-700 border-red-300'
                        : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'
                    }`}
                  >
                    {a.label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <div className="text-[10px] text-gray-500 uppercase tracking-wider mb-2">Cuisine Preferences (up to 4)</div>
              <div className="flex flex-wrap gap-2">
                {CUISINES.map(c => (
                  <button
                    key={c.value}
                    onClick={() => toggleCuisine(c.value)}
                    className={`px-3 py-1.5 border text-xs font-medium transition-colors ${
                      profile.cuisinePreferences.includes(c.value)
                        ? 'bg-[#2d1b4e] text-white border-[#2d1b4e]'
                        : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'
                    }`}
                  >
                    {c.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Step 5: Budget */}
      {step === 5 && (
        <div className="space-y-4">
          <div className="bg-[#2d1b4e] text-white px-4 py-2 text-sm font-semibold">
            Step 5: Weekly Budget
          </div>
          
          <div className="p-4 space-y-4">
            <div className="grid grid-cols-2 gap-2">
              {BUDGET_OPTIONS.map(opt => (
                <button
                  key={opt.value}
                  onClick={() => setProfile(p => ({ ...p, budget: opt.value }))}
                  className={`p-4 text-left border transition-colors ${
                    profile.budget === opt.value
                      ? 'bg-[#2d1b4e] text-white border-[#2d1b4e]'
                      : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'
                  }`}
                >
                  <div className="font-bold text-lg">{opt.label}</div>
                  <div className={`text-xs ${profile.budget === opt.value ? 'text-gray-300' : 'text-gray-400'}`}>per person · {opt.desc}</div>
                </button>
              ))}
            </div>

            {/* Summary */}
            <div className="bg-gray-50 border border-gray-200 p-4">
              <div className="text-[10px] text-gray-500 uppercase tracking-wider mb-3">Plan Summary</div>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="text-gray-500">People:</div>
                <div className="font-medium text-gray-900">{profile.peopleCount}</div>
                <div className="text-gray-500">Diet:</div>
                <div className="font-medium text-gray-900 capitalize">{profile.diet}</div>
                <div className="text-gray-500">Goals:</div>
                <div className="font-medium text-gray-900">{profile.goals.length > 0 ? profile.goals.join(', ') : 'None'}</div>
                <div className="text-gray-500">Allergies:</div>
                <div className="font-medium text-gray-900">{profile.allergies.length > 0 ? profile.allergies.join(', ') : 'None'}</div>
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
            ← Back
          </button>
        )}
        {step < totalSteps ? (
          <button 
            onClick={() => setStep(s => s + 1)} 
            className="flex-1 px-4 py-2 text-sm font-medium bg-[#2d1b4e] text-white hover:bg-[#3d2b5e] transition-colors"
          >
            Next →
          </button>
        ) : (
          <button 
            onClick={generatePlan} 
            disabled={loading}
            className="flex-1 px-4 py-2 text-sm font-medium bg-emerald-600 text-white hover:bg-emerald-700 transition-colors disabled:opacity-50"
          >
            {loading ? 'Generating...' : 'Generate 7-Day Meal Plan'}
          </button>
        )}
      </div>
    </div>
  );
}
