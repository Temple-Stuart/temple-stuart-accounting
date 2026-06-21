import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getVerifiedEmail } from '@/lib/cookie-auth';

/**
 * GET /api/runway — compute-on-read runway engine (RUNWAY-2).
 *
 * Returns, for the authenticated user, a top-line cash-runway readout computed over
 * TRAILING FULL CALENDAR MONTHS (never YTD — YTD income is garbage here: all-time
 * income ≈ $176K but YTD ≈ ~$900 after Alex left his job, so a YTD net burn would be
 * meaningless). Two windows: trailing 3mo and trailing 6mo.
 *
 * OPERATING scope = Personal + Business only. The Trading entity is EXCLUDED from burn/income
 * (trading P&L is not operating burn — decision: audits/RUNWAY-ENTITY-MODEL.md; see TRADING_ENTITY_ID).
 *
 * Inputs — ALL reuse the VERIFIED existing sources, user-scoped, no new table/migration:
 *   • cash       = SUM(accounts.currentBalance) for the user  (same field /api/metrics:22-27
 *                  uses — the Plaid-synced stored balance; this IS the cash source). NOTE: cash is
 *                  still COMBINED (all accounts) this PR — entity-scoping cash is a follow-up.
 *   • expenses   = ledger_entries debits on expense COAs (account_type='expense',
 *                  entry_type='D') — same identification as /api/metrics:30-41 — EXCL. Trading.
 *   • income     = ledger_entries credits on revenue COAs (account_type='revenue',
 *                  entry_type='C') — same identification as /api/income:40-59 — EXCL. Trading.
 * Both burn legs are bounded to the trailing window via je.date (the @db.Date posting date),
 * filtered to committed, non-reversed journal entries (is_reversal=false, reversed_by_entry_id
 * IS NULL) — the same committed basis the budget actuals use.
 *
 * net_burn/mo = (expenses − income) over the window ÷ N months (positive = burning cash).
 * runway_months = cash ÷ net_burn/mo ; zero_date = today + runway_months.
 *
 * NO FALLBACK / NO SILENT DEFAULTS. Each window declares its real state truthfully:
 *   • 'no_cash'              — no bank account linked (numerator missing) → no runway.
 *   • 'insufficient_history' — the ledger does not span the full N months → no runway.
 *   • 'cashflow_positive'    — net burn ≤ 0 (income ≥ expenses) → no division, no fake number.
 *   • 'ok'                   — real runway_months + zero_date.
 * runway_months / zero_date are present ONLY in the 'ok' state; otherwise null.
 *
 * DB-only read — no paid external call → verifyCookie (getVerifiedEmail) + user lookup +
 * user-scoping are the bar; requireTier is correctly absent (cf. ai/cart-plan/route.ts:77-88,
 * which tiers ONLY because it calls OpenAI).
 */

const MS_PER_DAY = 86_400_000;
const AVG_MONTH_DAYS = 30.436875; // mean Gregorian month — for projecting the zero date

const round = (n: number, dp: number) => {
  const f = 10 ** dp;
  return Math.round(n * f) / f;
};

// Trading entity excluded from OPERATING runway — trading P&L (WIN→4100 revenue, LOSS→5100
// expense, posted by commit-to-ledger) is NOT operating burn (decision: audits/RUNWAY-ENTITY-MODEL.md).
// Operating burn/income = Personal + Business only. Resolved by entity_id — the IMMUTABLE key — NOT
// entity_type, which is inconsistent across seeds (seed-entities.ts:13 wrongly seeds Trading as
// 'personal'; Alex's psql confirmed the live row is entity_type='trading' with THIS id). Single-tenant:
// this is the authenticated user's Trading entity. (Multi-tenant would resolve this per-user by id.)
const TRADING_ENTITY_ID = '972658cc-c1ca-4178-b77e-fad32a89a823';

// The two OPERATING entities, resolved by IMMUTABLE entity_id (psql-confirmed; entity_type is
// inconsistent across seeds — same rationale as TRADING_ENTITY_ID). The per-entity breakdown
// attributes each non-trading ledger row to one of these. Any non-trading row that is NEITHER
// (a stray/legacy entity) is surfaced as `unattributed` — NEVER silently dropped — so the
// invariant Personal + Business + Unattributed === Combined operating always holds. Single-tenant.
const PERSONAL_ENTITY_ID = 'e83f5b3a-0b46-4c73-8b91-1b736ecdd3eb';
const BUSINESS_ENTITY_ID = '9e8ee102-5b75-445b-a1ba-b7226a208b4a';

type WindowState = 'ok' | 'insufficient_history' | 'cashflow_positive' | 'no_cash';

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
    const userId = user.id;

    // ── Trailing-window bounds: FULL calendar months, excluding the current partial month.
    //    e.g. on 2026-06-21 → windowEnd = 2026-06-01 (exclusive); 3mo start = 2026-03-01;
    //    6mo start = 2025-12-01. Date.UTC handles negative-month rollover. ──
    const now = new Date();
    const y = now.getUTCFullYear();
    const m = now.getUTCMonth(); // 0-11
    const fmt = (d: Date) => d.toISOString().slice(0, 10);
    const firstOfMonth = (back: number) => new Date(Date.UTC(y, m - back, 1));
    const windowEndStr = fmt(firstOfMonth(0));

    // ── CASH = SUM(currentBalance), user-scoped. accountsLinked distinguishes a real $0
    //    balance from "no bank linked" (COALESCE over zero rows is also 0 — we must NOT
    //    present that ambiguous 0 as a runway numerator). ──
    const cashRows: Array<{ n: number; total: string }> = await prisma.$queryRaw`
      SELECT COUNT(*)::int AS n, COALESCE(SUM("currentBalance")::numeric, 0)::text AS total
      FROM accounts
      WHERE "userId" = ${userId}
    `;
    const accountsLinked = Number(cashRows[0]?.n ?? 0);
    const cashDollars = round(Number(cashRows[0]?.total ?? 0), 2);
    const cashAvailable = accountsLinked > 0;

    // ── Earliest committed, non-reversed ledger date — the history-coverage signal.
    //    A window is "sufficient" only if recorded history starts on/before its start. ──
    const earliestRows: Array<{ earliest: string | null }> = await prisma.$queryRaw`
      SELECT MIN(je.date)::text AS earliest
      FROM journal_entries je
      WHERE je."userId" = ${userId}
        AND je.is_reversal = false
        AND je.reversed_by_entry_id IS NULL
        AND je.entity_id != ${TRADING_ENTITY_ID}
    `;
    const earliest = earliestRows[0]?.earliest ?? null;

    // ── One burn query per window: expense debits − revenue credits over [start, windowEnd),
    //    user-scoped, committed + non-reversed. Same COA/entry_type identification as the
    //    verified metrics (expense) and income (revenue) queries. ──
    const burn = async (startStr: string) => {
      const rows: Array<{ exp_cents: string; rev_cents: string }> = await prisma.$queryRaw`
        SELECT
          COALESCE(SUM(CASE WHEN coa.account_type = 'expense' AND le.entry_type = 'D' THEN le.amount ELSE 0 END), 0)::text AS exp_cents,
          COALESCE(SUM(CASE WHEN coa.account_type = 'revenue' AND le.entry_type = 'C' THEN le.amount ELSE 0 END), 0)::text AS rev_cents
        FROM ledger_entries le
        JOIN journal_entries je    ON le.journal_entry_id = je.id
        JOIN chart_of_accounts coa ON le.account_id = coa.id
        WHERE je."userId" = ${userId}
          AND je.is_reversal = false
          AND je.reversed_by_entry_id IS NULL
          AND je.date >= ${startStr}::date
          AND je.date <  ${windowEndStr}::date
          AND coa.entity_id != ${TRADING_ENTITY_ID}
      `;
      const exp = Number(rows[0]?.exp_cents ?? 0) / 100;
      const rev = Number(rows[0]?.rev_cents ?? 0) / 100;
      return { exp, rev };
    };

    // ── ADDITIVE per-entity breakdown: the SAME filters as burn() (incl. the Trading exclusion),
    //    but GROUP BY coa.entity_id. The combined burn() above is untouched — this is a separate
    //    read whose grouped sums reconcile exactly to the combined total (identical WHERE). ──
    const burnByEntity = async (startStr: string): Promise<Record<string, { exp: number; rev: number }>> => {
      const rows: Array<{ entity_id: string; exp_cents: string; rev_cents: string }> = await prisma.$queryRaw`
        SELECT
          coa.entity_id,
          COALESCE(SUM(CASE WHEN coa.account_type = 'expense' AND le.entry_type = 'D' THEN le.amount ELSE 0 END), 0)::text AS exp_cents,
          COALESCE(SUM(CASE WHEN coa.account_type = 'revenue' AND le.entry_type = 'C' THEN le.amount ELSE 0 END), 0)::text AS rev_cents
        FROM ledger_entries le
        JOIN journal_entries je    ON le.journal_entry_id = je.id
        JOIN chart_of_accounts coa ON le.account_id = coa.id
        WHERE je."userId" = ${userId}
          AND je.is_reversal = false
          AND je.reversed_by_entry_id IS NULL
          AND je.date >= ${startStr}::date
          AND je.date <  ${windowEndStr}::date
          AND coa.entity_id != ${TRADING_ENTITY_ID}
        GROUP BY coa.entity_id
      `;
      const map: Record<string, { exp: number; rev: number }> = {};
      for (const r of rows) {
        map[r.entity_id] = { exp: Number(r.exp_cents ?? 0) / 100, rev: Number(r.rev_cents ?? 0) / 100 };
      }
      return map;
    };

    const buildWindow = async (n: number) => {
      const startStr = fmt(firstOfMonth(n));
      const { exp, rev } = await burn(startStr);
      const netBurnTotal = round(exp - rev, 2); // positive = burning cash over the window
      const netBurnPerMonth = round(netBurnTotal / n, 2);

      // Per-entity net burn (additive — the combined numbers above are unchanged). Attribute each
      // non-trading entity_id to Personal / Business; anything else accumulates into `unattributed`
      // (expected 0 — psql shows exactly 3 entities — but surfaced truthfully if non-zero).
      const byEntity = await burnByEntity(startStr);
      const entityFig = (e: { exp: number; rev: number }) => {
        const total = round(e.exp - e.rev, 2);
        return { expenses: e.exp, income: e.rev, netBurnTotal: total, netBurnPerMonth: round(total / n, 2) };
      };
      const personal = entityFig(byEntity[PERSONAL_ENTITY_ID] ?? { exp: 0, rev: 0 });
      const business = entityFig(byEntity[BUSINESS_ENTITY_ID] ?? { exp: 0, rev: 0 });
      let otherExp = 0;
      let otherRev = 0;
      for (const [id, e] of Object.entries(byEntity)) {
        if (id !== PERSONAL_ENTITY_ID && id !== BUSINESS_ENTITY_ID) { otherExp += e.exp; otherRev += e.rev; }
      }
      const unattributed = entityFig({ exp: otherExp, rev: otherRev });
      const sufficientHistory = earliest !== null && earliest <= startStr;

      let state: WindowState;
      let runwayMonths: number | null = null;
      let zeroDate: string | null = null;

      if (!cashAvailable) {
        state = 'no_cash';
      } else if (!sufficientHistory) {
        state = 'insufficient_history';
      } else if (netBurnPerMonth <= 0) {
        state = 'cashflow_positive';
      } else {
        state = 'ok';
        const exactMonths = cashDollars / netBurnPerMonth;
        runwayMonths = round(exactMonths, 1);
        zeroDate = fmt(new Date(now.getTime() + exactMonths * AVG_MONTH_DAYS * MS_PER_DAY));
      }

      return {
        months: n,
        rangeStart: startStr,
        rangeEnd: windowEndStr,
        expenses: exp,
        income: rev,
        netBurnTotal,
        netBurnPerMonth,
        sufficientHistory,
        state,
        runwayMonths,
        zeroDate,
        // Additive per-entity breakdown (Personal + Business + Unattributed === combined netBurnTotal).
        entities: {
          personal,
          business,
          unattributed: unattributed.netBurnTotal !== 0 ? unattributed : null,
        },
      };
    };

    const windows = [await buildWindow(3), await buildWindow(6)];

    return NextResponse.json({
      asOf: fmt(now),
      cash: {
        dollars: cashDollars,
        accountsLinked,
        available: cashAvailable,
        source: 'Plaid balance',
      },
      burnSource: 'trailing ledger actuals',
      windows,
    });
  } catch (error) {
    console.error('Runway API error:', error);
    return NextResponse.json({ error: 'Failed to compute runway' }, { status: 500 });
  }
}
