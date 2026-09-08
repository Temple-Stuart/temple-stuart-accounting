import { randomUUID } from 'crypto';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getVerifiedEmail } from '@/lib/cookie-auth';
import { ensureBookkeepingInitialized } from '@/lib/ensure-bookkeeping';
import { requireTabAccess } from '@/lib/auth-helpers';
import { failClosedResponse } from '@/lib/http/failClosedResponse';
import { assertPeriodOpen, PeriodClosedError } from '@/lib/period-close-guard';
import { ValidationError } from '@/lib/errors/ValidationError';
import { planReclassification, postReclassification } from '@/lib/coa/reclassify';
import { postJournal } from '@/lib/posting/postJournal';
import type { ChartAccountRow } from '@/lib/coa/accounts';

/**
 * POST /api/chart-of-accounts/reclassify — COA-01: move a balance from one
 * account to another by POSTING A NEW JOURNAL ENTRY with a memo.
 *
 *   { entityId, fromCode, toCode, memo, amountCents?, date? }
 *
 * The plan is pure (src/lib/coa/reclassify.ts): same entity, same family,
 * target active, memo required, amount within the source balance (omitted →
 * the whole balance); one debit and one credit of the same amount, balance
 * deltas by the rule every writer uses. Posted in one transaction with
 * source_type 'reclass' and the memo in the description and metadata. NO
 * prior entry, line or transaction is edited — the port has no way to.
 * Period-close is enforced like every other posting path; the posting itself
 * is postJournal's (HYG-04).
 *
 * Gate: verified email → user → tab:books → the entity is the user's
 * (defensive 404) → both accounts in that entity (404).
 */

const SELECT = {
  id: true, userId: true, entity_id: true, entity_type: true, code: true, name: true,
  account_type: true, balance_type: true, sub_type: true, module: true, settled_balance: true, is_archived: true,
} as const;

export async function POST(request: Request) {
  try {
    const userEmail = await getVerifiedEmail();
    if (!userEmail) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const user = await prisma.users.findFirst({
      where: { email: { equals: userEmail, mode: 'insensitive' } },
    });
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }
    // TAB-SERVER-GATE: tab:books entitlement (bundle:all included; admin bypass inside).
    const tabGate = await requireTabAccess(user.id, 'tab:books');
    if (tabGate) return tabGate;

    await ensureBookkeepingInitialized(user);

    const body = await request.json().catch(() => ({}));
    const { entityId, fromCode, toCode, memo, amountCents } = body ?? {};

    if (typeof entityId !== 'string' || !entityId) {
      return NextResponse.json({ error: 'entityId is required', field: 'entityId' }, { status: 400 });
    }
    if (typeof fromCode !== 'string' || !fromCode.trim()) {
      return NextResponse.json({ error: 'fromCode is required', field: 'fromCode' }, { status: 400 });
    }
    if (typeof toCode !== 'string' || !toCode.trim()) {
      return NextResponse.json({ error: 'toCode is required', field: 'toCode' }, { status: 400 });
    }
    const date = body?.date === undefined || body?.date === null || body?.date === '' ? new Date() : new Date(String(body.date));
    if (Number.isNaN(date.getTime())) {
      return NextResponse.json({ error: 'date is not a date', field: 'date' }, { status: 400 });
    }

    const entity = await prisma.entities.findFirst({
      where: { id: entityId, userId: user.id },
      select: { id: true, entity_type: true },
    });
    if (!entity) {
      return NextResponse.json({ error: 'Entity not found' }, { status: 404 });
    }

    const load = async (code: string, field: string): Promise<ChartAccountRow> => {
      const digits = code.trim().toUpperCase().replace(/^[PBT]-/, '');
      const r = await prisma.chart_of_accounts.findFirst({ where: { userId: user.id, entity_id: entity.id, code: digits }, select: SELECT });
      if (!r) throw new ValidationError(`no account ${code} in this entity's chart`, { status: 404, field });
      return { ...r, userId: r.userId ?? user.id };
    };
    const from = await load(fromCode, 'fromCode');
    const to = await load(toCode, 'toCode');

    const plan = planReclassification({ from, to, amountCents, memo, date });

    // Period close enforcement — the same guard every posting path calls.
    await assertPeriodOpen(prisma, user.id, entity.id, date);

    // HYG-04: ONE posting discipline — postJournal (SET CONSTRAINTS ALL
    // IMMEDIATE first, the lines in one statement, the id read back after
    // commit); the reclass plan is posted through its `post`.
    const requestId = randomUUID();
    const { result } = await postJournal(prisma, async (_tx, post) =>
      postReclassification({ postEntry: post }, { userId: user.id, entityId: entity.id, requestId, createdBy: userEmail }, plan),
    );

    return NextResponse.json({
      success: true,
      journalEntryId: result.journalEntryId,
      description: plan.description,
      amountCents: plan.amount.toString(),
      lines: plan.lines.map((l) => ({ account_id: l.account_id, entry_type: l.entry_type, amount: l.amount.toString(), balanceDelta: l.balanceDelta.toString() })),
    });
  } catch (error) {
    if (error instanceof PeriodClosedError) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }
    return failClosedResponse('COA reclassify', 'Failed to post the reclassification', error);
  }
}
