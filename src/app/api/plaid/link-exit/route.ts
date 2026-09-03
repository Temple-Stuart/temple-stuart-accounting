import { requireTabAccess } from '@/lib/auth-helpers';
import { NextResponse } from 'next/server';
import { failClosedResponse } from '@/lib/http/failClosedResponse';
import { prisma } from '@/lib/prisma';
import { getVerifiedEmail } from '@/lib/cookie-auth';
import { ownedItemOr404 } from '@/lib/plaid/reconnect';
import { summarizeLinkExit } from '@/lib/plaid/linkExit';

/**
 * POST /api/plaid/link-exit { itemId?, error_code, error_type, error_message,
 *                            link_session_id?, request_id?, status? }
 * BANK-01b: Plaid Link's onExit error, as the browser saw it, written to the
 * server log so Vercel Logs carry the reason ("Something went wrong" has a
 * code and a request_id here). User-scoped: the caller must own `itemId`
 * when one is given (a foreign or unknown id is a 404), and the institution
 * comes from the owned row, not from the body. Only the named fields are
 * read (length-capped); no token is ever in this body, and none is logged.
 * No Plaid call, no paid call.
 */
export async function POST(request: Request) {
  try {
    const userEmail = await getVerifiedEmail();
    if (!userEmail) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const user = await prisma.users.findUnique({ where: { email: userEmail } });
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const tierGate = await requireTabAccess(user.id, 'tab:books');
    if (tierGate) return tierGate;

    const summary = summarizeLinkExit(await request.json().catch(() => null));
    const item = summary.itemId === null ? null : await ownedItemOr404(prisma, user.id, summary.itemId);

    console.log('[plaid/link-exit]', {
      userId: user.id,
      itemId: item?.id ?? null,
      institution: item?.institutionName ?? null,
      mode: item ? 'update' : 'new-item',
      error_type: summary.error_type,
      error_code: summary.error_code,
      error_message: summary.error_message,
      status: summary.status,
      link_session_id: summary.link_session_id,
      request_id: summary.request_id,
    });

    return NextResponse.json({ ok: true, stage: 'link-exit', message: 'Plaid Link exit logged' });
  } catch (error: unknown) {
    return failClosedResponse('api/plaid/link-exit POST', 'Failed to log the Plaid Link exit', error);
  }
}
