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

/**
 * Vercel maxDuration: 800 seconds (13.3 min) — Pro plan ceiling.
 *
 * Required because the Voyage embedding worker
 * (src/inngest/functions/embed-pending.ts) processes hundreds of
 * batches in a single step.run, and the default Vercel timeout
 * (10s) was killing it with FUNCTION_INVOCATION_TIMEOUT after
 * partial completion.
 *
 * Stopgap. Proper fix is to refactor embed-pending.ts to use
 * per-batch step.run so each invocation is bounded to ~5 sec.
 * Tracked separately.
 */
export const maxDuration = 800;

/**
 * Inngest webhook endpoint. Auth is signature-based via
 * INNGEST_SIGNING_KEY, NOT cookie-based. /api/inngest is in
 * middleware PUBLIC_PATHS to bypass the auth gate; serve() validates
 * Inngest's signature on every inbound webhook before invoking any
 * registered function. The signing key is wired explicitly on the
 * Inngest client in src/inngest/client.ts (ServeHandlerOptions does
 * not accept signingKey in the current SDK version; the client
 * constructor does).
 */
export const { GET, POST, PUT } = serve({
  client: inngest,
  functions,
});
