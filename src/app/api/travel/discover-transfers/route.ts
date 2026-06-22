// ⚠️ TEMPORARY DEBUG ROUTE — DELETE after the transfers tag ID is confirmed. ⚠️
//
// One-off, OWNER-ONLY discovery of Viator's "Transfers & Ground Transport" tag id, plus
// PROOF that searchV2Products(destId, n, [tag]) returns real transfer products. It runs the
// same discovery server-side on Vercel (where VIATOR_API_KEY exists) that scripts/
// discover-viator-tags.ts would run locally. This is a throwaway investigation, NOT a feature:
// it adds no UI, is NOT in middleware PUBLIC_PATHS (stays authed — it calls a PAID API), and
// must be removed in an immediate follow-up PR once Alex reads the result.
//
// SECURITY (the 6 guardrails):
//   1. getVerifiedEmail() → users lookup → email MUST equal process.env.OWNER_EMAIL (Alex,
//      the existing owner gate used by stripe/webhook:5,35). Auth runs BEFORE any Viator call.
//   2. Calls Viator /products/tags + /products/search (filtered by the transfers tag) for a
//      destination ("Bali" default), server-side with the Vercel VIATOR_API_KEY.
//   3. Response JSON returns ONLY { tagId, name, productCount, sampleTitles[] } (+ context).
//      The API key is NEVER returned in any field and NEVER logged.
//   4. Rate-limited via the shared rateLimit helper.
//   5. NOT added to PUBLIC_PATHS — middleware keeps it cookie-gated; the in-route owner check
//      is the real boundary.
//   6. Clearly TEMPORARY (this banner) — delete after the tag ID is confirmed.

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getVerifiedEmail } from '@/lib/cookie-auth';
import { findDestinationId } from '@/lib/viatorClient';
import { rateLimit, RateLimitError } from '@/lib/rateLimit';

const VIATOR_V2_BASE = 'https://api.viator.com/partner';
const KEYWORDS = ['transfer', 'transport', 'ground', 'shuttle', 'airport'];

/** Mirrors viatorClient.ts:21-27. The key is passed in and NEVER returned/logged. */
function v2Headers(key: string): Record<string, string> {
  return {
    'Accept-Language': 'en-US',
    'Content-Type': 'application/json',
    'Accept': 'application/json;version=2.0',
    'exp-api-key': key,
  };
}

/** Defensive array extraction — Viator responses nest under varying keys. */
function firstArray(obj: any, paths: string[]): any[] {
  for (const p of paths) {
    const v = p.split('.').reduce((o, k) => (o == null ? o : o[k]), obj);
    if (Array.isArray(v)) return v;
  }
  return [];
}

/** Viator V2 tag names live under a locale map; try the documented shapes. */
function tagName(t: any): string {
  return (
    t?.allNamesByLocale?.en ||
    t?.nameByLocale?.en ||
    t?.name ||
    (Array.isArray(t?.names) ? t.names[0]?.name : undefined) ||
    ''
  );
}

export async function GET(request: NextRequest) {
  try {
    // ── 1 · AUTH — owner-only, BEFORE any Viator (paid) call ──
    const userEmail = await getVerifiedEmail();
    if (!userEmail) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const user = await prisma.users.findFirst({
      where: { email: { equals: userEmail, mode: 'insensitive' } },
    });
    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

    const owner = process.env.OWNER_EMAIL;
    // Pinned to OWNER_EMAIL (the same owner gate stripe/webhook uses). Fail CLOSED:
    // unset owner or non-owner email → 403, never reaches the paid API.
    if (!owner || user.email.toLowerCase() !== owner.toLowerCase()) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // ── 2 · rate limit (shared helper) ──
    const ip =
      request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
      request.headers.get('x-real-ip') ||
      'unknown';
    await rateLimit(`discover-transfers:${ip}`, { limit: 5, windowSeconds: 300 });

    // ── 3 · key — server-side only; NEVER placed in the response ──
    const key = process.env.VIATOR_API_KEY;
    if (!key) {
      return NextResponse.json({ error: 'VIATOR_API_KEY not configured on the server' }, { status: 503 });
    }

    const city = (request.nextUrl.searchParams.get('city') || 'Bali').trim();

    // ── A · the tags taxonomy → transfer/transport matches ──
    const tagsRes = await fetch(`${VIATOR_V2_BASE}/products/tags`, { headers: v2Headers(key) });
    const tagsJson = await tagsRes.json().catch(() => ({}));
    if (!tagsRes.ok) {
      // Viator error body (does NOT contain our key) — truncated for diagnosis.
      return NextResponse.json(
        { step: 'tags', status: tagsRes.status, error: 'tags endpoint failed', raw: JSON.stringify(tagsJson).slice(0, 300) },
        { status: 502 },
      );
    }
    const allTags = firstArray(tagsJson, ['tags', 'data', 'data.tags']);
    const matchedTags = allTags
      .filter((t) => KEYWORDS.some((k) => tagName(t).toLowerCase().includes(k)))
      .map((t) => ({ tagId: t.tagId ?? t.id ?? null, name: tagName(t) }));

    // ── B · resolve the destination → destId (reuse the app helper) ──
    const destId = await findDestinationId(city);

    // ── C · PROVE products per matched tag (the win condition) ──
    const proof: { tagId: unknown; name: string; status: number; productCount: number; sampleTitles: string[] }[] = [];
    if (destId) {
      for (const m of matchedTags) {
        const body = {
          // mirrors viatorClient.ts:252 (destination=String) + :258-259 (filtering.tags)
          filtering: { destination: String(destId), tags: [m.tagId] },
          sorting: { sort: 'DEFAULT' },
          pagination: { start: 1, count: 10 },
          currency: 'USD',
        };
        const sr = await fetch(`${VIATOR_V2_BASE}/products/search`, {
          method: 'POST',
          headers: v2Headers(key),
          body: JSON.stringify(body),
        });
        const sj = await sr.json().catch(() => ({}));
        const products = firstArray(sj, ['products', 'data', 'products.results']);
        proof.push({
          tagId: m.tagId,
          name: m.name,
          status: sr.status,
          productCount: products.length,
          sampleTitles: products.slice(0, 3).map((p: any) => p?.title ?? p?.productCode ?? '').filter(Boolean),
        });
      }
    }

    // ── Response: tag id + proof ONLY. No API key, ever. ──
    return NextResponse.json({
      note: 'TEMPORARY discovery route — delete after reading the transfers tag id.',
      city,
      destId,
      tagCountTotal: allTags.length,
      matchedTags,
      proof,
    });
  } catch (error) {
    if (error instanceof RateLimitError) {
      return NextResponse.json(
        { error: 'Too many requests — try again shortly.' },
        { status: 429, headers: { 'Retry-After': String(error.retryAfterSeconds) } },
      );
    }
    console.error('[discover-transfers] error', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'discovery failed' },
      { status: 500 },
    );
  }
}
