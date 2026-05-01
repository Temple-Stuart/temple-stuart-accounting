/**
 * src/inngest/functions/index.ts
 *
 * Barrel export of all Inngest functions for registration with the
 * route handler at src/app/api/inngest/route.ts.
 *
 * To add a new function:
 *   1. Create src/inngest/functions/your-function.ts
 *   2. Export it from this file
 *   3. The route handler picks it up automatically via the `functions` array
 */

import { healthCheck } from './health-check';
import { ecfrIngest } from './ecfr-ingest';
import { uscodeIngest } from './uscode-ingest';
import { fedregIngest } from './fedreg-ingest';
import { irbIngest } from './irb-ingest';

export const functions = [
  healthCheck,
  ecfrIngest,
  uscodeIngest,
  fedregIngest,
  irbIngest,
];

export { healthCheck, ecfrIngest, uscodeIngest, fedregIngest, irbIngest };
