import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getVerifiedEmail } from '@/lib/cookie-auth';
import { verifyCitation } from '@/lib/citations/verifyCitation';
import { writeAuditLog } from '@/lib/audit/writeAuditLog';

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

    const updatedStatus = statusMap[result.overall_status];

    await prisma.citations.update({
      where: { id },
      data: {
        status: updatedStatus,
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

    await writeAuditLog({
      actor: {
        email: userEmail,
        type: 'human_user',
      },
      action: {
        type: 'citation_verified',
        description: `Ran 8-step verification protocol on citation ${citation.citation_string}`,
      },
      target: {
        table: 'citations',
        id: citation.id,
      },
      payload: {
        before: {
          status: citation.status,
          last_verified_at: citation.last_verified_at,
        },
        after: {
          status: updatedStatus,
          last_verified_at: result.ran_at,
          checks: result.checks,
        },
        metadata: {
          overall_status: result.overall_status,
          notes: result.notes,
        },
      },
      request_id: request.headers.get('x-request-id') ?? undefined,
      user_agent: request.headers.get('user-agent') ?? undefined,
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error('[Citation Verify]', error);
    return NextResponse.json({ error: 'Verification failed' }, { status: 500 });
  }
}
