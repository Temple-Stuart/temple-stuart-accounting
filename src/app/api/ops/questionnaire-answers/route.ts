import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getVerifiedEmail } from '@/lib/cookie-auth';

async function getAuthUser() {
  const email = await getVerifiedEmail();
  if (!email) return null;
  return prisma.users.findFirst({ where: { email: { equals: email, mode: 'insensitive' } } });
}

export async function GET(request: NextRequest) {
  try {
    const user = await getAuthUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const missionId = searchParams.get('missionId');
    const moduleId = searchParams.get('moduleId');

    if (!missionId || !moduleId) {
      return NextResponse.json({ error: 'missionId and moduleId required' }, { status: 400 });
    }

    const mission = await prisma.missions.findFirst({ where: { id: missionId, userId: user.id } });
    if (!mission) return NextResponse.json({ error: 'Mission not found' }, { status: 404 });

    const rows = await prisma.ops_questionnaire_answers.findMany({
      where: { missionId, moduleId, userId: user.id },
      select: { questionId: true, answerValue: true },
    });

    const answers: Record<string, string> = {};
    for (const row of rows) {
      answers[row.questionId] = row.answerValue;
    }

    return NextResponse.json({ answers });
  } catch (error) {
    console.error('[QA GET]', error);
    return NextResponse.json({ error: 'Failed to load answers' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const user = await getAuthUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await request.json();
    const { missionId, moduleId, workstreamId, questionId, questionType, answerValue } = body;

    if (!missionId || !moduleId || !questionId) {
      return NextResponse.json({ error: 'missionId, moduleId, questionId required' }, { status: 400 });
    }

    const mission = await prisma.missions.findFirst({ where: { id: missionId, userId: user.id } });
    if (!mission) return NextResponse.json({ error: 'Mission not found' }, { status: 404 });

    const answer = await prisma.ops_questionnaire_answers.upsert({
      where: { missionId_moduleId_questionId: { missionId, moduleId, questionId } },
      create: {
        missionId,
        moduleId,
        workstreamId: workstreamId || '',
        questionId,
        questionType: questionType || 'text',
        answerValue: answerValue ?? '',
        userId: user.id,
      },
      update: { answerValue: answerValue ?? '' },
    });

    return NextResponse.json({ success: true, answer: { questionId: answer.questionId, answerValue: answer.answerValue } });
  } catch (error) {
    console.error('[QA PUT]', error);
    return NextResponse.json({ error: 'Failed to save answer' }, { status: 500 });
  }
}
