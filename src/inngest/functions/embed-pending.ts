/**
 * src/inngest/functions/embed-pending.ts
 *
 * Cron-triggered Voyage embedding worker. Runs every 6 hours at
 * minute 5 (offset from source ingestion crons that fire at minute 0).
 *
 * Embeds all regulatory_document_chunks rows where embedding IS NULL,
 * subject to a $10/run cost cap. Each run is recorded in
 * embedding_runs with full audit trail in audit_log.
 *
 * Cron cadence rationale:
 *   - 6 hours = 4 runs/day, fast enough that newly ingested chunks
 *     become semantically searchable within hours of arrival
 *   - Minute :05 = no contention with source ingestion crons (eCFR
 *     :00, FR :00, USC :00, IRB :00). Source ingestion completes,
 *     embedding picks up newly inserted chunks.
 *
 * Reference: docs/architecture/discovery-engine-institutional-grade.md § 4.1
 */

import { inngest } from '../client';
import { runEmbeddingPass } from '@/lib/corpus/embed';

export const embedPending = inngest.createFunction(
  {
    id: 'embed-pending-chunks',
    name: 'Voyage embedding worker',
    triggers: [{ cron: '5 */6 * * *' }],
    concurrency: { limit: 1 },
  },
  async ({ step }) => {
    // step.run memoization: if Inngest retries this function, the
    // pass result is cached. The pass itself is idempotent at the
    // chunk-level (queries for embedding IS NULL), so even if
    // step.run cache is dropped, re-running only embeds what's left.
    const result = await step.run('embed-pending-pass', async () => {
      return await runEmbeddingPass({
        // Default to architecture-doc model + 1024 dim from PR-F HNSW
        // Default $10 cost cap defined in embed-service
      });
    });

    return result;
  }
);
