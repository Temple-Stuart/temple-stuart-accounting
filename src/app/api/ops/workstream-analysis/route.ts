import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getVerifiedEmail } from '@/lib/cookie-auth';
import Anthropic from '@anthropic-ai/sdk';
import { BOOKKEEPING_OPS_MODULE } from '@/lib/ops/bookkeepingQuestions';
import { createHash } from 'crypto';

const MODEL = 'claude-sonnet-4-20250514';
const PROMPT_VERSION = 'v1.0';

async function getAuthUser() {
  const email = await getVerifiedEmail();
  if (!email) return null;
  return prisma.users.findFirst({ where: { email: { equals: email, mode: 'insensitive' } } });
}

function computeHash(answers: Record<string, string>): string {
  const sorted = JSON.stringify(answers, Object.keys(answers).sort());
  return createHash('sha256').update(sorted).digest('hex').slice(0, 16);
}

const SYSTEM_PROMPT = `You are a regulatory compliance analyst at an institutional-grade financial firm. You are reviewing a founder's compliance decisions for launching a bookkeeping and tax preparation SaaS platform.

Your analysis must meet the standard expected by Ray Dalio's Bridgewater, Ken Griffin's Citadel, or Jim Simons's Renaissance Technologies. This means:
- Every decision is assessed with a clear status
- Every risk is quantified with specific statute citations and penalty ranges
- Every required action has a concrete deadline
- No vague recommendations. No motivational language. No "consider" or "you might want to." Direct, specific, actionable.

You will receive a set of compliance questions with the founder's answers. For each question, assess the status and produce a decision register entry.

RESPONSE FORMAT — respond with ONLY valid JSON, no markdown, no preamble:

{
  "workstreamId": "string",
  "workstreamTitle": "string",
  "assessedAt": "ISO timestamp",
  "decisions": [
    {
      "questionId": "string",
      "questionText": "string",
      "answer": "string or null if unanswered",
      "status": "decided | undecided | blocked | at_risk | not_applicable",
      "statusReason": "1-2 sentence explanation",
      "regulatoryExposure": {
        "statute": "specific statute, e.g. IRC §6695(d)",
        "penaltyRange": "e.g. $50/failure up to $25,000/return period or N/A",
        "enforcementLikelihood": "high | medium | low | N/A",
        "notes": "relevant enforcement context"
      },
      "requiredAction": {
        "action": "specific action or null if decided and compliant",
        "deadline": "e.g. Before first paying user, or null",
        "effort": "hours | days | weeks | months",
        "blockedBy": ["questionIds this depends on, or empty"]
      }
    }
  ],
  "workstreamSummary": {
    "totalQuestions": 0,
    "decided": 0,
    "undecided": 0,
    "blocked": 0,
    "atRisk": 0,
    "notApplicable": 0,
    "totalExposure": "sum or range of penalty exposures",
    "criticalActions": ["top 3 most urgent actions"],
    "crossWorkstreamDependencies": [
      { "dependsOnWorkstream": "e.g. bk-b", "reason": "why" }
    ]
  }
}`;

function buildUserPrompt(
  workstream: { id: string; letter: string; title: string; description: string; questions: Array<{ id: string; text: string; type: string; regulatoryTag: string; launchStage: string; helpText?: string; sourceSection?: string; dependsOn?: string[]; options?: string[] }> },
  answers: Record<string, string>,
): string {
  const lines = [`Workstream: ${workstream.letter} — ${workstream.title}`, `Description: ${workstream.description}`, '', 'Questions and Answers:', ''];

  for (let i = 0; i < workstream.questions.length; i++) {
    const q = workstream.questions[i];
    const answer = answers[q.id];
    lines.push(`Q${i + 1} [${q.id}] [${q.regulatoryTag}] [${q.launchStage}]`);
    lines.push(`Question: ${q.text}`);
    if (q.helpText) lines.push(`Regulatory Context: ${q.helpText}`);
    if (q.sourceSection) lines.push(`Source: ${q.sourceSection}`);
    lines.push(`Answer: ${answer || 'UNANSWERED'}`);
    lines.push(`Dependencies: ${q.dependsOn?.join(', ') || 'None'}`);
    lines.push('');
  }

  return lines.join('\n');
}

export async function POST(request: NextRequest) {
  try {
    const user = await getAuthUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) return NextResponse.json({ error: 'API key not configured' }, { status: 500 });

    const { missionId, moduleId, workstreamId } = await request.json();
    if (!missionId || !moduleId || !workstreamId) {
      return NextResponse.json({ error: 'missionId, moduleId, workstreamId required' }, { status: 400 });
    }

    const mission = await prisma.missions.findFirst({ where: { id: missionId, userId: user.id } });
    if (!mission) return NextResponse.json({ error: 'Mission not found' }, { status: 404 });

    const workstream = BOOKKEEPING_OPS_MODULE.workstreams.find((ws) => ws.id === workstreamId);
    if (!workstream) return NextResponse.json({ error: 'Workstream not found' }, { status: 404 });

    const answerRows = await prisma.ops_questionnaire_answers.findMany({
      where: { missionId, moduleId, userId: user.id, workstreamId },
      select: { questionId: true, answerValue: true },
    });
    const answers: Record<string, string> = {};
    for (const row of answerRows) answers[row.questionId] = row.answerValue;

    const inputHash = computeHash(answers);
    const userPrompt = buildUserPrompt(workstream, answers);

    const client = new Anthropic({ apiKey });
    const response = await client.messages.create({
      model: MODEL,
      max_tokens: 4096,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: userPrompt }],
    });

    const rawText = response.content
      .filter((b): b is Anthropic.TextBlock => b.type === 'text')
      .map((b) => b.text)
      .join('');

    let parsed;
    try {
      const cleaned = rawText.trim().replace(/^```json\s*/, '').replace(/\s*```$/, '');
      parsed = JSON.parse(cleaned);
    } catch {
      return NextResponse.json({ error: 'Failed to parse AI response', raw: rawText.substring(0, 500) }, { status: 500 });
    }

    await prisma.ops_workstream_analysis.upsert({
      where: { missionId_moduleId_workstreamId: { missionId, moduleId, workstreamId } },
      create: { missionId, moduleId, workstreamId, userId: user.id, analysisOutput: JSON.stringify(parsed), modelUsed: MODEL, promptVersion: PROMPT_VERSION, inputHash },
      update: { analysisOutput: JSON.stringify(parsed), modelUsed: MODEL, inputHash },
    });

    return NextResponse.json({ analysis: parsed, inputHash });
  } catch (error) {
    console.error('[Workstream Analysis POST]', error);
    return NextResponse.json({ error: 'Analysis failed' }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  try {
    const user = await getAuthUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const missionId = searchParams.get('missionId');
    const moduleId = searchParams.get('moduleId');
    const workstreamId = searchParams.get('workstreamId');

    if (!missionId || !moduleId || !workstreamId) {
      return NextResponse.json({ error: 'missionId, moduleId, workstreamId required' }, { status: 400 });
    }

    const row = await prisma.ops_workstream_analysis.findFirst({
      where: { missionId, moduleId, workstreamId, userId: user.id },
    });

    if (!row) return NextResponse.json({ analysis: null, isStale: false });

    const answerRows = await prisma.ops_questionnaire_answers.findMany({
      where: { missionId, moduleId, userId: user.id, workstreamId },
      select: { questionId: true, answerValue: true },
    });
    const currentAnswers: Record<string, string> = {};
    for (const r of answerRows) currentAnswers[r.questionId] = r.answerValue;
    const currentHash = computeHash(currentAnswers);

    return NextResponse.json({
      analysis: JSON.parse(row.analysisOutput),
      inputHash: row.inputHash,
      isStale: currentHash !== row.inputHash,
      analyzedAt: row.updatedAt,
    });
  } catch (error) {
    console.error('[Workstream Analysis GET]', error);
    return NextResponse.json({ error: 'Failed to load analysis' }, { status: 500 });
  }
}
