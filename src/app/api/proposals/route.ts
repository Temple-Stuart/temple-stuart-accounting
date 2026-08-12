import { createHmac } from 'crypto';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { rateLimit, RateLimitError } from '@/lib/rateLimit';

// PROPOSAL-FORM: the public project-proposal intake — /work-with-me POSTs here.
// public BY RULING: DB-write only, no paid API, rate-limited + honeypot.
//
// The security-mandate order, cheapest defense first:
//   1. honeypot ('website' non-empty → 200 {ok:true} silent drop BY RULING —
//      the one sanctioned quiet path: telling a bot it was caught teaches it)
//   2. rateLimit('proposal:'+ipHash, 5/hour) — the admin-verify precedent
//      (api/admin/verify/route.ts:20), durable DB-backed fixed window
//   3. zod validation (enums mirror the table's CHECK constraints)
//   4. prisma create
//
// status + owner_notes are Alex's triage fields — NEVER accepted from the
// client (a bot must not mint status='won'); omitted here so the DDL defaults
// rule (status 'new'). ip_hash = HMAC-SHA256 of the client IP keyed by
// JWT_SECRET (the cookie-auth secret, cookie-auth.ts:5) — raw IP never stored.
// No attachment field BY RULING: public-form uploads are banned per the
// security mandate; files arrive via the email thread post-triage.

// The 9 module ids — REUSED from Landing.tsx PILLAR_CARDS (:241-313), the
// deck's one module vocabulary. Kept as literals because PILLAR_CARDS lives
// inside the Landing client component (importing it here would be absurd);
// they cannot drift silently — an id added to the deck but not here simply
// rejects, loudly.
const MODULE_IDS = [
  'travel',
  'runway',
  'books',
  'trade',
  'tax',
  'compliance',
  'routines',
  'projects',
  'content',
] as const;

const proposalSchema = z.object({
  name: z.string().trim().min(1).max(255),
  email: z.string().trim().email().max(255),
  business: z.string().trim().min(1).max(5000),
  currentStack: z.string().trim().min(1).max(5000),
  need: z.enum(['setup', 'maintenance', 'custom', 'embed', 'unsure']),
  modules: z.array(z.enum(MODULE_IDS)).max(9),
  startWindow: z.enum(['now', '2-4wk', '1-3mo', 'exploring']),
  budgetRange: z.enum(['<$2k', '$2–10k', '$10–50k', '$50k+', 'not sure']),
  notesFromThem: z.string().trim().max(5000),
  hardDeadline: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Expected YYYY-MM-DD')
    .refine((v) => !Number.isNaN(Date.parse(v)), 'Not a real date')
    .optional(),
  deadlineDriver: z.string().trim().max(2000).optional(),
  links: z.array(z.string().trim().url().max(500)).max(5).optional(),
  teamSize: z.enum(['Just me', '2–10', '11–50', '50+']).optional(),
  referralSource: z.enum(['Reddit', 'X', 'NYT', 'referral', 'other']).optional(),
});

export async function POST(request: Request) {
  try {
    const secret = process.env.JWT_SECRET;
    if (!secret) {
      // Mirrors cookie-auth.ts:7 — fail loud, never hash with a guessable key.
      throw new Error('JWT_SECRET environment variable is required for IP hashing');
    }

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    // 1. Honeypot — a filled 'website' field means a bot; drop silently BY RULING.
    const website = (body as Record<string, unknown> | null)?.['website'];
    if (typeof website === 'string' && website.trim() !== '') {
      return NextResponse.json({ ok: true });
    }

    // 2. Rate limit — per hashed IP, BEFORE any validation work.
    const ip =
      request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
      request.headers.get('x-real-ip') ||
      'unknown';
    const ipHash = createHmac('sha256', secret).update(ip).digest('hex');
    try {
      await rateLimit(`proposal:${ipHash}`, { limit: 5, windowSeconds: 3600 });
    } catch (error) {
      if (error instanceof RateLimitError) {
        return NextResponse.json(
          { error: 'Too many submissions — please try again later.' },
          { status: 429, headers: { 'Retry-After': String(error.retryAfterSeconds) } },
        );
      }
      throw error;
    }

    // 3. Validate.
    const parsed = proposalSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        {
          error: 'Invalid submission',
          issues: parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`),
        },
        { status: 400 },
      );
    }
    const d = parsed.data;

    // 4. Insert — the route's ONLY side effect (DB-write only BY RULING).
    const row = await prisma.proposals.create({
      data: {
        name: d.name,
        email: d.email,
        business: d.business,
        currentStack: d.currentStack,
        need: d.need,
        modules: d.modules,
        startWindow: d.startWindow,
        budgetRange: d.budgetRange,
        notesFromThem: d.notesFromThem,
        hardDeadline: d.hardDeadline ? new Date(`${d.hardDeadline}T00:00:00Z`) : null,
        deadlineDriver: d.deadlineDriver ?? null,
        ...(d.links ? { links: d.links } : {}),
        teamSize: d.teamSize ?? null,
        referralSource: d.referralSource ?? null,
        ipHash,
        // status + owner_notes intentionally absent — DDL defaults rule.
      },
      select: { id: true },
    });

    return NextResponse.json({ ok: true, id: row.id });
  } catch (error) {
    console.error('Proposal intake error:', error);
    return NextResponse.json(
      { error: 'Something broke on our side — please email astuart@templestuart.com instead.' },
      { status: 500 },
    );
  }
}
