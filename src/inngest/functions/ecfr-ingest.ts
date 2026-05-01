/**
 * src/inngest/functions/ecfr-ingest.ts
 *
 * Daily eCFR ingestion worker. Cron fires at 06:00 UTC.
 *
 * Flow:
 *   step 1: fetch the eCFR title list (50 entries)
 *   step 2: per title, run a step that:
 *           - looks up our latest stored published_date for the title
 *           - skips if eCFR's up_to_date_as_of <= our latest
 *           - otherwise: fetch XML, parse, persist, audit
 *   step 3: write the run summary to audit_log
 *
 * Each step.run is automatically memoized by Inngest. If the run fails
 * mid-flight and retries, completed titles are not re-fetched.
 *
 * Reference: docs/architecture/discovery-engine-institutional-grade.md § 4.1
 */

import crypto from 'crypto';
import { PrismaClient } from '@prisma/client';
import { inngest } from '../client';
import {
  fetchTitleList,
  fetchTitleXml,
  parseTitleToDocuments,
  persistTitleDocuments,
} from '@/lib/corpus/ingest';
import type {
  TitleIngestSummary,
  RunSummary,
} from '@/lib/corpus/ingest';
import { writeAuditLog } from '@/lib/audit/writeAuditLog';

const prisma = new PrismaClient();

/**
 * Helper: latest published_date in regulatory_documents for any document
 * sourced from ecfr.gov for the given title number. Returns null if none.
 *
 * Uses metadata->>'title_number' for the lookup since title_number lives
 * in the per-document metadata jsonb (set by ecfr-persist.ts).
 */
async function latestPublishedDateForTitle(
  titleNumber: number
): Promise<string | null> {
  const rows = await prisma.$queryRaw<Array<{ max: Date | null }>>`
    SELECT MAX(d.published_date) AS max
    FROM regulatory_documents d
    JOIN regulatory_sources s ON d.source_id = s.id
    WHERE s.domain = 'ecfr.gov'
      AND d.metadata->>'title_number' = ${String(titleNumber)}
      AND d.superseded_by IS NULL
  `;
  return rows[0]?.max ? rows[0].max.toISOString().slice(0, 10) : null;
}

export const ecfrIngest = inngest.createFunction(
  {
    id: 'ecfr-ingest-daily',
    name: 'eCFR daily ingestion',
    triggers: [{ cron: '0 6 * * *' }],
    concurrency: { limit: 1 },
  },
  async ({ step }) => {
    const startedAt = new Date().toISOString();

    // STEP 1: fetch title list
    const titleList = await step.run('fetch-title-list', async () => {
      return await fetchTitleList();
    });

    const perTitle: TitleIngestSummary[] = [];

    // STEP 2: per-title processing — each in its own step.run
    for (const title of titleList) {
      if (title.reserved) {
        perTitle.push({
          title_number: title.number,
          title_name: title.name,
          outcome: 'unchanged',
          documents_inserted: 0,
          chunks_inserted: 0,
          documents_superseded: 0,
          duration_ms: 0,
        });
        continue;
      }

      const summary = await step.run(`title-${title.number}`, async (): Promise<TitleIngestSummary> => {
        const titleStart = Date.now();
        try {
          const latestKnown = await latestPublishedDateForTitle(title.number);

          if (latestKnown && latestKnown >= title.up_to_date_as_of) {
            return {
              title_number: title.number,
              title_name: title.name,
              outcome: 'unchanged',
              documents_inserted: 0,
              chunks_inserted: 0,
              documents_superseded: 0,
              ecfr_up_to_date_as_of: title.up_to_date_as_of,
              duration_ms: Date.now() - titleStart,
            };
          }

          const xml = await fetchTitleXml(title.number, title.up_to_date_as_of);
          const rawSha = crypto.createHash('sha256').update(xml).digest('hex');

          const documents = parseTitleToDocuments(
            xml,
            title.number,
            title.up_to_date_as_of
          );

          const counts = await persistTitleDocuments(
            documents,
            title.number,
            title.name,
            xml,
            title.up_to_date_as_of
          );

          return {
            title_number: title.number,
            title_name: title.name,
            outcome: 'ingested',
            ...counts,
            ecfr_up_to_date_as_of: title.up_to_date_as_of,
            raw_xml_sha256: rawSha,
            duration_ms: Date.now() - titleStart,
          };
        } catch (err) {
          return {
            title_number: title.number,
            title_name: title.name,
            outcome: 'failed',
            documents_inserted: 0,
            chunks_inserted: 0,
            documents_superseded: 0,
            error_message: err instanceof Error ? err.message : String(err),
            duration_ms: Date.now() - titleStart,
          };
        }
      });

      perTitle.push(summary);
    }

    // STEP 3: write run summary to audit log
    const completedAt = new Date().toISOString();
    const summary: RunSummary = {
      started_at: startedAt,
      completed_at: completedAt,
      titles_total: titleList.length,
      titles_unchanged: perTitle.filter((p) => p.outcome === 'unchanged').length,
      titles_ingested: perTitle.filter((p) => p.outcome === 'ingested').length,
      titles_failed: perTitle.filter((p) => p.outcome === 'failed').length,
      documents_inserted_total: perTitle.reduce(
        (sum, p) => sum + p.documents_inserted,
        0
      ),
      chunks_inserted_total: perTitle.reduce(
        (sum, p) => sum + p.chunks_inserted,
        0
      ),
      per_title: perTitle,
    };

    await step.run('write-run-summary', async () => {
      await writeAuditLog({
        actor: { type: 'system_automation' },
        action: {
          type: 'regulatory_ingest_run_completed',
          description: `eCFR ingest run: ${summary.titles_ingested} ingested, ${summary.titles_unchanged} unchanged, ${summary.titles_failed} failed`,
        },
        target: { table: 'regulatory_documents' },
        payload: {
          metadata: { run_summary: summary },
        },
      });
    });

    return summary;
  }
);
