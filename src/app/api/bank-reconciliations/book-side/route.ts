/**
 * GET /api/bank-reconciliations/book-side?accountId=<id>&period=YYYY-MM — THE BOOKS' SIDE OF A MONTH
 * (DOCUMENTS-02, Alex, 2026-10-30, ruling B).
 *
 * The same gate as the reconciliation (a verified cookie 401, the user 404, Books' entitlement 403). Answers
 * { book_balance, as_of, period, words, coa: { code, name, entity_type }, statement } — the GL balance of the
 * chart-of-accounts row the bank account posts to, as of the month's last day, computed by
 * src/lib/books/readBookSide.ts (the one reader the POST uses too) — or that reader's refusal by name: the
 * account not the caller's (404), not a bank account (409), no accountCode (409, the commit route's words),
 * no entity (409), no chart-of-accounts row (409). accounts.currentBalance appears nowhere. No paid call.
 */
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getVerifiedEmail } from '@/lib/cookie-auth';
import { requireTabAccess } from '@/lib/auth-helpers';
import { failClosedResponse } from '@/lib/http/failClosedResponse';
import { periodRule } from '@/lib/books/period';
import { ACCOUNT_REQUIRED_WORDS } from '@/lib/books/reconciliation';
import { readBookSide } from '@/lib/books/readBookSide';

export async function GET(request: NextRequest) {
  try {
    const userEmail = await getVerifiedEmail();
    if (!userEmail) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const user = await prisma.users.findFirst({ where: { email: { equals: userEmail, mode: 'insensitive' } } });
    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });
    const tabGate = await requireTabAccess(user.id, 'tab:books');
    if (tabGate) return tabGate;

    const accountId = (request.nextUrl.searchParams.get('accountId') ?? '').trim();
    if (accountId === '') return NextResponse.json({ error: ACCOUNT_REQUIRED_WORDS }, { status: 400 });
    const period = periodRule(request.nextUrl.searchParams.get('period'));
    if (!period.ok) return NextResponse.json({ error: period.error }, { status: period.status });

    const side = await readBookSide(prisma, user, accountId, period.value);
    if (!side.ok) return NextResponse.json({ error: side.error }, { status: side.status });
    return NextResponse.json({
      book_balance: side.book_balance,
      as_of: side.as_of,
      period: period.value.period,
      words: period.value.words,
      coa: { code: side.coa.code, name: side.coa.name, entity_type: side.coa.entity_type },
      statement: side.statement,
    });
  } catch (error) {
    return failClosedResponse('Bank reconciliation book side GET', 'The book side could not be read', error);
  }
}
