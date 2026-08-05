import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getVerifiedEmail } from '@/lib/cookie-auth';
import { proposeMatches } from '@/lib/runway/reservationMatcher';
import { rateLimit, RateLimitError } from '@/lib/rateLimit';

// ─── POST /api/runway/match/propose (PR-MATCH-2) ─────────────────────────────
// Runs the MATCH-1 matcher over THIS USER's reservations × bank transactions
// and persists the candidates into transaction_reservation_links as
// status='proposed'. AUTH REQUIRED (the api/runway/route.ts:71-82 pattern) —
// no public path, no guest data:
//   • reservations are loaded WHERE userId = user.id ONLY — the guest fence
//     (guest rows have userId null and never enter matching; MATCH-4 ruling).
//   • transactions are user-scoped through accounts.userId (the review-queue
//     route's scoping, transactions/review-queue/route.ts:23-28).
// IDEMPOTENT, NEVER-DOWNGRADING: an existing (transactionId, reservationId)
// row that a human already ACCEPTED or REJECTED is NEVER touched; only
// still-'proposed' rows get their confidence/rationale refreshed. Proposing
// NEVER links — acceptance is a human act (the review route).
//
// NOTE: this route 500s (loudly, declared) until the MATCH-0 table exists in
// Azure — expected until Alex's psql lands.

// Config points (declared): FX/card drift tolerance + the date window the
// matcher scores against. Env-tunable later if real data demands it.
const MATCH_AMOUNT_TOLERANCE_PCT = 0.05;
const MATCH_DATE_WINDOW_DAYS = 5;
const MS_PER_DAY = 86_400_000;

export async function POST(request: NextRequest) {
  try {
    const userEmail = await getVerifiedEmail();
    if (!userEmail) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const user = await prisma.users.findFirst({
      where: { email: { equals: userEmail, mode: 'insensitive' } },
      select: { id: true },
    });
    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

    // Own bucket, keyed to the USER (authed route — the ip is not the actor).
    await rateLimit(`match-propose:${user.id}`, { limit: 5, windowSeconds: 60 });

    // GUEST FENCE: userId equality — guest reservations (userId null) can
    // never be selected here.
    const reservations = await prisma.reservations.findMany({
      where: { userId: user.id },
      select: {
        id: true, finalPriceCents: true, currency: true, provider: true,
        hotelName: true, createdAt: true, checkinDate: true, checkoutDate: true,
      },
    });
    if (reservations.length === 0) {
      return NextResponse.json({ reservations: 0, candidates: 0, proposed: 0, refreshed: 0, skippedReviewed: 0 });
    }

    // Candidate transactions: house semantics (MATCH-1 STEP 0 — positive =
    // outflow; pending included, the matcher flags it), user-scoped via
    // accounts, and date-bounded to the earliest possible anchor so the scan
    // doesn't read the whole history.
    const earliestAnchor = Math.min(
      ...reservations.map((r) => Math.min(
        r.createdAt.getTime(),
        r.checkinDate?.getTime() ?? Number.POSITIVE_INFINITY,
      )),
    );
    const dateFloor = new Date(earliestAnchor - MATCH_DATE_WINDOW_DAYS * MS_PER_DAY);
    const transactions = await prisma.transactions.findMany({
      where: {
        amount: { gt: 0 },
        date: { gte: dateFloor },
        accounts: { userId: user.id },
      },
      select: {
        id: true, amount: true, date: true, authorized_date: true,
        name: true, merchantName: true, pending: true,
      },
    });

    const proposals = proposeMatches({
      reservations,
      transactions,
      opts: { amountTolerancePct: MATCH_AMOUNT_TOLERANCE_PCT, dateWindowDays: MATCH_DATE_WINDOW_DAYS },
    });

    // Partition against existing lifecycle rows — reviewed rows are untouchable.
    const existing = await prisma.transaction_reservation_links.findMany({
      where: { userId: user.id },
      select: { id: true, transactionId: true, reservationId: true, status: true },
    });
    const byPair = new Map(existing.map((e) => [`${e.transactionId}|${e.reservationId}`, e]));

    const toCreate: typeof proposals = [];
    const toRefresh: Array<{ id: string; confidence: number; rationale: string }> = [];
    let skippedReviewed = 0;
    for (const p of proposals) {
      const row = byPair.get(`${p.transactionId}|${p.reservationId}`);
      if (!row) { toCreate.push(p); continue; }
      if (row.status === 'proposed') { toRefresh.push({ id: row.id, confidence: p.confidence, rationale: p.rationale }); continue; }
      skippedReviewed++; // accepted/rejected — human word stands, NEVER downgraded
    }

    if (toCreate.length > 0) {
      await prisma.transaction_reservation_links.createMany({
        data: toCreate.map((p) => ({
          transactionId: p.transactionId,
          reservationId: p.reservationId,
          userId: user.id,
          status: 'proposed',
          confidence: p.confidence,
          matchRationale: p.rationale,
        })),
        skipDuplicates: true,
      });
    }
    for (const r of toRefresh) {
      // Belt + braces: the status guard in the WHERE means a concurrent review
      // between our read and this write still cannot be overwritten.
      await prisma.transaction_reservation_links.updateMany({
        where: { id: r.id, status: 'proposed' },
        data: { confidence: r.confidence, matchRationale: r.rationale },
      });
    }

    return NextResponse.json({
      reservations: reservations.length,
      candidates: proposals.length,
      proposed: toCreate.length,
      refreshed: toRefresh.length,
      skippedReviewed,
    });
  } catch (err) {
    if (err instanceof RateLimitError) {
      return NextResponse.json(
        { error: 'Too many match runs — please wait a moment.' },
        { status: 429, headers: { 'Retry-After': String(err.retryAfterSeconds) } }
      );
    }
    // Includes the MATCH-0-table-missing case (P2021) — declared, never hidden.
    console.error('[Runway match propose] error:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Match proposal run failed' },
      { status: 500 }
    );
  }
}
