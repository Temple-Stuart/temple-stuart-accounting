import { Configuration, PlaidApi, PlaidEnvironments, Products, CountryCode } from 'plaid';
import { plaidClient } from '@/lib/plaid';
import { verifyAuth } from '@/lib/auth';

export async function POST(request: NextRequest) {
  try {
    const userId = await verifyAuth(request);
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const configs = {
      user: {
        client_user_id: userId,
      },
      client_name: 'Temple Stuart Accounting',
      products: ['transactions', 'investments'],
      country_codes: [CountryCode.Us],
      language: 'en',
      // removed redirect_uri - it's optional and was causing the HTTPS error
    };

    console.log('Creating link token with config:', {
      ...configs,
      environment: 'production'
    });

    const createTokenResponse = await plaidClient.linkTokenCreate(configs);
    
    return NextResponse.json({ 
      link_token: createTokenResponse.data.link_token,
      environment: 'production',
      expiration: createTokenResponse.data.expiration 
    });
    
  } catch (error: any) {
    console.error('Link token error:', {
      message: error.response?.data?.error_message || error.message,
      code: error.response?.data?.error_code,
      type: error.response?.data?.error_type,
    });
    
    return NextResponse.json(
      { 
        error: 'Failed to create link token',
        details: error.response?.data?.error_message || error.message,
        code: error.response?.data?.error_code 
      },
      { status: 500 }
    );
  }
}
