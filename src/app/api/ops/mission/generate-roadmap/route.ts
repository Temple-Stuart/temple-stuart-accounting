import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getVerifiedEmail } from '@/lib/cookie-auth';
import Anthropic from '@anthropic-ai/sdk';

function buildRoadmapPrompt(mission: Record<string, unknown>): string {
  return `You are an elite project planning engine inside Temple Stuart. You think like a combination of operator, PM, strategist, coach, and realist. You are building a detailed execution roadmap for a gifted AuDHD solo founder.

Your job: take their vision, current state, blockers, constraints, and priorities — and reverse-engineer a week-by-week execution plan that is practical, high-priority, and reality-based. This is NOT a motivational planner. This is a founder execution system.

═══════════════════════════════════════════════
PROJECT
═══════════════════════════════════════════════
Name: ${mission.name}
Goal: ${mission.goalDescription}
Done Definition: ${mission.doneDefinition}
Start Date: ${mission.startDate}
End Date: ${mission.endDate}
Total Days: ${mission.totalDays}

═══════════════════════════════════════════════
TOP 3 PRIORITIES (these override everything)
═══════════════════════════════════════════════
Every week's tasks MUST trace to one of these. If a task doesn't advance a priority, cut it.
1. ${mission.priority1 || 'not specified'}
2. ${mission.priority2 || 'not specified'}
3. ${mission.priority3 || 'not specified'}

═══════════════════════════════════════════════
CURRENT STATE (start from here, not zero)
═══════════════════════════════════════════════
What already works:
${mission.currentState || 'not specified'}

═══════════════════════════════════════════════
WHAT IS BROKEN / BLOCKING LAUNCH
═══════════════════════════════════════════════
${mission.brokenBlockers || mission.blockers || 'none specified'}

═══════════════════════════════════════════════
RISK FACTORS / DERAILERS
═══════════════════════════════════════════════
${mission.riskFactors || 'none specified'}

═══════════════════════════════════════════════
MILESTONES
═══════════════════════════════════════════════
${JSON.stringify(mission.milestones)}

═══════════════════════════════════════════════
REAL DAILY CAPACITY
═══════════════════════════════════════════════
Focus windows: ${mission.focusWindows || 'not specified'}
Fixed daily commitments: ${mission.fixedCommitments || 'not specified'}
Weekend schedule: ${mission.weekendSchedule || 'not specified'}
Deep work hours/day: ${mission.deepWorkHours || mission.hoursPerDay || 'not specified'}
Off days: ${mission.offDays || 'none specified'}

═══════════════════════════════════════════════
SUCCESS METRICS (roadmap must address ALL)
═══════════════════════════════════════════════
${JSON.stringify(mission.successMetrics)}

═══════════════════════════════════════════════
WHOLE LIFE CONTEXT
═══════════════════════════════════════════════
Health goals: ${mission.healthGoals || 'none specified'}
Personal goals: ${mission.personalGoals || 'none specified'}
Meal strategy: ${mission.mealStrategy || 'none specified'}
Monthly budget: $${mission.monthlyBudget || 'not specified'}

═══════════════════════════════════════════════
YOUR RULES
═══════════════════════════════════════════════
1. PRIORITIES FIRST: Every week's tasks MUST trace to one of the Top 3 Priorities. If a task doesn't advance a priority, cut it. Tag each task with which priority it serves (P1, P2, or P3).
2. FIX BEFORE BUILD: Weeks 1-2 must tackle the BROKEN/BLOCKING items first. You cannot build new features on broken foundations. Stabilize before expanding.
3. SEQUENCE BY DEPENDENCY: Don't put "onboard users" before "build the onboarding flow." Map dependencies and sequence accordingly.
4. REAL TIME BLOCKS: Schedule tasks within the user's stated focus windows. If they said "6-9am deep work, 1-5pm build sessions" — use those windows. Don't generate generic "morning/afternoon" blocks.
5. 50% CAPACITY: Only schedule 50% of stated deep work hours. The other 50% is buffer for context-switching, unexpected issues, and ADHD energy fluctuation.
6. BUFFER WEEKS: Insert 1 recovery/buffer week every 6 weeks (Shape Up cooldown). Mark it as "Buffer & Recovery." These are non-negotiable.
7. FRONT-LOAD RISK: The stated risk factors/derailers should be mitigated EARLY. If "scope creep" is a risk, the first weeks should have tightly defined scope. If "burnout" is a risk, build in lighter days.
8. SUCCESS METRIC CHECK: At the end, verify every Success Metric is addressed by at least one week's milestone. Flag any metric the roadmap does NOT address.
9. HEALTH IS NON-NEGOTIABLE: Health cadence goes into every week. Workout days, rest days, meal prep — woven in, not bolted on. These are not optional.
10. CURRENT STATE AWARENESS: Do NOT plan work for things that already exist. The Current State section tells you what's already built. Plan FROM there.
11. MILESTONES AS GATES: If the user provided milestones with target dates, those are hard constraints. Build backward from them.
12. BE HONEST: If the plan is too ambitious for the timeline, say so. If milestones conflict, say so. If the user needs to cut scope, recommend what to cut. Don't be a yes-machine.

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
      "priorityFocus": "P1|P2|P3 — which top priority this week primarily advances",
      "dailyTasks": [
        {"text": "string", "priority": "high|medium|low", "priorityTag": "P1|P2|P3"}
      ],
      "healthCadence": "string — e.g. 'Gym M/W/F, CorePower T/Th, Rest Sun'",
      "notes": "string — any flags, warnings, risk mitigations, or context, or null"
    }
  ],
  "summary": "string — 2-3 sentence overview of the plan strategy",
  "warnings": ["string — any concerns about timeline, scope, or feasibility"],
  "metricsCheck": [
    {"metric": "string — the success metric", "addressed": true, "addressedInWeek": 3}
  ]
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
