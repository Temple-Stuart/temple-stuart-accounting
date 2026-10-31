import axios from 'axios';
import { Configuration, PlaidApi, PlaidEnvironments } from 'plaid';
import { onWireError, onWireRequest, onWireResponse } from '@/lib/plaid/wire';

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

// REBUILD-01 PR-2: the SDK dispatches every call through THIS instance
// (plaid/dist/base.js:42, common.js:146-150). `arraybuffer` makes axios keep
// the response body as the exact bytes (axios/lib/adapters/http.js:260-263);
// the interceptors (src/lib/plaid/wire.ts) parse a copy for the SDK and stamp
// the bytes + asked / arrived on the response, so sync-complete can land the
// wire word for word. axios is pinned to the SDK's own version (plaid 11.0.0
// depends on axios 0.21.4 exactly).
const wireAxios = axios.create({ responseType: 'arraybuffer', transformResponse: [(data) => data] });
wireAxios.interceptors.request.use(onWireRequest);
wireAxios.interceptors.response.use((res) => onWireResponse(res), (err) => onWireError(err));

export const plaidClient = new PlaidApi(configuration, undefined, wireAxios);
export const PLAID_ENVIRONMENT = PLAID_ENV;
