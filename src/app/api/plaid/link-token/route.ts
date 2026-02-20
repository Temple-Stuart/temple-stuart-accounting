import { requireTier, getCurrentUser} from '@/lib/auth-helpers';
import { NextResponse } from 'next/server';
import { plaidClient } from '@/lib/plaid';
import { Products, CountryCode } from 'plaid';

export async function POST() {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const tierGate = requireTier(user.tier, 'plaid');
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
    console.error('Error creating link token:', error);
    return NextResponse.json(
      { error: 'Failed to create link token', details: error.message },
      { status: 500 }
    );
  }
}
