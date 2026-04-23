import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getMissionUser, getMissionWithOwnerCheck } from '@/lib/mission/auth';

interface GoalCandidate {
  rank: number;
  goalStatement: string;
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getMissionUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { id } = await params;
    const mission = await getMissionWithOwnerCheck(id, user.id);
    if (!mission) return NextResponse.json({ error: 'Mission not found' }, { status: 404 });

    const { goalRank, editedGoalStatement } = await request.json();
    if (!goalRank) return NextResponse.json({ error: 'goalRank required' }, { status: 400 });

    const goalStage = await prisma.mission_stages.findFirst({
      where: { missionId: id, stageType: 'goal_discovery', status: 'approved' },
      orderBy: { attemptNumber: 'desc' },
    });
    if (!goalStage || !goalStage.parsedOutput) {
      return NextResponse.json({ error: 'No approved goal discovery stage found' }, { status: 400 });
    }

    const output = goalStage.parsedOutput as { candidateGoals?: GoalCandidate[] };
    const selected = output.candidateGoals?.find((g) => g.rank === goalRank);
    if (!selected) {
      return NextResponse.json({ error: `No goal found with rank ${goalRank}` }, { status: 400 });
    }

    const confirmedGoal = editedGoalStatement || selected.goalStatement;

    await prisma.missions.update({
      where: { id },
      data: { confirmedGoal },
    });

    return NextResponse.json({ confirmedGoal });
  } catch (error) {
    console.error('[Confirm Goal]', error);
    return NextResponse.json({ error: 'Failed to confirm goal' }, { status: 500 });
  }
}
