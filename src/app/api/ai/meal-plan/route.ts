import { requireTier } from '@/lib/auth-helpers';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import OpenAI from 'openai';
import { getVerifiedEmail } from '@/lib/cookie-auth';

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
    const userEmail = await getVerifiedEmail();
    if (!userEmail) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const user = await prisma.users.findFirst({
      where: { email: { equals: userEmail, mode: 'insensitive' } }
    });
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const tierGate = requireTier(user.tier, 'ai');
    if (tierGate) return tierGate;

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

    // Compute prep day schedule based on food safety (3-4 day max fridge life)
    const DAYS_LIST = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    type PrepDay = { day: number; dayName: string; covers: string[] };
    let prepDays: PrepDay[] = [];

    if (profile.cookingStyle === 'meal-prep' || profile.cookingStyle === 'hybrid') {
      if (profile.cookingDays === 1) {
        // 1 prep day: Sunday covers Mon-Wed fridge + Thu-Sat freezer
        prepDays = [
          { day: 7, dayName: 'Sunday', covers: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'] }
        ];
      } else if (profile.cookingDays === 2) {
        // 2 prep days: Sunday covers Sun-Wed, Wednesday covers Wed-Sat
        prepDays = [
          { day: 7, dayName: 'Sunday', covers: ['Sunday', 'Monday', 'Tuesday', 'Wednesday'] },
          { day: 4, dayName: 'Wednesday', covers: ['Thursday', 'Friday', 'Saturday'] }
        ];
      } else if (profile.cookingDays === 3) {
        prepDays = [
          { day: 7, dayName: 'Sunday', covers: ['Sunday', 'Monday'] },
          { day: 3, dayName: 'Tuesday', covers: ['Tuesday', 'Wednesday', 'Thursday'] },
          { day: 6, dayName: 'Friday', covers: ['Friday', 'Saturday'] }
        ];
      } else if (profile.cookingDays === 4) {
        prepDays = [
          { day: 7, dayName: 'Sunday', covers: ['Sunday', 'Monday'] },
          { day: 2, dayName: 'Monday', covers: ['Tuesday'] },
          { day: 4, dayName: 'Wednesday', covers: ['Wednesday', 'Thursday'] },
          { day: 6, dayName: 'Friday', covers: ['Friday', 'Saturday'] }
        ];
      } else {
        // 5+ days: nearly daily, assign sequentially
        const spacing = Math.floor(7 / profile.cookingDays);
        for (let i = 0; i < profile.cookingDays; i++) {
          const dayIdx = (i * spacing) % 7;
          const coversCount = i < profile.cookingDays - 1 ? spacing : 7 - (i * spacing);
          const coversDays = [];
          for (let j = 0; j < coversCount; j++) {
            coversDays.push(DAYS_LIST[(dayIdx + j) % 7]);
          }
          prepDays.push({ day: dayIdx + 1, dayName: DAYS_LIST[dayIdx], covers: coversDays });
        }
      }
    }

    const prepDayScheduleText = prepDays.length > 0
      ? prepDays.map(pd => `- PREP DAY: ${pd.dayName} (day ${pd.day}) → cook meals for: ${pd.covers.join(', ')}`).join('\n')
      : '';

    // Build cooking style instructions
    let cookingInstructions = '';
    // Calculate max unique recipes for meal-prep modes
    const uniqueRecipeCap = profile.cookingDays <= 1 ? 4
      : profile.cookingDays === 2 ? 7
      : profile.cookingDays === 3 ? 10
      : Math.min(mealsToPlan, profile.cookingDays * 3);

    if (profile.cookingStyle === 'meal-prep') {
      cookingInstructions = `
MEAL PREP MODE — FOOD SAFETY IS NON-NEGOTIABLE:
The user cooks on EXACTLY ${profile.cookingDays} day(s). All ${mealsToPlan} eating occasions must be covered.

*** UNIQUE RECIPE LIMIT (CRITICAL — DO NOT IGNORE) ***
Generate AT MOST ${uniqueRecipeCap} unique recipes. The user cooks ${profile.cookingDays} day(s)/week — they batch-cook large portions and eat LEFTOVERS for the remaining days. ${mealsToPlan} is the number of EATING OCCASIONS, not unique meals. Each recipe should yield enough servings to cover multiple days. Reuse the same recipe name across multiple days. Do NOT create ${mealsToPlan} unique recipes — that defeats the purpose of meal prep.

DAILY ROTATION (CRITICAL — DO NOT MAKE EVERY DAY IDENTICAL):
Generate ${uniqueRecipeCap} base recipes, then ROTATE them across the 7 days so each day has a DIFFERENT combination. For example with 4 recipes (A, B, C, D): Day 1 = A/B/C, Day 2 = A/C/D, Day 3 = B/C/D, Day 4 = A/B/D, etc. Not every day should have the same breakfast, lunch, and dinner. Vary which recipe fills which meal slot each day.

PREP DAY ASSIGNMENTS (follow exactly):
${prepDayScheduleText}

FOOD SAFETY RULES:
- Cooked meat/poultry: 3-4 days max in fridge
- Cooked grains/rice: 4-5 days max
- Cut fruit/veg: 3-5 days
- If a meal is eaten 5+ days after prep, it MUST be frozen then thawed
- Each meal's "prepDay" field MUST match the prep day that covers it

MEAL REQUIREMENTS:
- ALL meals isMealPrep: true
- Each meal MUST have a prepDay value matching one of the prep days above
- Recipes must be batch-friendly: grain bowls, sheet pan proteins, soups, stews, casseroles, overnight oats
- Include storage instructions (fridge vs freeze) and reheating instructions
- AVOID: salads that wilt, fried foods that go soggy, raw fish dishes
- REUSE recipes across days — a batch of soup cooked Sunday IS the same meal entry for Mon, Tue, Wed

PREP SCHEDULE (required in response):
Generate "prepSchedule" array:
[${prepDays.map(pd => `{ "day": ${pd.day}, "dayName": "${pd.dayName}", "meals": ["Item 1 (X servings)", "Item 2 (X servings)"] }`).join(', ')}]

DISTRIBUTE MEALS ACROSS PREP DAYS — do NOT put all meals on one day.`;
    } else if (profile.cookingStyle === 'hybrid') {
      cookingInstructions = `
HYBRID MODE — MIX OF PREP AND FRESH:
The user cooks on ${profile.cookingDays} days per week.

PREP DAY ASSIGNMENTS:
${prepDayScheduleText}

RULES:
- ~50% of meals should be batch-prepped (isMealPrep: true, with prepDay)
- ~50% should be quick fresh meals (15-20 min, isMealPrep: false)
- Fresh meals should fall on or near cooking days
- Prepped meals follow same food safety rules: 3-4 days fridge max
- Include prepSchedule array for the batch-prep meals`;
    } else {
      cookingInstructions = `
DAILY COOKING MODE:
- User cooks fresh ${profile.cookingDays} days/week
- Target ${timeRange.prep + timeRange.cook} minutes or less per meal
- Variety each day, leftovers OK but not required
- isMealPrep: false for all, no prepDay needed`;
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
- Budget: $${weeklyBudget}/week HARD CEILING (see budget rules below)

${cookingInstructions}
${goalInstructions}

*** HARD BUDGET CEILING (DO NOT EXCEED) ***
The total shopping list cost (totalEstimated) MUST NOT exceed $${weeklyBudget}. This is a HARD ceiling, not a suggestion.
- If your initial plan exceeds the budget, you MUST revise: use cheaper proteins (chicken thighs, eggs, beans, lentils instead of beef/salmon), buy store-brand, reduce portion sizes, or remove expensive items.
- The budget of $${weeklyBudget}/week for ${profile.peopleCount} person(s) is non-negotiable. A plan that exceeds this amount is INVALID.
- Double-check: sum all shoppingList estimatedPrice values. If the sum > $${weeklyBudget}, revise the plan before responding.

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

SHOPPING LIST INTEGRITY (CRITICAL):
The shopping list MUST contain every single ingredient referenced in any meal. Cross-check every meal's ingredients against the shopping list before responding. If an ingredient appears in a meal, it MUST appear in the shopping list. The shopping list is derived by consolidating ALL ingredients from ALL meals — do NOT generate it independently. After generating all meals, walk through each meal's ingredient list and verify it maps to a shopping list entry. Missing ingredients = invalid response.

PRICE ESTIMATES (CRITICAL):
Estimate grocery prices conservatively — use the higher end of typical US grocery store prices, not the lowest. Round up to the nearest dollar.

totalEstimated CALCULATION (MANDATORY):
totalEstimated MUST equal the sum of all shoppingList estimatedPrice values plus a 15% buffer. CALCULATE it — do NOT estimate it independently. Formula: totalEstimated = (sum of all shoppingList[i].estimatedPrice) * 1.15, rounded to 2 decimal places. If your shoppingList items sum to $58, totalEstimated must be $66.70, NOT $92 or any other made-up number.

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

Generate ${profile.mealsPerDay === 3 ? 'breakfast, lunch, dinner' : 'lunch, dinner'} for all 7 days (${mealsToPlan} eating occasions total).
${profile.cookingStyle === 'meal-prep' ? `REMEMBER: Max ${uniqueRecipeCap} unique recipes — reuse batch-cooked meals across days. ${mealsToPlan} is eating occasions, NOT unique recipes.` : ''}
Shopping list must be CONSOLIDATED - combine all uses of same ingredient. Every meal ingredient MUST appear on the shopping list.
Categories: produce, dairy, meat, seafood, grains, pantry, frozen, beverages, spices
Prices must use high-end US grocery estimates, rounded up.
FINAL CHECK: totalEstimated = sum(shoppingList estimatedPrices) * 1.15. Verify this math. totalEstimated MUST be ≤ $${weeklyBudget}. If over budget, revise before responding.
${profile.cookingStyle === 'meal-prep' ? 'Include prepSchedule array showing what to cook each prep day.' : ''}`;

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.7,
      max_tokens: 16000,
      response_format: { type: 'json_object' },
    });

    const textContent = completion.choices[0]?.message?.content;
    if (!textContent) {
      throw new Error('No response from AI');
    }

    let planData;
    try {
      let jsonStr = textContent;
      // Strip markdown code blocks if present
      const codeBlockMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
      if (codeBlockMatch) jsonStr = codeBlockMatch[1];
      // Fallback: extract outermost JSON object
      if (!jsonStr.trim().startsWith('{')) {
        const objMatch = jsonStr.match(/\{[\s\S]*\}/);
        if (objMatch) jsonStr = objMatch[0];
      }
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
        day: Number(m.day) || 0,
        prepTime: Number(m.prepTime) || 0,
        cookTime: Number(m.cookTime) || 0,
        servings: Number(m.servings) || 0,
        calories: Number(m.calories) || 0,
        protein: Number(m.protein) || 0,
        carbs: Number(m.carbs) || 0,
        fat: Number(m.fat) || 0,
        ingredients: ((m.ingredients as Record<string, unknown>[]) || []).map((ing: Record<string, unknown>, j: number) => ({
          ...ing,
          id: `ing_${i}_${j}`,
          quantity: Number(ing.quantity) || 0,
          packageQuantity: Number(ing.packageQuantity) || 0,
          estimatedPrice: Number(ing.estimatedPrice) || 0,
          actualPrice: null
        }))
      })),
      shoppingList: (planData.shoppingList || []).map((item: Record<string, unknown>, i: number) => ({
        ...item,
        id: `shop_${i}`,
        quantity: Number(item.quantity) || 0,
        packageQuantity: Number(item.packageQuantity) || 0,
        estimatedPrice: Number(item.estimatedPrice) || 0,
        actualPrice: null
      })),
      totalEstimated: 0, // computed below from shopping list
      totalActual: 0,
      prepSchedule: planData.prepSchedule || null
    };

    // Server-side: compute totalEstimated from actual shopping list prices + 15% buffer
    const shoppingSum = plan.shoppingList.reduce((sum: number, item: { estimatedPrice: number }) => sum + item.estimatedPrice, 0);
    plan.totalEstimated = Math.round(shoppingSum * 1.15 * 100) / 100;

    return NextResponse.json(plan);

  } catch (error) {
    console.error('Meal plan error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to generate meal plan' },
      { status: 500 }
    );
  }
}
