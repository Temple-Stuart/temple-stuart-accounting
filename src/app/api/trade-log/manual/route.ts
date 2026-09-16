import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getVerifiedEmail } from '@/lib/cookie-auth';
import { AVAILABLE_STRATEGIES } from '@/lib/convergence/filter-types';
import { buildManualTrade, manualTradeNum, type ManualTradeInput } from '@/lib/tradeLog/manualTrade';
import { MANUAL_SOURCE } from '@/lib/tradeLog/ownership';

/**
 * TRADE-LOG-01 — the ONE writer of a hand-entered trade.
 *
 * POST   log a trade (open or closed), one trading_positions row per leg under
 *        one trade_num, source='manual', userId=the caller.
 * GET    read one back in the FORM's own shape, so a correction starts from
 *        what is stored and never from a retyped guess.
 * PATCH  correct one — the owner re-states the trade and the legs are replaced.
 * DELETE remove one — refused, with the reason, if a trade card is linked to it.
 *
 * USER-SCOPED THROUGHOUT. Every read and every write carries `userId` AND
 * `source='manual'`: a synced row is the broker's record and this route will
 * not touch it, and another user's row is not found (a defensive 404 — the
 * repo's rule is never to confirm that someone else's record exists).
 *
 * The arithmetic is not here: src/lib/tradeLog/manualTrade.ts builds the rows
 * from src/lib/tradeLog/optionPnl.ts, the same functions
 * position-tracker-service.ts calls on a synced close.
 */

async function caller() {
  const email = await getVerifiedEmail();
  if (!email) return null;
  return prisma.users.findFirst({ where: { email: { equals: email, mode: 'insensitive' } }, select: { id: true } });
}

/**
 * The next trade number for this user, across BOTH shapes — the arrivals'
 * `investment_transactions.tradeNum` and this user's own hand-entered
 * `trading_positions.trade_num`. Parsed the way max-trade-num/route.ts:6-11
 * parses them, so "42" and "OKTA-0042" both count.
 */
function numberOf(tradeNum: string): number {
  const m = tradeNum.match(/-(\d+)$/);
  if (m) return parseInt(m[1], 10);
  const n = parseInt(tradeNum, 10);
  return Number.isNaN(n) ? 0 : n;
}

async function nextTradeNumber(userId: string): Promise<number> {
  const [arrivals, manual] = await Promise.all([
    prisma.investment_transactions.findMany({
      where: { tradeNum: { not: null }, accounts: { userId } },
      select: { tradeNum: true },
      distinct: ['tradeNum'],
    }),
    prisma.trading_positions.findMany({
      where: { userId, trade_num: { not: null } },
      select: { trade_num: true },
      distinct: ['trade_num'],
    }),
  ]);
  let max = 0;
  for (const a of arrivals) if (a.tradeNum) max = Math.max(max, numberOf(a.tradeNum));
  for (const m of manual) if (m.trade_num) max = Math.max(max, numberOf(m.trade_num));
  return max + 1;
}

export async function POST(request: NextRequest) {
  const user = await caller();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let input: ManualTradeInput;
  try {
    input = (await request.json()) as ManualTradeInput;
  } catch {
    return NextResponse.json({ error: 'A JSON body is required.' }, { status: 400 });
  }

  const tradeNum = manualTradeNum(input?.symbol ?? 'TRADE', await nextTradeNumber(user.id));
  const built = buildManualTrade(input, user.id, tradeNum, AVAILABLE_STRATEGIES);
  if (!built.ok) return NextResponse.json({ error: built.reason }, { status: 400 });

  await prisma.trading_positions.createMany({ data: built.rows });

  return NextResponse.json({
    trade_num: tradeNum,
    legs: built.rows.length,
    status: built.closed ? 'CLOSED' : 'OPEN',
    realized_pl: built.realizedPl,
    source: MANUAL_SOURCE,
  }, { status: 201 });
}

/**
 * GET /api/trade-log/manual?trade_num=X — the caller's OWN hand-entered trade,
 * in the shape the form submits, so "correct this trade" opens on the stored
 * values. A synced trade is not returned: it is the broker's record and is not
 * editable here. Another user's trade is simply not found.
 */
export async function GET(request: NextRequest) {
  const user = await caller();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const tradeNum = (new URL(request.url).searchParams.get('trade_num') ?? '').trim();
  if (!tradeNum) return NextResponse.json({ error: 'trade_num is required.' }, { status: 400 });

  const legs = await prisma.trading_positions.findMany({
    where: { trade_num: tradeNum, userId: user.id, source: MANUAL_SOURCE },
    orderBy: { id: 'asc' },
  });
  if (legs.length === 0) {
    return NextResponse.json({ error: 'No hand-entered trade with that number.' }, { status: 404 });
  }

  const day = (d: Date | null) => (d ? d.toISOString().slice(0, 10) : null);
  const first = legs[0];
  const closeDates = legs.map((l) => l.close_date).filter((d): d is Date => d instanceof Date);

  return NextResponse.json({
    trade_num: tradeNum,
    symbol: first.symbol,
    strategy: first.strategy ?? '',
    openDate: day(first.open_date),
    closeDate: legs.every((l) => l.status === 'CLOSED') && closeDates.length > 0 ? day(closeDates[0]) : null,
    source: MANUAL_SOURCE,
    legs: legs.map((l) => ({
      // position_type is what the row stores; the form speaks in the action
      // that produced it — LONG came from a buy, SHORT from a sell
      // (optionPnl.ts positionTypeOf).
      side: l.position_type === 'LONG' ? 'buy' : 'sell',
      optionType: l.option_type,
      strike: l.strike_price,
      expiry: day(l.expiration_date),
      quantity: l.quantity,
      openPrice: l.open_price,
      openFees: l.open_fees,
      closePrice: l.close_price,
      closeFees: l.close_fees,
    })),
  });
}

export async function PATCH(request: NextRequest) {
  const user = await caller();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let body: ManualTradeInput & { trade_num?: string };
  try {
    body = (await request.json()) as ManualTradeInput & { trade_num?: string };
  } catch {
    return NextResponse.json({ error: 'A JSON body is required.' }, { status: 400 });
  }
  const tradeNum = (body?.trade_num ?? '').trim();
  if (!tradeNum) return NextResponse.json({ error: 'trade_num is required.' }, { status: 400 });

  // The owner's own hand-entered legs only. A synced row is the broker's record
  // and is not editable here; another user's row is simply not found.
  const existing = await prisma.trading_positions.findMany({
    where: { trade_num: tradeNum, userId: user.id, source: MANUAL_SOURCE },
    select: { id: true },
  });
  if (existing.length === 0) {
    return NextResponse.json({ error: 'No hand-entered trade with that number.' }, { status: 404 });
  }

  const built = buildManualTrade(body, user.id, tradeNum, AVAILABLE_STRATEGIES);
  if (!built.ok) return NextResponse.json({ error: built.reason }, { status: 400 });

  // A correction re-states the trade: the old legs go, the new legs land, in one
  // transaction so the trade is never half-corrected.
  await prisma.$transaction([
    prisma.trading_positions.deleteMany({ where: { trade_num: tradeNum, userId: user.id, source: MANUAL_SOURCE } }),
    prisma.trading_positions.createMany({ data: built.rows }),
  ]);

  return NextResponse.json({
    trade_num: tradeNum,
    legs: built.rows.length,
    status: built.closed ? 'CLOSED' : 'OPEN',
    realized_pl: built.realizedPl,
    source: MANUAL_SOURCE,
  });
}

export async function DELETE(request: NextRequest) {
  const user = await caller();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const tradeNum = (new URL(request.url).searchParams.get('trade_num') ?? '').trim();
  if (!tradeNum) return NextResponse.json({ error: 'trade_num is required.' }, { status: 400 });

  const existing = await prisma.trading_positions.findMany({
    where: { trade_num: tradeNum, userId: user.id, source: MANUAL_SOURCE },
    select: { id: true },
  });
  if (existing.length === 0) {
    return NextResponse.json({ error: 'No hand-entered trade with that number.' }, { status: 404 });
  }

  // NEVER a silent cascade. A trade card linked to this trade holds its grade
  // and its actual P&L; deleting the trade under it would leave the card
  // pointing at nothing. The link is named and the caller decides.
  const link = await prisma.trade_card_links.findFirst({
    where: { trade_num: tradeNum, trade_card: { userId: user.id } },
    select: { id: true, trade_card_id: true },
  });
  if (link) {
    return NextResponse.json({
      error: `Trade ${tradeNum} is linked to a trade card and was not deleted. Unlink the card first — deleting the trade under it would leave the card's grade pointing at nothing.`,
      linked_card_id: link.trade_card_id,
    }, { status: 409 });
  }

  const removed = await prisma.trading_positions.deleteMany({
    where: { trade_num: tradeNum, userId: user.id, source: MANUAL_SOURCE },
  });

  return NextResponse.json({ trade_num: tradeNum, deleted: removed.count });
}
