import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getVerifiedEmail } from '@/lib/cookie-auth';
import { requireTabAccess } from '@/lib/auth-helpers';
import { verifyCitation } from '@/lib/citations/verifyCitation';
import { writeAuditLog } from '@/lib/audit/writeAuditLog';
import { rateLimit, RateLimitError } from '@/lib/rateLimit';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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

    // COST/ABUSE GATE — verifyCitation() below makes outbound HTTP calls (HEAD+GET to the
    // citation's URLs) AND overwrites shared verification state on a GLOBAL citations row.
    // citations has no userId column (only relations to global regulatory_sources + self) →
    // there is no per-user ownership to scope by; it is a shared regulatory library. Auth
    // alone (above) left the external call unthrottled: any logged-in user could loop verify
    // across every citation. Per-USER rate limit (keyed on the authed email — tighter than
    // per-IP for an authed route), reusing the durable limiter the travel routes use
    // (flights/search:27), BEFORE the call. Over limit → 429 (mapped in catch). Fail-closed:
    // the guard throws before verifyCitation, so the external call never fires on reject.
    await rateLimit(`citation-verify:${userEmail}`, { limit: 10, windowSeconds: 60 });

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
    if (error instanceof RateLimitError) {
      return NextResponse.json(
        { error: 'Too many verification requests — please slow down and try again shortly.' },
        { status: 429, headers: { 'Retry-After': String(error.retryAfterSeconds) } }
      );
    }
    console.error('[Citation Verify]', error);
    return NextResponse.json({ error: 'Verification failed' }, { status: 500 });
  }
}
