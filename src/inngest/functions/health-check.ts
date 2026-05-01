/**
 * src/inngest/functions/health-check.ts
 *
 * Minimal Inngest function that proves the infrastructure wiring works.
 *
 * Trigger: emit { name: 'inngest/health.check' } via inngest.send().
 * Result: sleeps 1 second (exercises step.sleep), then returns a
 * timestamp + the run ID.
 *
 * This function exists primarily to validate end-to-end Inngest wiring
 * in dev and after each Vercel deploy. It is NOT business logic.
 *
 * Reference: docs/architecture/discovery-engine-institutional-grade.md § 4.1
 */

import { inngest } from '../client';

export const healthCheck = inngest.createFunction(
  {
    id: 'inngest-health-check',
    name: 'Inngest health check',
  },
  { event: 'inngest/health.check' },
  async ({ event, step }) => {
    const startedAt = new Date().toISOString();

    await step.sleep('one-second-pause', '1s');

    const completedAt = new Date().toISOString();

    return {
      ok: true,
      run_id: event.id ?? 'unknown',
      started_at: startedAt,
      completed_at: completedAt,
      message: 'Inngest infrastructure healthy.',
    };
  }
);
