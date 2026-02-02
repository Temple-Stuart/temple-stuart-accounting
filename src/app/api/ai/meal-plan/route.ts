import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';

interface MealProfile {
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

const BUDGET_RANGES: Record<string, { min: number; max: number }> = {
  'budget': { min: 50, max: 75 },
  'moderate': { min: 75, max: 125 },
  'premium': { min: 125, max: 175 },
  'luxury': { min: 175, max: 250 },
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

    const weightKg = profile.weightUnit === 'kg' ? profile.weight : profile.weight * 0.453592;
    const heightCm = profile.heightUnit === 'cm' ? profile.height : profile.height * 2.54;
    const bmr = 10 * weightKg + 6.25 * heightCm - 5 * profile.age + 5;
    let dailyCalories = Math.round(bmr * 1.55);
    
    if (profile.goals.includes('weight-loss')) dailyCalories = Math.round(dailyCalories * 0.8);
    if (profile.goals.includes('muscle-gain')) dailyCalories = Math.round(dailyCalories * 1.15);

    const prompt = `You are a professional nutritionist. Generate a 7-day meal plan.

PROFILE:
- People: ${profile.peopleCount}
- Cooking frequency: ${profile.cookingFrequency}
- Diet: ${profile.diet}
- Daily calories: ~${dailyCalories}/person
- Goals: ${profile.goals.length > 0 ? profile.goals.join(', ') : 'general health'}
- Allergies: ${profile.allergies.length > 0 ? profile.allergies.join(', ') : 'none'}
- Cuisines: ${profile.cuisinePreferences.length > 0 ? profile.cuisinePreferences.join(', ') : 'varied'}
- Budget: ~$${weeklyBudget}/week

CRITICAL - REAL PACKAGING SIZES:
You cannot buy 1 egg or 3 oz of milk. Use real store quantities:
- Eggs: 6, 12, 18, or 24 count cartons
- Milk: half gallon or gallon
- Bread: 1 loaf (20-24 slices)
- Chicken breast: 1 lb, 2 lb, or 3 lb packs
- Ground beef: 1 lb or 2 lb packs
- Rice: 1 lb, 2 lb, or 5 lb bags
- Pasta: 1 lb box
- Butter: 1 lb (4 sticks) or 8 oz (2 sticks)
- Cheese: 8 oz or 16 oz blocks
- Yogurt: 32 oz tub or 5.3 oz individual
- Spinach/greens: 5 oz or 10-16 oz bags
- Onions: 3 lb bag or individual
- Potatoes: 5 lb or 10 lb bags
- Berries: 6 oz or 16 oz containers

PLAN EFFICIENTLY:
1. Reuse ingredients across meals to minimize waste
2. If recipe needs 2 eggs, buy 12-count, plan other meals using remaining 10
3. Buy 2 lb chicken pack, use across 3-4 meals
4. Consolidate shopping list - no duplicates

Respond with ONLY valid JSON:
{
  "meals": [
    {
      "day": 1,
      "dayName": "Monday",
      "mealType": "breakfast",
      "name": "Veggie Scramble",
      "description": "Fluffy eggs with sauteed vegetables",
      "prepTime": 10,
      "cookTime": 15,
      "servings": ${profile.peopleCount},
      "calories": 400,
      "protein": 25,
      "carbs": 15,
      "fat": 28,
      "instructions": ["Step 1...", "Step 2..."],
      "ingredients": [
        {
          "name": "Large eggs",
          "quantity": 3,
          "unit": "eggs",
          "packageSize": "12 count carton",
          "packageQuantity": 1,
          "estimatedPrice": 4.99,
          "category": "dairy",
          "notes": "9 remaining for week"
        }
      ]
    }
  ],
  "shoppingList": [
    {
      "name": "Large eggs",
      "quantity": 12,
      "unit": "count",
      "packageSize": "12 count carton",
      "packageQuantity": 1,
      "estimatedPrice": 4.99,
      "category": "dairy",
      "notes": "Used: Mon breakfast, Wed dinner, Sat brunch"
    }
  ],
  "totalEstimated": 127.50
}

Generate breakfast, lunch, dinner for all 7 days (21 meals).
Shopping list must be CONSOLIDATED - combine all uses of same ingredient.
Categories: produce, dairy, meat, seafood, grains, pantry, frozen, beverages, spices`;

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
      totalActual: 0
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
