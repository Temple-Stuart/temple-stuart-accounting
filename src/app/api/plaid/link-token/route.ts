import { requireTabAccess } from '@/lib/auth-helpers';
import { NextResponse } from 'next/server';
import { failClosedResponse } from '@/lib/http/failClosedResponse';
import { prisma } from '@/lib/prisma';
import { plaidClient } from '@/lib/plaid';
import { getVerifiedEmail } from '@/lib/cookie-auth';
import { summarizePlaidError } from '@/lib/plaid/summarizeError';
import { decryptToken } from '@/lib/secrets/tokenCipher';
import { RateLimitError, rateLimit } from '@/lib/rateLimit';
import { ownedItemOr404, rateLimitedEnvelope, updateModeLinkRequest } from '@/lib/plaid/reconnect';
// BANK-01c: the OAuth return URL on EVERY link token, read before any Plaid call —
// unset → a named throw, never a token without it.
import { CLIENT_NAME, newItemLinkRequest, plaidRedirectUri } from '@/lib/plaid/oauth';

/**
 * POST /api/plaid/link-token
 *   {}           → a link token for a NEW item (products, history), as before.
 *   { itemId }   → BANK-01: a link token in UPDATE MODE for the caller's own
 *                  existing item (plaid_items.id, user-scoped; a foreign or
 *                  unknown id is a 404). The stored access token is decrypted
 *                  server-side (SEC-02) and handed to Plaid only; the browser
 *                  receives the link token and nothing else. No products are
 *                  requested in update mode. Rate-limited per user.
 *   Both carry redirect_uri = PLAID_REDIRECT_URI (BANK-01c) — the OAuth return
 *   URL registered in the Plaid Dashboard; unset → a named 500, no token.
 */
export async function POST(request: Request) {
  try {
    const userEmail = await getVerifiedEmail();

    if (!userEmail) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const user = await prisma.users.findUnique({
      where: { email: userEmail }
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // TAB-SERVER-GATE: tab:books entitlement replaces the 'plaid' tier gate
    const tierGate = await requireTabAccess(user.id, 'tab:books');
    if (tierGate) return tierGate;

    // BANK-01: per-user burst defense before any paid call (the repo's durable limiter).
    try {
      await rateLimit(`plaid-link-token:${user.id}`, { limit: 10, windowSeconds: 60 });
    } catch (limited) {
      if (limited instanceof RateLimitError) {
        const { status, body, retryAfterSeconds } = rateLimitedEnvelope('link-token', limited);
        return NextResponse.json(body, { status, headers: { 'Retry-After': String(retryAfterSeconds) } });
      }
      throw limited;
    }

    // BANK-01c: the registered OAuth return URL — read BEFORE any Plaid call. Unset or
    // malformed → PlaidRedirectUriMissingError → the catch-all's 500 (the name in the
    // log); there is no link token without it.
    const redirectUri = plaidRedirectUri();

    const body = (await request.json().catch(() => ({}))) as { itemId?: unknown };

    if (body.itemId !== undefined) {
      const item = await ownedItemOr404(prisma, user.id, body.itemId);
      const createTokenResponse = await plaidClient.linkTokenCreate(
        updateModeLinkRequest({ userId: user.id, clientName: CLIENT_NAME, accessToken: decryptToken(item.accessToken), redirectUri }),
      );
      return NextResponse.json({
        link_token: createTokenResponse.data.link_token,
        expiration: createTokenResponse.data.expiration,
        mode: 'update',
      });
    }

    // The new-item token: Transactions + Investments, two years of history, the return URL.
    const createTokenResponse = await plaidClient.linkTokenCreate(
      newItemLinkRequest({ userId: user.id, clientName: CLIENT_NAME, redirectUri }),
    );

    return NextResponse.json({
      link_token: createTokenResponse.data.link_token,
      expiration: createTokenResponse.data.expiration
    });
  } catch (error: unknown) {
    console.error('Error creating link token:', summarizePlaidError(error));
    return failClosedResponse('api/plaid/link-token POST', 'Failed to create link token', error);
  }
}
