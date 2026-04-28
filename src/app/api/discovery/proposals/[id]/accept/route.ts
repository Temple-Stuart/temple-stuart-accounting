import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getVerifiedEmail } from '@/lib/cookie-auth';
import { materializeProposal } from '@/lib/discovery/materializeProposal';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const userEmail = await getVerifiedEmail();
    if (!userEmail) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const user = await prisma.users.findFirst({ where: { email: { equals: userEmail, mode: 'insensitive' } } });
    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

    const proposal = await prisma.discovery_proposals.findUnique({
      where: { id },
      include: { discovery_run: true },
    });

    if (!proposal || proposal.discovery_run.user_id !== user.id) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    if (proposal.status !== 'proposed') {
      return NextResponse.json(
        { error: `Proposal cannot be accepted — current status is "${proposal.status}"` },
        { status: 400 },
      );
    }

    const body = await request.json().catch(() => ({}));
    const { modifications } = body as { modifications?: Record<string, unknown> };

    const result = await materializeProposal(id, userEmail, user.id, modifications);

    return NextResponse.json(result);
  } catch (error) {
    console.error('[Discovery Proposal Accept POST]', error);
    return NextResponse.json({ error: 'Failed to accept proposal' }, { status: 500 });
  }
}
