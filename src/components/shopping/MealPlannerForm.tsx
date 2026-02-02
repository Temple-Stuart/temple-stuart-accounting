'use client';

import { useState } from 'react';
import { Button } from '@/components/ui';

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
  { value: 'daily', label: 'Every Day', icon: '👨‍🍳', desc: '7 days/week cooking' },
  { value: '5-6days', label: '5-6 Days', icon: '🍳', desc: 'Most days' },
  { value: '3-4days', label: '3-4 Days', icon: '🥘', desc: 'Half the week' },
  { value: '1-2days', label: '1-2 Days', icon: '🍲', desc: 'Meal prep style' },
];

const DIET_OPTIONS = [
  { value: 'omnivore', label: 'Omnivore', icon: '🥩', desc: 'Eat everything' },
  { value: 'vegetarian', label: 'Vegetarian', icon: '🥗', desc: 'No meat' },
  { value: 'vegan', label: 'Vegan', icon: '🌱', desc: 'Plant-based only' },
  { value: 'pescatarian', label: 'Pescatarian', icon: '🐟', desc: 'Fish, no meat' },
  { value: 'keto', label: 'Keto', icon: '🥑', desc: 'Low carb, high fat' },
  { value: 'paleo', label: 'Paleo', icon: '🦴', desc: 'Whole foods' },
  { value: 'mediterranean', label: 'Mediterranean', icon: '🫒', desc: 'Olive oil, fish, veggies' },
  { value: 'carnivore', label: 'Carnivore', icon: '🥓', desc: 'Meat-based' },
];

const HEALTH_GOALS = [
  { value: 'weight-loss', label: 'Weight Loss', icon: '⚖️' },
  { value: 'muscle-gain', label: 'Muscle Gain', icon: '💪' },
  { value: 'gut-health', label: 'Gut Health', icon: '🦠' },
  { value: 'skin-health', label: 'Better Skin', icon: '✨' },
  { value: 'longevity', label: 'Longevity', icon: '🧬' },
  { value: 'energy', label: 'More Energy', icon: '⚡' },
  { value: 'sleep', label: 'Better Sleep', icon: '😴' },
  { value: 'heart-health', label: 'Heart Health', icon: '❤️' },
  { value: 'brain-health', label: 'Brain Health', icon: '🧠' },
  { value: 'immune', label: 'Immune Support', icon: '🛡️' },
  { value: 'inflammation', label: 'Reduce Inflammation', icon: '🔥' },
  { value: 'blood-sugar', label: 'Blood Sugar Control', icon: '📊' },
];

const ALLERGIES = [
  { value: 'gluten', label: 'Gluten', icon: '🌾' },
  { value: 'dairy', label: 'Dairy', icon: '🥛' },
  { value: 'nuts', label: 'Tree Nuts', icon: '🥜' },
  { value: 'peanuts', label: 'Peanuts', icon: '🥜' },
  { value: 'soy', label: 'Soy', icon: '🫘' },
  { value: 'eggs', label: 'Eggs', icon: '🥚' },
  { value: 'shellfish', label: 'Shellfish', icon: '🦐' },
  { value: 'fish', label: 'Fish', icon: '🐟' },
  { value: 'sesame', label: 'Sesame', icon: '🌰' },
];

const CUISINES = [
  { value: 'american', label: 'American', icon: '🍔' },
  { value: 'mexican', label: 'Mexican', icon: '🌮' },
  { value: 'italian', label: 'Italian', icon: '🍝' },
  { value: 'asian', label: 'Asian', icon: '🥢' },
  { value: 'mediterranean', label: 'Mediterranean', icon: '🫒' },
  { value: 'indian', label: 'Indian', icon: '🍛' },
  { value: 'japanese', label: 'Japanese', icon: '🍣' },
  { value: 'thai', label: 'Thai', icon: '🍜' },
  { value: 'french', label: 'French', icon: '🥐' },
  { value: 'middle-eastern', label: 'Middle Eastern', icon: '🧆' },
];

const BUDGET_OPTIONS = [
  { value: 'budget', label: '$50-75/wk', sublabel: 'per person', icon: '💚', desc: 'Budget-conscious' },
  { value: 'moderate', label: '$75-125/wk', sublabel: 'per person', icon: '💙', desc: 'Balanced quality' },
  { value: 'premium', label: '$125-175/wk', sublabel: 'per person', icon: '💜', desc: 'High quality' },
  { value: 'luxury', label: '$175+/wk', sublabel: 'per person', icon: '💛', desc: 'Premium ingredients' },
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
    <div className="bg-zinc-900 rounded-2xl border border-zinc-800 overflow-hidden">
      {/* Header */}
      <div className="bg-gradient-to-r from-emerald-600 via-teal-600 to-cyan-600 p-6 text-white">
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2 text-white/80 text-sm font-medium mb-1">
              <span>🥗</span> AI-Powered Meal Planning
            </div>
            <h2 className="text-xl font-bold">Build Your Weekly Menu</h2>
            <p className="text-white/80 text-sm mt-1">Personalized nutrition based on your goals</p>
          </div>
          <div className="flex items-center gap-2">
            {Array.from({ length: totalSteps }, (_, i) => (
              <div 
                key={i} 
                className={`w-2.5 h-2.5 rounded-full transition-all ${step > i ? 'bg-white' : 'bg-white/30'}`} 
              />
            ))}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="p-6">
        {/* Step 1: Household */}
        {step === 1 && (
          <div className="space-y-6">
            <div className="text-center mb-6">
              <h3 className="font-semibold text-lg text-white">Who's eating?</h3>
              <p className="text-zinc-400 text-sm">Tell us about your household</p>
            </div>

            <div>
              <label className="text-sm font-medium text-zinc-300 block mb-3">👥 Number of People</label>
              <div className="flex gap-2">
                {[1, 2, 3, 4, 5, 6].map(n => (
                  <button
                    key={n}
                    onClick={() => setProfile(p => ({ ...p, peopleCount: n }))}
                    className={`flex-1 py-3 rounded-lg font-medium transition-all ${
                      profile.peopleCount === n 
                        ? 'bg-emerald-500 text-white' 
                        : 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700'
                    }`}
                  >
                    {n}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="text-sm font-medium text-zinc-300 block mb-3">🍳 How often do you cook?</label>
              <div className="grid grid-cols-2 gap-3">
                {COOKING_FREQUENCY.map(opt => (
                  <button
                    key={opt.value}
                    onClick={() => setProfile(p => ({ ...p, cookingFrequency: opt.value }))}
                    className={`p-4 rounded-xl border-2 text-left transition-all ${
                      profile.cookingFrequency === opt.value
                        ? 'border-emerald-500 bg-emerald-500/10'
                        : 'border-zinc-700 hover:border-zinc-600'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-2xl">{opt.icon}</span>
                      <div>
                        <div className="font-medium text-white">{opt.label}</div>
                        <div className="text-xs text-zinc-400">{opt.desc}</div>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Step 2: Body Stats */}
        {step === 2 && (
          <div className="space-y-6">
            <div className="text-center mb-6">
              <h3 className="font-semibold text-lg text-white">Your body stats</h3>
              <p className="text-zinc-400 text-sm">For personalized calorie & macro calculations</p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium text-zinc-300 block mb-2">🎂 Age</label>
                <input
                  type="number"
                  value={profile.age}
                  onChange={e => setProfile(p => ({ ...p, age: +e.target.value }))}
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-4 py-3 text-white"
                  min={1}
                  max={120}
                />
              </div>

              <div>
                <label className="text-sm font-medium text-zinc-300 block mb-2">⚖️ Weight</label>
                <div className="flex gap-2">
                  <input
                    type="number"
                    value={profile.weight}
                    onChange={e => setProfile(p => ({ ...p, weight: +e.target.value }))}
                    className="flex-1 bg-zinc-800 border border-zinc-700 rounded-lg px-4 py-3 text-white"
                    min={1}
                  />
                  <select
                    value={profile.weightUnit}
                    onChange={e => setProfile(p => ({ ...p, weightUnit: e.target.value as 'lbs' | 'kg' }))}
                    className="bg-zinc-800 border border-zinc-700 rounded-lg px-3 text-white"
                  >
                    <option value="lbs">lbs</option>
                    <option value="kg">kg</option>
                  </select>
                </div>
              </div>

              <div className="col-span-2">
                <label className="text-sm font-medium text-zinc-300 block mb-2">📏 Height</label>
                <div className="flex gap-2">
                  <input
                    type="number"
                    value={profile.height}
                    onChange={e => setProfile(p => ({ ...p, height: +e.target.value }))}
                    className="flex-1 bg-zinc-800 border border-zinc-700 rounded-lg px-4 py-3 text-white"
                    min={1}
                  />
                  <select
                    value={profile.heightUnit}
                    onChange={e => setProfile(p => ({ ...p, heightUnit: e.target.value as 'in' | 'cm' }))}
                    className="bg-zinc-800 border border-zinc-700 rounded-lg px-3 text-white"
                  >
                    <option value="in">inches</option>
                    <option value="cm">cm</option>
                  </select>
                </div>
              </div>
            </div>

            <div>
              <label className="text-sm font-medium text-zinc-300 block mb-3">🥗 Diet Type</label>
              <div className="grid grid-cols-2 gap-2">
                {DIET_OPTIONS.map(opt => (
                  <button
                    key={opt.value}
                    onClick={() => setProfile(p => ({ ...p, diet: opt.value }))}
                    className={`p-3 rounded-xl border-2 text-left transition-all ${
                      profile.diet === opt.value
                        ? 'border-emerald-500 bg-emerald-500/10'
                        : 'border-zinc-700 hover:border-zinc-600'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-xl">{opt.icon}</span>
                      <div>
                        <div className="font-medium text-white text-sm">{opt.label}</div>
                        <div className="text-xs text-zinc-500">{opt.desc}</div>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Step 3: Health Goals */}
        {step === 3 && (
          <div className="space-y-6">
            <div className="text-center mb-6">
              <h3 className="font-semibold text-lg text-white">What are your goals?</h3>
              <p className="text-zinc-400 text-sm">Select up to 4 priorities • {profile.goals.length}/4 selected</p>
            </div>

            <div className="grid grid-cols-3 gap-2">
              {HEALTH_GOALS.map(goal => (
                <button
                  key={goal.value}
                  onClick={() => toggleGoal(goal.value)}
                  className={`p-3 rounded-xl border-2 text-center transition-all ${
                    profile.goals.includes(goal.value)
                      ? 'border-emerald-500 bg-emerald-500/10'
                      : 'border-zinc-700 hover:border-zinc-600'
                  }`}
                >
                  <div className="text-2xl mb-1">{goal.icon}</div>
                  <div className="text-xs font-medium text-white">{goal.label}</div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Step 4: Allergies & Preferences */}
        {step === 4 && (
          <div className="space-y-6">
            <div className="text-center mb-6">
              <h3 className="font-semibold text-lg text-white">Allergies & Preferences</h3>
              <p className="text-zinc-400 text-sm">Help us avoid problematic ingredients</p>
            </div>

            <div>
              <label className="text-sm font-medium text-zinc-300 block mb-3">⚠️ Allergies / Intolerances</label>
              <div className="flex flex-wrap gap-2">
                {ALLERGIES.map(a => (
                  <button
                    key={a.value}
                    onClick={() => toggleAllergy(a.value)}
                    className={`px-3 py-2 rounded-lg border-2 text-sm font-medium transition-all ${
                      profile.allergies.includes(a.value)
                        ? 'border-red-500 bg-red-500/10 text-red-400'
                        : 'border-zinc-700 text-zinc-300 hover:border-zinc-600'
                    }`}
                  >
                    {a.icon} {a.label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="text-sm font-medium text-zinc-300 block mb-3">🌍 Cuisine Preferences (up to 4)</label>
              <div className="flex flex-wrap gap-2">
                {CUISINES.map(c => (
                  <button
                    key={c.value}
                    onClick={() => toggleCuisine(c.value)}
                    className={`px-3 py-2 rounded-lg border-2 text-sm font-medium transition-all ${
                      profile.cuisinePreferences.includes(c.value)
                        ? 'border-emerald-500 bg-emerald-500/10 text-emerald-400'
                        : 'border-zinc-700 text-zinc-300 hover:border-zinc-600'
                    }`}
                  >
                    {c.icon} {c.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Step 5: Budget */}
        {step === 5 && (
          <div className="space-y-6">
            <div className="text-center mb-6">
              <h3 className="font-semibold text-lg text-white">Weekly Budget</h3>
              <p className="text-zinc-400 text-sm">How much do you want to spend on groceries?</p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              {BUDGET_OPTIONS.map(opt => (
                <button
                  key={opt.value}
                  onClick={() => setProfile(p => ({ ...p, budget: opt.value }))}
                  className={`relative p-5 rounded-xl border-2 text-left transition-all ${
                    profile.budget === opt.value
                      ? 'border-emerald-500 bg-emerald-500/10'
                      : 'border-zinc-700 hover:border-zinc-600'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">{opt.icon}</span>
                    <div>
                      <div className="font-bold text-lg text-white">
                        {opt.label}
                        <span className="text-sm font-normal text-zinc-400 ml-1">{opt.sublabel}</span>
                      </div>
                      <div className="text-sm text-zinc-400">{opt.desc}</div>
                    </div>
                  </div>
                  {profile.budget === opt.value && (
                    <div className="absolute top-3 right-3 w-5 h-5 bg-emerald-500 rounded-full flex items-center justify-center text-white text-xs">✓</div>
                  )}
                </button>
              ))}
            </div>

            {/* Summary */}
            <div className="bg-zinc-800/50 rounded-xl p-4 border border-zinc-700">
              <h4 className="font-medium text-white mb-3">📋 Plan Summary</h4>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div className="text-zinc-400">People:</div>
                <div className="text-white font-medium">{profile.peopleCount}</div>
                <div className="text-zinc-400">Diet:</div>
                <div className="text-white font-medium capitalize">{profile.diet}</div>
                <div className="text-zinc-400">Goals:</div>
                <div className="text-white font-medium">{profile.goals.length > 0 ? profile.goals.join(', ') : 'None'}</div>
                <div className="text-zinc-400">Allergies:</div>
                <div className="text-white font-medium">{profile.allergies.length > 0 ? profile.allergies.join(', ') : 'None'}</div>
              </div>
            </div>

            {error && (
              <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 text-red-400 text-sm">
                {error}
              </div>
            )}
          </div>
        )}

        {/* Navigation */}
        <div className="flex gap-3 mt-8">
          {step > 1 && (
            <Button 
              variant="secondary" 
              onClick={() => setStep(s => s - 1)}
              className="flex-1 bg-zinc-800 hover:bg-zinc-700 text-white border-zinc-700"
            >
              ← Back
            </Button>
          )}
          {step < totalSteps ? (
            <Button 
              onClick={() => setStep(s => s + 1)} 
              className="flex-1 bg-emerald-600 hover:bg-emerald-500"
            >
              Next →
            </Button>
          ) : (
            <Button 
              onClick={generatePlan} 
              loading={loading}
              className="flex-1 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500"
            >
              🥗 Generate My Meal Plan
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
