import { NextRequest, NextResponse } from 'next/server';
import { failClosedResponse } from '@/lib/http/failClosedResponse';
import { prisma } from '@/lib/prisma';
import { getVerifiedEmail } from '@/lib/cookie-auth';
import { MATCH_REFUND_DATE_WINDOW_DAYS, proposeMatches, proposeRefundMatches, type MatcherRefundEvent, type RefundMatchProposal } from '@/lib/runway/reservationMatcher';
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
//
// MATCH-02 (2026-09-26): A SECOND PASS, REFUNDS. After the outflow pass (untouched
// above), the user's refund money events — through reservations.userId, the guest
// fence — are scored against the user's INFLOWS (amount < 0) by the pure
// proposeRefundMatches, per account currency (accounts.isoCurrencyCode; NULL → the
// amount signal EXCLUDED, named), inflows an accepted link already claims left
// out; the proposals persist with moneyEventId set, status 'proposed'. A human
// accepts in the review route, which settles the money event. Nothing here
// converts a currency, infers a payout, or accepts anything.

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
        // SEC-03: finalPriceCents is nullable — the matcher EXCLUDES the amount
        // signal on NULL and re-normalizes; a 0 is a real amount.
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

    // ─── MATCH-02: THE REFUND PASS — inflows against the refunds the vendor stated ──
    const refundEvents = await prisma.money_events.findMany({
      where: { kind: 'refund', status: 'stated', reservation: { userId: user.id } },
      orderBy: { statedAt: 'asc' },
      select: {
        id: true, reservationId: true, kind: true, status: true, amountCents: true, currency: true, refundDestination: true, statedAt: true,
        reservation: {
          select: {
            provider: true, hotelName: true, displayName: true,
            // The booking's ACCEPTED charge link (moneyEventId null), earliest accept first: its bank descriptor is a refund signal.
            transaction_reservation_links: {
              where: { status: 'accepted', moneyEventId: null },
              orderBy: { reviewedAt: 'asc' },
              take: 1,
              select: { transaction: { select: { name: true } } },
            },
          },
        },
      },
    });
    const refunds = { events: refundEvents.length, candidates: 0, proposed: 0, refreshed: 0, skippedReviewed: 0, contradictions: 0 };
    if (refundEvents.length > 0) {
      const refundInputs: MatcherRefundEvent[] = refundEvents.map((e) => {
        const charge = e.reservation.transaction_reservation_links[0];
        return {
          id: e.id, reservationId: e.reservationId, kind: e.kind, status: e.status, amountCents: e.amountCents, currency: e.currency,
          refundDestination: e.refundDestination, statedAt: e.statedAt,
          provider: e.reservation.provider, hotelName: e.reservation.hotelName, displayName: e.reservation.displayName,
          chargeTransactionName: charge ? charge.transaction.name : null,
        };
      });
      // Inflows dated at or after the earliest statement: a refund cannot land before it is stated.
      const earliestStatedAt = refundEvents[0].statedAt;
      const inflows = await prisma.transactions.findMany({
        where: {
          amount: { lt: 0 },
          date: { gte: earliestStatedAt },
          accounts: { userId: user.id },
        },
        select: {
          id: true, amount: true, date: true, authorized_date: true,
          name: true, merchantName: true, pending: true,
          accounts: { select: { isoCurrencyCode: true } },
        },
      });
      // An inflow an accepted link already claims is one thing already — never a candidate.
      const claimed = new Set(
        (await prisma.transaction_reservation_links.findMany({
          where: { userId: user.id, status: 'accepted', transactionId: { in: inflows.map((t) => t.id) } },
          select: { transactionId: true },
        })).map((l) => l.transactionId),
      );
      // Per account currency — the amount is compared in the account's stated currency, never converted.
      const byCurrency = new Map<string | null, typeof inflows>();
      for (const t of inflows) {
        const key = t.accounts.isoCurrencyCode;
        const group = byCurrency.get(key) ?? [];
        group.push(t);
        byCurrency.set(key, group);
      }
      const refundProposals: RefundMatchProposal[] = [];
      const currencies = [...byCurrency.keys()].sort((a, b) => (a ?? '').localeCompare(b ?? ''));
      for (const accountCurrency of currencies) {
        const out = proposeRefundMatches({
          refunds: refundInputs,
          transactions: byCurrency.get(accountCurrency) ?? [],
          accountCurrency,
          opts: { amountTolerancePct: MATCH_AMOUNT_TOLERANCE_PCT, refundDateWindowDays: MATCH_REFUND_DATE_WINDOW_DAYS },
          excludeTransactionIds: claimed,
        });
        refundProposals.push(...out.proposals);
        refunds.contradictions += out.skipped.length;
      }
      refunds.candidates = refundProposals.length;

      // The same partition as the outflow pass: a reviewed row is never touched.
      const existingRefundRows = await prisma.transaction_reservation_links.findMany({
        where: { userId: user.id, transactionId: { in: refundProposals.map((p) => p.transactionId) } },
        select: { id: true, transactionId: true, reservationId: true, status: true },
      });
      const refundByPair = new Map(existingRefundRows.map((e) => [`${e.transactionId}|${e.reservationId}`, e]));
      const refundCreate: RefundMatchProposal[] = [];
      const refundRefresh: Array<{ id: string; confidence: number; rationale: string }> = [];
      for (const p of refundProposals) {
        const row = refundByPair.get(`${p.transactionId}|${p.reservationId}`);
        if (!row) { refundCreate.push(p); continue; }
        if (row.status === 'proposed') { refundRefresh.push({ id: row.id, confidence: p.confidence, rationale: p.rationale }); continue; }
        refunds.skippedReviewed += 1;
      }
      if (refundCreate.length > 0) {
        await prisma.transaction_reservation_links.createMany({
          data: refundCreate.map((p) => ({
            transactionId: p.transactionId,
            reservationId: p.reservationId,
            moneyEventId: p.moneyEventId,
            userId: user.id,
            status: 'proposed',
            confidence: p.confidence,
            matchRationale: p.rationale,
          })),
          skipDuplicates: true,
        });
      }
      for (const r of refundRefresh) {
        await prisma.transaction_reservation_links.updateMany({
          where: { id: r.id, status: 'proposed' },
          data: { confidence: r.confidence, matchRationale: r.rationale },
        });
      }
      refunds.proposed = refundCreate.length;
      refunds.refreshed = refundRefresh.length;
    }

    return NextResponse.json({
      reservations: reservations.length,
      candidates: proposals.length,
      proposed: toCreate.length,
      refreshed: toRefresh.length,
      skippedReviewed,
      // MATCH-02: the refund pass, counted apart.
      refunds,
    });
  } catch (err) {
    if (err instanceof RateLimitError) {
      return NextResponse.json(
        { error: 'Too many match runs — please wait a moment.' },
        { status: 429, headers: { 'Retry-After': String(err.retryAfterSeconds) } }
      );
    }
    // Includes the MATCH-0-table-missing case (P2021) — declared, never hidden.
    return failClosedResponse('Runway match propose', 'Match proposal run failed', err);
  }
}
