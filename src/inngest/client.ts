/**
 * src/inngest/client.ts
 *
 * Singleton Inngest client for the temple-stuart-accounting application.
 *
 * Reference: docs/architecture/discovery-engine-institutional-grade.md § 4.1
 *
 * The Inngest client is the entry point for sending events and registering
 * functions. All Inngest functions in src/inngest/functions/ must be created
 * via inngest.createFunction(...) using this client.
 *
 * In local development, the Inngest Dev Server (http://localhost:8288) auto-
 * discovers functions registered through this client by polling the
 * /api/inngest route handler. In production, the Inngest Cloud platform
 * connects to the same route via webhooks.
 *
 * Environment variables (set in .env.local for dev, Vercel for prod):
 *   INNGEST_EVENT_KEY    — production event signing key (Vercel only)
 *   INNGEST_SIGNING_KEY  — production webhook signing key (Vercel only)
 *
 * In dev, neither variable is required — the Dev Server uses local-only
 * signing.
 */

import { Inngest } from 'inngest';

export const inngest = new Inngest({
  id: 'temple-stuart-accounting',
  name: 'Temple Stuart Accounting',
});
