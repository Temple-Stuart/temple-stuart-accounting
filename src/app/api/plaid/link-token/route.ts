import { requireTabAccess } from '@/lib/auth-helpers';
import { NextResponse } from 'next/server';
import { failClosedResponse } from '@/lib/http/failClosedResponse';
import { prisma } from '@/lib/prisma';
import { plaidClient } from '@/lib/plaid';
import { Products, CountryCode } from 'plaid';
import { getVerifiedEmail } from '@/lib/cookie-auth';
import { summarizePlaidError } from '@/lib/plaid/summarizeError';
import { decryptToken } from '@/lib/secrets/tokenCipher';
import { RateLimitError, rateLimit } from '@/lib/rateLimit';
import { ownedItemOr404, rateLimitedEnvelope, updateModeLinkRequest } from '@/lib/plaid/reconnect';

const CLIENT_NAME = 'Temple Stuart, LLC';

/**
 * POST /api/plaid/link-token
 *   {}           → a link token for a NEW item (products, history), as before.
 *   { itemId }   → BANK-01: a link token in UPDATE MODE for the caller's own
 *                  existing item (plaid_items.id, user-scoped; a foreign or
 *                  unknown id is a 404). The stored access token is decrypted
 *                  server-side (SEC-02) and handed to Plaid only; the browser
 *                  receives the link token and nothing else. No products are
 *                  requested in update mode. Rate-limited per user.
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

    const body = (await request.json().catch(() => ({}))) as { itemId?: unknown };

    if (body.itemId !== undefined) {
      const item = await ownedItemOr404(prisma, user.id, body.itemId);
      const createTokenResponse = await plaidClient.linkTokenCreate(
        updateModeLinkRequest({ userId: user.id, clientName: CLIENT_NAME, accessToken: decryptToken(item.accessToken) }),
      );
      return NextResponse.json({
        link_token: createTokenResponse.data.link_token,
        expiration: createTokenResponse.data.expiration,
        mode: 'update',
      });
    }

    const configs = {
      user: {
        client_user_id: user.id,
      },
      client_name: CLIENT_NAME,
      products: [Products.Transactions, Products.Investments],
      country_codes: [CountryCode.Us],
      language: 'en',
      transactions: {
        days_requested: 730  // Request 2 years of history
      }
    };

    const createTokenResponse = await plaidClient.linkTokenCreate(configs);
    
    return NextResponse.json({ 
      link_token: createTokenResponse.data.link_token,
      expiration: createTokenResponse.data.expiration 
    });
  } catch (error: unknown) {
    console.error('Error creating link token:', summarizePlaidError(error));
    return failClosedResponse('api/plaid/link-token POST', 'Failed to create link token', error);
  }
}
