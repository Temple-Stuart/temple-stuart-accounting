import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getVerifiedEmail } from '@/lib/cookie-auth';
import Anthropic from '@anthropic-ai/sdk';

function buildPrompt(bullets: string[]): string {
  const numbered = bullets.map((b, i) => `${i + 1}. ${b}`).join('\n');
  return `You are an organization engine inside Temple Stuart. A neurodivergent founder just dumped everything in their head as unstructured bullet points. Your job is to categorize these scattered thoughts into structured planning categories.

THE RAW BRAIN DUMP:
${numbered}

CATEGORIZE INTO THESE BUCKETS. For each bucket, write 1-3 concise sentences synthesizing what the user said. If nothing fits a bucket, set it to null. Do NOT invent information — only organize what was given.

RESPOND WITH ONLY a JSON object wrapped in <structured> tags:

<structured>
{
  "missionStatement": "string — one punchy sentence capturing the overall mission",
  "projectName": "string — suggested project name, short",
  "goals": "string — what they want to achieve, synthesized",
  "doneDefinition": "string — what DONE looks like based on their bullets",
  "priority1": "string — highest leverage outcome, or null",
  "priority2": "string — second highest, or null",
  "priority3": "string — third highest, or null",
  "currentState": "string — what already exists/works, or null",
  "deliverables": ["string — concrete milestone items extracted"],
  "brokenBlockers": "string — broken things, dependencies, obstacles, or null",
  "riskFactors": "string — burnout risks, distractions, derailers, or null",
  "healthGoals": "string — health, fitness, wellness mentions, or null",
  "personalGoals": "string — personal life, relationships, content, or null",
  "mealStrategy": "string — food, diet, nutrition mentions, or null",
  "unknowns": ["string — things needing answers or decisions"],
  "timelineHints": "string — any dates, deadlines, durations mentioned, or null",
  "budgetHints": "string — any dollar amounts or budget mentions, or null"
}
</structured>`;
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
    const { bullets } = body;

    if (!bullets || !Array.isArray(bullets) || bullets.length === 0) {
      return NextResponse.json({ error: 'bullets array required' }, { status: 400 });
    }

    const client = new Anthropic({ apiKey });

    const msg = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 2000,
      temperature: 0.4,
      system: buildPrompt(bullets),
      messages: [{ role: 'user', content: 'Organize my brain dump into structured categories.' }],
    });

    const text = msg.content[0].type === 'text' ? msg.content[0].text : '';
    const match = text.match(/<structured>([\s\S]*?)<\/structured>/);
    if (!match) {
      return NextResponse.json({ error: 'Failed to parse structured output' }, { status: 500 });
    }

    let structured;
    try {
      structured = JSON.parse(match[1]);
    } catch {
      return NextResponse.json({ error: 'Invalid JSON from AI' }, { status: 500 });
    }

    return NextResponse.json({ structured });
  } catch (error) {
    console.error('[Brain Dump]', error);
    const msg = error instanceof Error ? error.message : 'Brain dump processing failed';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
