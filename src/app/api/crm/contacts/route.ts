/**
 * PATCH + POST /api/crm/contacts — THE CRM'S TWO WRITES (CRM-01b, Alex, 2026-11-07, ruling A).
 *
 * The caller first, exactly the GET's order (src/app/api/crm/route.ts:28-33): a verified cookie or 401, the user or 404
 * — before any other read — then isAdminUser (src/lib/admin.ts:31; an unset ADMIN_USER_ID is an AdminConfigError,
 * answered 500 with its words, the GET's catch). Not in PUBLIC_PATHS. No paid call. Every query user-scoped: a write
 * names its row WHERE user_id = the caller's, or creates it with user_id = the caller's — the ownership law (SEC-02) reads
 * exactly that and needs no list entry for this file.
 *
 *   PATCH { key, stage?, next_step? } — the row named by a ContactRow.key (crm.ts contactKeyOf), the body's shape
 *     src/lib/crm/contactWrites.ts (400 with the field on a miss). Whose row:
 *       · 'proposal:<id>' | 'signup:<id>' — only the platform owner has these contacts: anyone else → 404 (never 403 —
 *         the row's existence is not confirmed). The owner's source row must exist (proposals / users by id, the users
 *         row not the caller's own) → else 404. Then the working row on the partial unique key (user_id, source,
 *         source_ref) — Prisma cannot name a partial index, so: findFirst, then update or create, inside ONE
 *         $transaction, both carrying user_id = the caller's.
 *       · 'manual:<id>' — updateMany WHERE id AND user_id = the caller's; count 0 → 404.
 *       · 'form:<submission id>' — CRM-02 (Alex, 2026-11-07, CLOSED 4): the submission must be the caller's
 *         (crm_form_submissions.findFirst { id, user_id }) → else 404, never 403; then the working row on the partial
 *         key, exactly as a proposal's or a signup's.
 *     last_touch_at = the server's now on every PATCH that changes something, updated_at the same instant; a PATCH that
 *     changes nothing (the same stage, the same next step — or 'new' and no next step on an untouched contact) writes
 *     no row. Nothing from the client names the time. Answers { ok: true, key }; the page re-reads GET /api/crm after.
 *   POST { name, business?, email } — a contact typed by hand: crm_contacts.create { user_id: the caller's, source
 *     'manual', source_ref null, name, business (absent or empty → null), email, stage 'new', last_touch_at null }.
 *     Answers { ok: true, key: 'manual:<id>' }. crm_contacts_manual_chk is the database's own guard; this route never
 *     relies on it to validate — the body's shape does.
 *
 * Reads only its own tables: proposals and users by id (existence), crm_contacts by the caller. Never reads
 * proposals.status or owner_notes; never backfills them (ruling E — the carry-over is Alex's one psql INSERT).
 */
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getVerifiedEmail } from '@/lib/cookie-auth';
import { AdminConfigError, isAdminUser } from '@/lib/admin';
import { failClosedResponse } from '@/lib/http/failClosedResponse';
import { isValidUuid } from '@/lib/operations/parseUuid';
import { CrmLawError, contactKeyOf, type CrmStage } from '@/lib/crm/crm';
import { patchContactBody, postContactBody, validationOf, type PatchContactBody } from '@/lib/crm/contactWrites';

export const dynamic = 'force-dynamic';

const INVALID_JSON = Symbol('invalid json');
const notFound = () => NextResponse.json({ error: 'Not found' }, { status: 404 });
const invalidJson = () => NextResponse.json({ error: 'Validation', field: 'body', message: 'Invalid JSON body' }, { status: 400 });

/** What a contact nobody has touched reads as (CRM-01a ruling E): no working row, stage new, no next step. */
const UNTOUCHED = { stage: 'new', next_step: null } as const;

/** The fields a PATCH changes against what the row holds — nothing changed is null, and no row is written. */
function changesOf(current: { readonly stage: string; readonly next_step: string | null }, d: PatchContactBody): { stage?: CrmStage; next_step?: string | null } | null {
  const out: { stage?: CrmStage; next_step?: string | null } = {};
  if (d.stage !== undefined && d.stage !== current.stage) out.stage = d.stage;
  if (d.next_step !== undefined && d.next_step !== current.next_step) out.next_step = d.next_step;
  return Object.keys(out).length === 0 ? null : out;
}

export async function PATCH(request: Request) {
  try {
    const userEmail = await getVerifiedEmail();
    if (!userEmail) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const user = await prisma.users.findFirst({ where: { email: { equals: userEmail, mode: 'insensitive' } } });
    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });
    const owner = isAdminUser(user.id);

    const json: unknown = await request.json().catch(() => INVALID_JSON);
    if (json === INVALID_JSON) return invalidJson();
    const parsed = patchContactBody.safeParse(json);
    if (!parsed.success) return NextResponse.json(validationOf(parsed.error), { status: 400 });
    const d = parsed.data;
    let named: ReturnType<typeof contactKeyOf>;
    try {
      named = contactKeyOf(d.key);
    } catch (e) {
      if (e instanceof CrmLawError) return NextResponse.json({ error: 'Validation', field: 'key', message: e.message }, { status: 400 });
      throw e;
    }
    // The server's instant, once — the touch and the update share it. Nothing from the client names a time.
    const now = new Date();

    if (named.source === 'manual') {
      // A working row's id is a UUID; any other string names no row of anyone's.
      if (!isValidUuid(named.ref)) return notFound();
      const found = await prisma.crm_contacts.findFirst({ where: { id: named.ref, user_id: user.id }, select: { stage: true, next_step: true } });
      if (!found) return notFound();
      const changed = changesOf(found, d);
      if (changed === null) return NextResponse.json({ ok: true, key: d.key });
      const { count } = await prisma.crm_contacts.updateMany({ where: { id: named.ref, user_id: user.id }, data: { ...changed, last_touch_at: now, updated_at: now } });
      if (count === 0) return notFound();
      return NextResponse.json({ ok: true, key: d.key });
    }

    if (named.source === 'form') {
      // CRM-02: a submission is the form owner's — read by { id, user_id } → else 404, never 403.
      if (!isValidUuid(named.ref)) return notFound();
      const submission = await prisma.crm_form_submissions.findFirst({ where: { id: named.ref, user_id: user.id }, select: { id: true } });
      if (!submission) return notFound();
    } else {
      // 'proposal' | 'signup' — the platform owner's contacts. Anyone else has none: 404, never 403.
      if (!owner) return notFound();
      if (named.source === 'proposal') {
        if (!isValidUuid(named.ref)) return notFound();
        const proposal = await prisma.proposals.findUnique({ where: { id: named.ref }, select: { id: true } });
        if (!proposal) return notFound();
      } else {
        if (named.ref === user.id) return notFound(); // the caller is no contact of their own
        const signup = await prisma.users.findUnique({ where: { id: named.ref }, select: { id: true } });
        if (!signup) return notFound();
      }
    }
    await prisma.$transaction(async (tx) => {
      const found = await tx.crm_contacts.findFirst({
        where: { user_id: user.id, source: named.source, source_ref: named.ref },
        select: { id: true, stage: true, next_step: true },
      });
      const changed = changesOf(found === null ? UNTOUCHED : found, d);
      if (changed === null) return;
      if (found !== null) {
        await tx.crm_contacts.update({ where: { id: found.id, user_id: user.id }, data: { ...changed, last_touch_at: now, updated_at: now } });
      } else {
        await tx.crm_contacts.create({
          data: { user_id: user.id, source: named.source, source_ref: named.ref, stage: changed.stage ?? UNTOUCHED.stage, next_step: changed.next_step ?? UNTOUCHED.next_step, last_touch_at: now, updated_at: now },
        });
      }
    });
    return NextResponse.json({ ok: true, key: d.key });
  } catch (error) {
    if (error instanceof AdminConfigError || error instanceof CrmLawError) return NextResponse.json({ error: error.message }, { status: 500 });
    return failClosedResponse('CRM contacts PATCH', 'Failed to save the contact', error);
  }
}

export async function POST(request: Request) {
  try {
    const userEmail = await getVerifiedEmail();
    if (!userEmail) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const user = await prisma.users.findFirst({ where: { email: { equals: userEmail, mode: 'insensitive' } } });
    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

    const json: unknown = await request.json().catch(() => INVALID_JSON);
    if (json === INVALID_JSON) return invalidJson();
    const parsed = postContactBody.safeParse(json);
    if (!parsed.success) return NextResponse.json(validationOf(parsed.error), { status: 400 });
    const d = parsed.data;
    // "business ≤ 5000 or absent": an empty box is no business (the column is nullable; the CHECK asks only name and email).
    const business = d.business === undefined || d.business === '' ? null : d.business;
    const now = new Date();
    const row = await prisma.crm_contacts.create({
      data: { user_id: user.id, source: 'manual', source_ref: null, name: d.name, business, email: d.email, stage: 'new', next_step: null, last_touch_at: null, updated_at: now },
      select: { id: true },
    });
    return NextResponse.json({ ok: true, key: `manual:${row.id}` });
  } catch (error) {
    if (error instanceof AdminConfigError || error instanceof CrmLawError) return NextResponse.json({ error: error.message }, { status: 500 });
    return failClosedResponse('CRM contacts POST', 'Failed to add the contact', error);
  }
}
