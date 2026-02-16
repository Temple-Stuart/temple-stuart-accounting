import { NextResponse } from 'next/server';
import { runPipeline } from '@/lib/convergence/pipeline';
import type { PipelineResult } from '@/lib/convergence/pipeline';

export const maxDuration = 300;

// ===== 15-MINUTE IN-MEMORY CACHE =====

const CACHE_TTL_MS = 15 * 60 * 1000; // 15 minutes

interface CacheEntry {
  data: PipelineResult;
  timestamp: number;
}

const cache = new Map<string, CacheEntry>();

function getCacheKey(limit: number): string {
  return `convergence_${limit}`;
}

function getFromCache(limit: number): CacheEntry | null {
  const key = getCacheKey(limit);
  const entry = cache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.timestamp > CACHE_TTL_MS) {
    cache.delete(key);
    return null;
  }
  return entry;
}

function setCache(limit: number, data: PipelineResult): void {
  const key = getCacheKey(limit);
  cache.set(key, { data, timestamp: Date.now() });
}

// ===== ROUTE =====

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);

    // Parse query params
    let limit = parseInt(searchParams.get('limit') || '20', 10);
    if (isNaN(limit) || limit < 4) limit = 4;
    if (limit > 150) limit = 150;

    const refresh = searchParams.get('refresh') === 'true';

    // Check cache (unless refresh=true)
    if (!refresh) {
      const cached = getFromCache(limit);
      if (cached) {
        const age = Math.round((Date.now() - cached.timestamp) / 1000);
        console.log(`[Convergence Route] Cache HIT (age=${age}s, limit=${limit})`);
        return NextResponse.json(cached.data, {
          headers: {
            'X-Cache-Hit': 'true',
            'X-Cache-Age-Seconds': String(age),
            'X-Pipeline-Runtime-Ms': String(cached.data.pipeline_summary.pipeline_runtime_ms),
          },
        });
      }
    }

    // Cache miss or refresh — run full pipeline
    console.log(`[Convergence Route] Cache MISS (limit=${limit}, refresh=${refresh})`);
    const start = Date.now();
    const result = await runPipeline(limit);
    const elapsed = Date.now() - start;
    console.log(`[Convergence Route] Pipeline completed in ${elapsed}ms`);

    // Store in cache
    setCache(limit, result);

    return NextResponse.json(result, {
      headers: {
        'X-Cache-Hit': 'false',
        'X-Pipeline-Runtime-Ms': String(result.pipeline_summary.pipeline_runtime_ms),
      },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('[Convergence Route] Error:', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
