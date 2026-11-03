/**
 * /api/operations/stays/costs — every stay of the caller, CALCULATED against the living baseline (TRAVEL-02c, Alex,
 * 2026-11-03, rulings C and D).
 *
 * GET → { stays, baselines }: every stay of the caller, first day first, each with its figures as the pure leaf
 *       computes them (src/lib/operations/stayCosts.ts stayCostsOf — DAYS, CHARGES, TOTAL, PER DAY, BY ACCOUNT, the
 *       baseline in force on its first day, FOR THE STAY, UNDER / OVER, each figure with its formula) and its lines —
 *       the postings linked to it by hand (planned_item_links kind 'stay', the one link rule; LINK-LAW-01's one writer is
 *       src/app/api/calendar/links/route.ts), each read through postingAmount.ts BILL_POSTING_SELECT (every line with its
 *       chart account) and the posting's state (LINKED_POSTING_SELECT's three columns — a reversed posting pays
 *       nothing); and every living baseline of the caller, voided included and marked (stayCosts.ts baselineViewsOf).
 *       A 200 always carries both lists (TRAVEL-02b-fix's rule: a list that is empty stays a list).
 *
 * The caller's own rows only: the verified cookie, then the user, then every read by user_id (the link, its posting
 * and the stay alike). Read-only; no paid call, no vendor call.
 */

import { NextResponse } from 'next/server';
import { failClosedResponse } from '@/lib/http/failClosedResponse';
import { prisma } from '@/lib/prisma';
import { getVerifiedEmail } from '@/lib/cookie-auth';
import { BILL_POSTING_SELECT } from '@/lib/calendar/postingAmount';
import { stayRowOf } from '@/lib/operations/stay';
import { LIVING_BASELINE_SELECT, baselineViewsOf, livingBaselineRowOf, stayCostsOf, type StayPostingIn } from '@/lib/operations/stayCosts';

/** A linked posting as the leaf reads it: its day and words, and BILL_POSTING_SELECT — the lines with their account, and the state. */
const POSTING_SELECT = { id: true, date: true, description: true, ...BILL_POSTING_SELECT } as const;

export async function GET() {
  try {
    const userEmail = await getVerifiedEmail();
    if (!userEmail) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const user = await prisma.users.findFirst({ where: { email: { equals: userEmail, mode: 'insensitive' } }, select: { id: true } });
    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

    const rows = await prisma.operations_stays.findMany({ where: { user_id: user.id }, orderBy: { starts_on: 'asc' } });
    const stays = rows.map(stayRowOf);
    const [links, baselineRows] = await Promise.all([
      prisma.planned_item_links.findMany({
        where: { user_id: user.id, target_kind: 'stay', target_id: { in: stays.map((s) => s.id) }, journal_entry: { userId: user.id } },
        orderBy: { linked_at: 'asc' },
        select: { target_id: true, journal_entry: { select: POSTING_SELECT } },
      }),
      prisma.living_baselines.findMany({ where: { user_id: user.id }, select: LIVING_BASELINE_SELECT }),
    ]);

    const postingsOf = new Map<string, StayPostingIn[]>();
    for (const l of links) {
      const list = postingsOf.get(l.target_id);
      if (list === undefined) postingsOf.set(l.target_id, [l.journal_entry]);
      else list.push(l.journal_entry);
    }
    const baselines = baselineRows.map(livingBaselineRowOf);

    return NextResponse.json({ stays: stayCostsOf(stays, postingsOf, baselines), baselines: baselineViewsOf(baselines) });
  } catch (error) {
    return failClosedResponse('Stay costs GET', 'Failed to calculate the stays', error);
  }
}
