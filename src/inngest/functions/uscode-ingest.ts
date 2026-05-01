/**
 * src/inngest/functions/uscode-ingest.ts
 *
 * Weekly U.S. Code ingestion worker. Cron fires at Sunday 07:00 UTC
 * (30 minutes after eCFR's daily cron, weekly cadence per the
 * regulatory_sources entry's refresh_cadence: "weekly").
 *
 * Flow:
 *   step 1: discover-release-point — fetch download.shtml and
 *           extract the highest (congress, plno) pair. If this step
 *           fails, the entire run fails (no silent fallback).
 *   step 2: per-title loop — for each of 55 USCODE_TITLES (54 plus
 *           Title 5 Appendix), run a step that:
 *             - HEAD request to get Last-Modified at this release point
 *             - compare to our latest stored published_date
 *             - skip if Last-Modified <= our latest
 *             - otherwise: fetch full ZIP, unpack XML, parse, persist
 *   step 3: write-run-summary — audit log entry with per-title summary
 *
 * Each step.run is automatically memoized by Inngest. If the run
 * fails mid-flight and retries, completed titles are not re-fetched.
 *
 * Reference: docs/architecture/discovery-engine-institutional-grade.md § 4.1
 */

import crypto from 'crypto';
import { PrismaClient } from '@prisma/client';
import { inngest } from '../client';
import {
  USCODE_TITLES,
  fetchTitleHeaders,
  fetchUscTitleXml,
  parseUscTitleToDocuments,
  persistUscTitleDocuments,
  discoverLatestReleasePoint,
} from '@/lib/corpus/ingest';
import type {
  TitleIngestSummary,
  RunSummary,
  ReleasePoint,
} from '@/lib/corpus/ingest';
import { writeAuditLog } from '@/lib/audit/writeAuditLog';

const prisma = new PrismaClient();

/**
 * Helper: latest published_date for any USC document under the given
 * title number. Returns null if none.
 */
async function latestPublishedDateForTitle(
  titleNumber: number
): Promise<Date | null> {
  const rows = await prisma.$queryRaw<Array<{ max: Date | null }>>`
    SELECT MAX(d.published_date) AS max
    FROM regulatory_documents d
    JOIN regulatory_sources s ON d.source_id = s.id
    WHERE s.domain = 'uscode.house.gov'
      AND d.metadata->>'title_number' = ${String(titleNumber)}
      AND d.superseded_by IS NULL
  `;
  return rows[0]?.max ?? null;
}

export const uscodeIngest = inngest.createFunction(
  {
    id: 'uscode-ingest-weekly',
    name: 'U.S. Code weekly ingestion',
    triggers: [{ cron: '0 7 * * 0' }],
    concurrency: { limit: 1 },
  },
  async ({ step }) => {
    const startedAt = new Date().toISOString();

    // STEP 1: discover the latest OLRC release point.
    // If this fails, the whole run fails — no silent fallback.
    const releasePoint: ReleasePoint = await step.run(
      'discover-release-point',
      async () => {
        return await discoverLatestReleasePoint();
      }
    );

    const perTitle: TitleIngestSummary[] = [];

    // STEP 2: per-title loop — each title in its own step.run for
    // Inngest's automatic memoization on retry.
    for (const title of USCODE_TITLES) {
      const summary = await step.run(
        `title-${title.number}`,
        async (): Promise<TitleIngestSummary> => {
          const titleStart = Date.now();
          try {
            const headers = await fetchTitleHeaders(
              releasePoint.congress,
              releasePoint.plno,
              title.number
            );

            if (!headers.last_modified) {
              return {
                title_number: title.number,
                title_name: title.name,
                outcome: 'failed',
                documents_inserted: 0,
                chunks_inserted: 0,
                documents_superseded: 0,
                error_message: 'no Last-Modified header from OLRC',
                duration_ms: Date.now() - titleStart,
              };
            }

            const lastModifiedDate = new Date(headers.last_modified);
            const latestKnown = await latestPublishedDateForTitle(title.number);

            if (latestKnown && latestKnown >= lastModifiedDate) {
              return {
                title_number: title.number,
                title_name: title.name,
                outcome: 'unchanged',
                documents_inserted: 0,
                chunks_inserted: 0,
                documents_superseded: 0,
                ecfr_up_to_date_as_of: lastModifiedDate.toISOString(),
                duration_ms: Date.now() - titleStart,
              };
            }

            const xml = await fetchUscTitleXml(
              releasePoint.congress,
              releasePoint.plno,
              title.number
            );
            const rawSha = crypto
              .createHash('sha256')
              .update(xml)
              .digest('hex');

            const documents = parseUscTitleToDocuments(
              xml,
              title.number,
              lastModifiedDate.toISOString()
            );

            const counts = await persistUscTitleDocuments(
              documents,
              title.number,
              title.name,
              xml,
              lastModifiedDate.toISOString()
            );

            return {
              title_number: title.number,
              title_name: title.name,
              outcome: 'ingested',
              ...counts,
              ecfr_up_to_date_as_of: lastModifiedDate.toISOString(),
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
        }
      );

      perTitle.push(summary);
    }

    // STEP 3: write run summary to audit log.
    const completedAt = new Date().toISOString();
    const summary: RunSummary = {
      started_at: startedAt,
      completed_at: completedAt,
      titles_total: USCODE_TITLES.length,
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
          description: `USC ingest run @${releasePoint.identifier}: ${summary.titles_ingested} ingested, ${summary.titles_unchanged} unchanged, ${summary.titles_failed} failed`,
        },
        target: { table: 'regulatory_documents' },
        payload: {
          metadata: {
            run_summary: summary,
            source: 'uscode.house.gov',
            release_point: releasePoint.identifier,
          },
        },
      });
    });

    return summary;
  }
);
