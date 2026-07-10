import { NextResponse } from 'next/server';
import { runPipeline } from '@/lib/convergence/pipeline';
import type { PipelineResult } from '@/lib/convergence/pipeline';
import { getVerifiedEmail } from '@/lib/cookie-auth';
import { requireTabAccess } from '@/lib/auth-helpers';
import { requireScanRateLimit } from '@/lib/scan-rate-limit';
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
    // TAB-SERVER-GATE (supersedes TRADING-PR-SEC's admin-only ruling): the scan
    // hits PAID data feeds (TastyTrade market data / Finnhub / FRED / xAI), so it
    // is gated to the tab:trade entitlement (or bundle:all; admin bypass inside
    // requireTabAccess) — pay for the Trade tab and scans run. 401/403 BEFORE any
    // param parsing, cache read, SSE stream, or runPipeline — no paid call fires
    // for an unentitled user. NOTE: the pipeline reads MARKET data only via the
    // shared TT session (chains/quotes/candles), never account state — the
    // account-reading tastytrade/* routes stay requireAdmin (SEC4).
    // SCAN-SPEND-QUOTA closes the gap previously flagged here: a per-user run
    // quota (requireScanRateLimit) sits at BOTH pipeline-fire points below —
    // after this tab gate, before runPipeline. Cache hits stay free.
    const userEmail = await getVerifiedEmail();
    if (!userEmail) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const gateUser = await prisma.users.findFirst({
      where: { email: { equals: userEmail, mode: 'insensitive' } },
      select: { id: true },
    });
    if (!gateUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }
    const tabGate = await requireTabAccess(gateUser.id, 'tab:trade');
    if (tabGate) return tabGate;

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
      // SCAN-SPEND-QUOTA: the stream path NEVER reads the cache — every stream
      // request runs the full paid pipeline — so the per-user run quota is
      // checked BEFORE the stream (and any paid call) starts. Over-quota → a
      // plain 429 + Retry-After instead of an SSE response.
      const scanQuota = await requireScanRateLimit(gateUser.id);
      if (scanQuota) return scanQuota;

      // Resolve userId for snapshot logging
      let userId: string | undefined;
      let snapshotLookupError: string | null = null;
      try {
        const user = await prisma.users.findFirst({ where: { email: { equals: userEmail, mode: 'insensitive' } } });
        userId = user?.id;
      } catch (e: unknown) {
        // KILL-4: still non-fatal (pipeline runs without snapshots), but the
        // skipped audit trail is DECLARED on the result below.
        snapshotLookupError = e instanceof Error ? e.message : String(e);
      }

      const encoder = new TextEncoder();
      const readable = new ReadableStream({
        async start(controller) {
          const send = (data: object) => {
            controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
          };
          try {
            const result = await runPipeline(limit, userId, universe, (event) => send(event));
            if (snapshotLookupError) {
              result.data_gaps.push(`snapshot_logging: SKIPPED — user lookup failed (${snapshotLookupError}); this run left no scan_snapshots audit trail`);
            }
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
    // SCAN-SPEND-QUOTA: quota is checked AFTER the cache read (a cache hit above
    // returned without consuming quota — it fires no paid call) and BEFORE
    // runPipeline. refresh=true skipped the cache, so it lands here and pays
    // quota like any other full run.
    const scanQuota = await requireScanRateLimit(gateUser.id);
    if (scanQuota) return scanQuota;

    console.log(`[Convergence Route] Cache MISS (limit=${limit}, refresh=${refresh}, universe=${universe ?? 'all'})`);

    // Resolve userId for snapshot logging (non-blocking — pipeline runs even if lookup fails)
    let userId: string | undefined;
    let snapshotLookupError: string | null = null;
    try {
      const user = await prisma.users.findFirst({ where: { email: { equals: userEmail, mode: 'insensitive' } } });
      userId = user?.id;
    } catch (e: unknown) {
      // KILL-4: still non-fatal, but the skipped snapshot audit trail is
      // DECLARED on the result below.
      snapshotLookupError = e instanceof Error ? e.message : String(e);
    }

    const start = Date.now();
    const result = await runPipeline(limit, userId, universe);
    if (snapshotLookupError) {
      result.data_gaps.push(`snapshot_logging: SKIPPED — user lookup failed (${snapshotLookupError}); this run left no scan_snapshots audit trail`);
    }
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
