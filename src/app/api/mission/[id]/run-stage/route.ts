import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getMissionUser, getMissionWithOwnerCheck } from '@/lib/mission/auth';
import Anthropic from '@anthropic-ai/sdk';
import {
  STRUCTURE_MODEL,
  STRUCTURE_SYSTEM_PROMPT,
  buildStructurePrompt,
  parseStructureResponse,
  GOAL_DISCOVERY_MODEL,
  GOAL_DISCOVERY_SYSTEM_PROMPT,
  buildGoalDiscoveryPrompt,
  parseGoalDiscoveryResponse,
  type BrainDumpItem,
  type StructureOutput,
} from '@/lib/mission/prompts';
import { TRIGGER_QUESTION_GROUPS } from '@/lib/mission/trigger-questions';

const STAGE_ORDER: Record<string, number> = {
  structure: 1,
  goal_discovery: 2,
  research_scoping: 3,
  reality_audit: 4,
  roadmap: 5,
};

function inferTriggerGroupId(triggerQuestion: string | null): string | null {
  if (!triggerQuestion) return null;
  for (const group of TRIGGER_QUESTION_GROUPS) {
    if (group.questions.some((q) => q.text === triggerQuestion)) return group.id;
  }
  return null;
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getMissionUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { id } = await params;
    const mission = await getMissionWithOwnerCheck(id, user.id);
    if (!mission) return NextResponse.json({ error: 'Mission not found' }, { status: 404 });

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) return NextResponse.json({ error: 'API key not configured' }, { status: 500 });

    const { stageType } = await request.json();
    if (!stageType || !STAGE_ORDER[stageType]) {
      return NextResponse.json({ error: 'Invalid stageType' }, { status: 400 });
    }

    // Validate prerequisites
    const approvedStages = await prisma.mission_stages.findMany({
      where: { missionId: id, status: 'approved' },
      select: { stageType: true, parsedOutput: true },
    });
    const approvedTypes = new Set(approvedStages.map((s) => s.stageType));

    if (stageType === 'structure') {
      const entryCount = await prisma.brain_dump_entries.count({ where: { missionId: id } });
      if (entryCount === 0) {
        return NextResponse.json({ error: 'Brain dump entries required before running structure stage' }, { status: 400 });
      }
    } else if (stageType === 'goal_discovery') {
      if (!approvedTypes.has('structure')) {
        return NextResponse.json({ error: 'Structure stage must be approved first' }, { status: 400 });
      }
    } else if (stageType === 'reality_audit') {
      if (!approvedTypes.has('goal_discovery')) {
        return NextResponse.json({ error: 'Goal discovery must be approved first' }, { status: 400 });
      }
      if (!mission.confirmedGoal) {
        return NextResponse.json({ error: 'Goal must be confirmed before reality audit' }, { status: 400 });
      }
    } else if (stageType === 'roadmap') {
      if (!approvedTypes.has('reality_audit')) {
        return NextResponse.json({ error: 'Reality audit must be approved first' }, { status: 400 });
      }
    }

    // Check if stage is implemented
    if (stageType === 'reality_audit' || stageType === 'roadmap' || stageType === 'research_scoping') {
      return NextResponse.json({ error: `${stageType} stage is not yet implemented` }, { status: 400 });
    }

    // Build input + prompts
    let systemPrompt: string;
    let userPrompt: string;
    let model: string;
    let inputSnapshot: unknown;
    let parseFn: (raw: string) => unknown;

    if (stageType === 'structure') {
      const entries = await prisma.brain_dump_entries.findMany({
        where: { missionId: id },
        orderBy: { rawOrder: 'asc' },
      });
      const brainDumpItems: BrainDumpItem[] = entries.map((e) => ({
        id: e.id,
        content: e.content,
        source: e.source as 'typed' | 'voice',
        triggerQuestion: e.triggerQuestion,
        triggerGroupId: inferTriggerGroupId(e.triggerQuestion),
      }));
      const input = {
        brainDumpEntries: brainDumpItems,
        missionTitle: mission.name,
        missionDuration: mission.durationDays ?? mission.totalDays,
      };
      systemPrompt = STRUCTURE_SYSTEM_PROMPT;
      userPrompt = buildStructurePrompt(input);
      model = STRUCTURE_MODEL;
      inputSnapshot = input;
      parseFn = parseStructureResponse;
    } else {
      // goal_discovery
      const structureStage = approvedStages.find((s) => s.stageType === 'structure');
      const input = {
        structuredOutput: structureStage!.parsedOutput as unknown as StructureOutput,
        missionTitle: mission.name,
        missionDuration: mission.durationDays ?? mission.totalDays,
      };
      systemPrompt = GOAL_DISCOVERY_SYSTEM_PROMPT;
      userPrompt = buildGoalDiscoveryPrompt(input);
      model = GOAL_DISCOVERY_MODEL;
      inputSnapshot = input;
      parseFn = parseGoalDiscoveryResponse;
    }

    // Determine attempt number
    const prevAttempts = await prisma.mission_stages.count({
      where: { missionId: id, stageType: stageType as 'structure' | 'goal_discovery' },
    });

    // Create stage row
    const stage = await prisma.mission_stages.create({
      data: {
        missionId: id,
        stageType: stageType as 'structure' | 'goal_discovery',
        stageOrder: STAGE_ORDER[stageType],
        status: 'processing',
        inputSnapshot: inputSnapshot as object,
        systemPrompt,
        userPrompt,
        model,
        attemptNumber: prevAttempts + 1,
      },
    });

    // Call Claude
    const client = new Anthropic({ apiKey });
    const response = await client.messages.create({
      model,
      max_tokens: 4096,
      system: systemPrompt,
      messages: [{ role: 'user', content: userPrompt }],
    });

    const rawText = response.content
      .filter((b): b is Anthropic.TextBlock => b.type === 'text')
      .map((b) => b.text)
      .join('');

    // Parse
    let parsedOutput: unknown = null;
    let parseError: string | null = null;
    try {
      parsedOutput = parseFn(rawText);
    } catch (err) {
      parseError = err instanceof Error ? err.message : 'Parse failed';
    }

    // Update stage
    await prisma.mission_stages.update({
      where: { id: stage.id },
      data: {
        status: 'completed',
        rawResponse: rawText,
        parsedOutput: parsedOutput as object | undefined,
      },
    });

    if (parseError) {
      return NextResponse.json({
        stageId: stage.id,
        status: 'completed',
        parseError,
        rawResponse: rawText.substring(0, 500),
      }, { status: 200 });
    }

    return NextResponse.json({ stageId: stage.id, status: 'completed', parsedOutput });
  } catch (error) {
    console.error('[Run Stage]', error);
    const msg = error instanceof Error ? error.message : 'Stage execution failed';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
