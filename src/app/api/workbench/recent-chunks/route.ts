/**
 * src/app/api/workbench/recent-chunks/route.ts
 *
 * Section H of the workbench: corpus inspector.
 *
 * v1: returns the most recent chunks across all documents, with
 * parent document context. Sorted by document published_date DESC.
 *
 * v2 (after PR-J Voyage embeddings): if ?q= is provided, performs
 * HNSW similarity search via src/lib/corpus/db.ts searchSimilarChunks.
 * Until then, ?q= falls back to ts_vector keyword search via the
 * existing bm25_tsv GIN index.
 *
 * Reference: docs/architecture/discovery-engine-institutional-grade.md § 6.2 H
 */

import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { getVerifiedEmail } from '@/lib/cookie-auth';

const prisma = new PrismaClient();

interface ChunkResult {
  id: string;
  document_id: string;
  citation_key: string;
  document_title: string;
  jurisdiction: string;
  pinpoint: string | null;
  structural_path: string;
  text_snippet: string;
  ingested_at: Date;
}

export async function GET(request: Request) {
  const email = await getVerifiedEmail();
  if (!email) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const url = new URL(request.url);
  const q = url.searchParams.get('q')?.trim() ?? '';
  const limit = Math.min(
    parseInt(url.searchParams.get('limit') ?? '20', 10) || 20,
    100
  );

  try {
    let rows: ChunkResult[];

    if (q.length > 0) {
      // BM25 keyword search via existing GIN index on bm25_tsv
      rows = await prisma.$queryRaw<ChunkResult[]>`
        SELECT
          c.id,
          c.document_id,
          d.citation_key,
          d.title AS document_title,
          d.jurisdiction,
          c.pinpoint,
          c.structural_path,
          LEFT(c.text, 400) AS text_snippet,
          c.created_at AS ingested_at
        FROM regulatory_document_chunks c
        JOIN regulatory_documents d ON c.document_id = d.id
        WHERE c.bm25_tsv @@ plainto_tsquery('english', ${q})
          AND d.superseded_by IS NULL
        ORDER BY ts_rank(c.bm25_tsv, plainto_tsquery('english', ${q})) DESC
        LIMIT ${limit}
      `;
    } else {
      // No query: return most recent chunks by ingestion time
      rows = await prisma.$queryRaw<ChunkResult[]>`
        SELECT
          c.id,
          c.document_id,
          d.citation_key,
          d.title AS document_title,
          d.jurisdiction,
          c.pinpoint,
          c.structural_path,
          LEFT(c.text, 400) AS text_snippet,
          c.created_at AS ingested_at
        FROM regulatory_document_chunks c
        JOIN regulatory_documents d ON c.document_id = d.id
        WHERE d.superseded_by IS NULL
        ORDER BY c.created_at DESC
        LIMIT ${limit}
      `;
    }

    return NextResponse.json({
      query: q || null,
      results: rows.map((r) => ({
        ...r,
        ingested_at: r.ingested_at.toISOString(),
      })),
      result_count: rows.length,
    });
  } catch (err) {
    console.error('[workbench/recent-chunks] error', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'unknown' },
      { status: 500 }
    );
  }
}
