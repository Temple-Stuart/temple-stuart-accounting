'use client';

import { useState } from 'react';

// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────

export interface MealProfile {
  peopleCount: number;
  cookingDays: number;
  cookingStyle: 'daily' | 'meal-prep' | 'hybrid';
  mealsPerDay: number;
  eatOutMeals: number;
  diet: string;
  age: number;
  weight: number;
  weightUnit: 'lbs' | 'kg';
  height: number;
  heightUnit: 'in' | 'cm';
  goals: string[];
  allergies: string[];
  cuisinePreferences: string[];
  excludeFoods: string;
  includeFoods: string;
  mealComplexity: 'quick' | 'moderate' | 'elaborate';
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
  prepDay?: number;
  isMealPrep?: boolean;
}

export interface MealPlan {
  id: string;
  createdAt: string;
  profile: MealProfile;
  meals: Meal[];
  shoppingList: Ingredient[];
  totalEstimated: number;
  totalActual: number;
  prepSchedule?: { day: number; dayName: string; meals: string[] }[];
}

interface Props {
  onPlanGenerated: (plan: MealPlan) => void;
}

// ─────────────────────────────────────────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────────────────────────────────────────

const DEFAULT_PROFILE: MealProfile = {
  peopleCount: 1,
  cookingDays: 2,
  cookingStyle: 'meal-prep',
  mealsPerDay: 3,
  eatOutMeals: 0,
  diet: 'omnivore',
  age: 30,
  weight: 150,
  weightUnit: 'lbs',
  height: 68,
  heightUnit: 'in',
  goals: [],
  allergies: [],
  cuisinePreferences: [],
  excludeFoods: '',
  includeFoods: '',
  mealComplexity: 'moderate',
  budget: 'moderate',
};

const COOKING_STYLE_OPTIONS = [
  { 
    value: 'meal-prep', 
    label: 'Meal Prep', 
    desc: 'Cook 1-2 days, eat all week',
    detail: 'Batch cook on weekends, portion for the week. Best for busy schedules.'
  },
  { 
    value: 'hybrid', 
    label: 'Hybrid', 
    desc: 'Prep some, cook some fresh',
    detail: 'Prep basics ahead, cook quick meals on other days.'
  },
  { 
    value: 'daily', 
    label: 'Daily Cooking', 
    desc: 'Fresh meals most days',
    detail: 'Cook fresh meals 5-7 days per week.'
  },
];

const DIET_OPTIONS = [
  { value: 'omnivore', label: 'Omnivore', desc: 'Eat everything' },
  { value: 'vegetarian', label: 'Vegetarian', desc: 'No meat' },
  { value: 'vegan', label: 'Vegan', desc: 'Plant-based' },
  { value: 'pescatarian', label: 'Pescatarian', desc: 'Fish only' },
  { value: 'keto', label: 'Keto', desc: 'Low carb, high fat' },
  { value: 'paleo', label: 'Paleo', desc: 'Whole foods' },
  { value: 'mediterranean', label: 'Mediterranean', desc: 'Olive oil, fish' },
  { value: 'carnivore', label: 'Carnivore', desc: 'Meat-based' },
];

const HEALTH_GOALS = [
  { value: 'weight-loss', label: 'Weight Loss', desc: 'Calorie deficit, high protein' },
  { value: 'muscle-gain', label: 'Muscle Gain', desc: 'High protein, calorie surplus' },
  { value: 'gut-health', label: 'Gut Health', desc: 'Fiber, fermented foods, prebiotics' },
  { value: 'skin-health', label: 'Better Skin', desc: 'Omega-3s, antioxidants, hydration' },
  { value: 'longevity', label: 'Longevity', desc: 'Anti-inflammatory, whole foods' },
  { value: 'energy', label: 'More Energy', desc: 'Complex carbs, B vitamins, iron' },
  { value: 'sleep', label: 'Better Sleep', desc: 'Magnesium, tryptophan, low sugar PM' },
  { value: 'heart-health', label: 'Heart Health', desc: 'Low sodium, omega-3s, fiber' },
  { value: 'brain-health', label: 'Brain Health', desc: 'Omega-3s, blueberries, leafy greens' },
  { value: 'immune', label: 'Immune Support', desc: 'Vitamin C, zinc, garlic, ginger' },
  { value: 'inflammation', label: 'Anti-Inflammatory', desc: 'Turmeric, omega-3s, avoid processed' },
  { value: 'blood-sugar', label: 'Blood Sugar', desc: 'Low GI, fiber, protein with carbs' },
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

const COMPLEXITY_OPTIONS = [
  { value: 'quick', label: 'Quick & Easy', desc: '15-30 min meals, minimal ingredients' },
  { value: 'moderate', label: 'Moderate', desc: '30-60 min, balanced complexity' },
  { value: 'elaborate', label: 'Elaborate', desc: '60+ min, restaurant-quality' },
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

  const totalSteps = 6;
  const MAX_GOALS = 6;

  const toggleGoal = (value: string) => {
    setProfile(p => ({
      ...p,
      goals: p.goals.includes(value) 
        ? p.goals.filter(x => x !== value)
        : p.goals.length < MAX_GOALS ? [...p.goals, value] : p.goals
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
        : p.cuisinePreferences.length < 5 ? [...p.cuisinePreferences, value] : p.cuisinePreferences
    }));
  };

  // Calculate total meals to plan
  const totalMealsPerWeek = profile.mealsPerDay * 7;
  const mealsToEatOut = profile.eatOutMeals;
  const mealsToPlan = totalMealsPerWeek - mealsToEatOut;

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

      {/* Step 1: Cooking Style */}
      {step === 1 && (
        <div className="space-y-4">
          <div className="bg-[#2d1b4e] text-white px-4 py-2 text-sm font-semibold">
            Step 1: How Do You Want to Cook?
          </div>
          
          <div className="p-4 space-y-4">
            <div>
              <div className="text-[10px] text-gray-500 uppercase tracking-wider mb-2">Cooking Style</div>
              <div className="space-y-2">
                {COOKING_STYLE_OPTIONS.map(opt => (
                  <button
                    key={opt.value}
                    onClick={() => {
                      const days = opt.value === 'meal-prep' ? 2 : opt.value === 'hybrid' ? 4 : 6;
                      setProfile(p => ({ ...p, cookingStyle: opt.value as any, cookingDays: days }));
                    }}
                    className={`w-full p-4 text-left border transition-colors ${
                      profile.cookingStyle === opt.value
                        ? 'bg-[#2d1b4e] text-white border-[#2d1b4e]'
                        : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'
                    }`}
                  >
                    <div className="font-semibold">{opt.label}</div>
                    <div className={`text-sm ${profile.cookingStyle === opt.value ? 'text-gray-300' : 'text-gray-500'}`}>{opt.desc}</div>
                    <div className={`text-xs mt-1 ${profile.cookingStyle === opt.value ? 'text-gray-400' : 'text-gray-400'}`}>{opt.detail}</div>
                  </button>
                ))}
              </div>
            </div>

            {profile.cookingStyle === 'meal-prep' && (
              <div className="bg-amber-50 border border-amber-200 p-3 text-sm text-amber-800">
                <strong>Meal Prep Mode:</strong> You'll cook on 1-2 days (e.g., Sunday) and prepare all meals for the week. 
                Recipes will be batch-friendly and store/reheat well.
              </div>
            )}

            <div>
              <div className="text-[10px] text-gray-500 uppercase tracking-wider mb-2">
                Cooking Days Per Week {profile.cookingStyle === 'meal-prep' && '(Prep Days)'}
              </div>
              <div className="flex gap-2">
                {[1, 2, 3, 4, 5, 6, 7].map(n => (
                  <button
                    key={n}
                    onClick={() => setProfile(p => ({ ...p, cookingDays: n }))}
                    className={`flex-1 py-2 text-sm font-medium border transition-colors ${
                      profile.cookingDays === n 
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
              <div className="text-[10px] text-gray-500 uppercase tracking-wider mb-2">Meals Per Day</div>
              <div className="flex gap-2">
                {[2, 3].map(n => (
                  <button
                    key={n}
                    onClick={() => setProfile(p => ({ ...p, mealsPerDay: n }))}
                    className={`flex-1 py-3 text-sm font-medium border transition-colors ${
                      profile.mealsPerDay === n 
                        ? 'bg-[#2d1b4e] text-white border-[#2d1b4e]' 
                        : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'
                    }`}
                  >
                    {n === 2 ? '2 (Skip breakfast)' : '3 (Full day)'}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <div className="text-[10px] text-gray-500 uppercase tracking-wider mb-2">
                Meals Eating Out Per Week <span className="text-gray-400">(reduce planned meals)</span>
              </div>
              <div className="flex gap-2">
                {[0, 1, 2, 3, 4, 5, 6, 7].map(n => (
                  <button
                    key={n}
                    onClick={() => setProfile(p => ({ ...p, eatOutMeals: n }))}
                    className={`flex-1 py-2 text-sm font-medium border transition-colors ${
                      profile.eatOutMeals === n 
                        ? 'bg-[#2d1b4e] text-white border-[#2d1b4e]' 
                        : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'
                    }`}
                  >
                    {n}
                  </button>
                ))}
              </div>
              <div className="text-xs text-gray-500 mt-2">
                Planning <strong>{mealsToPlan}</strong> meals ({totalMealsPerWeek} total - {mealsToEatOut} eating out)
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Step 2: Household & Body */}
      {step === 2 && (
        <div className="space-y-4">
          <div className="bg-[#2d1b4e] text-white px-4 py-2 text-sm font-semibold">
            Step 2: About You
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

            <div className="grid grid-cols-3 gap-4">
              <div>
                <div className="text-[10px] text-gray-500 uppercase tracking-wider mb-2">Age</div>
                <input
                  type="number"
                  value={profile.age}
                  onChange={e => setProfile(p => ({ ...p, age: +e.target.value }))}
                  className="w-full border border-gray-300 px-3 py-2 text-sm"
                  min={1} max={120}
                />
              </div>
              <div>
                <div className="text-[10px] text-gray-500 uppercase tracking-wider mb-2">Weight</div>
                <div className="flex gap-1">
                  <input
                    type="number"
                    value={profile.weight}
                    onChange={e => setProfile(p => ({ ...p, weight: +e.target.value }))}
                    className="flex-1 border border-gray-300 px-3 py-2 text-sm"
                  />
                  <select
                    value={profile.weightUnit}
                    onChange={e => setProfile(p => ({ ...p, weightUnit: e.target.value as 'lbs' | 'kg' }))}
                    className="border border-gray-300 px-1 text-sm"
                  >
                    <option value="lbs">lb</option>
                    <option value="kg">kg</option>
                  </select>
                </div>
              </div>
              <div>
                <div className="text-[10px] text-gray-500 uppercase tracking-wider mb-2">Height</div>
                <div className="flex gap-1">
                  <input
                    type="number"
                    value={profile.height}
                    onChange={e => setProfile(p => ({ ...p, height: +e.target.value }))}
                    className="flex-1 border border-gray-300 px-3 py-2 text-sm"
                  />
                  <select
                    value={profile.heightUnit}
                    onChange={e => setProfile(p => ({ ...p, heightUnit: e.target.value as 'in' | 'cm' }))}
                    className="border border-gray-300 px-1 text-sm"
                  >
                    <option value="in">in</option>
                    <option value="cm">cm</option>
                  </select>
                </div>
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
            <span className="text-xs text-gray-300">{profile.goals.length}/{MAX_GOALS} selected</span>
          </div>
          
          <div className="p-4">
            <div className="text-xs text-gray-500 mb-3">
              Select up to {MAX_GOALS} goals. Each goal influences ingredient selection and meal composition.
            </div>
            <div className="grid grid-cols-2 gap-2">
              {HEALTH_GOALS.map(goal => (
                <button
                  key={goal.value}
                  onClick={() => toggleGoal(goal.value)}
                  className={`p-3 text-left border transition-colors ${
                    profile.goals.includes(goal.value)
                      ? 'bg-[#2d1b4e] text-white border-[#2d1b4e]'
                      : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'
                  }`}
                >
                  <div className="font-medium text-xs">{goal.label}</div>
                  <div className={`text-[10px] ${profile.goals.includes(goal.value) ? 'text-gray-300' : 'text-gray-400'}`}>
                    {goal.desc}
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Step 4: Allergies & Restrictions */}
      {step === 4 && (
        <div className="space-y-4">
          <div className="bg-[#2d1b4e] text-white px-4 py-2 text-sm font-semibold">
            Step 4: Allergies & Food Preferences
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
              <div className="text-[10px] text-gray-500 uppercase tracking-wider mb-2">
                Foods to EXCLUDE <span className="text-gray-400">(comma-separated)</span>
              </div>
              <input
                type="text"
                value={profile.excludeFoods}
                onChange={e => setProfile(p => ({ ...p, excludeFoods: e.target.value }))}
                placeholder="e.g., mushrooms, cilantro, olives"
                className="w-full border border-gray-300 px-3 py-2 text-sm"
              />
            </div>

            <div>
              <div className="text-[10px] text-gray-500 uppercase tracking-wider mb-2">
                Foods to INCLUDE <span className="text-gray-400">(things you love)</span>
              </div>
              <input
                type="text"
                value={profile.includeFoods}
                onChange={e => setProfile(p => ({ ...p, includeFoods: e.target.value }))}
                placeholder="e.g., salmon, avocado, sweet potato"
                className="w-full border border-gray-300 px-3 py-2 text-sm"
              />
            </div>

            <div>
              <div className="text-[10px] text-gray-500 uppercase tracking-wider mb-2">Cuisine Preferences (up to 5)</div>
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

      {/* Step 5: Meal Complexity */}
      {step === 5 && (
        <div className="space-y-4">
          <div className="bg-[#2d1b4e] text-white px-4 py-2 text-sm font-semibold">
            Step 5: Meal Complexity & Budget
          </div>
          
          <div className="p-4 space-y-4">
            <div>
              <div className="text-[10px] text-gray-500 uppercase tracking-wider mb-2">Meal Complexity</div>
              <div className="space-y-2">
                {COMPLEXITY_OPTIONS.map(opt => (
                  <button
                    key={opt.value}
                    onClick={() => setProfile(p => ({ ...p, mealComplexity: opt.value as any }))}
                    className={`w-full p-3 text-left border transition-colors ${
                      profile.mealComplexity === opt.value
                        ? 'bg-[#2d1b4e] text-white border-[#2d1b4e]'
                        : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'
                    }`}
                  >
                    <div className="font-medium text-sm">{opt.label}</div>
                    <div className={`text-xs ${profile.mealComplexity === opt.value ? 'text-gray-300' : 'text-gray-400'}`}>{opt.desc}</div>
                  </button>
                ))}
              </div>
            </div>

            <div>
              <div className="text-[10px] text-gray-500 uppercase tracking-wider mb-2">Weekly Budget (per person)</div>
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
                    <div className={`text-xs ${profile.budget === opt.value ? 'text-gray-300' : 'text-gray-400'}`}>{opt.desc}</div>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Step 6: Review & Generate */}
      {step === 6 && (
        <div className="space-y-4">
          <div className="bg-[#2d1b4e] text-white px-4 py-2 text-sm font-semibold">
            Step 6: Review Your Plan
          </div>
          
          <div className="p-4 space-y-4">
            <div className="bg-gray-50 border border-gray-200 p-4">
              <div className="text-[10px] text-gray-500 uppercase tracking-wider mb-3">Plan Summary</div>
              <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
                <div className="text-gray-500">Cooking Style:</div>
                <div className="font-medium text-gray-900 capitalize">{profile.cookingStyle.replace('-', ' ')}</div>
                
                <div className="text-gray-500">Cooking Days:</div>
                <div className="font-medium text-gray-900">{profile.cookingDays} days/week</div>
                
                <div className="text-gray-500">Meals to Plan:</div>
                <div className="font-medium text-gray-900">{mealsToPlan} meals ({mealsToEatOut} eating out)</div>
                
                <div className="text-gray-500">People:</div>
                <div className="font-medium text-gray-900">{profile.peopleCount}</div>
                
                <div className="text-gray-500">Diet:</div>
                <div className="font-medium text-gray-900 capitalize">{profile.diet}</div>
                
                <div className="text-gray-500">Goals:</div>
                <div className="font-medium text-gray-900">{profile.goals.length > 0 ? profile.goals.join(', ') : 'None'}</div>
                
                <div className="text-gray-500">Allergies:</div>
                <div className="font-medium text-gray-900">{profile.allergies.length > 0 ? profile.allergies.join(', ') : 'None'}</div>
                
                <div className="text-gray-500">Complexity:</div>
                <div className="font-medium text-gray-900 capitalize">{profile.mealComplexity}</div>
                
                {profile.excludeFoods && (
                  <>
                    <div className="text-gray-500">Exclude:</div>
                    <div className="font-medium text-red-700">{profile.excludeFoods}</div>
                  </>
                )}
                
                {profile.includeFoods && (
                  <>
                    <div className="text-gray-500">Include:</div>
                    <div className="font-medium text-emerald-700">{profile.includeFoods}</div>
                  </>
                )}
              </div>
            </div>

            {profile.cookingStyle === 'meal-prep' && (
              <div className="bg-amber-50 border border-amber-200 p-3 text-sm text-amber-800">
                <strong>Prep Day Schedule:</strong> Your meal plan will include a prep schedule showing exactly what to cook on your {profile.cookingDays} cooking day{profile.cookingDays > 1 ? 's' : ''}.
              </div>
            )}

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
            {loading ? 'Generating Plan...' : `Generate ${mealsToPlan}-Meal Plan`}
          </button>
        )}
      </div>
    </div>
  );
}
