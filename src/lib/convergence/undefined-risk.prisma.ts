/**
 * MODEL-01 STEP 5 — the Prisma loader for the undefined-risk cap: the user's
 * OPEN option positions, scoped through the accounts they own
 * TRADE-LOG-01: trading_positions now HAS a userId, and ownership is the one
 * predicate in src/lib/tradeLog/ownership.ts — the arrivals chain for rows
 * written before it, the column for hand-entered ones.
 */
import { prisma } from '@/lib/prisma';
import { countUndefinedRiskPositions, type OpenOptionPosition } from './undefined-risk';
import { positionOwnershipWhere } from '@/lib/tradeLog/ownership';

export async function countUserOpenUndefinedRiskPositions(userId: string): Promise<number> {
  // TRADE-LOG-01: ownership is one predicate now (src/lib/tradeLog/ownership.ts).
  // A hand-entered OPEN position is a real obligation and counts against the
  // cap exactly like a synced one — the cap is about risk, not provenance.
  const accounts = await prisma.accounts.findMany({ where: { userId }, select: { id: true } });
  const accountIds = accounts.map((a) => a.id);
  const arrivalTxnIds = accountIds.length > 0
    ? (await prisma.investment_transactions.findMany({ where: { accountId: { in: accountIds } }, select: { id: true } })).map((t) => t.id)
    : [];
  const mine = await prisma.trading_positions.findMany({
    where: {
      status: 'OPEN',
      option_type: { not: null },
      ...positionOwnershipWhere(userId, arrivalTxnIds),
    },
    select: { symbol: true, option_type: true, expiration_date: true, position_type: true, status: true },
  });
  return countUndefinedRiskPositions(mine as OpenOptionPosition[]);
}
