/**
 * PUT /api/crm/form — THE FORM'S ONE WRITE (CRM-02, Alex, 2026-11-07): the caller's own intake form, made or changed.
 *
 * The caller first, exactly the GET's order (src/app/api/crm/route.ts:28-33): a verified cookie or 401, the user or 404 —
 * before any other read. Not in PUBLIC_PATHS. No paid call, nothing sent. The body's shape is src/lib/crm/formWrites.ts
 * putFormBody (400 with the field on a miss). Inside ONE $transaction: the caller's row (crm_forms.findUnique { user_id })
 * → the questions re-keyed (src/lib/crm/forms.ts rekeyQuestions, CLOSED 3: an id the form does not hold today → 400 with
 * the field 'questions'; a question with none is given the server's randomUUID; a question keeps its id across saves) →
 * crm_forms.update WHERE { id, user_id } or .create with user_id = the caller's; updated_at the server's now. The slug is
 * GLOBAL (crm_forms_slug_key): a unique violation on it (Prisma P2002 naming the slug) → 409 { error: 'Conflict', field:
 * 'slug', message: SLUG_TAKEN_WORDS }. Answers the IntakeForm as saved; the block keeps that answer as its state and the
 * page re-reads GET /api/crm after.
 *
 * THE OWNERSHIP LAW (SEC-02): every write carries user_id = the caller's — the update's WHERE names it, the create sets it —
 * so the law passes this file with no list entry (the contacts route's precedent, src/app/api/crm/contacts/route.ts).
 */
import { randomUUID } from 'crypto';
import { NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { getVerifiedEmail } from '@/lib/cookie-auth';
import { failClosedResponse } from '@/lib/http/failClosedResponse';
import { CrmLawError } from '@/lib/crm/crm';
import { intakeFormOf, questionsOf, rekeyQuestions, type FormQuestion, type IntakeForm } from '@/lib/crm/forms';
import { putFormBody } from '@/lib/crm/formWrites';
import { validationOf } from '@/lib/crm/contactWrites';
import { SLUG_TAKEN_WORDS } from '@/lib/crm/formWords';

export const dynamic = 'force-dynamic';

const INVALID_JSON = Symbol('invalid json');
const invalidJson = () => NextResponse.json({ error: 'Validation', field: 'body', message: 'Invalid JSON body' }, { status: 400 });

/** The body's questions refused by the form's rules (an id it does not hold, one given twice) — a 400 on the field, not a data error. */
class QuestionsRefused extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'QuestionsRefused';
  }
}

/** A unique violation on the slug's key — Prisma names the columns of the index that refused the write. */
const isSlugTaken = (error: unknown): boolean =>
  error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002' && Array.isArray(error.meta?.target) && (error.meta.target as unknown[]).includes('slug');

export async function PUT(request: Request) {
  try {
    const userEmail = await getVerifiedEmail();
    if (!userEmail) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const user = await prisma.users.findFirst({ where: { email: { equals: userEmail, mode: 'insensitive' } } });
    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

    const json: unknown = await request.json().catch(() => INVALID_JSON);
    if (json === INVALID_JSON) return invalidJson();
    const parsed = putFormBody.safeParse(json);
    if (!parsed.success) return NextResponse.json(validationOf(parsed.error), { status: 400 });
    const d = parsed.data;
    // An empty line is no line (the column is nullable; crm_forms_line_chk refuses a blank one).
    const line = d.line === null || d.line === '' ? null : d.line;
    // The server's instant, once. Nothing from the client names a time or an id.
    const now = new Date();
    const saved: IntakeForm = await prisma.$transaction(async (tx) => {
      const found = await tx.crm_forms.findUnique({ where: { user_id: user.id }, select: { id: true, questions: true } });
      let questions: FormQuestion[];
      try {
        questions = rekeyQuestions(found === null ? [] : questionsOf(found.questions), d.questions, randomUUID);
      } catch (error) {
        if (error instanceof CrmLawError) throw new QuestionsRefused(error.message);
        throw error;
      }
      const data = { slug: d.slug, title: d.title, line, questions: questions as unknown as Prisma.InputJsonValue, updated_at: now };
      const select = { id: true, slug: true, title: true, line: true, questions: true } as const;
      const row = found !== null
        ? await tx.crm_forms.update({ where: { id: found.id, user_id: user.id }, data, select })
        : await tx.crm_forms.create({ data: { user_id: user.id, ...data }, select });
      return intakeFormOf(row);
    });
    return NextResponse.json(saved);
  } catch (error) {
    if (error instanceof QuestionsRefused) return NextResponse.json({ error: 'Validation', field: 'questions', message: error.message }, { status: 400 });
    if (isSlugTaken(error)) return NextResponse.json({ error: 'Conflict', field: 'slug', message: SLUG_TAKEN_WORDS }, { status: 409 });
    if (error instanceof CrmLawError) return NextResponse.json({ error: error.message }, { status: 500 });
    return failClosedResponse('CRM form PUT', 'Failed to save the form', error);
  }
}
