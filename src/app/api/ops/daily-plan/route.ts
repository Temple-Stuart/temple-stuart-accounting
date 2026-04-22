import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getVerifiedEmail } from '@/lib/cookie-auth';

const SPRINT_START = new Date('2026-04-22');
const SPRINT_TOTAL_DAYS = 75;

function getDayNumber(date: Date): number {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const s = new Date(SPRINT_START.getFullYear(), SPRINT_START.getMonth(), SPRINT_START.getDate());
  const diff = Math.floor((d.getTime() - s.getTime()) / (1000 * 60 * 60 * 24));
  return diff + 1;
}

function isSprintDay(dayNumber: number): boolean {
  return dayNumber >= 1 && dayNumber <= SPRINT_TOTAL_DAYS;
}

interface Task {
  id: string;
  text: string;
  priority: 'high' | 'medium' | 'low';
  completed: boolean;
  order: number;
}

function calculateDayScore(plan: {
  tasks: unknown;
  workoutCompleted: boolean;
  hydrationActualOz: number | null;
  hydrationTargetOz: number | null;
  calorieActual: number | null;
  calorieTarget: number | null;
  sleepHours: number | null;
}): number {
  let score = 0;

  const tasks = (Array.isArray(plan.tasks) ? plan.tasks : []) as Task[];
  if (tasks.length > 0) {
    const completed = tasks.filter((t) => t.completed).length;
    score += (completed / tasks.length) * 40;
  }

  if (plan.workoutCompleted) score += 20;

  if (plan.hydrationActualOz && plan.hydrationTargetOz && plan.hydrationTargetOz > 0) {
    score += Math.min((plan.hydrationActualOz / plan.hydrationTargetOz) * 15, 15);
  }

  if (plan.calorieActual && plan.calorieTarget && plan.calorieTarget > 0) {
    const ratio = Math.abs(plan.calorieActual - plan.calorieTarget) / plan.calorieTarget;
    if (ratio <= 0.1) score += 15;
    else if (ratio <= 0.2) score += 10;
    else score += 5;
  }

  if (plan.sleepHours != null) {
    if (plan.sleepHours >= 7) score += 10;
    else if (plan.sleepHours >= 6) score += 7;
    else score += 3;
  }

  return Math.round(score * 10) / 10;
}

export async function GET(request: NextRequest) {
  try {
    const userEmail = await getVerifiedEmail();
    if (!userEmail) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const user = await prisma.users.findFirst({
      where: { email: { equals: userEmail, mode: 'insensitive' } },
    });
    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

    const { searchParams } = new URL(request.url);
    const dateStr = searchParams.get('date');
    if (!dateStr) return NextResponse.json({ error: 'date parameter required' }, { status: 400 });

    const date = new Date(dateStr + 'T00:00:00.000Z');
    const dayNumber = getDayNumber(date);

    const plan = await prisma.daily_plans.findUnique({
      where: { userId_date: { userId: user.id, date } },
    });

    // Get previous day's plan for trend data
    const prevDate = new Date(date);
    prevDate.setUTCDate(prevDate.getUTCDate() - 1);
    const prevPlan = await prisma.daily_plans.findUnique({
      where: { userId_date: { userId: user.id, date: prevDate } },
      select: { weightMorning: true, dayScore: true, tasks: true },
    });

    let prevTaskCompletion: number | null = null;
    if (prevPlan?.tasks) {
      const prevTasks = (Array.isArray(prevPlan.tasks) ? prevPlan.tasks : []) as unknown as Task[];
      if (prevTasks.length > 0) {
        prevTaskCompletion = prevTasks.filter((t) => t.completed).length / prevTasks.length;
      }
    }

    return NextResponse.json({
      plan,
      dayNumber,
      isSprintDay: isSprintDay(dayNumber),
      previousDay: prevPlan
        ? {
            weight: prevPlan.weightMorning,
            dayScore: prevPlan.dayScore,
            taskCompletion: prevTaskCompletion,
          }
        : null,
    });
  } catch (error) {
    console.error('Daily plan GET error:', error);
    const msg = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const userEmail = await getVerifiedEmail();
    if (!userEmail) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const user = await prisma.users.findFirst({
      where: { email: { equals: userEmail, mode: 'insensitive' } },
    });
    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

    const body = await request.json();
    const { date: dateStr, ...fields } = body;

    if (!dateStr) return NextResponse.json({ error: 'date field required' }, { status: 400 });

    const date = new Date(dateStr + 'T00:00:00.000Z');
    const dayNumber = getDayNumber(date);

    const dataToSave: Record<string, unknown> = {};
    const allowedFields = [
      'mission', 'missionCompleted', 'tasks', 'schedule',
      'budgetTarget', 'budgetActual', 'weightMorning',
      'workoutPlanned', 'workoutCompleted', 'workoutType', 'workoutDuration', 'workoutNotes',
      'hydrationTargetOz', 'hydrationActualOz',
      'calorieTarget', 'calorieActual', 'proteinTargetG', 'proteinActualG', 'meals',
      'sleepHours', 'sleepQuality', 'steps',
      'reflection', 'wins', 'blockers',
    ];

    for (const key of allowedFields) {
      if (key in fields) {
        dataToSave[key] = fields[key];
      }
    }

    // Auto-calculate day score
    const mergedForScore = {
      tasks: (dataToSave.tasks ?? fields.tasks ?? []) as unknown,
      workoutCompleted: (dataToSave.workoutCompleted ?? false) as boolean,
      hydrationActualOz: (dataToSave.hydrationActualOz ?? null) as number | null,
      hydrationTargetOz: (dataToSave.hydrationTargetOz ?? null) as number | null,
      calorieActual: (dataToSave.calorieActual ?? null) as number | null,
      calorieTarget: (dataToSave.calorieTarget ?? null) as number | null,
      sleepHours: (dataToSave.sleepHours ?? null) as number | null,
    };
    dataToSave.dayScore = calculateDayScore(mergedForScore);

    const plan = await prisma.daily_plans.upsert({
      where: { userId_date: { userId: user.id, date } },
      create: {
        userId: user.id,
        date,
        dayNumber,
        sprintStartDate: SPRINT_START,
        sprintTotalDays: SPRINT_TOTAL_DAYS,
        ...dataToSave,
      },
      update: {
        dayNumber,
        ...dataToSave,
      },
    });

    return NextResponse.json({ plan });
  } catch (error) {
    console.error('Daily plan POST error:', error);
    const msg = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
