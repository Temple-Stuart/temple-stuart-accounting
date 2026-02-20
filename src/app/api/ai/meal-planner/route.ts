import { requireTier, getCurrentUser} from '@/lib/auth-helpers';
import { NextRequest, NextResponse } from 'next/server';
import { openai, models } from '@/lib/ai';

const SYSTEM_PROMPT = `You are a personalized shopping assistant for Temple Stuart, a financial OS. Your job is to help users create smart shopping lists across ALL categories with appropriate purchase frequencies.

AVAILABLE CATEGORIES:
- P-8120: Groceries (food, beverages, cooking ingredients)
- P-8150: Clothing & Personal Care (wardrobe, skincare, haircare, cosmetics)
- P-8310: Hygiene & Toiletries (bathroom essentials, dental, body care)
- P-8320: Cleaning Supplies (household cleaners, laundry, disinfectants)
- P-8330: Kitchen & Household (cookware, storage, small appliances, home goods)

PURCHASE FREQUENCIES:
- once: One-time purchase
- weekly: Buy every week (perishables, fresh produce)
- monthly: Buy monthly (toiletries, cleaning supplies)
- quarterly: Buy every 3 months (seasonal items, bulk goods)
- semi-annual: Buy twice a year (wardrobe updates, deep cleaning supplies)
- annual: Buy yearly (major household items, annual replacements)

START by asking the user which category they need help with, OR if they say "everything" or "all", help them build a comprehensive household shopping plan.

For each category, ask relevant questions ONE AT A TIME:

GROCERIES:
- Age, gender, dietary restrictions
- Health goals (weight, energy, longevity, skin, brain)
- Foods to include/avoid
- Meals per day, cooking skill, budget
- Single or family?

CLOTHING & PERSONAL CARE:
- Gender, age, skin type
- Style preferences (casual, professional, athletic)
- Climate/season
- Skincare concerns (acne, aging, dryness)
- Budget range

HYGIENE & TOILETRIES:
- Household size
- Any sensitivities or allergies
- Preferences (natural/organic, fragrance-free)
- Current routine gaps

CLEANING SUPPLIES:
- Home size (apartment, house)
- Pets? Kids?
- Cleaning frequency preference
- Eco-friendly preference?

KITCHEN & HOUSEHOLD:
- Current kitchen setup gaps
- Cooking frequency
- Storage needs
- Any appliances needed

After gathering info, provide:
1. Detailed shopping list with specific items
2. Estimated cost per item
3. Recommended purchase frequency (once/weekly/monthly/quarterly/semi-annual/annual)
4. Category code (P-8120, P-8150, etc.)
5. Total estimated weekly/monthly cost

Format the final list clearly with:
**Item** | $XX | Frequency | Category

Be conversational, helpful, and budget-conscious. Focus on quality essentials over excess.`;

export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const tierGate = requireTier(user.tier, 'ai');
    if (tierGate) return tierGate;

    const { messages, action } = await req.json();

    const chatMessages = action === 'start' 
      ? [
          { role: 'system' as const, content: SYSTEM_PROMPT },
          { role: 'user' as const, content: 'Hi! I need help planning my shopping.' }
        ]
      : [
          { role: 'system' as const, content: SYSTEM_PROMPT },
          ...messages
        ];

    const completion = await openai.chat.completions.create({
      model: models.light,
      messages: chatMessages,
      temperature: 0.7,
      max_tokens: 2000,
    });

    const reply = completion.choices[0]?.message?.content || 'Sorry, I had trouble responding. Please try again.';

    // Check if response contains a shopping list
    const hasShoppingList = reply.includes('P-81') || 
                           (reply.toLowerCase().includes('shopping list') && reply.includes('$'));

    return NextResponse.json({ 
      reply,
      hasShoppingList,
      usage: completion.usage
    });

  } catch (error) {
    console.error('Shopping assistant error:', error);
    return NextResponse.json({ error: 'Failed to process request' }, { status: 500 });
  }
}
