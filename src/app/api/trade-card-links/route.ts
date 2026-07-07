import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getVerifiedEmail } from '@/lib/cookie-auth';

/**
 * SEC-2: the user's investment_transaction ids — the ownership handle for
 * trading_positions, which has no userId. Positions are the user's only when
 * their open_investment_txn_id is in this set (open_investment_txn_id →
 * investment_transactions.accounts.userId). Same two-step scope as
 * trading/coverage/route.ts:38-50.
 */
async function getUserTxnIds(userId: string): Promise<string[]> {
  const txns = await prisma.investment_transactions.findMany({
    where: { accounts: { userId } },
    select: { id: true },
  });
  return txns.map((t) => t.id);
}

/**
 * POST /api/trade-card-links — Link a trade card to a trading position
 */
export async function POST(request: NextRequest) {
  try {
    const userEmail = await getVerifiedEmail();
    if (!userEmail) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const user = await prisma.users.findFirst({
      where: { email: { equals: userEmail, mode: 'insensitive' } }
    });
    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

    const { trade_card_id, trade_num } = await request.json();
    if (!trade_card_id || !trade_num) {
      return NextResponse.json({ error: 'Required: trade_card_id, trade_num' }, { status: 400 });
    }

    // Verify card ownership and status
    const card = await prisma.trade_cards.findFirst({
      where: { id: trade_card_id, userId: user.id },
    });
    if (!card) {
      return NextResponse.json({ error: 'Trade card not found' }, { status: 404 });
    }
    if (card.status !== 'queued' && card.status !== 'entered') {
      return NextResponse.json(
        { error: `Card is already ${card.status}. Unlink first to re-link.` },
        { status: 400 }
      );
    }

    // SEC-2: only ever read the user's OWN positions. Scope the trade_num
    // lookup through the ownership chain — a cross-user (or unknown) trade_num
    // resolves to zero owned positions → defensive 404, no link created, and
    // no other user's cost_basis/realized_pl is ever read.
    const userTxnIds = await getUserTxnIds(user.id);
    const positions = await prisma.trading_positions.findMany({
      where: { trade_num, open_investment_txn_id: { in: userTxnIds } },
    });
    if (positions.length === 0) {
      return NextResponse.json({ error: 'No matching position found' }, { status: 404 });
    }

    // Compute entry as average open_price across the user's own position legs
    const totalCost = positions.reduce((sum, p) => sum + Math.abs(p.cost_basis), 0);
    let actualEntryPrice: number | null = totalCost / positions.length;
    let actualExitPrice: number | null = null;
    let actualPl: number | null = null;
    let grade: string | null = null;

    // Check if position is closed — if so, compute grade
    const allClosed = positions.every(p => p.status === 'CLOSED');
    if (allClosed) {
      const totalPl = positions.reduce((sum, p) => sum + (p.realized_pl ?? 0), 0);
      actualPl = totalPl;
      const totalProceeds = positions.reduce((sum, p) => sum + (p.proceeds ?? 0), 0);
      actualExitPrice = totalProceeds / positions.length;
      grade = computeGrade(actualPl, Number(card.max_profit), Number(card.max_loss));
    }

    // Create the link in a transaction
    const [link] = await prisma.$transaction([
      prisma.trade_card_links.create({
        data: {
          trade_card_id,
          trade_num,
          actual_entry_price: actualEntryPrice,
          actual_exit_price: actualExitPrice,
          actual_pl: actualPl,
          grade,
        },
      }),
      prisma.trade_cards.update({
        where: { id: trade_card_id },
        data: { status: grade ? 'graded' : 'linked' },
      }),
    ]);

    return NextResponse.json({ success: true, link });
  } catch (error) {
    console.error('Trade card link error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to link trade card' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/trade-card-links — Unlink a trade card from a position
 */
export async function DELETE(request: NextRequest) {
  try {
    const userEmail = await getVerifiedEmail();
    if (!userEmail) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const user = await prisma.users.findFirst({
      where: { email: { equals: userEmail, mode: 'insensitive' } }
    });
    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

    const { id } = await request.json();
    if (!id) return NextResponse.json({ error: 'Required: id (link id)' }, { status: 400 });

    // Verify ownership through the trade_card relationship
    const link = await prisma.trade_card_links.findFirst({
      where: { id },
      include: { trade_card: true },
    });
    if (!link || link.trade_card.userId !== user.id) {
      return NextResponse.json({ error: 'Link not found' }, { status: 404 });
    }

    await prisma.$transaction([
      prisma.trade_card_links.delete({ where: { id } }),
      prisma.trade_cards.update({
        where: { id: link.trade_card_id },
        data: { status: 'queued' },
      }),
    ]);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Trade card unlink error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to unlink trade card' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/trade-card-links?trade_card_id=X — Grade a linked card
 * Also: GET /api/trade-card-links?positions_for=SYMBOL&after=ISO_DATE
 *   — Get matchable positions for linking
 */
export async function GET(request: NextRequest) {
  try {
    const userEmail = await getVerifiedEmail();
    if (!userEmail) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const user = await prisma.users.findFirst({
      where: { email: { equals: userEmail, mode: 'insensitive' } }
    });
    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

    const params = request.nextUrl.searchParams;

    // Mode 1: Get matchable positions for a symbol
    const positionsFor = params.get('positions_for');
    if (positionsFor) {
      const afterDate = params.get('after');

      // SEC-2: scope both reads to the user. Links are the user's via their
      // trade_cards; positions are the user's via the txn-id ownership chain.
      const userTxnIds = await getUserTxnIds(user.id);

      // Get the user's own already-linked trade_nums (was: ALL users' links)
      const existingLinks = await prisma.trade_card_links.findMany({
        where: { trade_card: { userId: user.id } },
        select: { trade_num: true },
      });
      const linkedTradeNums = new Set(existingLinks.map(l => l.trade_num));

      // Find the USER'S positions matching symbol, opened after card generation
      const where: Record<string, unknown> = {
        symbol: { contains: positionsFor.toUpperCase(), mode: 'insensitive' },
        trade_num: { not: null },
        open_investment_txn_id: { in: userTxnIds },
      };
      if (afterDate) {
        where.open_date = { gte: new Date(afterDate) };
      }

      const positions = await prisma.trading_positions.findMany({
        where,
        orderBy: { open_date: 'desc' },
        distinct: ['trade_num'],
      });

      // Filter out already-linked trade_nums and group by trade_num
      const matchable = positions
        .filter(p => p.trade_num && !linkedTradeNums.has(p.trade_num))
        .map(p => ({
          trade_num: p.trade_num!,
          symbol: p.symbol,
          strategy: p.strategy,
          open_date: p.open_date,
          status: p.status,
          option_type: p.option_type,
          strike_price: p.strike_price,
          expiration_date: p.expiration_date,
        }));

      return NextResponse.json({ positions: matchable });
    }

    // Mode 2: Re-grade a specific linked card
    const tradeCardId = params.get('trade_card_id');
    if (tradeCardId) {
      const card = await prisma.trade_cards.findFirst({
        where: { id: tradeCardId, userId: user.id },
        include: { link: true },
      });
      if (!card || !card.link) {
        return NextResponse.json({ error: 'Linked card not found' }, { status: 404 });
      }

      // SEC-2: scope to the user's own legs so a trade_num collision cannot
      // sum another user's realized_pl/proceeds into this user's grade.
      const userTxnIds = await getUserTxnIds(user.id);
      const positions = await prisma.trading_positions.findMany({
        where: { trade_num: card.link.trade_num, open_investment_txn_id: { in: userTxnIds } },
      });

      const allClosed = positions.length > 0 && positions.every(p => p.status === 'CLOSED');
      if (!allClosed) {
        return NextResponse.json({
          graded: false,
          message: 'Position is still open — grade will be computed when it closes.',
          link: card.link,
        });
      }

      const totalPl = positions.reduce((sum, p) => sum + (p.realized_pl ?? 0), 0);
      const totalProceeds = positions.reduce((sum, p) => sum + (p.proceeds ?? 0), 0);
      const grade = computeGrade(totalPl, Number(card.max_profit), Number(card.max_loss));

      // Update the link with grade data
      const updated = await prisma.trade_card_links.update({
        where: { id: card.link.id },
        data: {
          actual_pl: totalPl,
          actual_exit_price: totalProceeds / positions.length,
          grade,
        },
      });

      // Update card status to graded
      await prisma.trade_cards.update({
        where: { id: card.id },
        data: { status: 'graded' },
      });

      return NextResponse.json({ graded: true, link: updated, grade });
    }

    return NextResponse.json({ error: 'Required: positions_for or trade_card_id parameter' }, { status: 400 });
  } catch (error) {
    console.error('Trade card links GET error:', error);
    return NextResponse.json({ error: 'Failed to process request' }, { status: 500 });
  }
}

/**
 * Compute a grade based on actual P&L vs predicted max profit/loss
 */
function computeGrade(actualPl: number, maxProfit: number | null, maxLoss: number | null): string {
  if (maxProfit == null || maxProfit === 0) {
    // No max profit prediction — grade on raw P&L
    if (actualPl > 0) return 'B';
    if (actualPl === 0) return 'C';
    return 'D';
  }

  if (actualPl >= maxProfit * 0.75) return 'A';
  if (actualPl >= maxProfit * 0.50) return 'B';
  if (actualPl > 0) return 'C';

  // Losing trade — compare to max loss
  if (maxLoss != null && maxLoss < 0) {
    if (actualPl <= maxLoss * 0.50) return 'F';
  }
  return 'D';
}
