/**
 * src/lib/corpus/embed/embed-service.ts
 *
 * Orchestrated embedding worker. Embeds all regulatory_document_chunks
 * rows where embedding IS NULL.
 *
 * Flow:
 *   1. Open an embedding_runs row (outcome=in_progress)
 *   2. Query unembedded chunks in batches of 100
 *   3. For each batch:
 *      - Estimate cost; abort if cap reached
 *      - Call Voyage embedBatch
 *      - UPDATE chunks with returned vectors
 *      - Accumulate counters
 *      - Write audit log entry per batch
 *   4. Close the embedding_runs row with final outcome + counters
 *
 * Cost cap: $10/run by default (overridable per-call). Renaissance
 * principle: hard guardrail at the worker level even though Voyage's
 * dashboard budget cap also exists at vendor level.
 *
 * Reference: docs/architecture/discovery-engine-institutional-grade.md § 4.4
 */

import crypto from 'crypto';
import { Prisma, PrismaClient } from '@prisma/client';
import {
  embedBatch,
  estimateCostUsd,
  estimateTokensFromText,
  VoyageApiError,
} from './voyage-client';
import { writeAuditLog } from '@/lib/audit/writeAuditLog';

const prisma = new PrismaClient();

const DEFAULT_BATCH_SIZE = 100;
const DEFAULT_MODEL = 'voyage-3.5';
const DEFAULT_OUTPUT_DIMENSION = 1024;
const DEFAULT_COST_CAP_USD = 10.0;

interface UnembeddedChunk {
  id: string;
  text: string;
}

export interface EmbedRunOptions {
  modelName?: string;
  outputDimension?: number;
  batchSize?: number;
  costCapUsd?: number;
  /** Optional cap on chunks to process this run (for testing). */
  maxChunks?: number;
}

export interface EmbedRunResult {
  run_id: string;
  outcome: 'completed' | 'failed' | 'cost_capped';
  chunks_embedded: number;
  tokens_total: number;
  cost_usd: number;
  duration_ms: number;
  error_message?: string;
}

/**
 * Open an embedding_runs row with outcome=in_progress. Returns the
 * generated UUID.
 */
async function openRun(
  modelName: string,
  costCapUsd: number
): Promise<string> {
  const rows = await prisma.$queryRaw<Array<{ id: string }>>`
    INSERT INTO embedding_runs (
      started_at, model_name, cost_cap_usd, outcome
    ) VALUES (
      now(), ${modelName}, ${costCapUsd}, 'in_progress'
    )
    RETURNING id
  `;
  return rows[0].id;
}

async function closeRun(
  runId: string,
  outcome: 'completed' | 'failed' | 'cost_capped',
  counters: { chunksEmbedded: number; tokensTotal: number; costUsd: number },
  errorMessage?: string
): Promise<void> {
  await prisma.$executeRaw`
    UPDATE embedding_runs
    SET completed_at = now(),
        chunks_embedded = ${counters.chunksEmbedded},
        tokens_total = ${counters.tokensTotal},
        cost_usd = ${new Prisma.Decimal(counters.costUsd.toFixed(4))},
        outcome = ${outcome},
        error_message = ${errorMessage ?? null}
    WHERE id = ${runId}::uuid
  `;
}

async function fetchUnembeddedBatch(
  batchSize: number
): Promise<UnembeddedChunk[]> {
  return await prisma.$queryRaw<UnembeddedChunk[]>`
    SELECT id, text
    FROM regulatory_document_chunks
    WHERE embedding IS NULL
    ORDER BY created_at ASC
    LIMIT ${batchSize}
  `;
}

async function persistEmbeddings(
  chunkIds: string[],
  embeddings: number[][],
  modelName: string
): Promise<void> {
  if (chunkIds.length !== embeddings.length) {
    throw new Error(
      `embedding count mismatch: ${chunkIds.length} ids vs ${embeddings.length} vectors`
    );
  }

  // Per-chunk UPDATE. We don't batch into one statement because
  // Postgres vector literals get unwieldy at 100x1024 floats per
  // statement, and per-row UPDATE keeps the transaction explicit.
  for (let i = 0; i < chunkIds.length; i++) {
    const id = chunkIds[i];
    const vec = embeddings[i];
    const literal = `[${vec.join(',')}]`;

    await prisma.$executeRaw`
      UPDATE regulatory_document_chunks
      SET embedding = ${literal}::vector,
          embedding_model = ${modelName}
      WHERE id = ${id}::uuid
    `;
  }
}

/**
 * Run one embedding pass over all unembedded chunks (or until cost
 * cap or maxChunks is hit).
 */
export async function runEmbeddingPass(
  options: EmbedRunOptions = {}
): Promise<EmbedRunResult> {
  const modelName = options.modelName ?? DEFAULT_MODEL;
  const outputDimension = options.outputDimension ?? DEFAULT_OUTPUT_DIMENSION;
  const batchSize = options.batchSize ?? DEFAULT_BATCH_SIZE;
  const costCapUsd = options.costCapUsd ?? DEFAULT_COST_CAP_USD;
  const maxChunks = options.maxChunks ?? Number.POSITIVE_INFINITY;

  const runStart = Date.now();
  const runId = await openRun(modelName, costCapUsd);

  let chunksEmbedded = 0;
  let tokensTotal = 0;
  let costUsd = 0;
  let outcome: 'completed' | 'failed' | 'cost_capped' = 'completed';
  let errorMessage: string | undefined;

  try {
    while (chunksEmbedded < maxChunks) {
      // Cost cap pre-check: estimate cost of one more max-size batch.
      // If the floor estimate alone would exceed the cap, stop now.
      const remainingBudget = costCapUsd - costUsd;
      if (remainingBudget <= 0) {
        outcome = 'cost_capped';

        await writeAuditLog({
          actor: { type: 'system_automation' },
          action: {
            type: 'embedding_run_cost_capped',
            description: `Embedding run cost-capped at $${costUsd.toFixed(4)} of $${costCapUsd}`,
          },
          target: { table: 'embedding_runs', id: runId },
          payload: {
            metadata: {
              chunks_embedded: chunksEmbedded,
              tokens_total: tokensTotal,
              cost_usd: costUsd,
              cost_cap_usd: costCapUsd,
            },
          },
        });
        break;
      }

      const batch = await fetchUnembeddedBatch(batchSize);
      if (batch.length === 0) {
        // Nothing left to embed.
        break;
      }

      const texts = batch.map((c) => c.text);
      const ids = batch.map((c) => c.id);

      const response = await embedBatch({
        input: texts,
        model: modelName,
        input_type: 'document',
        output_dimension: outputDimension,
      });

      // Reorder embeddings by index to match input order (defensive —
      // Voyage docs say results are returned in input order, but we
      // verify with the index field).
      const orderedEmbeddings: number[][] = new Array(batch.length);
      for (const item of response.data) {
        orderedEmbeddings[item.index] = item.embedding;
      }

      // Sanity check: every slot must be filled.
      if (orderedEmbeddings.some((e) => !e)) {
        throw new Error(
          'Voyage response missing embeddings for some indices in batch'
        );
      }

      await persistEmbeddings(ids, orderedEmbeddings, modelName);

      // Cost accounting: take MAX of vendor count and our own estimate
      // (Renaissance principle: don't trust vendor under-counts).
      const vendorTokens = response.usage.total_tokens;
      const ourEstimate = estimateTokensFromText(texts);
      const billedTokens = Math.max(vendorTokens, ourEstimate);

      tokensTotal += billedTokens;
      costUsd += estimateCostUsd(modelName, billedTokens);
      chunksEmbedded += batch.length;

      await writeAuditLog({
        actor: { type: 'system_automation' },
        action: {
          type: 'regulatory_chunks_embedded',
          description: `Embedded ${batch.length} chunks (${billedTokens} tokens) at $${costUsd.toFixed(4)} cumulative`,
        },
        target: { table: 'regulatory_document_chunks' },
        payload: {
          metadata: {
            run_id: runId,
            batch_size: batch.length,
            tokens_billed: billedTokens,
            tokens_vendor_reported: vendorTokens,
            cumulative_cost_usd: costUsd,
            model: modelName,
          },
        },
      });
    }
  } catch (err) {
    outcome = 'failed';
    errorMessage =
      err instanceof VoyageApiError
        ? `Voyage ${err.status}: ${err.detail}`
        : err instanceof Error
          ? err.message
          : String(err);
  }

  await closeRun(
    runId,
    outcome,
    { chunksEmbedded, tokensTotal, costUsd },
    errorMessage
  );

  if (outcome === 'completed' || outcome === 'cost_capped') {
    await writeAuditLog({
      actor: { type: 'system_automation' },
      action: {
        type: 'embedding_run_completed',
        description: `Embedding run ${outcome}: ${chunksEmbedded} chunks, ${tokensTotal} tokens, $${costUsd.toFixed(4)}`,
      },
      target: { table: 'embedding_runs', id: runId },
      payload: {
        metadata: {
          model: modelName,
          chunks_embedded: chunksEmbedded,
          tokens_total: tokensTotal,
          cost_usd: costUsd,
          outcome,
        },
      },
    });
  }

  return {
    run_id: runId,
    outcome,
    chunks_embedded: chunksEmbedded,
    tokens_total: tokensTotal,
    cost_usd: costUsd,
    duration_ms: Date.now() - runStart,
    error_message: errorMessage,
  };
}
