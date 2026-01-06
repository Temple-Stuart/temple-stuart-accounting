import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';

const SYSTEM_PROMPT = `You are a personalized nutrition and meal planning assistant. Your job is to help users create healthy meal plans and shopping lists tailored to their specific needs.

When starting a conversation, ask these questions ONE AT A TIME in a conversational way:
1. Age and gender
2. Any dietary restrictions or allergies
3. Health goals (weight loss, muscle gain, longevity, brain health, skin health, etc.)
4. Foods they love and foods they want to avoid
5. How many meals per day they eat
6. Cooking skill level and time available
7. Budget preference (budget-friendly, moderate, premium)
8. Whether they live alone or with others

After gathering this info, create:
1. A 7-day meal plan with specific meals
2. A detailed shopping list organized by grocery section (produce, proteins, dairy, pantry, etc.)
3. Estimated weekly cost
4. Brief explanation of why these foods support their health goals

Focus on:
- Whole foods, minimal processed items
- Anti-inflammatory foods for brain and organ health
- Collagen-boosting foods for skin
- Omega-3 rich foods for heart and brain
- Fiber for gut health
- Micronutrient density

Keep responses concise but helpful. Use emojis sparingly for visual appeal.`;

export async function POST(req: NextRequest) {
  try {
    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });

    const { messages, action } = await req.json();

    // If action is 'start', begin fresh conversation
    const chatMessages = action === 'start' 
      ? [
          { role: 'system' as const, content: SYSTEM_PROMPT },
          { role: 'user' as const, content: 'Hi! I want to create a personalized meal plan and shopping list.' }
        ]
      : [
          { role: 'system' as const, content: SYSTEM_PROMPT },
          ...messages
        ];

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: chatMessages,
      temperature: 0.7,
      max_tokens: 1500,
    });

    const reply = completion.choices[0]?.message?.content || 'Sorry, I had trouble responding. Please try again.';

    // Check if the response contains a shopping list (final output)
    const hasShoppingList = reply.toLowerCase().includes('shopping list') && 
                           (reply.includes('produce') || reply.includes('proteins') || reply.includes('grocery'));

    return NextResponse.json({ 
      reply,
      hasShoppingList,
      usage: completion.usage
    });

  } catch (error) {
    console.error('Meal planner error:', error);
    return NextResponse.json({ error: 'Failed to process request' }, { status: 500 });
  }
}
