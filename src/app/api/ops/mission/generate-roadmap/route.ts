import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getVerifiedEmail } from '@/lib/cookie-auth';
import Anthropic from '@anthropic-ai/sdk';

function buildRoadmapPrompt(mission: Record<string, unknown>): string {
  return `You are a strategic project planning engine inside Temple Stuart. You are building a detailed execution roadmap for a gifted AuDHD adult who is a solo founder. Your job is to take their vision and reverse-engineer it into a week-by-week plan with daily task templates.

PROJECT:
- Name: ${mission.name}
- Goal: ${mission.goalDescription}
- Done Definition: ${mission.doneDefinition}
- Start Date: ${mission.startDate}
- End Date: ${mission.endDate}
- Total Days: ${mission.totalDays}

MILESTONES THE USER DEFINED:
${JSON.stringify(mission.milestones)}

CONSTRAINTS:
- Available hours per day: ${mission.hoursPerDay || 'not specified'}
- Off days: ${mission.offDays || 'none specified'}
- Monthly budget: $${mission.monthlyBudget || 'not specified'}
- Blockers: ${mission.blockers || 'none specified'}

WHOLE LIFE CONTEXT:
- Health goals: ${mission.healthGoals || 'none specified'}
- Personal goals: ${mission.personalGoals || 'none specified'}
- Meal strategy: ${mission.mealStrategy || 'none specified'}

YOUR RULES:
1. Break the total timeline into weeks. Each week gets a THEME (what's the focus) and a MILESTONE TARGET (what should be done by end of week).
2. For each week, generate 3-5 DAILY TASK TEMPLATES — these are the recurring daily tasks for that week. They should directly advance the milestone.
3. Sequence milestones logically — dependencies first, launches last. Don't put "onboard users" before "build the product."
4. Apply the 50% rule — only schedule 50% of stated available hours for focused work. The rest is buffer, context-switching, unexpected issues.
5. Front-load the hardest/riskiest work. Week 1-2 should tackle the scariest unknowns.
6. Include health cadence per week — when to work out, rest days, meal prep days. These are NON-NEGOTIABLE and should be woven into the plan, not bolted on.
7. If the user's milestones seem unrealistic for the timeline, say so in the week notes. Don't silently compress. Flag it.
8. Include 1 recovery/buffer week every 6 weeks (Shape Up cooldown principle). Mark it as "Buffer & Recovery."
9. Personal goals should have dedicated time blocks — content creation, personal errands, etc. Don't let business eat everything.

RESPOND WITH ONLY a JSON object wrapped in <roadmap> tags:

<roadmap>
{
  "weeks": [
    {
      "weekNumber": 1,
      "startDate": "YYYY-MM-DD",
      "endDate": "YYYY-MM-DD",
      "theme": "string — what this week is about",
      "milestoneTarget": "string — what should be DONE by end of this week, or null",
      "dailyTasks": [
        {"text": "string", "priority": "high|medium|low"}
      ],
      "healthCadence": "string — e.g. 'Gym M/W/F, CorePower T/Th, Rest Sun'",
      "notes": "string — any flags, warnings, or context for this week, or null"
    }
  ],
  "summary": "string — 2-3 sentence overview of the plan strategy",
  "warnings": ["string — any concerns about timeline, scope, or feasibility"]
}
</roadmap>`;
}

export async function POST(request: Request) {
  try {
    const userEmail = await getVerifiedEmail();
    if (!userEmail) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const user = await prisma.users.findFirst({
      where: { email: { equals: userEmail, mode: 'insensitive' } },
    });
    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) return NextResponse.json({ error: 'API key not configured' }, { status: 500 });

    const body = await request.json();
    const { missionId } = body;
    if (!missionId) return NextResponse.json({ error: 'missionId required' }, { status: 400 });

    const mission = await prisma.missions.findFirst({
      where: { id: missionId, userId: user.id },
    });
    if (!mission) return NextResponse.json({ error: 'Mission not found' }, { status: 404 });

    const client = new Anthropic({ apiKey });

    const msg = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 4000,
      temperature: 0.5,
      system: buildRoadmapPrompt(mission as unknown as Record<string, unknown>),
      messages: [{ role: 'user', content: 'Generate the week-by-week execution roadmap.' }],
    });

    const text = msg.content[0].type === 'text' ? msg.content[0].text : '';
    const match = text.match(/<roadmap>([\s\S]*?)<\/roadmap>/);
    if (!match) {
      return NextResponse.json({ error: 'Failed to parse roadmap from AI response' }, { status: 500 });
    }

    let roadmap;
    try {
      roadmap = JSON.parse(match[1]);
    } catch {
      return NextResponse.json({ error: 'Invalid roadmap JSON from AI' }, { status: 500 });
    }

    const updated = await prisma.missions.update({
      where: { id: missionId },
      data: { roadmap },
    });

    return NextResponse.json({ mission: updated });
  } catch (error) {
    console.error('[Roadmap Generation]', error);
    const msg = error instanceof Error ? error.message : 'Roadmap generation failed';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
