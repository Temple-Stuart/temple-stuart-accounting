import { requireTabAccess } from '@/lib/auth-helpers';
import { NextResponse } from 'next/server';
import { failClosedResponse } from '@/lib/http/failClosedResponse';
import { prisma } from '@/lib/prisma';
import { plaidClient } from '@/lib/plaid';
import { getVerifiedEmail } from '@/lib/cookie-auth';
import { summarizePlaidError } from '@/lib/plaid/summarizeError';
import { decryptToken } from '@/lib/secrets/tokenCipher';
import { RateLimitError, rateLimit } from '@/lib/rateLimit';
import { ownedItemOr404, rateLimitedEnvelope, reconcileItemHealth, reconnectEnvelope } from '@/lib/plaid/reconnect';

/**
 * POST /api/plaid/reconnect-complete { itemId }
 * BANK-01: after Plaid Link's onSuccess in UPDATE MODE. The item keeps its id
 * and its access token, so there is NO public-token exchange here — the only
 * question is whether the item is healthy now: /item/get with the stored token
 * (decrypted server-side, SEC-02). Healthy → last_error_* cleared, 200; still
 * erroring → recorded again, 409. Both answers are the HYG-01 envelope and name
 * the institution, never the Plaid item id or a token. User-scoped; a foreign
 * or unknown id is a 404. Rate-limited per user.
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

    try {
      await rateLimit(`plaid-reconnect:${user.id}`, { limit: 10, windowSeconds: 60 });
    } catch (limited) {
      if (limited instanceof RateLimitError) {
        const { status, body, retryAfterSeconds } = rateLimitedEnvelope('reconnect', limited);
        return NextResponse.json(body, { status, headers: { 'Retry-After': String(retryAfterSeconds) } });
      }
      throw limited;
    }

    const body = (await request.json().catch(() => ({}))) as { itemId?: unknown };
    const item = await ownedItemOr404(prisma, user.id, body.itemId);

    const got = await plaidClient.itemGet({ access_token: decryptToken(item.accessToken) });
    const health = await reconcileItemHealth(prisma, item, got.data.item);
    const { status, body: envelope } = reconnectEnvelope(item.institutionName, health);
    return NextResponse.json(envelope, { status });
  } catch (error: unknown) {
    console.error('Reconnect complete error:', summarizePlaidError(error));
    return failClosedResponse('api/plaid/reconnect-complete POST', 'Failed to confirm the reconnection', error);
  }
}
