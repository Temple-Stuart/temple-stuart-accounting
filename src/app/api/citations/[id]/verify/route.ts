import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getVerifiedEmail } from '@/lib/cookie-auth';
import { verifyCitation } from '@/lib/citations/verifyCitation';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const userEmail = await getVerifiedEmail();
    if (!userEmail) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { id } = await params;

    const citation = await prisma.citations.findUnique({ where: { id } });
    if (!citation) return NextResponse.json({ error: 'Citation not found' }, { status: 404 });

    const result = await verifyCitation(citation);

    const statusMap = {
      verified: 'verified',
      failed: 'unreachable',
      partial: 'pending_review',
    } as const;

    await prisma.citations.update({
      where: { id },
      data: {
        status: statusMap[result.overall_status],
        last_verified_at: result.ran_at,
        last_verified_by: userEmail,
        verification_notes: result.notes.join('\n'),
        existence_check: result.checks.existence,
        currency_check: result.checks.currency,
        groundedness_check: result.checks.groundedness,
        pinpoint_check: result.checks.pinpoint,
        supersession_check: result.checks.supersession,
        jurisdiction_match_check: result.checks.jurisdiction_match,
        source_authority_match_check: result.checks.source_authority_match,
        content_hash_check: result.checks.content_hash,
      },
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error('[Citation Verify]', error);
    return NextResponse.json({ error: 'Verification failed' }, { status: 500 });
  }
}
