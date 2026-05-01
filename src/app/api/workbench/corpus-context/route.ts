/**
 * src/app/api/workbench/corpus-context/route.ts
 *
 * Section C of the institutional workbench: corpus context summary.
 *
 * Returns:
 *   - total documents in regulatory_documents
 *   - total chunks in regulatory_document_chunks
 *   - count of currently-superseded documents
 *   - most recent regulatory_ingest_run_completed audit event
 *   - per-source: domain, count, last-fetched
 *
 * Reference: docs/architecture/discovery-engine-institutional-grade.md § 6.2
 */

import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { getVerifiedEmail } from '@/lib/cookie-auth';

const prisma = new PrismaClient();

export async function GET() {
  const email = await getVerifiedEmail();
  if (!email) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  try {
    const [documentRows, chunkRows, supersededRows, lastIngestRows, perSource] =
      await Promise.all([
        prisma.$queryRaw<Array<{ count: bigint }>>`
          SELECT COUNT(*)::bigint AS count FROM regulatory_documents
        `,
        prisma.$queryRaw<Array<{ count: bigint }>>`
          SELECT COUNT(*)::bigint AS count FROM regulatory_document_chunks
        `,
        prisma.$queryRaw<Array<{ count: bigint }>>`
          SELECT COUNT(*)::bigint AS count
          FROM regulatory_documents
          WHERE superseded_by IS NOT NULL
        `,
        prisma.$queryRaw<
          Array<{
            created_at: Date;
            action_description: string;
            payload_metadata: unknown;
          }>
        >`
          SELECT created_at, action_description, payload_metadata
          FROM audit_log
          WHERE action_type = 'regulatory_ingest_run_completed'
          ORDER BY sequence_number DESC
          LIMIT 1
        `,
        prisma.$queryRaw<
          Array<{
            domain: string;
            source_name: string;
            document_count: bigint;
            last_retrieved_at: Date | null;
          }>
        >`
          SELECT
            s.domain,
            s.source_name,
            COUNT(d.id)::bigint AS document_count,
            MAX(d.retrieved_at) AS last_retrieved_at
          FROM regulatory_sources s
          LEFT JOIN regulatory_documents d ON d.source_id = s.id
          WHERE s.is_active = true
          GROUP BY s.domain, s.source_name
          HAVING COUNT(d.id) > 0
          ORDER BY MAX(d.retrieved_at) DESC NULLS LAST
        `,
      ]);

    return NextResponse.json({
      total_documents: Number(documentRows[0]?.count ?? 0),
      total_chunks: Number(chunkRows[0]?.count ?? 0),
      superseded_documents: Number(supersededRows[0]?.count ?? 0),
      last_ingest_event: lastIngestRows[0]
        ? {
            timestamp: lastIngestRows[0].created_at.toISOString(),
            description: lastIngestRows[0].action_description,
            payload: lastIngestRows[0].payload_metadata,
          }
        : null,
      per_source: perSource.map((row) => ({
        domain: row.domain,
        source_name: row.source_name,
        document_count: Number(row.document_count),
        last_retrieved_at: row.last_retrieved_at?.toISOString() ?? null,
      })),
    });
  } catch (err) {
    console.error('[workbench/corpus-context] error', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'unknown' },
      { status: 500 }
    );
  }
}
