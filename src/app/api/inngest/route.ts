/**
 * src/app/api/inngest/route.ts
 *
 * Inngest serve handler for the Next.js App Router.
 *
 * Local dev:  Inngest Dev Server polls this endpoint to discover and
 *             execute functions. Run the Dev Server via `npm run dev:inngest`.
 *             The Dev Server UI is at http://localhost:8288.
 *
 * Production: Inngest Cloud delivers webhook events to this endpoint.
 *             Authentication is via the INNGEST_SIGNING_KEY env var
 *             (set in Vercel environment configuration).
 *
 * Reference: docs/architecture/discovery-engine-institutional-grade.md § 4.1
 */

import { serve } from 'inngest/next';
import { inngest } from '@/inngest/client';
import { functions } from '@/inngest/functions';

export const { GET, POST, PUT } = serve({
  client: inngest,
  functions,
});
