/**
 * src/inngest/functions/fedreg-ingest.ts
 *
 * Hourly Federal Register ingestion worker. Cron fires every hour
 * at minute 0.
 *
 * Flow:
 *   step 1: discover-since-date — find latest stored FR
 *           publication_date; if none, default to 90 days ago
 *           (Bridgewater institutional 90-day review window).
 *   step 2: paginate /documents.json since that date, processing
 *           each page in its own step.run for memoization. Within
 *           a page, each document is its own step.run keyed by
 *           document_number — retries don't re-fetch.
 *   step 3: write-run-summary — audit log entry.
 *
 * Volume estimate:
 *   - First run on empty DB: 90 days × ~300 docs/day ≈ 27,000 docs.
 *     At pLimit(2) and ~3 sec/doc end-to-end → ~11 hours one-time
 *     backfill. Inngest's automatic resumption handles the long run.
 *   - Subsequent hourly runs: 0-30 docs typically.
 *
 * Reference: docs/architecture/discovery-engine-institutional-grade.md § 4.1
 */

import { PrismaClient } from '@prisma/client';
import { inngest } from '../client';
import {
  fetchDocumentList,
  fetchDocumentDetail,
  fetchDocumentRawText,
  parseFedregDocument,
  persistFedregDocument,
} from '@/lib/corpus/ingest';
import { writeAuditLog } from '@/lib/audit/writeAuditLog';

const prisma = new PrismaClient();

const FIRST_RUN_BACKFILL_DAYS = 90;
const MAX_PAGES_PER_RUN = 50; // safety cap; 100 docs/page × 50 = 5000 docs/run

interface DocumentOutcome {
  document_number: string;
  outcome: 'inserted' | 'unchanged' | 'failed' | 'skipped';
  reason?: string;
}

async function latestStoredPublicationDate(): Promise<Date | null> {
  const rows = await prisma.$queryRaw<Array<{ max: Date | null }>>`
    SELECT MAX(d.published_date) AS max
    FROM regulatory_documents d
    JOIN regulatory_sources s ON d.source_id = s.id
    WHERE s.domain = 'federalregister.gov'
      AND d.superseded_by IS NULL
  `;
  return rows[0]?.max ?? null;
}

export const fedregIngest = inngest.createFunction(
  {
    id: 'fedreg-ingest-hourly',
    name: 'Federal Register hourly ingestion',
    triggers: [{ cron: '0 * * * *' }],
    concurrency: { limit: 1 },
  },
  async ({ step }) => {
    const startedAt = new Date().toISOString();

    // STEP 1: determine since-date
    const sinceDate = await step.run('discover-since-date', async () => {
      const latest = await latestStoredPublicationDate();
      if (latest) {
        // Subtract one day to handle late-arriving documents that
        // backfill into a date we've already processed.
        const adjusted = new Date(latest);
        adjusted.setUTCDate(adjusted.getUTCDate() - 1);
        return adjusted.toISOString().slice(0, 10);
      }
      const backfill = new Date();
      backfill.setUTCDate(backfill.getUTCDate() - FIRST_RUN_BACKFILL_DAYS);
      return backfill.toISOString().slice(0, 10);
    });

    const outcomes: DocumentOutcome[] = [];
    let totalInserted = 0;
    let totalUnchanged = 0;
    let totalFailed = 0;
    let pagesProcessed = 0;

    // STEP 2: paginate and ingest
    for (let page = 1; page <= MAX_PAGES_PER_RUN; page++) {
      const pageResult = await step.run(`page-${page}`, async () => {
        return await fetchDocumentList(sinceDate, page, 100);
      });

      pagesProcessed++;

      for (const entry of pageResult.results) {
        const docOutcome = await step.run(
          `doc-${entry.document_number}`,
          async (): Promise<DocumentOutcome> => {
            try {
              const detail = await fetchDocumentDetail(entry.document_number);

              if (!detail.raw_text_url) {
                return {
                  document_number: entry.document_number,
                  outcome: 'skipped',
                  reason: 'no raw_text_url',
                };
              }

              const rawText = await fetchDocumentRawText(detail.raw_text_url);
              const parsed = parseFedregDocument(detail, rawText);

              if (!parsed) {
                return {
                  document_number: entry.document_number,
                  outcome: 'skipped',
                  reason: 'parse returned null',
                };
              }

              const result = await persistFedregDocument(parsed, detail, rawText);

              return {
                document_number: entry.document_number,
                outcome: result.documents_inserted > 0 ? 'inserted' : 'unchanged',
              };
            } catch (err) {
              return {
                document_number: entry.document_number,
                outcome: 'failed',
                reason: err instanceof Error ? err.message : String(err),
              };
            }
          }
        );

        outcomes.push(docOutcome);
        if (docOutcome.outcome === 'inserted') totalInserted++;
        else if (docOutcome.outcome === 'unchanged') totalUnchanged++;
        else if (docOutcome.outcome === 'failed') totalFailed++;
      }

      // Stop when we've reached the last page.
      if (!pageResult.next_page_url) break;
    }

    // STEP 3: write run summary
    const completedAt = new Date().toISOString();
    const summary = {
      started_at: startedAt,
      completed_at: completedAt,
      since_date: sinceDate,
      pages_processed: pagesProcessed,
      documents_total: outcomes.length,
      documents_inserted: totalInserted,
      documents_unchanged: totalUnchanged,
      documents_failed: totalFailed,
      documents_skipped: outcomes.filter((o) => o.outcome === 'skipped').length,
      // Don't include the full per-document list in audit_log payload —
      // it can be 5000+ entries on first run. Just the failures, which
      // are the operationally interesting ones.
      failures: outcomes
        .filter((o) => o.outcome === 'failed')
        .map((o) => ({ document_number: o.document_number, reason: o.reason })),
    };

    await step.run('write-run-summary', async () => {
      await writeAuditLog({
        actor: { type: 'system_automation' },
        action: {
          type: 'regulatory_ingest_run_completed',
          description: `FR ingest run: ${totalInserted} inserted, ${totalUnchanged} unchanged, ${totalFailed} failed (since ${sinceDate})`,
        },
        target: { table: 'regulatory_documents' },
        payload: {
          metadata: { run_summary: summary, source: 'federalregister.gov' },
        },
      });
    });

    return summary;
  }
);
