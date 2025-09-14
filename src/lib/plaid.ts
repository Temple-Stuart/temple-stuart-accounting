import { Configuration, PlaidApi, PlaidEnvironments } from 'plaid';

// Validate environment variables
if (!process.env.PLAID_CLIENT_ID || !process.env.PLAID_SECRET) {
  throw new Error('PLAID_CLIENT_ID and PLAID_SECRET must be set');
}

// Force production environment for real data
const PLAID_ENV = 'production';

console.log('Initializing Plaid client:', {
  environment: PLAID_ENV,
  clientId: process.env.PLAID_CLIENT_ID.substring(0, 10) + '...',
});

const configuration = new Configuration({
  basePath: PlaidEnvironments[PLAID_ENV],
  baseOptions: {
    headers: {
      'PLAID-CLIENT-ID': process.env.PLAID_CLIENT_ID,
      'PLAID-SECRET': process.env.PLAID_SECRET,
      'Plaid-Version': '2020-09-14', // Use stable API version
    },
  },
});

export const plaidClient = new PlaidApi(configuration);
export const PLAID_ENVIRONMENT = PLAID_ENV;
