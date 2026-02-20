import { requireTier, getCurrentUser} from '@/lib/auth-helpers';
import { NextRequest, NextResponse } from 'next/server';
import { openai, models } from '@/lib/ai';

type CartCategory = 'clothing' | 'hygiene' | 'cleaning' | 'kitchen';

interface CartRequest {
  category: CartCategory;
  budgetMin: number;
  budgetMax: number;
  householdSize: number;
  cadence: 'monthly' | 'quarterly' | 'semi-annual' | 'annual' | 'as-needed';
  preferences: string;
  excludeItems: string;
}

const VALID_CATEGORIES: CartCategory[] = ['clothing', 'hygiene', 'cleaning', 'kitchen'];

const CATEGORY_CONFIG: Record<CartCategory, { label: string; coaCode: string; systemContext: string; exampleItems: string }> = {
  clothing: {
    label: 'Clothing & Personal Care',
    coaCode: 'P-8150',
    systemContext: `You are a personal shopping consultant specializing in wardrobe essentials and personal care basics.
Focus on:
- Seasonal wardrobe staples (basics that need regular replacement: socks, underwear, undershirts, t-shirts)
- Personal care items (deodorant, razors, shaving cream, lotion, sunscreen)
- Replacement basics (worn-out items that every person needs)
- Quality-to-price ratio — recommend mid-range brands, not luxury
Do NOT include: fashion/trend items, formal wear, accessories, shoes (unless basic), or designer brands.`,
    exampleItems: 'crew socks 6-pack, cotton boxer briefs 3-pack, plain t-shirts 3-pack, deodorant, body lotion, sunscreen SPF 50',
  },
  hygiene: {
    label: 'Hygiene & Toiletries',
    coaCode: 'P-8310',
    systemContext: `You are a household supply consultant specializing in personal hygiene and toiletries.
Focus on:
- Daily hygiene: toothpaste, toothbrushes, floss, mouthwash
- Shower/bath: body wash, shampoo, conditioner, bar soap
- Skincare basics: face wash, moisturizer, lip balm
- Personal care: cotton swabs, cotton pads, tissues, hand sanitizer
- Feminine hygiene (if applicable based on household)
Do NOT include: luxury/premium skincare, perfume/cologne, cosmetics/makeup, or salon-quality products.`,
    exampleItems: 'toothpaste 2-pack, soft toothbrushes 4-pack, floss 2-pack, body wash 2-pack, shampoo, conditioner',
  },
  cleaning: {
    label: 'Cleaning Supplies',
    coaCode: 'P-8320',
    systemContext: `You are a household supply consultant specializing in cleaning products.
Focus on:
- Surface cleaners: all-purpose spray, glass cleaner, bathroom cleaner, disinfectant
- Laundry: detergent, dryer sheets/balls, stain remover, fabric softener
- Disposables: trash bags (kitchen + bathroom sizes), paper towels, sponges, scrub brushes
- Floor care: mop pads/refills, floor cleaner, vacuum bags/filters
- Dish care: dish soap, dishwasher pods, rinse aid
Do NOT include: cleaning appliances/devices, mops, vacuums, or other durable equipment.`,
    exampleItems: 'all-purpose cleaner 2-pack, kitchen trash bags 200ct, laundry detergent 64 loads, dish soap, paper towels 12-roll',
  },
  kitchen: {
    label: 'Kitchen & Household',
    coaCode: 'P-8330',
    systemContext: `You are a household supply consultant specializing in kitchen and general household consumables and small tools.
Focus on:
- Kitchen consumables: aluminum foil, plastic wrap, parchment paper, zip-lock bags, food storage containers
- Kitchen tools (replacement): can opener, vegetable peeler, spatulas, tongs, cutting board
- Food storage: containers, bag clips, labels
- Household basics: batteries, light bulbs, tape, scissors
- Seasonal: air freshener, candles, matches
Do NOT include: appliances (blender, toaster, etc.), cookware (pots, pans), dinnerware, or furniture.`,
    exampleItems: 'aluminum foil 200ft, gallon zip-lock bags 75ct, parchment paper, food storage containers 10-set, AA batteries 24-pack',
  },
};

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const tierGate = requireTier(user.tier, 'ai');
    if (tierGate) return tierGate;

    const body = await request.json() as CartRequest;

    if (!body.category || !VALID_CATEGORIES.includes(body.category)) {
      return NextResponse.json({ error: 'Invalid category. Must be one of: clothing, hygiene, cleaning, kitchen' }, { status: 400 });
    }

    const { category, budgetMin, budgetMax, householdSize, cadence, preferences, excludeItems } = body;
    const config = CATEGORY_CONFIG[category];
    const budgetCeiling = Math.round(((budgetMin + budgetMax) / 2) * householdSize);

    const cadenceLabel = cadence === 'monthly' ? 'one month'
      : cadence === 'quarterly' ? 'three months (one quarter)'
      : cadence === 'semi-annual' ? 'six months (half a year)'
      : cadence === 'annual' ? 'one full year'
      : 'a single replenishment cycle';

    const prompt = `${config.systemContext}

Generate a complete ${config.label} shopping list for a household of ${householdSize} person(s), covering ${cadenceLabel} of needs.

BUDGET: $${budgetMin}-$${budgetMax} total for ${householdSize} person(s).
*** HARD BUDGET CEILING: $${budgetCeiling}. Do NOT exceed this. ***
If items sum to more than $${budgetCeiling}, remove lower-priority items or switch to cheaper alternatives. A list that exceeds this budget is INVALID.

REPLENISHMENT CADENCE: ${cadence}
- Buy quantities that last ${cadenceLabel}. Do not over-buy or under-buy.
- For monthly: standard household quantities (1 bottle of cleaner, 1 pack of sponges, etc.)
- For quarterly: bulk sizes where available (3-pack, warehouse sizes)
- For semi-annual: warehouse/club store bulk (6-packs, large multi-packs, economy sizes)
- For annual: maximum bulk — buy enough for a full year. Use the largest available sizes and multi-packs for maximum per-unit savings.
- For as-needed: minimum viable restock

${preferences ? `USER PREFERENCES: ${preferences}` : ''}
${excludeItems ? `ITEMS TO EXCLUDE: ${excludeItems}` : ''}

PRICING RULES:
- Use real US retail prices (Target, Walmart, Amazon range). Round up to nearest dollar.
- Use real package sizes (no "1 sponge" — buy the 3-pack or 6-pack).
- Examples of real items for this category: ${config.exampleItems}

PRIORITY LEVELS:
- "essential" = must-have, needed every cycle
- "recommended" = should-have, improves quality of life
- "optional" = nice-to-have if budget allows

totalEstimated CALCULATION (MANDATORY):
totalEstimated MUST equal the sum of all items' estimatedPrice values plus a 15% buffer.
Formula: totalEstimated = (sum of all estimatedPrice) * 1.15, rounded to 2 decimal places.
CALCULATE it from the item prices — do NOT make up a separate number.

Respond with ONLY valid JSON:
{
  "items": [
    {
      "name": "All-Purpose Cleaner",
      "quantity": 2,
      "unit": "bottles",
      "packageSize": "32 oz spray bottle",
      "estimatedPrice": 4.00,
      "category": "${category}",
      "priority": "essential",
      "notes": "Covers kitchen + bathroom for 1 month"
    }
  ],
  "totalEstimated": 0
}

Generate a comprehensive but realistic list — typically 10-20 items for monthly, 15-30 for quarterly.
FINAL CHECK: sum all estimatedPrice values, multiply by 1.15 = totalEstimated. This MUST be ≤ $${budgetCeiling}. If over, revise.`;

    const completion = await openai.chat.completions.create({
      model: models.primary,
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.7,
      max_tokens: 8000,
      response_format: { type: 'json_object' },
    });

    const textContent = completion.choices[0]?.message?.content;
    if (!textContent) {
      throw new Error('No response from AI');
    }

    let planData;
    try {
      let jsonStr = textContent;
      const codeBlockMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
      if (codeBlockMatch) jsonStr = codeBlockMatch[1];
      if (!jsonStr.trim().startsWith('{')) {
        const objMatch = jsonStr.match(/\{[\s\S]*\}/);
        if (objMatch) jsonStr = objMatch[0];
      }
      planData = JSON.parse(jsonStr.trim());
    } catch {
      console.error('Cart plan JSON parse error:', textContent.substring(0, 500));
      throw new Error('Failed to parse cart plan response');
    }

    const plan = {
      id: `cart_${category}_${Date.now()}`,
      createdAt: new Date().toISOString(),
      category,
      categoryLabel: config.label,
      coaCode: config.coaCode,
      householdSize,
      cadence,
      budgetMin,
      budgetMax,
      items: (planData.items || []).map((item: Record<string, unknown>, i: number) => ({
        ...item,
        id: `cart_${i}`,
        quantity: Number(item.quantity) || 0,
        estimatedPrice: Number(item.estimatedPrice) || 0,
        actualPrice: null,
      })),
      totalEstimated: 0, // computed below
      totalActual: 0,
    };

    // Server-side: compute totalEstimated from actual item prices + 15% buffer
    const itemSum = plan.items.reduce((sum: number, item: { estimatedPrice: number }) => sum + item.estimatedPrice, 0);
    plan.totalEstimated = Math.round(itemSum * 1.15 * 100) / 100;

    return NextResponse.json(plan);

  } catch (error) {
    console.error('Cart plan error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to generate cart plan' },
      { status: 500 }
    );
  }
}
