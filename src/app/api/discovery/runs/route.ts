import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getVerifiedEmail } from '@/lib/cookie-auth';
import { runDiscovery } from '@/lib/discovery/runDiscovery';

export async function GET(_request: NextRequest) {
  try {
    const userEmail = await getVerifiedEmail();
    if (!userEmail) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const user = await prisma.users.findFirst({ where: { email: { equals: userEmail, mode: 'insensitive' } } });
    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

    const runs = await prisma.discovery_runs.findMany({
      where: { user_id: user.id },
      orderBy: { started_at: 'desc' },
      take: 50,
      include: {
        _count: {
          select: { proposals: true },
        },
      },
    });

    return NextResponse.json({ runs });
  } catch (error) {
    console.error('[Discovery Runs GET]', error);
    return NextResponse.json({ error: 'Failed to load discovery runs' }, { status: 500 });
  }
}

export async function POST(_request: NextRequest) {
  try {
    const userEmail = await getVerifiedEmail();
    if (!userEmail) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const user = await prisma.users.findFirst({ where: { email: { equals: userEmail, mode: 'insensitive' } } });
    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

    // Load user's profile
    const profile = await prisma.user_profiles.findUnique({ where: { user_id: user.id } });
    if (!profile) {
      return NextResponse.json(
        { error: 'User profile not found. Please create a profile before running discovery.' },
        { status: 404 },
      );
    }

    // Check no run is currently in progress
    const terminalStatuses = ['completed', 'failed', 'cancelled'] as const;
    const inProgressRun = await prisma.discovery_runs.findFirst({
      where: {
        user_id: user.id,
        status: { notIn: [...terminalStatuses] },
      },
    });

    if (inProgressRun) {
      return NextResponse.json(
        { error: 'A discovery run is already in progress', runId: inProgressRun.id },
        { status: 409 },
      );
    }

    const result = await runDiscovery({ userId: user.id, userEmail, profile });

    return NextResponse.json({ discoveryRunId: result.discoveryRunId }, { status: 201 });
  } catch (error) {
    console.error('[Discovery Runs POST]', error);
    return NextResponse.json({ error: 'Failed to start discovery run' }, { status: 500 });
  }
}
