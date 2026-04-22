import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getVerifiedEmail } from '@/lib/cookie-auth';
import Anthropic from '@anthropic-ai/sdk';

interface Answers {
  energy: string;
  mission: string;
  tasks: string;
  body: string;
  budget: string;
  schedule: string;
}

function buildSynthesisPrompt(date: string, dayNumber: number, answers: Answers): string {
  return `You are the planning engine inside Temple Stuart, a personal operating system designed for AuDHD gifted adults. You have received 6 structured answers from the user's daily planning flow. Your job is to synthesize these raw, unstructured answers into a precise, structured daily plan.

Today is Day ${dayNumber}. Date: ${date}.

The user's answers:

ENERGY & SLEEP: ${answers.energy}
TODAY'S MISSION: ${answers.mission}
BRAIN DUMP (tasks/todo): ${answers.tasks}
BODY & FOOD: ${answers.body}
BUDGET: ${answers.budget}
FIXED SCHEDULE: ${answers.schedule}

YOUR JOB:
1. Extract every actionable task from the BRAIN DUMP. Assign priority: high (has a deadline today or is the mission), medium (important but flexible), low (nice to have).
2. Build a time-blocked schedule. Start with fixed commitments from FIXED SCHEDULE. Then slot in tasks based on energy level from ENERGY & SLEEP:
   - If they feel sharp/energized: put the hardest task first in the morning, creative work mid-day, admin/errands afternoon.
   - If they feel foggy/tired: start with easy wins to build momentum, save hard tasks for when energy picks up.
   - If they feel wired/anxious: physical activity first, then focused work.
3. Estimate duration for each task. Multiply your estimate by 1.5 (ADHD brains underestimate time). Add 15-minute buffers between different types of activities.
4. Only schedule 50% of available waking hours. Leave the rest unscheduled for flexibility and unexpected needs.
5. Extract workout details from BODY & FOOD. If they mention a workout, set workoutPlanned: true with type and estimated duration.
6. Extract meal plans from BODY & FOOD. If they mention specific meals, create meal entries. If vague ("eating healthy"), create placeholder meals with null calories.
7. Extract budget target from BUDGET. Parse dollar amounts. If they say "trying to spend nothing" set to 0. If unclear, set to null.
8. Extract hydration/calorie/protein targets from BODY & FOOD if mentioned. If not mentioned, set to null (do NOT default or guess).
9. Craft a one-sentence mission from TODAY'S MISSION. Keep it punchy and motivating.
10. Set sleepHours and sleepQuality from ENERGY & SLEEP if they mention how they slept.

RESPOND WITH ONLY a JSON object wrapped in <plan> tags. No conversational text before or after. Just the plan:

<plan>
{
  "mission": "string",
  "tasks": [{"text": "string", "priority": "high|medium|low", "estimatedMinutes": number}],
  "schedule": [{"time": "HH:MM", "activity": "string", "durationMinutes": number}],
  "budgetTarget": null,
  "workoutPlanned": false,
  "workoutType": null,
  "workoutDuration": null,
  "hydrationTargetOz": null,
  "calorieTarget": null,
  "proteinTargetG": null,
  "meals": [{"name": "Breakfast|Lunch|Dinner|Snack", "description": "string", "calories": null, "protein": null}],
  "sleepHours": null,
  "sleepQuality": null,
  "aiNotes": "string — brief note about how you organized the plan based on their energy level, any concerns about overcommitment, or suggestions"
}
</plan>`;
}

function buildAdjustPrompt(adjustment: string, currentPlan: Record<string, unknown>): string {
  return `You have a daily plan. The user wants to make an adjustment. Apply the change and return the full updated plan in <plan> tags. Only return the <plan> JSON block, no other text.

Change requested: ${adjustment}

Current plan:
${JSON.stringify(currentPlan, null, 2)}

Return the complete updated plan as a JSON object inside <plan> tags.`;
}

async function authenticateUser() {
  const userEmail = await getVerifiedEmail();
  if (!userEmail) return null;
  const user = await prisma.users.findFirst({
    where: { email: { equals: userEmail, mode: 'insensitive' } },
  });
  return user;
}

function getClient() {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return null;
  return new Anthropic({ apiKey });
}

export async function POST(request: Request) {
  try {
    const user = await authenticateUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const client = getClient();
    if (!client) return NextResponse.json({ error: 'API key not configured' }, { status: 500 });

    const body = await request.json();
    const { mode } = body;

    if (mode === 'adjust') {
      const { adjustment, currentPlan } = body;
      if (!adjustment || !currentPlan) {
        return NextResponse.json({ error: 'adjustment and currentPlan required' }, { status: 400 });
      }

      const msg = await client.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 2000,
        temperature: 0.3,
        system: buildAdjustPrompt(adjustment, currentPlan),
        messages: [{ role: 'user', content: 'Apply this adjustment and return the updated plan.' }],
      });

      const text = msg.content[0].type === 'text' ? msg.content[0].text : '';
      return NextResponse.json({ reply: text });
    }

    // Default: synthesize mode
    const { answers, date, dayNumber } = body;
    if (!answers || !date) {
      return NextResponse.json({ error: 'answers and date required' }, { status: 400 });
    }

    const systemPrompt = buildSynthesisPrompt(date, dayNumber, answers);

    const msg = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 2000,
      temperature: 0.5,
      system: systemPrompt,
      messages: [{ role: 'user', content: 'Synthesize my answers into a structured daily plan.' }],
    });

    const text = msg.content[0].type === 'text' ? msg.content[0].text : '';
    return NextResponse.json({ reply: text });
  } catch (error) {
    console.error('[AI Plan]', error);
    const msg = error instanceof Error ? error.message : 'AI planning failed';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
