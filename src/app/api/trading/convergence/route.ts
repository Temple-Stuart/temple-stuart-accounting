import { NextResponse } from 'next/server';
import { runPipeline } from '@/lib/convergence/pipeline';
import type { PipelineResult } from '@/lib/convergence/pipeline';
import { getVerifiedEmail } from '@/lib/cookie-auth';
import { prisma } from '@/lib/prisma';

export const maxDuration = 300;

// ===== 15-MINUTE IN-MEMORY CACHE =====

const CACHE_TTL_MS = 15 * 60 * 1000; // 15 minutes

interface CacheEntry {
  data: PipelineResult;
  timestamp: number;
}

const cache = new Map<string, CacheEntry>();

function getCacheKey(limit: number, universe?: string): string {
  return `convergence_${limit}_${universe ?? 'all'}`;
}

function getFromCache(limit: number, universe?: string): CacheEntry | null {
  const key = getCacheKey(limit, universe);
  const entry = cache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.timestamp > CACHE_TTL_MS) {
    cache.delete(key);
    return null;
  }
  return entry;
}

function setCache(limit: number, data: PipelineResult, universe?: string): void {
  const key = getCacheKey(limit, universe);
  cache.set(key, { data, timestamp: Date.now() });
}

// ===== ROUTE =====

export async function GET(request: Request) {
  try {
    const userEmail = await getVerifiedEmail();
    if (!userEmail) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);

    // Parse query params
    let limit = parseInt(searchParams.get('limit') || '20', 10);
    if (isNaN(limit) || limit < 4) limit = 4;
    if (limit > 150) limit = 150;

    const refresh = searchParams.get('refresh') === 'true';
    const universe = searchParams.get('universe') ?? undefined;
    const stream = searchParams.get('stream') === 'true';

    // ===== SSE STREAMING PATH =====
    if (stream) {
      // Resolve userId for snapshot logging
      let userId: string | undefined;
      try {
        const user = await prisma.users.findFirst({ where: { email: { equals: userEmail, mode: 'insensitive' } } });
        userId = user?.id;
      } catch {
        // Non-critical
      }

      const encoder = new TextEncoder();
      const readable = new ReadableStream({
        async start(controller) {
          const send = (data: object) => {
            controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
          };
          try {
            const result = await runPipeline(limit, userId, universe, (event) => send(event));
            // Cache the final result so the follow-up fetch is instant
            setCache(limit, result, universe);
            send({ step: 'done', label: 'Complete', data: {} });
          } catch (err) {
            send({ step: 'error', label: err instanceof Error ? err.message : String(err), data: {} });
          } finally {
            controller.close();
          }
        },
      });

      return new Response(readable, {
        headers: {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive',
        },
      });
    }

    // Check cache (unless refresh=true)
    if (!refresh) {
      const cached = getFromCache(limit, universe);
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
    console.log(`[Convergence Route] Cache MISS (limit=${limit}, refresh=${refresh}, universe=${universe ?? 'all'})`);

    // Resolve userId for snapshot logging (non-blocking — pipeline runs even if lookup fails)
    let userId: string | undefined;
    try {
      const user = await prisma.users.findFirst({ where: { email: { equals: userEmail, mode: 'insensitive' } } });
      userId = user?.id;
    } catch {
      // Non-critical — snapshot logging will be skipped
    }

    const start = Date.now();
    const result = await runPipeline(limit, userId, universe);
    const elapsed = Date.now() - start;
    console.log(`[Convergence Route] Pipeline completed in ${elapsed}ms`);

    // Store in cache
    setCache(limit, result, universe);

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
