import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getVerifiedEmail } from '@/lib/cookie-auth';
import { requireTabAccess } from '@/lib/auth-helpers';

/**
 * RISK-1 — GET /api/trading/coverage
 *
 * Read-only coverage declaration for the Trade tab. Every number is computed from
 * the DB and traceable to a query — NO external APIs, NO estimates. If the user has
 * zero data, returns zeros with null dates (the true state, not a fallback).
 *
 * Ownership scoping (trading_positions has no userId — two-step, same pattern as
 * commit-to-ledger/route.ts:92-97): investment_transactions.accounts.userId scopes the
 * txns; positions are then filtered by open_investment_txn_id IN the user's txn ids.
 */
export async function GET() {
  try {
    // Auth first — 401 before any data read.
    const userEmail = await getVerifiedEmail();
    if (!userEmail) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const user = await prisma.users.findFirst({
      where: { email: { equals: userEmail, mode: 'insensitive' } },
      select: { id: true },
    });
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }
    // TAB-SERVER-GATE: tab:trade entitlement (bundle:all included; admin bypass inside).
    const tabGate = await requireTabAccess(user.id, 'tab:trade');
    if (tabGate) return tabGate;

    // 1. Investment-transaction count + date range (user-scoped via accounts relation).
    const txnAgg = await prisma.investment_transactions.aggregate({
      where: { accounts: { userId: user.id } },
      _count: { _all: true },
      _min: { date: true },
      _max: { date: true },
    });

    // The user's investment_transaction ids — needed to scope positions (no relation).
    const userTxns = await prisma.investment_transactions.findMany({
      where: { accounts: { userId: user.id } },
      select: { id: true },
    });
    const userTxnIds = userTxns.map((t: { id: string }) => t.id);

    // 2. Closed positions owned by the user.
    const closedPositions = userTxnIds.length === 0
      ? []
      : await prisma.trading_positions.findMany({
          where: { status: 'CLOSED', open_investment_txn_id: { in: userTxnIds } },
          select: { trade_num: true },
        });

    // 3. Linked cards (trade_card_links whose card belongs to the user) + their trade_nums.
    const userLinks = await prisma.trade_card_links.findMany({
      where: { trade_card: { userId: user.id } },
      select: { trade_num: true },
    });
    const linkedTradeNums = new Set(userLinks.map((l: { trade_num: string }) => l.trade_num));

    // 4. Unlinked closed positions: closed positions whose trade_num is not linked
    //    (null trade_num is inherently unlinked → counted).
    const unlinkedClosedCount = closedPositions.filter(
      (p: { trade_num: string | null }) => !p.trade_num || !linkedTradeNums.has(p.trade_num),
    ).length;

    return NextResponse.json({
      investment_txn_count: txnAgg._count._all,
      earliest_txn_date: txnAgg._min.date ? txnAgg._min.date.toISOString() : null,
      latest_txn_date: txnAgg._max.date ? txnAgg._max.date.toISOString() : null,
      closed_position_count: closedPositions.length,
      linked_card_count: userLinks.length,
      unlinked_closed_count: unlinkedClosedCount,
      // Source of truth: the hardcoded Plaid investment sync window floor in
      // src/app/api/transactions/sync-complete/route.ts:182 (start_date: '2024-01-01').
      sync_window_start: '2024-01-01',
    });
  } catch (error) {
    console.error('[trading/coverage]', error);
    return NextResponse.json({ error: 'Failed to compute coverage' }, { status: 500 });
  }
}
