import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function POST(req: NextRequest) {
  try {
    const { thisMonthTotal, thisYearTotal, thisMonthCount, categories, merchants, trends, entity } = await req.json();

    const entityText = entity ? ` for ${entity} accounts` : '';
    
    // Build context for GPT
    const categoriesText = categories.map(([cat, amt]: [string, number]) => `${cat}: $${amt.toFixed(2)}`).join(', ');
    const merchantsText = merchants.map(([merch, amt]: [string, number]) => `${merch}: $${amt.toFixed(2)}`).join(', ');
    const trendsText = trends.map((t: any) => `${t.month}: $${t.total.toFixed(2)}`).join(', ');

    const prompt = `You are a financial advisor analyzing spending data${entityText}. Generate a concise, insightful summary (3-4 sentences) of the following spending patterns:

This Month: $${thisMonthTotal.toFixed(2)} (${thisMonthCount} transactions)
This Year: $${thisYearTotal.toFixed(2)}

Top Categories: ${categoriesText}
Top Merchants: ${merchantsText}
6-Month Trend: ${trendsText}

Provide actionable insights about spending patterns, notable changes, and suggestions. Be conversational but professional.`;

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: 'You are a helpful financial advisor providing spending insights.' },
        { role: 'user', content: prompt }
      ],
      temperature: 0.7,
      max_tokens: 200,
    });

    const insights = completion.choices[0]?.message?.content || 'Unable to generate insights.';

    return NextResponse.json({ insights });
  } catch (error) {
    console.error('AI insights error:', error);
    return NextResponse.json({ error: 'Failed to generate insights' }, { status: 500 });
  }
}
