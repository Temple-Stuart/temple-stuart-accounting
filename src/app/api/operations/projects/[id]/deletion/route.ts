/**
 * /api/operations/projects/[id]/deletion
 *
 * GET — the delete PREVIEW (TASKS-01): may this project be hard-deleted, and
 *       what would go? User-scoped; 404 when the project is not the caller's.
 *       Reads the same leaf the DELETE re-runs inside its transaction
 *       (src/lib/operations/projectDeletion.ts), so the dialog the client shows
 *       is the decision the delete makes. Read-only: no audit, no write.
 */

import { NextRequest, NextResponse } from 'next/server';
import { failClosedResponse } from '@/lib/http/failClosedResponse';
import { prisma } from '@/lib/prisma';
import { getVerifiedEmail } from '@/lib/cookie-auth';
import { describeBlockers, projectDeletionCheck, removalSummary } from '@/lib/operations/projectDeletion';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const userEmail = await getVerifiedEmail();
    if (!userEmail) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const user = await prisma.users.findFirst({
      where: { email: { equals: userEmail, mode: 'insensitive' } },
    });
    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

    const { id } = await params;
    const preview = await projectDeletionCheck(prisma, id, user.id);
    if (!preview) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    return NextResponse.json({
      ...preview,
      deletable: preview.blockers.length === 0,
      message: preview.blockers.length > 0 ? describeBlockers(preview) : null,
      summary: removalSummary(preview),
    });
  } catch (error) {
    return failClosedResponse('Project deletion preview', 'Failed to check the project', error);
  }
}
