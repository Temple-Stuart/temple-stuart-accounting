import { createHmac } from 'crypto';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { rateLimit, RateLimitError } from '@/lib/rateLimit';
// ONE-FORM-01 (Alex, 2026-11-06): the need vocabulary, typed once. SERVICES-01 (2026-11-08): the six doors' keys
// (src/lib/proposalNeeds.ts SERVICES); proposals_need_chk holds them and 'close' (20261108111500_services_01_bookkeeping_need).
import { PROPOSAL_NEEDS } from '@/lib/proposalNeeds';
import { proposalCheck } from '@/lib/proposalNeeds'; // HOME-SERVICES-02 (2026-11-16): the list's check — the hook's rule reads the same one

// PROPOSAL-FORM: the public project-proposal intake — /work-with-me POSTs here, and, since HOME-SERVICES-02 (2026-11-16), the home
// page's panel too: both forms post the one body their hook builds (src/hooks/useProposalForm.ts).
// public BY RULING: DB-write only, no paid API, rate-limited + honeypot.
//
// The security-mandate order, cheapest defense first:
//   1. honeypot ('website' non-empty → 200 {ok:true} silent drop BY RULING —
//      the one sanctioned quiet path: telling a bot it was caught teaches it)
//   2. rateLimit('proposal:'+ipHash, 5/hour) — the admin-verify precedent
//      (api/admin/verify/route.ts:20), durable DB-backed fixed window
//   3. zod validation (enums mirror the table's CHECK constraints — need accepts the six doors; the CHECK also keeps 'close' for the rows the old close door wrote, SERVICES-01),
//      then the list's check (HOME-SERVICES-02): each answer against its question, a missing or a wrong one refused by name
//   4. prisma create
//
// status + owner_notes are Alex's triage fields — NEVER accepted from the
// client (a bot must not mint status='won'); omitted here so the DDL defaults
// rule (status 'new'). ip_hash = HMAC-SHA256 of the client IP keyed by
// JWT_SECRET (the cookie-auth secret, cookie-auth.ts:5) — raw IP never stored.
// No attachment field BY RULING: public-form uploads are banned per the
// security mandate; files arrive via the email thread post-triage.

// HOME-SERVICES-02 (Alex's brief, 2026-11-16 13:24 Manila), ruling n: "THE HONEYPOT KEEPS ITS NAME. website stays the route's trap, silently dropped when filled, BY RULING. The visitor's real website never travels under that key: it is an answer, under a key of its own." — step 1 reads website and nothing else; the visitor's own
// website is the list's site question, and it travels under answers.
// Ruling f, in part: "The hook's rule and the route's check read the same set, so the route refuses by name any body the button would
// have held back." — proposalCheck (src/lib/proposalNeeds.ts), after zod: the held (a required pick, count or follow-up missing), the
// empty (a required text missing) and the wrong (a key no question asks, an answer none offers, a shape no field writes), each by its
// question's words, in a 400 shaped as zod's: { error: 'Invalid submission', issues }.
//
// The 9 module ids that stood here until then (MODULE_IDS, kept as literals from the deck's PILLAR_CARDS) left with the modules
// question's old shape: Full setup's "What should it run on day one?" holds its answers as the list words them, and the list's
// check reads them there. A word the list does not offer is refused by name, as an id the deck did not hold was.
//
// The old questions' columns are written no more, and lose NOT NULL and their defaults
// (prisma/migrations/20261116132400_home_services_02_answers, ruling m): a new row holds NULL there, never a value nobody gave.

const proposalSchema = z.object({
  name: z.string().trim().min(1).max(255),
  email: z.string().trim().email().max(255),
  business: z.string().trim().min(1).max(5000),
  // ONE-FORM-01 → SERVICES-01 (2026-11-08): the six doors' keys, from src/lib/proposalNeeds.ts.
  // SERVICES-01: 'close' is no longer accepted on write — proposals_need_chk keeps it for the rows the old close door wrote.
  need: z.enum(PROPOSAL_NEEDS),
  // HOME-SERVICES-02 (2026-11-16): the website, the decision role and the picked service's answered questions, each under its key —
  // their shapes are the list's check's to read, below. The FORM-V2 notes on current_stack (the stack question, moved to the optional
  // detail section) and notesFromThem (the done question, required, with the Other module's description prepended to it) stood
  // here until then: neither question is asked now, nor the start window, the budget's one set of bands, the deadline, the links or
  // the team size as the old body sent them.
  answers: z.record(z.string(), z.unknown()),
  // FORM-V2: free string at the DDL cap (VARCHAR(100)) — the client
  // assembles it: a base token (Reddit/Instagram/TikTok/X/YouTube) or
  // 'referral: {name}' / 'other: {text}' (HOME-SERVICES-02: the list's referralSource; its check reads it back).
  referralSource: z.string().trim().min(1).max(100).optional(),
});

/**
 * HOME-SERVICES-02 (2026-11-16): the list's check, as a refusal — each finding by its question's words, in zod's shape, so both
 * forms read it as they read zod's (the hook, src/hooks/useProposalForm.ts: the error, then its issues); null when it found nothing.
 */
function refusedByTheList(found: { held: string[]; empty: string[]; wrong: string[] }): NextResponse | null {
  const issues = [...[...found.held, ...found.empty].map((words) => `${words}: required`), ...found.wrong];
  if (issues.length === 0) return null;
  return NextResponse.json({ error: 'Invalid submission', issues }, { status: 400 });
}

// The intake, its steps in the order above.
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
    // 3b. HOME-SERVICES-02 (2026-11-16): the list's check — each answer against its question; the hook's rule reads the same.
    const found = proposalCheck(d);
    const refused = refusedByTheList(found);
    if (refused !== null) return refused;

    // 4. Insert — the route's ONLY side effect (DB-write only BY RULING).
    const row = await prisma.proposals.create({
      data: {
        name: d.name,
        email: d.email,
        business: d.business,
        need: d.need,
        // HOME-SERVICES-02 (2026-11-16), ruling m: the answers' one column, each under its question's key. The columns only the
        // old questions filled (current_stack, modules, start_window, budget_range, notes_from_them, the deadline's two, links and
        // team_size) are not written: a new row holds NULL there. Until then this create wrote them, current_stack '' when the
        // stack question went unanswered — the FORM-V2 ruling's admitted-empty value, retired with the question.
        answers: found.answers,
        referralSource: d.referralSource ?? null,
        ipHash,
        // status + owner_notes intentionally absent — DDL defaults rule.
      },
      select: { id: true },
    });

    // HOME-SERVICES-02 (2026-11-16): nothing else is sent or stored — no email, no notification; the route stays
    // database-only. The CRM reads the row (GET /api/crm, src/lib/crm/crm.ts): a new row's answers under their
    // questions' words, read from the list, and an old row as it read until then (ruling o).

    return NextResponse.json({ ok: true, id: row.id });
  } catch (error) {
    console.error('Proposal intake error:', error);
    return NextResponse.json(
      { error: 'Something broke on our side — please email astuart@templestuart.com instead.' },
      { status: 500 },
    );
  }
}
