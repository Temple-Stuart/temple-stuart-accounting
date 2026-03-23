import { prisma } from '@/lib/prisma';
import { generateScheduleC, generateScheduleSE } from './schedule-c-service';
import type { ScheduleC, ScheduleSE } from './schedule-c-service';
import { generateTaxReport } from './tax-report-service';

// ============================================
// Form 1040 — U.S. Individual Income Tax Return
// TAX ESTIMATE ONLY — Not a filing document
// ============================================

// ─── 2025 Tax Brackets (Single) ────────────────────────────────

const TAX_BRACKETS_2025 = [
  { min: 0, max: 11600, rate: 0.10 },
  { min: 11600, max: 47150, rate: 0.12 },
  { min: 47150, max: 100525, rate: 0.22 },
  { min: 100525, max: 191950, rate: 0.24 },
  { min: 191950, max: 243725, rate: 0.32 },
  { min: 243725, max: 609350, rate: 0.35 },
  { min: 609350, max: Infinity, rate: 0.37 },
];

const TAX_BRACKETS_2026 = [
  { min: 0, max: 11925, rate: 0.10 },
  { min: 11925, max: 48475, rate: 0.12 },
  { min: 48475, max: 103350, rate: 0.22 },
  { min: 103350, max: 197300, rate: 0.24 },
  { min: 197300, max: 250525, rate: 0.32 },
  { min: 250525, max: 626350, rate: 0.35 },
  { min: 626350, max: Infinity, rate: 0.37 },
];

const STANDARD_DEDUCTION: Record<string, Record<number, number>> = {
  single: { 2025: 14600, 2026: 15000 },
  married_joint: { 2025: 29200, 2026: 30000 },
  married_separate: { 2025: 14600, 2026: 15000 },
  head_of_household: { 2025: 21900, 2026: 22500 },
};

// ─── LTCG Tax Brackets (2025 Single) ───────────────────────────

const LTCG_BRACKETS_2025 = [
  { min: 0, max: 48350, rate: 0.00 },
  { min: 48350, max: 533400, rate: 0.15 },
  { min: 533400, max: Infinity, rate: 0.20 },
];

const LTCG_BRACKETS_2026 = [
  { min: 0, max: 49850, rate: 0.00 },
  { min: 49850, max: 549250, rate: 0.15 },
  { min: 549250, max: Infinity, rate: 0.20 },
];

// ─── Interfaces ────────────────────────────────────────────────

export interface TaxBracketBreakdown {
  bracket: string;
  rate: number;
  taxableInBracket: number;
  taxForBracket: number;
}

export interface Form1040 {
  taxYear: number;
  filingStatus: string;
  disclaimer: string;

  // INCOME
  line1: number;   // W-2 wages
  line1Source: string;
  line5a: number;  // 403(b) gross distribution
  line5b: number;  // 403(b) taxable amount
  line7: number;   // Capital gain/loss (from Schedule D)
  line7_stcg: number;  // Short-term component
  line7_ltcg: number;  // Long-term component
  line8: number;   // Schedule C net profit
  line9: number;   // Total income

  // ADJUSTMENTS
  seTaxDeduction: number;  // Deductible half of SE tax
  line11: number;  // Adjusted Gross Income (AGI)

  // DEDUCTIONS
  standardDeduction: number;
  line15: number;  // Taxable income

  // TAX COMPUTATION
  incomeTax: number;
  bracketBreakdown: TaxBracketBreakdown[];
  ltcgTax: number;
  ltcgBracketBreakdown: TaxBracketBreakdown[];
  earlyWithdrawalPenalty: number;  // 10% of 403(b) - Schedule 2 Line 8
  selfEmploymentTax: number;       // From Schedule SE
  totalTax: number;

  // CREDITS & PAYMENTS
  w2Withheld: number;
  retirementWithheld: number;
  estimatedPayments: number;
  totalPayments: number;

  // BOTTOM LINE
  amountOwed: number;   // Positive = owed, Negative = refund
  isRefund: boolean;

  // Sub-form data
  scheduleC: ScheduleC;
  scheduleSE: ScheduleSE;

  // Override status
  overridesUsed: string[];
}

// ─── Tax override helper ───────────────────────────────────────

async function getOverrides(
  userId: string,
  taxYear: number
): Promise<Record<string, string>> {
  const rows = await prisma.tax_overrides.findMany({
    where: { userId, tax_year: taxYear },
    select: { field_key: true, field_value: true },
  });
  const map: Record<string, string> = {};
  for (const r of rows) {
    map[r.field_key] = r.field_value;
  }
  return map;
}

function overrideNum(overrides: Record<string, string>, key: string, fallback: number): { value: number; used: boolean } {
  if (overrides[key] !== undefined && overrides[key] !== '') {
    const parsed = parseFloat(overrides[key]);
    if (!isNaN(parsed)) return { value: parsed, used: true };
  }
  return { value: fallback, used: false };
}

// ─── W-2 wages from COA (across all user entities via account_tax_mappings) ──

async function getW2Wages(userId: string, taxYear: number): Promise<number> {
  const yearStart = new Date(`${taxYear}-01-01T00:00:00.000Z`);
  const yearEnd = new Date(`${taxYear + 1}-01-01T00:00:00.000Z`);

  // Find wage accounts via account_tax_mappings for form_1040 line 1
  const taxMappedWages = await prisma.account_tax_mappings.findMany({
    where: {
      tax_form: 'form_1040',
      form_line: '1',
      tax_year: taxYear,
      account: { userId, is_archived: false },
    },
    include: { account: true },
  });

  if (taxMappedWages.length > 0) {
    let totalWages = 0;
    for (const tm of taxMappedWages) {
      const acct = tm.account;
      const entries = await prisma.ledger_entries.findMany({
        where: {
          account_id: acct.id,
          journal_entry: {
            date: { gte: yearStart, lt: yearEnd },
            status: 'posted',
          },
        },
        select: { amount: true, entry_type: true },
      });

      let net = BigInt(0);
      for (const e of entries) {
        net += e.entry_type === 'C' ? e.amount : -e.amount;
      }
      totalWages += Math.abs(Number(net) / 100) * tm.multiplier.toNumber();
    }
    if (totalWages > 0) return round2(totalWages);
  }

  // Fallback: find wage account by code 4000 across all user entities
  const wageAccount = await prisma.chart_of_accounts.findFirst({
    where: { userId, code: '4000', is_archived: false },
  });

  if (!wageAccount) return 0;

  const entries = await prisma.ledger_entries.findMany({
    where: {
      account_id: wageAccount.id,
      journal_entry: {
        date: { gte: yearStart, lt: yearEnd },
        status: 'posted',
      },
    },
    select: { amount: true, entry_type: true },
  });

  if (entries.length > 0) {
    let net = BigInt(0);
    for (const e of entries) {
      net += e.entry_type === 'C' ? e.amount : -e.amount;
    }
    return Math.abs(Number(net) / 100);
  }

  return Math.abs(Number(wageAccount.settled_balance) / 100);
}

// ─── Compute ordinary income tax from brackets ──────────────────

function computeIncomeTax(
  taxableIncome: number,
  taxYear: number
): { tax: number; breakdown: TaxBracketBreakdown[] } {
  const brackets = taxYear >= 2026 ? TAX_BRACKETS_2026 : TAX_BRACKETS_2025;
  const breakdown: TaxBracketBreakdown[] = [];
  let remaining = Math.max(0, taxableIncome);
  let totalTax = 0;

  for (const b of brackets) {
    if (remaining <= 0) break;
    const taxableInBracket = Math.min(remaining, b.max - b.min);
    const taxForBracket = round2(taxableInBracket * b.rate);
    totalTax += taxForBracket;
    remaining -= taxableInBracket;

    if (taxableInBracket > 0) {
      breakdown.push({
        bracket: b.max === Infinity
          ? `$${b.min.toLocaleString()}+`
          : `$${b.min.toLocaleString()} – $${b.max.toLocaleString()}`,
        rate: b.rate,
        taxableInBracket: round2(taxableInBracket),
        taxForBracket,
      });
    }
  }

  return { tax: round2(totalTax), breakdown };
}

// ─── Compute LTCG tax from 0%/15%/20% brackets ─────────────────

function computeLtcgTax(
  ltcg: number,
  taxableOrdinaryIncome: number,
  taxYear: number
): { tax: number; breakdown: TaxBracketBreakdown[] } {
  if (ltcg <= 0) return { tax: 0, breakdown: [] };

  const brackets = taxYear >= 2026 ? LTCG_BRACKETS_2026 : LTCG_BRACKETS_2025;
  const breakdown: TaxBracketBreakdown[] = [];

  // LTCG stacks on top of ordinary income for bracket purposes
  let filled = taxableOrdinaryIncome;
  let remaining = ltcg;
  let totalTax = 0;

  for (const b of brackets) {
    if (remaining <= 0) break;
    // How much room is left in this bracket after ordinary income?
    const bracketRoom = Math.max(0, b.max - Math.max(filled, b.min));
    const taxableInBracket = Math.min(remaining, bracketRoom);
    if (taxableInBracket <= 0) continue;

    const taxForBracket = round2(taxableInBracket * b.rate);
    totalTax += taxForBracket;
    remaining -= taxableInBracket;
    filled += taxableInBracket;

    breakdown.push({
      bracket: b.max === Infinity
        ? `$${b.min.toLocaleString()}+`
        : `$${b.min.toLocaleString()} – $${b.max.toLocaleString()}`,
      rate: b.rate,
      taxableInBracket: round2(taxableInBracket),
      taxForBracket,
    });
  }

  return { tax: round2(totalTax), breakdown };
}

// ─── Main Form 1040 generator ──────────────────────────────────

export async function generateForm1040(
  userId: string,
  taxYear: number
): Promise<Form1040> {
  const overrides = await getOverrides(userId, taxYear);
  const overridesUsed: string[] = [];

  const filingStatus = overrides['filing_status'] || 'single';

  // ── INCOME ──

  // Line 1: W-2 wages
  const coaWages = await getW2Wages(userId, taxYear);
  const w2 = overrideNum(overrides, 'w2_gross_wages', coaWages);
  const line1 = w2.value;
  const line1Source = w2.used ? 'manual override' : (coaWages > 0 ? 'COA 4000' : 'not set');
  if (w2.used) overridesUsed.push('w2_gross_wages');

  // Line 5a/5b: 403(b) distribution
  const ret5a = overrideNum(overrides, 'retirement_distribution_gross', 0);
  const line5a = ret5a.value;
  if (ret5a.used) overridesUsed.push('retirement_distribution_gross');

  const ret5b = overrideNum(overrides, 'retirement_distribution_taxable', line5a);
  const line5b = ret5b.value;
  if (ret5b.used) overridesUsed.push('retirement_distribution_taxable');

  // Line 7: Capital gain/loss from Schedule D
  let line7 = 0;
  let line7_stcg = 0;
  let line7_ltcg = 0;
  try {
    const taxReport = await generateTaxReport(userId, taxYear);
    line7 = taxReport.scheduleD.line16.gainOrLoss;
    line7_stcg = taxReport.scheduleD.partI.line7.gainOrLoss;
    line7_ltcg = taxReport.scheduleD.partII.line15.gainOrLoss;
  } catch (e) {
    console.log('[Form 1040] Schedule D generation failed, using 0:', (e as Error).message);
  }

  // Line 8: Schedule C net profit
  const scheduleC = await generateScheduleC(userId, taxYear);
  const line8 = scheduleC.line31;

  // Line 9: Total income
  const line9 = round2(line1 + line5b + line7 + line8);

  // ── ADJUSTMENTS ──

  // Schedule SE
  const scheduleSE = generateScheduleSE(line8);
  const seTaxDeduction = Math.max(0, scheduleSE.line13);

  // Line 11: AGI
  const line11 = round2(line9 - seTaxDeduction);

  // ── DEDUCTIONS ──

  const stdDed = STANDARD_DEDUCTION[filingStatus]?.[taxYear]
    ?? STANDARD_DEDUCTION['single'][2025];

  const standardDeduction = stdDed;
  const line15 = round2(Math.max(0, line11 - standardDeduction));

  // ── TAX COMPUTATION ──

  // Separate ordinary income from LTCG for preferential rate treatment
  const ltcgForTax = Math.max(0, line7_ltcg);
  const ordinaryTaxable = round2(Math.max(0, line15 - ltcgForTax));

  // Ordinary income tax (excludes LTCG)
  const { tax: incomeTax, breakdown: bracketBreakdown } = computeIncomeTax(ordinaryTaxable, taxYear);

  // LTCG tax at preferential 0%/15%/20% rates
  const { tax: ltcgTax, breakdown: ltcgBracketBreakdown } = computeLtcgTax(ltcgForTax, ordinaryTaxable, taxYear);

  // Early withdrawal penalty (10% of 403(b) if code is '1' — early distribution)
  const retCode = overrides['retirement_distribution_code'] || '1';
  const earlyWithdrawalPenalty = retCode === '1' ? round2(line5b * 0.10) : 0;

  const selfEmploymentTax = Math.max(0, scheduleSE.line12);
  const totalTax = round2(incomeTax + ltcgTax + earlyWithdrawalPenalty + selfEmploymentTax);

  // ── CREDITS & PAYMENTS ──

  const w2With = overrideNum(overrides, 'w2_federal_withheld', 0);
  const w2Withheld = w2With.value;
  if (w2With.used) overridesUsed.push('w2_federal_withheld');

  const retWith = overrideNum(overrides, 'retirement_distribution_withheld', 0);
  const retirementWithheld = retWith.value;
  if (retWith.used) overridesUsed.push('retirement_distribution_withheld');

  const estPay = overrideNum(overrides, 'estimated_payments_made', 0);
  const estimatedPayments = estPay.value;
  if (estPay.used) overridesUsed.push('estimated_payments_made');

  const totalPayments = round2(w2Withheld + retirementWithheld + estimatedPayments);

  // ── BOTTOM LINE ──

  const amountOwed = round2(totalTax - totalPayments);

  return {
    taxYear,
    filingStatus,
    disclaimer: 'TAX ESTIMATE ONLY — All figures must be verified by a licensed CPA or tax professional before filing.',

    line1,
    line1Source,
    line5a,
    line5b,
    line7,
    line7_stcg,
    line7_ltcg,
    line8,
    line9,

    seTaxDeduction,
    line11,

    standardDeduction,
    line15,

    incomeTax,
    bracketBreakdown,
    ltcgTax,
    ltcgBracketBreakdown,
    earlyWithdrawalPenalty,
    selfEmploymentTax,
    totalTax,

    w2Withheld,
    retirementWithheld,
    estimatedPayments,
    totalPayments,

    amountOwed,
    isRefund: amountOwed < 0,

    scheduleC,
    scheduleSE,

    overridesUsed,
  };
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
