/**
 * POST /api/f/<slug> — A SUBMISSION OF AN ACCOUNT'S OWN INTAKE FORM (CRM-02, Alex, 2026-11-07).
 *
 * PUBLIC BY RULING (CLOSED 1; src/middleware.ts PUBLIC_PATHS '/api/f'): the sender holds no session. DB-write only — no
 * paid API, no email, nothing sent. The proposal route's guards in the proposal route's order
 * (src/app/api/proposals/route.ts:75-113), cheapest defense first:
 *   0. JWT_SECRET or throw — the IP is hashed with it, never stored raw (cookie-auth.ts's secret);
 *   1. the body as JSON, or 400;
 *   2. the honeypot — a filled 'website' means a bot: 200 { ok: true } and nothing written, the one sanctioned quiet path
 *      (telling a bot it was caught teaches it);
 *   3. the per-ip_hash rate limit, 5 an hour (rateLimit `form:<ip hash>`, the durable DB-backed window) → 429 + Retry-After;
 *   4. THEN the form by its slug (crm_forms.findUnique { slug }; a slug outside the rule names no row of anyone's) → 404;
 *   5. the body's shape (src/lib/crm/formWrites.ts publicSubmissionBody) → 400 with the field;
 *   6. the answers against the form (src/lib/crm/forms.ts answersOf — the FROZEN snapshot, the questions AS ASKED,
 *      CLOSED 4) → 400 with the field 'answers';
 *   7. the ONE insert — crm_form_submissions.create { form_id, user_id: the FORM OWNER's, name, email, business, answers }
 *      — the route's only side effect; it answers { ok: true } and nothing of the row.
 * Listed in the ownership law's PUBLIC_WRITERS with these guards (scripts/assert-tool-registry.ts, SEC-02); the intake
 * form law reads the order above from this file.
 */
import { createHmac } from 'crypto';
import { NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { rateLimit, RateLimitError } from '@/lib/rateLimit';
import { failClosedResponse } from '@/lib/http/failClosedResponse';
import { CrmLawError } from '@/lib/crm/crm';
import { answersOf, intakeFormOf, isFormSlug, type SubmissionAnswer } from '@/lib/crm/forms';
import { publicSubmissionBody } from '@/lib/crm/formWrites';
import { validationOf } from '@/lib/crm/contactWrites';
import { NOT_FOUND_WORDS } from '@/lib/crm/formWords';

export const dynamic = 'force-dynamic';

const notFound = () => NextResponse.json({ error: NOT_FOUND_WORDS }, { status: 404 });

export async function POST(request: Request, { params }: { params: Promise<{ slug: string }> }) {
  try {
    const secret = process.env.JWT_SECRET;
    if (!secret) {
      // Mirrors cookie-auth.ts:7 and the proposal route — fail loud, never hash with a guessable key.
      throw new Error('JWT_SECRET environment variable is required for IP hashing');
    }

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'Validation', field: 'body', message: 'Invalid JSON body' }, { status: 400 });
    }

    // 1. Honeypot — a filled 'website' field means a bot; drop silently BY RULING.
    const website = (body as Record<string, unknown> | null)?.['website'];
    if (typeof website === 'string' && website.trim() !== '') {
      return NextResponse.json({ ok: true });
    }

    // 2. Rate limit — per hashed IP, BEFORE any read or validation work (the proposal route's own lines).
    const ip =
      request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
      request.headers.get('x-real-ip') ||
      'unknown';
    const ipHash = createHmac('sha256', secret).update(ip).digest('hex');
    try {
      await rateLimit(`form:${ipHash}`, { limit: 5, windowSeconds: 3600 });
    } catch (error) {
      if (error instanceof RateLimitError) {
        return NextResponse.json(
          { error: 'Too many submissions — please try again later.' },
          { status: 429, headers: { 'Retry-After': String(error.retryAfterSeconds) } },
        );
      }
      throw error;
    }

    // 3. The form by its slug — a slug outside the rule names no row of anyone's; none at the slug → 404.
    const { slug } = await params;
    if (!isFormSlug(slug)) return notFound();
    const row = await prisma.crm_forms.findUnique({ where: { slug }, select: { id: true, user_id: true, slug: true, title: true, line: true, questions: true } });
    if (!row) return notFound();
    const form = intakeFormOf(row);

    // 4. The body's shape.
    const parsed = publicSubmissionBody.safeParse(body);
    if (!parsed.success) return NextResponse.json(validationOf(parsed.error), { status: 400 });
    const d = parsed.data;

    // 5. The answers against the form — frozen as asked; a miss names its question.
    let answers: SubmissionAnswer[];
    try {
      answers = answersOf(form, d);
    } catch (error) {
      if (error instanceof CrmLawError) return NextResponse.json({ error: 'Validation', field: 'answers', message: error.message }, { status: 400 });
      throw error;
    }
    // "business ≤ 5000 or absent": an empty box is no business (the column is nullable).
    const business = d.business === undefined || d.business === '' ? null : d.business;

    // 6. The ONE insert — the route's only side effect; user_id is the form owner's, never the sender's.
    await prisma.crm_form_submissions.create({
      data: { form_id: row.id, user_id: row.user_id, name: d.name, email: d.email, business, answers: answers as unknown as Prisma.InputJsonValue },
      select: { id: true },
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof CrmLawError) return NextResponse.json({ error: error.message }, { status: 500 });
    return failClosedResponse('Intake form POST', 'Failed to send the form', error);
  }
}
