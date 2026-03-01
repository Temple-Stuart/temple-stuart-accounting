import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getVerifiedEmail } from '@/lib/cookie-auth';

type FilingStatus = 'single' | 'married_joint' | 'married_separate' | 'head_of_household';

const FEDERAL_BRACKETS: Record<FilingStatus, [number, number][]> = {
  single: [
    [1192500, 10], [4847500, 12], [10335000, 22], [19730000, 24], [25052500, 32], [62635000, 35], [Infinity, 37],
  ],
  married_joint: [
    [2385000, 10], [9695000, 12], [20670000, 22], [39460000, 24], [50105000, 32], [78765000, 35], [Infinity, 37],
  ],
  married_separate: [
    [1192500, 10], [4847500, 12], [10335000, 22], [19730000, 24], [25052500, 32], [39382500, 35], [Infinity, 37],
  ],
  head_of_household: [
    [1700000, 10], [6405000, 12], [10335000, 22], [19730000, 24], [25052500, 32], [62635000, 35], [Infinity, 37],
  ],
};

const STANDARD_DEDUCTIONS: Record<FilingStatus, number> = {
  single: 1500000,          // $15,000
  married_joint: 3000000,   // $30,000
  married_separate: 1500000,
  head_of_household: 2250000, // $22,500
};

const NO_INCOME_TAX_STATES = ['AK', 'FL', 'NV', 'NH', 'SD', 'TN', 'TX', 'WA', 'WY'];

const STATE_TAX_RATES: Record<string, number | [number, number][]> = {
  AL: 5.0, AZ: 2.5, AR: 4.4,
  CA: [
    [1088900, 1], [2580100, 2], [4071300, 4], [5650700, 6], [7142900, 8],
    [100000000, 9.3], [200000000, 10.3], [300000000, 11.3], [Infinity, 12.3],
  ],
  CO: 4.4, CT: 6.99, DE: 6.6, DC: 8.95, GA: 5.49, HI: 11.0,
  ID: 5.8, IL: 4.95, IN: 3.05, IA: 5.7, KS: 5.7, KY: 4.0,
  LA: 4.25, ME: 7.15, MD: 5.75, MA: 5.0, MI: 4.25, MN: 9.85,
  MS: 5.0, MO: 4.95, MT: 6.75, NE: 6.64, NJ: 10.75, NM: 5.9,
  NY: 10.9, NC: 4.5, ND: 2.5, OH: 3.99, OK: 4.75, OR: 9.9,
  PA: 3.07, RI: 5.99, SC: 6.4, UT: 4.65, VT: 8.75, VA: 5.75,
  WV: 5.12, WI: 7.65,
};

function calculateBracketTax(
  taxableIncome: number,
  brackets: [number, number][]
): { total: number; breakdown: { rate: number; taxableInRange: number; tax: number }[] } {
  let remaining = taxableIncome;
  let total = 0;
  let prevCeiling = 0;
  const breakdown: { rate: number; taxableInRange: number; tax: number }[] = [];
  for (const [ceiling, rate] of brackets) {
    const rangeSize = ceiling - prevCeiling;
    const inRange = Math.min(remaining, rangeSize);
    if (inRange <= 0) break;
    const tax = Math.round(inRange * rate / 100);
    breakdown.push({ rate, taxableInRange: inRange, tax });
    total += tax;
    remaining -= inRange;
    prevCeiling = ceiling;
  }
  return { total, breakdown };
}

function calculateStateTax(taxableIncome: number, state: string): number {
  if (NO_INCOME_TAX_STATES.includes(state)) return 0;
  const rate = STATE_TAX_RATES[state];
  if (!rate) return 0;
  if (typeof rate === 'number') return Math.round(taxableIncome * rate / 100);
  // Progressive brackets
  let remaining = taxableIncome;
  let total = 0;
  let prev = 0;
  for (const [ceiling, r] of rate) {
    const rangeSize = ceiling - prev;
    const inRange = Math.min(remaining, rangeSize);
    if (inRange <= 0) break;
    total += Math.round(inRange * r / 100);
    remaining -= inRange;
    prev = ceiling;
  }
  return total;
}

export async function POST(request: Request) {
  try {
    const userEmail = await getVerifiedEmail();
    if (!userEmail) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const user = await prisma.users.findFirst({
      where: { email: { equals: userEmail, mode: 'insensitive' } },
    });
    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

    const userId = user.id;

    // Parse body with sensible defaults
    let body: Record<string, unknown> = {};
    try {
      body = await request.json();
    } catch {
      // empty body is fine, use defaults
    }

    const filingStatus: FilingStatus =
      ['single', 'married_joint', 'married_separate', 'head_of_household'].includes(body.filingStatus as string)
        ? (body.filingStatus as FilingStatus)
        : 'single';
    const state: string = typeof body.state === 'string' && body.state.length === 2 ? body.state.toUpperCase() : 'CA';
    const selfEmployed: boolean = typeof body.selfEmployed === 'boolean' ? body.selfEmployed : false;
    const priorYearLiability: number = typeof body.priorYearLiability === 'number' ? body.priorYearLiability : 0;
    const priorYearAgi: number = typeof body.priorYearAgi === 'number' ? body.priorYearAgi : 0;
    const estimatedPaymentsMade: number = typeof body.estimatedPaymentsMade === 'number' ? body.estimatedPaymentsMade : 0;
    const standardDeduction: boolean = typeof body.standardDeduction === 'boolean' ? body.standardDeduction : true;
    const additionalDeductions: number = typeof body.additionalDeductions === 'number' ? body.additionalDeductions : 0;
    const dependents: number = typeof body.dependents === 'number' ? body.dependents : 0;

    // ---------------------------------------------------------------
    // STEP 1: Get YTD income and expenses from ledger
    // ---------------------------------------------------------------

    // Business revenue
    const bizRevenueResult = await prisma.$queryRaw<{ total: bigint }[]>`
      SELECT COALESCE(SUM(le.amount)::bigint, 0) as total
      FROM ledger_entries le
      JOIN journal_entries je ON le.journal_entry_id = je.id
      JOIN chart_of_accounts coa ON le.account_id = coa.id
      WHERE je."userId" = ${userId}
        AND je.is_reversal = false AND je.reversed_by_entry_id IS NULL
        AND coa.account_type = 'revenue' AND le.entry_type = 'C'
        AND coa.entity_id IN (SELECT id FROM entities WHERE "userId" = ${userId} AND entity_type = 'business')
        AND EXTRACT(YEAR FROM je.date) = EXTRACT(YEAR FROM NOW())
    `;
    const bizRevenue = Number(bizRevenueResult[0]?.total ?? 0);

    // Business expenses
    const bizExpensesResult = await prisma.$queryRaw<{ total: bigint }[]>`
      SELECT COALESCE(SUM(le.amount)::bigint, 0) as total
      FROM ledger_entries le
      JOIN journal_entries je ON le.journal_entry_id = je.id
      JOIN chart_of_accounts coa ON le.account_id = coa.id
      WHERE je."userId" = ${userId}
        AND je.is_reversal = false AND je.reversed_by_entry_id IS NULL
        AND coa.account_type = 'expense' AND le.entry_type = 'D'
        AND coa.entity_id IN (SELECT id FROM entities WHERE "userId" = ${userId} AND entity_type = 'business')
        AND EXTRACT(YEAR FROM je.date) = EXTRACT(YEAR FROM NOW())
    `;
    const bizExpenses = Number(bizExpensesResult[0]?.total ?? 0);

    // Personal income (non-business revenue)
    const personalIncomeResult = await prisma.$queryRaw<{ total: bigint }[]>`
      SELECT COALESCE(SUM(le.amount)::bigint, 0) as total
      FROM ledger_entries le
      JOIN journal_entries je ON le.journal_entry_id = je.id
      JOIN chart_of_accounts coa ON le.account_id = coa.id
      WHERE je."userId" = ${userId}
        AND je.is_reversal = false AND je.reversed_by_entry_id IS NULL
        AND coa.account_type = 'revenue' AND le.entry_type = 'C'
        AND (coa.entity_id NOT IN (SELECT id FROM entities WHERE "userId" = ${userId} AND entity_type = 'business') OR coa.entity_id IS NULL)
        AND EXTRACT(YEAR FROM je.date) = EXTRACT(YEAR FROM NOW())
    `;
    const personalIncome = Number(personalIncomeResult[0]?.total ?? 0);

    // Total expenses (all entities)
    const totalExpensesResult = await prisma.$queryRaw<{ total: bigint }[]>`
      SELECT COALESCE(SUM(le.amount)::bigint, 0) as total
      FROM ledger_entries le
      JOIN journal_entries je ON le.journal_entry_id = je.id
      JOIN chart_of_accounts coa ON le.account_id = coa.id
      WHERE je."userId" = ${userId}
        AND je.is_reversal = false AND je.reversed_by_entry_id IS NULL
        AND coa.account_type = 'expense' AND le.entry_type = 'D'
        AND EXTRACT(YEAR FROM je.date) = EXTRACT(YEAR FROM NOW())
    `;
    const _totalExpenses = Number(totalExpensesResult[0]?.total ?? 0);

    // Deductible expenses (tax_form_line IS NOT NULL)
    const deductibleExpensesResult = await prisma.$queryRaw<{ total: bigint }[]>`
      SELECT COALESCE(SUM(le.amount)::bigint, 0) as total
      FROM ledger_entries le
      JOIN journal_entries je ON le.journal_entry_id = je.id
      JOIN chart_of_accounts coa ON le.account_id = coa.id
      WHERE je."userId" = ${userId}
        AND je.is_reversal = false AND je.reversed_by_entry_id IS NULL
        AND coa.account_type = 'expense' AND le.entry_type = 'D'
        AND coa.tax_form_line IS NOT NULL
        AND EXTRACT(YEAR FROM je.date) = EXTRACT(YEAR FROM NOW())
    `;
    const deductibleExpenses = Number(deductibleExpensesResult[0]?.total ?? 0);

    // ---------------------------------------------------------------
    // STEP 2: Self-Employment Tax
    // ---------------------------------------------------------------
    const SE_NET = bizRevenue - bizExpenses;
    const SE_TAXABLE = Math.round(SE_NET * 0.9235);
    const SE_TAX = selfEmployed ? Math.round(SE_TAXABLE * 0.153) : 0;
    const SE_DEDUCTION = selfEmployed ? Math.round(SE_TAX * 0.5) : 0;

    // ---------------------------------------------------------------
    // STEP 3: Federal Income Tax
    // ---------------------------------------------------------------
    const totalIncome = bizRevenue + personalIncome;
    const totalDeductions = deductibleExpenses;

    const GROSS = totalIncome - deductibleExpenses;
    const AGI = GROSS - (selfEmployed ? SE_DEDUCTION : 0);
    const deductionAmount = standardDeduction
      ? STANDARD_DEDUCTIONS[filingStatus]
      : additionalDeductions;
    const TAXABLE = Math.max(0, AGI - deductionAmount);

    const { total: federalIncomeTax, breakdown: brackets } = calculateBracketTax(
      TAXABLE,
      FEDERAL_BRACKETS[filingStatus]
    );

    // ---------------------------------------------------------------
    // STEP 4: State Tax
    // ---------------------------------------------------------------
    const stateTax = calculateStateTax(TAXABLE, state);

    // ---------------------------------------------------------------
    // STEP 5: Safe Harbor Analysis
    // ---------------------------------------------------------------
    const TOTAL_LIABILITY = federalIncomeTax + (selfEmployed ? SE_TAX : 0) + stateTax;
    const QUARTERLY_DUE = Math.round(TOTAL_LIABILITY / 4);

    const safeHarbor90 = Math.round(TOTAL_LIABILITY * 0.90);
    const safeHarbor100 = priorYearAgi > 15000000 // $150K in cents
      ? Math.round(priorYearLiability * 1.10)
      : priorYearLiability;
    const SAFE_HARBOR = Math.min(safeHarbor90, safeHarbor100 > 0 ? safeHarbor100 : safeHarbor90);

    const REMAINING_DUE = Math.max(0, SAFE_HARBOR - estimatedPaymentsMade);
    const safeHarborPercent = SAFE_HARBOR > 0
      ? Math.round((estimatedPaymentsMade / SAFE_HARBOR) * 100)
      : 100;

    const effectiveRate = Math.round((TOTAL_LIABILITY / Math.max(totalIncome, 1)) * 10000) / 100;

    // ---------------------------------------------------------------
    // Build assumptions
    // ---------------------------------------------------------------
    const assumptions: string[] = [
      'State tax uses simplified flat or progressive rate, not full state tax code',
      'No AMT (Alternative Minimum Tax) calculated',
      'No capital gains brackets or preferential rates applied',
      'No tax credits applied (e.g., child tax credit, earned income credit)',
      'Self-employment tax uses standard 92.35% and 15.3% rates',
      'No NIIT (Net Investment Income Tax) calculated',
      'No qualified business income (QBI / Section 199A) deduction applied',
      'Deductible expenses based on accounts with tax_form_line set',
      'All amounts are YTD for the current calendar year',
      `${dependents} dependent(s) noted but no dependent credits applied`,
    ];

    return NextResponse.json({
      // Facts (from ledger)
      bizRevenue,
      bizExpenses,
      bizNet: SE_NET,
      totalIncome,
      totalDeductions,

      // Computed
      selfEmploymentTax: selfEmployed ? SE_TAX : 0,
      federalIncomeTax,
      stateTax,
      totalEstimatedTax: TOTAL_LIABILITY,
      effectiveRate,

      // Quarterly
      quarterlyDue: QUARTERLY_DUE,
      estimatedPaymentsMade,
      remainingDue: REMAINING_DUE,
      safeHarborTarget: SAFE_HARBOR,
      safeHarborPercent,

      // Breakdown for drill-down
      brackets,

      // Metadata
      disclaimer: 'Estimate only. Not tax advice. Consult a CPA.',
      assumptions,
      inputsUsed: {
        filingStatus,
        state,
        selfEmployed,
        priorYearLiability,
        priorYearAgi,
        estimatedPaymentsMade,
        standardDeduction,
        additionalDeductions,
        dependents,
      },
    });
  } catch (error) {
    console.error('Tax estimate error:', error);
    return NextResponse.json(
      { error: 'Failed to calculate tax estimate' },
      { status: 500 }
    );
  }
}
