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

function computeSynthesisHash(analyses: Array<{ workstreamId: string; updatedAt: Date }>): string {
  const data = analyses.map((a) => `${a.workstreamId}:${a.updatedAt.toISOString()}`).sort().join('|');
  return createHash('sha256').update(data).digest('hex').slice(0, 16);
}

const SYSTEM_PROMPT = `You are a Chief Compliance Officer at an institutional-grade financial firm preparing a launch readiness assessment for a bookkeeping and tax preparation SaaS platform. Your audience is the founder, their legal counsel, and potential institutional investors.

You will receive decision register outputs from multiple compliance workstreams. Each contains per-question status assessments, regulatory exposure quantification, and required actions. Your job is to synthesize these into a unified launch readiness assessment.

RESPONSE FORMAT — respond with ONLY valid JSON, no markdown, no preamble:

{
  "synthesisId": "ISO timestamp",
  "moduleId": "string",
  "moduleName": "string",
  "workstreamsCovered": ["workstream IDs"],
  "workstreamsNotAnalyzed": ["workstream IDs with no analysis"],
  "launchReadiness": {
    "canLaunch": false,
    "blockers": [
      {
        "questionId": "string",
        "workstreamId": "string",
        "reason": "specific reason this blocks launch",
        "statute": "governing statute",
        "penaltyIfIgnored": "specific penalty range",
        "resolution": "what must be done",
        "estimatedEffort": "hours | days | weeks | months"
      }
    ],
    "conditionalItems": [
      {
        "questionId": "string",
        "condition": "what condition makes this a blocker vs not",
        "currentAnswer": "the user's answer"
      }
    ]
  },
  "totalRegulatoryExposure": {
    "totalMinPenalty": "dollar amount",
    "totalMaxPenalty": "dollar amount",
    "breakdownByStatute": [
      { "statute": "string", "exposure": "range", "affectedQuestions": ["ids"], "status": "resolved | unresolved" }
    ],
    "breakdownByWorkstream": [
      { "workstreamId": "string", "workstreamTitle": "string", "exposure": "range", "unresolvedCount": 0 }
    ]
  },
  "criticalPath": {
    "launchDate": "estimated or Cannot estimate",
    "longestPole": {
      "item": "string", "reason": "string", "estimatedDuration": "string", "questionId": "string"
    },
    "sequencedActions": [
      { "order": 1, "questionId": "string", "action": "string", "deadline": "string", "effort": "string", "blocksQuestions": ["ids"], "workstreamId": "string" }
    ]
  },
  "contradictions": [
    { "questionId1": "string", "answer1": "string", "questionId2": "string", "answer2": "string", "contradiction": "string", "resolution": "string" }
  ],
  "crossWorkstreamDependencies": [
    { "fromWorkstream": "string", "toWorkstream": "string", "dependency": "string", "impact": "string" }
  ],
  "executiveSummary": "3-5 sentence summary"
}`;

export async function POST(request: NextRequest) {
  try {
    const user = await getAuthUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) return NextResponse.json({ error: 'API key not configured' }, { status: 500 });

    const { missionId, moduleId } = await request.json();
    if (!missionId || !moduleId) return NextResponse.json({ error: 'missionId and moduleId required' }, { status: 400 });

    const mission = await prisma.missions.findFirst({ where: { id: missionId, userId: user.id } });
    if (!mission) return NextResponse.json({ error: 'Mission not found' }, { status: 404 });

    const analyses = await prisma.ops_workstream_analysis.findMany({
      where: { missionId, moduleId, userId: user.id },
      orderBy: { workstreamId: 'asc' },
    });

    if (analyses.length < 2) {
      return NextResponse.json({ error: 'At least 2 workstream analyses required before synthesis. Analyze more workstreams first.' }, { status: 400 });
    }

    const allWsIds = BOOKKEEPING_OPS_MODULE.workstreams.map((ws) => ws.id);
    const analyzedIds = analyses.map((a) => a.workstreamId);
    const notAnalyzed = allWsIds.filter((id) => !analyzedIds.includes(id));

    const inputHash = computeSynthesisHash(analyses.map((a) => ({ workstreamId: a.workstreamId, updatedAt: a.updatedAt })));

    const wsBlocks = analyses.map((a) => {
      const ws = BOOKKEEPING_OPS_MODULE.workstreams.find((w) => w.id === a.workstreamId);
      return `=== WORKSTREAM ${ws?.letter || '?'}: ${ws?.title || a.workstreamId} ===\n${a.analysisOutput}`;
    }).join('\n\n');

    const userPrompt = `Module: ${BOOKKEEPING_OPS_MODULE.title}
Mission: ${mission.name}
Total workstreams analyzed: ${analyses.length} of ${allWsIds.length}

Below are the decision register outputs from each analyzed workstream.

${wsBlocks}

WORKSTREAMS NOT YET ANALYZED:
${notAnalyzed.length > 0 ? notAnalyzed.map((id) => {
  const ws = BOOKKEEPING_OPS_MODULE.workstreams.find((w) => w.id === id);
  return `- ${ws?.letter || '?'}: ${ws?.title || id}`;
}).join('\n') : '(all workstreams analyzed)'}`;

    const client = new Anthropic({ apiKey });
    const response = await client.messages.create({
      model: MODEL,
      max_tokens: 8192,
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

    await prisma.ops_synthesis_report.upsert({
      where: { missionId_moduleId: { missionId, moduleId } },
      create: {
        missionId, moduleId, userId: user.id,
        synthesisOutput: JSON.stringify(parsed),
        modelUsed: MODEL, promptVersion: PROMPT_VERSION,
        inputHash, workstreamsCovered: JSON.stringify(analyzedIds),
      },
      update: {
        synthesisOutput: JSON.stringify(parsed),
        modelUsed: MODEL, inputHash,
        workstreamsCovered: JSON.stringify(analyzedIds),
      },
    });

    return NextResponse.json({ synthesis: parsed, inputHash, workstreamsCovered: analyzedIds });
  } catch (error) {
    console.error('[Synthesis POST]', error);
    return NextResponse.json({ error: 'Synthesis failed' }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  try {
    const user = await getAuthUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const missionId = searchParams.get('missionId');
    const moduleId = searchParams.get('moduleId');
    if (!missionId || !moduleId) return NextResponse.json({ error: 'missionId and moduleId required' }, { status: 400 });

    const row = await prisma.ops_synthesis_report.findFirst({
      where: { missionId, moduleId, userId: user.id },
    });

    if (!row) return NextResponse.json({ synthesis: null, isStale: false });

    const analyses = await prisma.ops_workstream_analysis.findMany({
      where: { missionId, moduleId, userId: user.id },
      select: { workstreamId: true, updatedAt: true },
    });
    const currentHash = computeSynthesisHash(analyses.map((a) => ({ workstreamId: a.workstreamId, updatedAt: a.updatedAt })));

    return NextResponse.json({
      synthesis: JSON.parse(row.synthesisOutput),
      isStale: currentHash !== row.inputHash,
      workstreamsCovered: JSON.parse(row.workstreamsCovered),
      synthesizedAt: row.updatedAt,
    });
  } catch (error) {
    console.error('[Synthesis GET]', error);
    return NextResponse.json({ error: 'Failed to load synthesis' }, { status: 500 });
  }
}
