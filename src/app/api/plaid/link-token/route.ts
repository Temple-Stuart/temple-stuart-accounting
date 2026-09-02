import { requireTabAccess } from '@/lib/auth-helpers';
import { NextResponse } from 'next/server';
import { failClosedResponse } from '@/lib/http/failClosedResponse';
import { prisma } from '@/lib/prisma';
import { plaidClient } from '@/lib/plaid';
import { Products, CountryCode } from 'plaid';
import { getVerifiedEmail } from '@/lib/cookie-auth';
import { summarizePlaidError } from '@/lib/plaid/summarizeError';

export async function POST() {
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

    const configs = {
      user: {
        client_user_id: user.id,
      },
      client_name: 'Temple Stuart, LLC',
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
  } catch (error: any) {
    console.error('Error creating link token:', summarizePlaidError(error));
    return failClosedResponse('api/plaid/link-token POST', 'Failed to create link token', error);
  }
}
