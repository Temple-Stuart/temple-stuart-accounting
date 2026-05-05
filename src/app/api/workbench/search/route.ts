/**
 * src/app/api/workbench/search/route.ts
 *
 * Auth-gated hybrid retrieval endpoint for Section H of the
 * institutional workbench.
 *
 * POST /api/workbench/search
 * Body: { query: string, mode?: 'keyword'|'semantic'|'hybrid', topK?: number, sourceDomains?: string[], docTypes?: string[] }
 * Returns: { results: RetrievalResult[], duration_ms: number, mode: string }
 */

import { NextRequest, NextResponse } from 'next/server';
import { getVerifiedEmail } from '@/lib/cookie-auth';
import { searchCorpus } from '@/lib/corpus/retrieve';
import type { RetrievalMode } from '@/lib/corpus/retrieve';

interface SearchRequestBody {
  query: string;
  mode?: RetrievalMode;
  topK?: number;
  sourceDomains?: string[];
  docTypes?: string[];
}

export async function POST(request: NextRequest) {
  const email = await getVerifiedEmail();
  if (!email) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  try {
    const body = (await request.json()) as SearchRequestBody;
    const query = body.query?.trim();

    if (!query) {
      return NextResponse.json(
        { error: 'query is required' },
        { status: 400 }
      );
    }

    const startedAt = Date.now();
    const results = await searchCorpus(query, {
      mode: body.mode ?? 'hybrid',
      topK: body.topK ?? 8,
      sourceDomains: body.sourceDomains,
      docTypes: body.docTypes,
    });
    const durationMs = Date.now() - startedAt;

    return NextResponse.json({
      results,
      duration_ms: durationMs,
      mode: body.mode ?? 'hybrid',
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'unknown error';
    console.error('[/api/workbench/search]', message);
    return NextResponse.json(
      { error: 'search failed', detail: message },
      { status: 500 }
    );
  }
}
