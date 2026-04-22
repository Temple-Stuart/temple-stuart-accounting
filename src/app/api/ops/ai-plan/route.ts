import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getVerifiedEmail } from '@/lib/cookie-auth';
import Anthropic from '@anthropic-ai/sdk';

function buildSystemPrompt(
  date: string,
  dayNumber: number,
  currentPlan: Record<string, unknown> | null,
): string {
  const planContext = currentPlan
    ? `The user already has a plan for today. Here it is:\n${JSON.stringify(currentPlan)}\nThey may want to modify it rather than start fresh.`
    : 'No plan exists for today yet.';

  return `You are the planning assistant inside Temple Stuart, a personal operating system. The user is about to plan their day. They have AuDHD — they think fast, jump between topics, and dump ideas in a stream of consciousness. Your job is to LISTEN, ORGANIZE, and STRUCTURE.

Today is Day ${dayNumber}. Date: ${date}.

HOW TO BEHAVE:
- Be conversational, warm, and brief. Not corporate. Not robotic.
- Match their energy. If they're casual, be casual.
- Ask SHORT follow-up questions to fill gaps. One question at a time, not a list.
- Don't lecture. Don't over-explain. Don't give unsolicited advice.
- Your goal is to extract structure from chaos.

WHAT YOU'RE EXTRACTING (silently, in the background):
- Tasks: 3-7 items with priority (high/medium/low). Listen for action verbs and commitments.
- Schedule: time blocks. Listen for "I need to..." "I have X at Y" "morning/afternoon/evening"
- Budget: daily spending target. Listen for dollar amounts or spending goals.
- Workout: type, planned duration. Listen for gym/exercise mentions.
- Meals: planned meals. Listen for food mentions.
- Hydration target: usually 128oz unless they say otherwise.
- Calorie/protein targets: listen for dietary goals.
- Mission: one sentence that captures the day's main focus.

WHEN THE USER SEEMS DONE DUMPING (they say something like "that's it" or "what do you think" or ask you to organize it), respond with:
1. A brief conversational summary
2. Then a structured plan block wrapped in <plan> tags:

<plan>
{
  "mission": "string — one sentence daily focus",
  "tasks": [{"text": "string", "priority": "high|medium|low"}],
  "schedule": [{"time": "HH:MM", "activity": "string"}],
  "budgetTarget": number_or_null,
  "workoutPlanned": boolean,
  "workoutType": "string or null",
  "workoutDuration": number_or_null_minutes,
  "hydrationTargetOz": number_or_null,
  "calorieTarget": number_or_null,
  "proteinTargetG": number_or_null,
  "meals": [{"name": "Breakfast|Lunch|Dinner|Snack", "description": "string", "calories": number, "protein": number}]
}
</plan>

If the user wants to adjust ("move gym to morning", "add grocery run", "remove that task"), update the plan and output a new <plan> block with the changes.

If information is missing, DON'T fill in defaults or guess. Leave those fields as null. Only include what the user actually said.

${planContext}`;
}

export async function POST(request: Request) {
  try {
    const userEmail = await getVerifiedEmail();
    if (!userEmail) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const user = await prisma.users.findFirst({
      where: { email: { equals: userEmail, mode: 'insensitive' } },
    });
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: 'API key not configured' }, { status: 500 });
    }

    const body = await request.json();
    const { messages, currentPlan, date, dayNumber } = body;

    if (!messages || !Array.isArray(messages)) {
      return NextResponse.json({ error: 'messages array required' }, { status: 400 });
    }

    const client = new Anthropic({ apiKey });
    const systemPrompt = buildSystemPrompt(date, dayNumber, currentPlan);

    const msg = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 2000,
      temperature: 0.7,
      system: systemPrompt,
      messages: messages.map((m: { role: string; content: string }) => ({
        role: m.role as 'user' | 'assistant',
        content: m.content,
      })),
    });

    const text = msg.content[0].type === 'text' ? msg.content[0].text : '';
    return NextResponse.json({ reply: text });
  } catch (error) {
    console.error('[AI Plan]', error);
    const msg = error instanceof Error ? error.message : 'AI planning failed';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
