/**
 * src/inngest/functions/irb-ingest.ts
 *
 * Daily Internal Revenue Bulletin ingestion worker. Cron fires at
 * 02:00 UTC.
 *
 * IRB publishes weekly (Monday morning ET, ~13:00 UTC). Daily
 * polling at 02:00 UTC means new issues appear in our corpus
 * within ~36 hours of publication. Most cron runs are no-ops
 * (Tuesday-Sunday) at essentially zero cost.
 *
 * Flow:
 *   step 1: discover-issues — fetch /irb index, filter to issues
 *           we haven't ingested or whose HEAD Last-Modified is
 *           newer than our stored published_date.
 *   step 2: per-issue loop — for each candidate issue, fetch HTML,
 *           parse into ParsedDocument[], persist all.
 *   step 3: write-run-summary — audit log entry.
 *
 * Backfill (first run on empty DB): fetches all issues from the
 * past 3 years (current + 2 prior tax years) per institutional
 * tax-research convention.
 *
 * Reference: docs/architecture/discovery-engine-institutional-grade.md § 4.1
 */

import { PrismaClient } from '@prisma/client';
import { inngest } from '../client';
import {
  fetchIrbIndex,
  fetchIssueHtml,
  parseIrbIssue,
  persistIrbDocuments,
} from '@/lib/corpus/ingest';
import type { IrbIndexEntry } from '@/lib/corpus/ingest';
import { writeAuditLog } from '@/lib/audit/writeAuditLog';

const prisma = new PrismaClient();

const BACKFILL_YEARS = 3;

interface IssueOutcome {
  issue_id: string;
  outcome: 'ingested' | 'unchanged' | 'failed' | 'skipped';
  documents_inserted: number;
  chunks_inserted: number;
  reason?: string;
}

async function alreadyIngestedIssueIds(): Promise<Set<string>> {
  const rows = await prisma.$queryRaw<Array<{ irb_issue_id: string }>>`
    SELECT DISTINCT (d.metadata->>'irb_issue_id') AS irb_issue_id
    FROM regulatory_documents d
    JOIN regulatory_sources s ON d.source_id = s.id
    WHERE s.domain = 'irs.gov'
      AND d.metadata->>'irb_issue_id' IS NOT NULL
      AND d.superseded_by IS NULL
  `;
  return new Set(rows.map((r) => r.irb_issue_id).filter(Boolean));
}

export const irbIngest = inngest.createFunction(
  {
    id: 'irb-ingest-daily',
    name: 'IRS Internal Revenue Bulletin daily ingestion',
    triggers: [{ cron: '0 2 * * *' }],
    concurrency: { limit: 1 },
  },
  async ({ step }) => {
    const startedAt = new Date().toISOString();

    // STEP 1: discover candidate issues
    const candidates = await step.run('discover-issues', async () => {
      const allIssues = await fetchIrbIndex();
      const ingestedIds = await alreadyIngestedIssueIds();

      // Backfill window: filter to issues from the past N years
      const currentYear = new Date().getUTCFullYear();
      const earliestYear = currentYear - BACKFILL_YEARS;

      return allIssues.filter((issue) => {
        if (issue.year < earliestYear) return false;
        // Re-ingestion of already-stored issues is currently a no-op
        // (content_hash will match). We still include them in the
        // candidate list for completeness — persist will short-circuit.
        // Skip them here to save bandwidth.
        if (ingestedIds.has(issue.issue_id)) return false;
        return true;
      });
    });

    const outcomes: IssueOutcome[] = [];

    // STEP 2: per-issue loop
    for (const issue of candidates as IrbIndexEntry[]) {
      const outcome = await step.run(
        `issue-${issue.issue_id}`,
        async (): Promise<IssueOutcome> => {
          try {
            const html = await fetchIssueHtml(issue.html_url);
            const documents = parseIrbIssue(
              html,
              issue.issue_id,
              issue.publication_date ??
                new Date(`${issue.year}-01-01`).toISOString().slice(0, 10)
            );

            if (documents.length === 0) {
              return {
                issue_id: issue.issue_id,
                outcome: 'skipped',
                documents_inserted: 0,
                chunks_inserted: 0,
                reason: 'parser produced zero documents',
              };
            }

            const result = await persistIrbDocuments(
              documents,
              issue.issue_id,
              issue.html_url,
              html
            );

            return {
              issue_id: issue.issue_id,
              outcome: result.documents_inserted > 0 ? 'ingested' : 'unchanged',
              documents_inserted: result.documents_inserted,
              chunks_inserted: result.chunks_inserted,
            };
          } catch (err) {
            return {
              issue_id: issue.issue_id,
              outcome: 'failed',
              documents_inserted: 0,
              chunks_inserted: 0,
              reason: err instanceof Error ? err.message : String(err),
            };
          }
        }
      );

      outcomes.push(outcome);
    }

    // STEP 3: run summary
    const completedAt = new Date().toISOString();
    const summary = {
      started_at: startedAt,
      completed_at: completedAt,
      issues_discovered: candidates.length,
      issues_ingested: outcomes.filter((o) => o.outcome === 'ingested').length,
      issues_unchanged: outcomes.filter((o) => o.outcome === 'unchanged').length,
      issues_failed: outcomes.filter((o) => o.outcome === 'failed').length,
      issues_skipped: outcomes.filter((o) => o.outcome === 'skipped').length,
      documents_inserted_total: outcomes.reduce(
        (sum, o) => sum + o.documents_inserted,
        0
      ),
      chunks_inserted_total: outcomes.reduce(
        (sum, o) => sum + o.chunks_inserted,
        0
      ),
      failures: outcomes
        .filter((o) => o.outcome === 'failed')
        .map((o) => ({ issue_id: o.issue_id, reason: o.reason })),
    };

    await step.run('write-run-summary', async () => {
      await writeAuditLog({
        actor: { type: 'system_automation' },
        action: {
          type: 'regulatory_ingest_run_completed',
          description: `IRB ingest run: ${summary.issues_ingested} ingested, ${summary.issues_unchanged} unchanged, ${summary.issues_failed} failed (${summary.documents_inserted_total} docs)`,
        },
        target: { table: 'regulatory_documents' },
        payload: {
          metadata: { run_summary: summary, source: 'irs.gov' },
        },
      });
    });

    return summary;
  }
);
