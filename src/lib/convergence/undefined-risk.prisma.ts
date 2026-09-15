/**
 * MODEL-01 STEP 5 — the Prisma loader for the undefined-risk cap: the user's
 * OPEN option positions, scoped through the accounts they own
 * (trading_positions has no userId; ownership runs open_investment_txn_id →
 * investment_transactions.accountId → accounts.userId, as
 * src/app/api/trading/route.ts reads them).
 */
import { prisma } from '@/lib/prisma';
import { countUndefinedRiskPositions, type OpenOptionPosition } from './undefined-risk';

export async function countUserOpenUndefinedRiskPositions(userId: string): Promise<number> {
  const open = await prisma.trading_positions.findMany({
    where: { status: 'OPEN', option_type: { not: null } },
    select: { symbol: true, option_type: true, expiration_date: true, position_type: true, status: true, open_investment_txn_id: true },
  });
  if (open.length === 0) return 0;
  const accounts = await prisma.accounts.findMany({ where: { userId }, select: { id: true } });
  const accountIds = accounts.map((a) => a.id);
  if (accountIds.length === 0) return 0;
  const owned = await prisma.investment_transactions.findMany({
    where: { id: { in: open.map((p) => p.open_investment_txn_id) }, accountId: { in: accountIds } },
    select: { id: true },
  });
  const ownedIds = new Set(owned.map((t) => t.id));
  const mine: OpenOptionPosition[] = open.filter((p) => ownedIds.has(p.open_investment_txn_id));
  return countUndefinedRiskPositions(mine);
}
