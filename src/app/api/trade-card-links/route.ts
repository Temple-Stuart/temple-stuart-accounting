import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getVerifiedEmail } from '@/lib/cookie-auth';

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

    // Find the position and compute actual entry price
    const positions = await prisma.trading_positions.findMany({
      where: { trade_num },
    });

    let actualEntryPrice: number | null = null;
    let actualExitPrice: number | null = null;
    let actualPl: number | null = null;
    let grade: string | null = null;

    if (positions.length > 0) {
      // Compute entry as average open_price across position legs
      const totalCost = positions.reduce((sum, p) => sum + Math.abs(p.cost_basis), 0);
      actualEntryPrice = totalCost / positions.length;

      // Check if position is closed — if so, compute grade
      const allClosed = positions.every(p => p.status === 'CLOSED');
      if (allClosed) {
        const totalPl = positions.reduce((sum, p) => sum + (p.realized_pl ?? 0), 0);
        actualPl = totalPl;
        const totalProceeds = positions.reduce((sum, p) => sum + (p.proceeds ?? 0), 0);
        actualExitPrice = totalProceeds / positions.length;
        grade = computeGrade(actualPl, Number(card.max_profit), Number(card.max_loss));
      }
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

      // Get all trade_nums already linked
      const existingLinks = await prisma.trade_card_links.findMany({
        select: { trade_num: true },
      });
      const linkedTradeNums = new Set(existingLinks.map(l => l.trade_num));

      // Find positions matching symbol, opened after card generation date
      const where: Record<string, unknown> = {
        symbol: { contains: positionsFor.toUpperCase(), mode: 'insensitive' },
        trade_num: { not: null },
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

      const positions = await prisma.trading_positions.findMany({
        where: { trade_num: card.link.trade_num },
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
