import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getVerifiedEmail } from '@/lib/cookie-auth';

export async function GET() {
  try {
    const userEmail = await getVerifiedEmail();
    if (!userEmail) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const user = await prisma.users.findFirst({
      where: { email: { equals: userEmail, mode: 'insensitive' } },
    });
    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

    const mission = await prisma.missions.findFirst({
      where: { userId: user.id, status: 'active' },
    });

    return NextResponse.json({ mission });
  } catch (error) {
    console.error('Mission GET error:', error);
    const msg = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const userEmail = await getVerifiedEmail();
    if (!userEmail) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const user = await prisma.users.findFirst({
      where: { email: { equals: userEmail, mode: 'insensitive' } },
    });
    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

    const body = await request.json();
    const { name, goalDescription, doneDefinition, startDate, endDate, ...rest } = body;

    if (!name || !goalDescription || !doneDefinition || !startDate || !endDate) {
      return NextResponse.json({ error: 'name, goalDescription, doneDefinition, startDate, endDate required' }, { status: 400 });
    }

    const start = new Date(startDate + 'T00:00:00.000Z');
    const end = new Date(endDate + 'T00:00:00.000Z');
    const totalDays = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;

    const data = {
      name,
      goalDescription,
      doneDefinition,
      startDate: start,
      endDate: end,
      totalDays,
      milestones: rest.milestones ?? [],
      hoursPerDay: rest.hoursPerDay ?? null,
      offDays: rest.offDays ?? null,
      monthlyBudget: rest.monthlyBudget ?? null,
      blockers: rest.blockers ?? null,
      healthGoals: rest.healthGoals ?? null,
      personalGoals: rest.personalGoals ?? null,
      mealStrategy: rest.mealStrategy ?? null,
    };

    const existing = await prisma.missions.findFirst({
      where: { userId: user.id, status: 'active' },
    });

    let mission;
    if (existing) {
      mission = await prisma.missions.update({
        where: { id: existing.id },
        data,
      });
    } else {
      mission = await prisma.missions.create({
        data: { userId: user.id, ...data },
      });
    }

    return NextResponse.json({ mission });
  } catch (error) {
    console.error('Mission POST error:', error);
    const msg = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
