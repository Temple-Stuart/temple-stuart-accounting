import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';

interface MealProfile {
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

const BUDGET_RANGES: Record<string, { min: number; max: number }> = {
  'budget': { min: 50, max: 75 },
  'moderate': { min: 75, max: 125 },
  'premium': { min: 125, max: 175 },
  'luxury': { min: 175, max: 250 },
};

const COMPLEXITY_TIME: Record<string, { prep: number; cook: number }> = {
  'quick': { prep: 10, cook: 15 },
  'moderate': { prep: 20, cook: 30 },
  'elaborate': { prep: 30, cook: 60 },
};

export async function POST(request: NextRequest) {
  try {
    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });

    const { profile } = await request.json() as { profile: MealProfile };

    if (!profile) {
      return NextResponse.json({ error: 'Profile required' }, { status: 400 });
    }

    const budgetRange = BUDGET_RANGES[profile.budget] || BUDGET_RANGES.moderate;
    const weeklyBudget = ((budgetRange.min + budgetRange.max) / 2) * profile.peopleCount;
    const timeRange = COMPLEXITY_TIME[profile.mealComplexity] || COMPLEXITY_TIME.moderate;

    // Calculate calories
    const weightKg = profile.weightUnit === 'kg' ? profile.weight : profile.weight * 0.453592;
    const heightCm = profile.heightUnit === 'cm' ? profile.height : profile.height * 2.54;
    const bmr = 10 * weightKg + 6.25 * heightCm - 5 * profile.age + 5;
    let dailyCalories = Math.round(bmr * 1.55);
    
    if (profile.goals.includes('weight-loss')) dailyCalories = Math.round(dailyCalories * 0.8);
    if (profile.goals.includes('muscle-gain')) dailyCalories = Math.round(dailyCalories * 1.15);

    // Calculate meals to plan
    const totalMealsPerWeek = profile.mealsPerDay * 7;
    const mealsToPlan = totalMealsPerWeek - profile.eatOutMeals;

    // Build cooking style instructions
    let cookingInstructions = '';
    if (profile.cookingStyle === 'meal-prep') {
      cookingInstructions = `
MEAL PREP MODE - CRITICAL:
- User cooks on ${profile.cookingDays} day(s) per week only (e.g., Sunday and Wednesday)
- ALL ${mealsToPlan} meals must be prepared on these cooking days
- Recipes MUST be batch-friendly: make large portions that refrigerate/freeze well
- Include reheating instructions for each meal
- Mark which day each meal should be PREPPED on (prepDay field)
- Set isMealPrep: true for all meals
- Good meal prep foods: grain bowls, sheet pan proteins, soups, casseroles, overnight oats
- Avoid: salads that wilt, fried foods that get soggy, dishes that don't reheat well

PREP SCHEDULE REQUIRED:
Generate a "prepSchedule" array showing what to cook each prep day:
[{ "day": 1, "dayName": "Sunday", "meals": ["Chicken grain bowls (4 servings)", "Overnight oats (7 servings)"] }]`;
    } else if (profile.cookingStyle === 'hybrid') {
      cookingInstructions = `
HYBRID MODE:
- User preps some meals ahead, cooks others fresh
- ${profile.cookingDays} cooking days per week
- Make 50% of meals batch-friendly for meal prep
- Other 50% can be quick fresh meals (15-20 min)
- Mark meal prep meals with isMealPrep: true and prepDay`;
    } else {
      cookingInstructions = `
DAILY COOKING MODE:
- User cooks fresh most days (${profile.cookingDays} days/week)
- Focus on ${timeRange.prep + timeRange.cook} minute or less meals
- Variety is key - different meals each day
- Some leftovers OK but not required`;
    }

    // Build goal-specific instructions
    const goalInstructions = profile.goals.length > 0 ? `
HEALTH GOAL REQUIREMENTS (incorporate these into meal planning):
${profile.goals.map(g => {
  const goalMap: Record<string, string> = {
    'weight-loss': '- Weight Loss: High protein (30g+/meal), high fiber, low calorie density, avoid processed carbs',
    'muscle-gain': '- Muscle Gain: 40g+ protein/meal, complex carbs, caloric surplus, post-workout nutrition',
    'gut-health': '- Gut Health: Include fermented foods (yogurt, kimchi, sauerkraut), high fiber, prebiotics (garlic, onion, banana)',
    'skin-health': '- Skin Health: Omega-3s (salmon, walnuts), antioxidants (berries, leafy greens), vitamin C, avoid sugar',
    'longevity': '- Longevity: Mediterranean-style, colorful vegetables, olive oil, nuts, limit processed foods',
    'energy': '- Energy: Complex carbs, B vitamins, iron-rich foods, steady blood sugar (avoid sugar spikes)',
    'sleep': '- Sleep: Magnesium-rich (nuts, leafy greens), tryptophan (turkey, milk), avoid caffeine/sugar PM',
    'heart-health': '- Heart Health: Low sodium, omega-3s, fiber, avoid saturated fats, include oats and beans',
    'brain-health': '- Brain Health: Fatty fish, blueberries, leafy greens, nuts, dark chocolate, turmeric',
    'immune': '- Immune: Vitamin C (citrus, bell peppers), zinc (meat, legumes), garlic, ginger, elderberry',
    'inflammation': '- Anti-Inflammatory: Turmeric, ginger, omega-3s, leafy greens, avoid processed foods/sugar',
    'blood-sugar': '- Blood Sugar: Low glycemic, pair carbs with protein/fat, fiber with every meal, avoid refined carbs',
  };
  return goalMap[g] || '';
}).filter(Boolean).join('\n')}` : '';

    const prompt = `You are a professional nutritionist and meal prep expert. Generate a detailed ${mealsToPlan}-meal plan for 7 days.

PROFILE:
- People: ${profile.peopleCount}
- Cooking Style: ${profile.cookingStyle}
- Cooking Days: ${profile.cookingDays} days/week
- Meals Per Day: ${profile.mealsPerDay}
- Eating Out: ${profile.eatOutMeals} meals/week (already excluded from count)
- Diet: ${profile.diet}
- Daily Calories Target: ~${dailyCalories}/person
- Meal Complexity: ${profile.mealComplexity} (${timeRange.prep} min prep, ${timeRange.cook} min cook max)
- Budget: ~$${weeklyBudget}/week total

${cookingInstructions}
${goalInstructions}

ALLERGIES/RESTRICTIONS: ${profile.allergies.length > 0 ? profile.allergies.join(', ') : 'None'}
FOODS TO EXCLUDE: ${profile.excludeFoods || 'None'}
FOODS TO INCLUDE (favorites): ${profile.includeFoods || 'No specific requests'}
CUISINE PREFERENCES: ${profile.cuisinePreferences.length > 0 ? profile.cuisinePreferences.join(', ') : 'Varied'}

CRITICAL - REAL PACKAGING SIZES:
You cannot buy 1 egg or 3 oz of milk. Use real store quantities:
- Eggs: 6, 12, 18, or 24 count cartons
- Milk: half gallon or gallon
- Bread: 1 loaf (20-24 slices)
- Chicken breast: 1 lb, 2 lb, or 3 lb packs
- Ground beef/turkey: 1 lb or 2 lb packs
- Rice: 1 lb, 2 lb, or 5 lb bags
- Pasta: 1 lb box
- Butter: 1 lb (4 sticks) or 8 oz (2 sticks)
- Cheese: 8 oz or 16 oz blocks/bags
- Yogurt: 32 oz tub or 5.3 oz individual
- Spinach/greens: 5 oz or 10-16 oz bags/containers
- Onions: 3 lb bag or individual
- Potatoes: 5 lb or 10 lb bags
- Berries: 6 oz or 16 oz containers

PLAN EFFICIENTLY:
1. Reuse ingredients across meals to minimize waste
2. If recipe needs 2 eggs, buy 12-count, use remaining in other meals
3. Buy 2-3 lb protein packs, distribute across multiple meals
4. Consolidate shopping list - no duplicates

Respond with ONLY valid JSON:
{
  "meals": [
    {
      "day": 1,
      "dayName": "Monday",
      "mealType": "breakfast",
      "name": "Overnight Oats with Berries",
      "description": "Creamy oats with fresh berries and honey",
      "prepTime": 5,
      "cookTime": 0,
      "servings": ${profile.peopleCount},
      "calories": 350,
      "protein": 12,
      "carbs": 55,
      "fat": 10,
      "instructions": ["Combine oats, milk, yogurt in jar", "Add toppings", "Refrigerate overnight"],
      "ingredients": [
        {
          "name": "Rolled oats",
          "quantity": 0.5,
          "unit": "cup",
          "packageSize": "42 oz canister",
          "packageQuantity": 1,
          "estimatedPrice": 4.99,
          "category": "grains",
          "notes": "Used for breakfast x7"
        }
      ],
      "prepDay": 1,
      "isMealPrep": true
    }
  ],
  "shoppingList": [
    {
      "name": "Rolled oats",
      "quantity": 42,
      "unit": "oz",
      "packageSize": "42 oz canister",
      "packageQuantity": 1,
      "estimatedPrice": 4.99,
      "category": "grains",
      "notes": "Breakfast oats for the week"
    }
  ],
  "totalEstimated": 127.50,
  "prepSchedule": [
    { "day": 1, "dayName": "Sunday", "meals": ["Overnight oats (7 servings)", "Chicken grain bowls (4 servings)"] }
  ]
}

Generate ${profile.mealsPerDay === 3 ? 'breakfast, lunch, dinner' : 'lunch, dinner'} for all 7 days (${mealsToPlan} meals total).
Shopping list must be CONSOLIDATED - combine all uses of same ingredient.
Categories: produce, dairy, meat, seafood, grains, pantry, frozen, beverages, spices
${profile.cookingStyle === 'meal-prep' ? 'Include prepSchedule array showing what to cook each prep day.' : ''}`;

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.7,
      max_tokens: 8000,
    });

    const textContent = completion.choices[0]?.message?.content;
    if (!textContent) {
      throw new Error('No response from AI');
    }

    let planData;
    try {
      let jsonStr = textContent;
      const jsonMatch = jsonStr.match(/```json\s*([\s\S]*?)\s*```/) || jsonStr.match(/```\s*([\s\S]*?)\s*```/);
      if (jsonMatch) jsonStr = jsonMatch[1];
      planData = JSON.parse(jsonStr.trim());
    } catch (parseError) {
      console.error('JSON parse error:', textContent.substring(0, 500));
      throw new Error('Failed to parse meal plan response');
    }

    const plan = {
      id: `mp_${Date.now()}`,
      createdAt: new Date().toISOString(),
      profile,
      meals: (planData.meals || []).map((m: Record<string, unknown>, i: number) => ({
        ...m,
        id: `meal_${i}`,
        ingredients: ((m.ingredients as Record<string, unknown>[]) || []).map((ing: Record<string, unknown>, j: number) => ({
          ...ing,
          id: `ing_${i}_${j}`,
          actualPrice: null
        }))
      })),
      shoppingList: (planData.shoppingList || []).map((item: Record<string, unknown>, i: number) => ({
        ...item,
        id: `shop_${i}`,
        actualPrice: null
      })),
      totalEstimated: planData.totalEstimated || 0,
      totalActual: 0,
      prepSchedule: planData.prepSchedule || null
    };

    return NextResponse.json(plan);

  } catch (error) {
    console.error('Meal plan error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to generate meal plan' },
      { status: 500 }
    );
  }
}
