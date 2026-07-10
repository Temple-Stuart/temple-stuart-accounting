import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getVerifiedEmail } from '@/lib/cookie-auth';
import { requireTabAccess } from '@/lib/auth-helpers';

/**
 * GET /api/trading/realized-pnl — the SEPARATE Trading panel's data (NOT a runway).
 *
 * Trading is governed by DIFFERENT rules than operating runway: it is excluded from operating
 * burn (see /api/runway TRADING_ENTITY_ID), and it is NEVER expressed as runway months / zero
 * date. This route returns the one figure that is TRUTHFULLY derivable from the trading ledger:
 *
 *   realized P&L = SUM(4100 credits, gains) − SUM(5100 debits, losses), for the Trading entity,
 *   user-scoped, committed + non-reversed. These are exactly the codes commit-to-ledger posts on
 *   trade close (WIN→CR 4100, LOSS→DR 5100, route.ts:128-171). Period = ALL-TIME (trading is
 *   sparse; a trailing window is usually empty — the meaningful realized figure is cumulative).
 *
 * NOT DERIVABLE → declared, never fabricated (NO FALLBACK):
 *   • Trading capital — 3200/3300 (contributions/withdrawals) are NOT posted to the ledger by any
 *     code path (only the dead trading/route.ts reads them from `transactions`); settled_balance is
 *     a denormalized lifetime cache the codebase warns against (trial-balance/route.ts:8). No Plaid
 *     account is tagged to the Trading entity_id. So capital is reported `tracked: false`.
 *   • Drawdown — no peak/trough data exists. `tracked: false`.
 *
 * PAYWALL ruling (supersedes the earlier "requireTier is correctly absent" note): this route IS
 * the "Trading P&L analytics" feature sold on the Pro tier (tiers.ts tradingAnalytics), so it is
 * tier-gated even though it spends no external money — the gate here is the PAYWALL, not a
 * cost control. Free tier → 403 (tradingAnalytics: false); Pro/Pro+ → allowed; admin bypasses.
 */

// Trading entity — IMMUTABLE entity_id (psql-confirmed; entity_type is inconsistent across seeds —
// same rationale as /api/runway TRADING_ENTITY_ID). Single-tenant: the authenticated user's Trading.
const TRADING_ENTITY_ID = '972658cc-c1ca-4178-b77e-fad32a89a823';

export async function GET() {
  try {
    const userEmail = await getVerifiedEmail();
    if (!userEmail) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const user = await prisma.users.findFirst({
      where: { email: { equals: userEmail, mode: 'insensitive' } },
    });
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // PAYWALL: Trading P&L analytics is a paid (Pro) feature — same requireTier
    // pattern as ai/cart-plan/route.ts:89-90.
    // TAB-SERVER-GATE: tab:trade entitlement replaces the 'tradingAnalytics' tier gate
    const tierGate = await requireTabAccess(user.id, 'tab:trade');
    if (tierGate) return tierGate;

    const userId = user.id;

    // Realized P&L = trading gains (4100 credits) − trading losses (5100 debits), Trading entity,
    // user-scoped, committed + non-reversed. trade_count = distinct journals touching those codes.
    const rows: Array<{ gains_cents: string; losses_cents: string; trade_count: number }> =
      await prisma.$queryRaw`
        SELECT
          COALESCE(SUM(CASE WHEN coa.code = '4100' AND le.entry_type = 'C' THEN le.amount ELSE 0 END), 0)::text AS gains_cents,
          COALESCE(SUM(CASE WHEN coa.code = '5100' AND le.entry_type = 'D' THEN le.amount ELSE 0 END), 0)::text AS losses_cents,
          COUNT(DISTINCT je.id)::int AS trade_count
        FROM ledger_entries le
        JOIN journal_entries je    ON le.journal_entry_id = je.id
        JOIN chart_of_accounts coa ON le.account_id = coa.id
        WHERE je."userId" = ${userId}
          AND je.is_reversal = false
          AND je.reversed_by_entry_id IS NULL
          AND coa.entity_id = ${TRADING_ENTITY_ID}
          AND coa.code IN ('4100', '5100')
      `;

    const gains = Number(rows[0]?.gains_cents ?? 0) / 100;
    const losses = Number(rows[0]?.losses_cents ?? 0) / 100;
    const realizedPnl = Math.round((gains - losses) * 100) / 100;
    const tradeCount = Number(rows[0]?.trade_count ?? 0);

    return NextResponse.json({
      realizedPnl,
      gains,
      losses,
      tradeCount,
      period: 'all-time',
      source: 'trading ledger, realized (4100 gains − 5100 losses)',
      // Truthful declarations — these are NOT derivable from existing data (see header). Never faked.
      capital: { tracked: false, reason: 'no contributions/withdrawals posted to the trading ledger' },
      drawdown: { tracked: false, reason: 'no peak/trough data tracked' },
    });
  } catch (error) {
    console.error('Trading realized-pnl API error:', error);
    return NextResponse.json({ error: 'Failed to compute trading realized P&L' }, { status: 500 });
  }
}
