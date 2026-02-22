import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getVerifiedEmail } from '@/lib/cookie-auth';

/**
 * POST /api/trade-cards — Save a card to the queue
 */
export async function POST(request: NextRequest) {
  try {
    const userEmail = await getVerifiedEmail();
    if (!userEmail) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const user = await prisma.users.findFirst({
      where: { email: { equals: userEmail, mode: 'insensitive' } }
    });
    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

    const body = await request.json();
    const {
      symbol,
      strategy_name,
      direction,
      legs,
      entry_price,
      max_profit,
      max_loss,
      win_rate,
      risk_reward,
      thesis_points,
      key_stats,
      macro_regime,
      sentiment,
      insider_activity,
      headlines,
      dte,
      expiration_date,
    } = body;

    if (!symbol || !strategy_name || !direction || !legs) {
      return NextResponse.json(
        { error: 'Required: symbol, strategy_name, direction, legs' },
        { status: 400 }
      );
    }

    const card = await prisma.trade_cards.create({
      data: {
        userId: user.id,
        symbol: symbol.toUpperCase(),
        strategy_name,
        direction,
        legs,
        entry_price: entry_price != null ? entry_price : null,
        max_profit: max_profit != null ? max_profit : null,
        max_loss: max_loss != null ? max_loss : null,
        win_rate: win_rate != null ? win_rate : null,
        risk_reward: risk_reward != null ? risk_reward : null,
        thesis_points: thesis_points ?? null,
        key_stats: key_stats ?? null,
        macro_regime: macro_regime ?? null,
        sentiment: sentiment ?? null,
        insider_activity: insider_activity ?? null,
        headlines: headlines ?? null,
        dte: dte != null ? dte : null,
        expiration_date: expiration_date ? new Date(expiration_date) : null,
        status: 'queued',
      },
    });

    return NextResponse.json({ success: true, card });
  } catch (error) {
    console.error('Trade card save error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to save trade card' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/trade-cards?status=queued — Get user's trade cards
 */
export async function GET(request: NextRequest) {
  try {
    const userEmail = await getVerifiedEmail();
    if (!userEmail) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const user = await prisma.users.findFirst({
      where: { email: { equals: userEmail, mode: 'insensitive' } }
    });
    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

    const statusFilter = request.nextUrl.searchParams.get('status');

    const where: Record<string, unknown> = { userId: user.id };
    if (statusFilter) {
      where.status = statusFilter;
    }

    const cards = await prisma.trade_cards.findMany({
      where,
      include: { link: true },
      orderBy: { generated_at: 'desc' },
    });

    return NextResponse.json({ cards });
  } catch (error) {
    console.error('Trade card list error:', error);
    return NextResponse.json({ error: 'Failed to fetch trade cards' }, { status: 500 });
  }
}

/**
 * DELETE /api/trade-cards — Remove a card from queue (by id in body)
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
    if (!id) return NextResponse.json({ error: 'Required: id' }, { status: 400 });

    // Verify ownership and status
    const card = await prisma.trade_cards.findFirst({
      where: { id, userId: user.id },
    });

    if (!card) {
      return NextResponse.json({ error: 'Card not found' }, { status: 404 });
    }

    if (card.status === 'linked' || card.status === 'graded') {
      return NextResponse.json(
        { error: `Cannot delete a ${card.status} card. Unlink it first.` },
        { status: 400 }
      );
    }

    await prisma.trade_cards.delete({ where: { id } });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Trade card delete error:', error);
    return NextResponse.json({ error: 'Failed to delete trade card' }, { status: 500 });
  }
}

/**
 * PATCH /api/trade-cards — Update card status
 */
export async function PATCH(request: NextRequest) {
  try {
    const userEmail = await getVerifiedEmail();
    if (!userEmail) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const user = await prisma.users.findFirst({
      where: { email: { equals: userEmail, mode: 'insensitive' } }
    });
    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

    const { id, status } = await request.json();
    if (!id || !status) {
      return NextResponse.json({ error: 'Required: id, status' }, { status: 400 });
    }

    const validStatuses = ['queued', 'entered', 'linked', 'graded'];
    if (!validStatuses.includes(status)) {
      return NextResponse.json(
        { error: `Invalid status. Must be one of: ${validStatuses.join(', ')}` },
        { status: 400 }
      );
    }

    // Verify ownership
    const card = await prisma.trade_cards.findFirst({
      where: { id, userId: user.id },
    });
    if (!card) {
      return NextResponse.json({ error: 'Card not found' }, { status: 404 });
    }

    const updated = await prisma.trade_cards.update({
      where: { id },
      data: { status },
    });

    return NextResponse.json({ success: true, card: updated });
  } catch (error) {
    console.error('Trade card update error:', error);
    return NextResponse.json({ error: 'Failed to update trade card' }, { status: 500 });
  }
}
