import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getVerifiedEmail } from '@/lib/cookie-auth';
import { requireTabAccess } from '@/lib/auth-helpers';

export async function GET(request: NextRequest) {
  try {
    const userEmail = await getVerifiedEmail();
    if (!userEmail) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    // TAB-SERVER-GATE: tab:compliance entitlement (bundle:all included; admin
    // bypass inside). This shared regulatory library had auth-only access; use
    // now requires the Compliance tab.
    const gateUser = await prisma.users.findFirst({
      where: { email: { equals: userEmail, mode: 'insensitive' } },
      select: { id: true },
    });
    if (!gateUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }
    const tabGate = await requireTabAccess(gateUser.id, 'tab:compliance');
    if (tabGate) return tabGate;

    const { searchParams } = new URL(request.url);
    const tier = searchParams.get('tier');
    const moduleRelevance = searchParams.get('module');
    const jurisdiction = searchParams.get('jurisdiction');

    const where: Record<string, unknown> = { is_active: true };
    if (tier) where.source_tier = tier;
    if (moduleRelevance) where.module_relevance = { has: moduleRelevance };
    if (jurisdiction) where.jurisdictions = { has: jurisdiction };

    const sources = await prisma.regulatory_sources.findMany({
      where,
      orderBy: [
        { authority_rank: 'asc' },
        { source_name: 'asc' },
      ],
    });

    return NextResponse.json({ count: sources.length, sources });
  } catch (error) {
    console.error('[Regulatory Sources]', error);
    return NextResponse.json({ error: 'Failed to load sources' }, { status: 500 });
  }
}
