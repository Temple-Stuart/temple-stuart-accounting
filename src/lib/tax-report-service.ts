import { prisma } from '@/lib/prisma';

const MS_PER_DAY = 24 * 60 * 60 * 1000;

// ============================================
// Form 8949 — Sales and Other Dispositions of Capital Assets
// ============================================

/**
 * Each row on Form 8949 represents one disposition.
 * IRS columns: (a) Description, (b) Date acquired, (c) Date sold,
 * (d) Proceeds, (e) Cost basis, (f) Adjustment code, (g) Adjustment amount,
 * (h) Gain or loss = (d) - (e) + (g)
 */
export interface Form8949Entry {
  description: string;        // (a) e.g. "100 sh AAPL" or "1 AAPL Jan 20 2025 $150 Call"
  dateAcquired: string;       // (b) ISO date
  dateSold: string;           // (c) ISO date
  proceeds: number;           // (d)
  costBasis: number;          // (e)
  adjustmentCode: string;     // (f) "W" for wash sale, "" for none
  adjustmentAmount: number;   // (g) wash sale disallowed loss (positive adds to basis)
  gainOrLoss: number;         // (h) proceeds - costBasis + adjustmentAmount
  isLongTerm: boolean;
  holdingDays: number;
  symbol: string;
  assetType: 'stock' | 'option';
  // Form 8949 Box classification:
  // A = basis reported to IRS (1099-B with basis)
  // B = basis NOT reported to IRS (1099-B without basis)
  // C = no 1099-B received
  box: 'A' | 'B' | 'C';
}

// ============================================
// Schedule D — Capital Gains and Losses
// ============================================

export interface ScheduleDLine {
  line: string;
  description: string;
  proceeds: number;
  costBasis: number;
  adjustments: number;
  gainOrLoss: number;
}

export interface ScheduleD {
  partI: {  // Short-term
    line1a: ScheduleDLine;  // Box A (basis reported to IRS)
    line1b: ScheduleDLine;  // Box B (basis NOT reported)
    line1c: ScheduleDLine;  // Box C (no 1099-B)
    line7: ScheduleDLine;   // Total short-term
  };
  partII: { // Long-term
    line8a: ScheduleDLine;  // Box A
    line8b: ScheduleDLine;  // Box B
    line8c: ScheduleDLine;  // Box C
    line15: ScheduleDLine;  // Total long-term
  };
  line16: ScheduleDLine;    // Net: line 7 + line 15
}

export interface TaxReport {
  taxYear: number;
  form8949: {
    shortTerm: Form8949Entry[];
    longTerm: Form8949Entry[];
  };
  scheduleD: ScheduleD;
  summary: {
    totalDispositions: number;
    shortTermCount: number;
    longTermCount: number;
    totalProceeds: number;
    totalCostBasis: number;
    totalAdjustments: number;
    netGainOrLoss: number;
    washSaleCount: number;
    washSaleDisallowed: number;
  };
  availableYears: number[];
}

/**
 * Generate Form 8949 entries for a given user and tax year.
 */
export async function generateForm8949(
  userId: string,
  taxYear: number
): Promise<Form8949Entry[]> {
  const yearStart = new Date(`${taxYear}-01-01T00:00:00.000Z`);
  const yearEnd = new Date(`${taxYear + 1}-01-01T00:00:00.000Z`);

  const entries: Form8949Entry[] = [];

  // ========== STOCK DISPOSITIONS ==========
  const stockDispositions = await prisma.lot_dispositions.findMany({
    where: {
      disposed_date: { gte: yearStart, lt: yearEnd },
      lot: { user_id: userId }
    },
    include: { lot: true },
    orderBy: { disposed_date: 'asc' }
  });

  for (const disp of stockDispositions) {
    const adjustmentAmount = disp.is_wash_sale ? disp.wash_sale_loss : 0;
    // Form 8949 column (h): gain/loss = proceeds - cost + wash sale adjustment
    // Wash sale adjustment is positive (adds to cost basis, reducing the loss reported)
    const gainOrLoss = disp.total_proceeds - disp.cost_basis_disposed + adjustmentAmount;

    entries.push({
      description: `${disp.quantity_disposed} sh ${disp.lot.symbol}`,
      dateAcquired: disp.lot.acquired_date.toISOString().split('T')[0],
      dateSold: disp.disposed_date.toISOString().split('T')[0],
      proceeds: round2(disp.total_proceeds),
      costBasis: round2(disp.cost_basis_disposed),
      adjustmentCode: disp.is_wash_sale ? 'W' : '',
      adjustmentAmount: round2(adjustmentAmount),
      gainOrLoss: round2(gainOrLoss),
      isLongTerm: disp.is_long_term,
      holdingDays: disp.holding_period_days,
      symbol: disp.lot.symbol,
      assetType: 'stock',
      // Default to Box A (basis reported to IRS via 1099-B) for broker-imported transactions
      box: 'A'
    });
  }

  // ========== OPTION DISPOSITIONS ==========
  // Get user's investment transaction IDs for scoping
  const userAccounts = await prisma.accounts.findMany({
    where: { userId },
    select: { id: true }
  });
  const accountIds = userAccounts.map(a => a.id);

  if (accountIds.length > 0) {
    const userInvestmentTxnIds = (await prisma.investment_transactions.findMany({
      where: { accountId: { in: accountIds } },
      select: { id: true }
    })).map(t => t.id);

    if (userInvestmentTxnIds.length > 0) {
      const closedOptions = await prisma.trading_positions.findMany({
        where: {
          open_investment_txn_id: { in: userInvestmentTxnIds },
          status: 'CLOSED',
          close_date: { gte: yearStart, lt: yearEnd }
        },
        orderBy: { close_date: 'asc' }
      });

      for (const pos of closedOptions) {
        const closeDate = pos.close_date!;
        const holdingDays = Math.floor(
          (closeDate.getTime() - pos.open_date.getTime()) / MS_PER_DAY
        );
        const isLongTerm = holdingDays >= 365;
        const proceeds = pos.proceeds || 0;
        const costBasis = pos.cost_basis;
        const gainOrLoss = proceeds - costBasis;

        // Build option description: "1 AAPL Jan 20 2025 $150 Call"
        const optDesc = buildOptionDescription(pos);

        entries.push({
          description: optDesc,
          dateAcquired: pos.open_date.toISOString().split('T')[0],
          dateSold: closeDate.toISOString().split('T')[0],
          proceeds: round2(proceeds),
          costBasis: round2(costBasis),
          adjustmentCode: '',
          adjustmentAmount: 0,
          gainOrLoss: round2(gainOrLoss),
          isLongTerm,
          holdingDays,
          symbol: extractUnderlying(pos.symbol),
          assetType: 'option',
          box: 'A'
        });
      }
    }
  }

  // Sort by date sold
  entries.sort((a, b) => a.dateSold.localeCompare(b.dateSold));

  return entries;
}

/**
 * Generate Schedule D from Form 8949 entries.
 */
export function generateScheduleD(entries: Form8949Entry[]): ScheduleD {
  const shortTerm = entries.filter(e => !e.isLongTerm);
  const longTerm = entries.filter(e => e.isLongTerm);

  const stBoxA = shortTerm.filter(e => e.box === 'A');
  const stBoxB = shortTerm.filter(e => e.box === 'B');
  const stBoxC = shortTerm.filter(e => e.box === 'C');
  const ltBoxA = longTerm.filter(e => e.box === 'A');
  const ltBoxB = longTerm.filter(e => e.box === 'B');
  const ltBoxC = longTerm.filter(e => e.box === 'C');

  const sumLine = (items: Form8949Entry[], line: string, desc: string): ScheduleDLine => ({
    line,
    description: desc,
    proceeds: round2(items.reduce((s, e) => s + e.proceeds, 0)),
    costBasis: round2(items.reduce((s, e) => s + e.costBasis, 0)),
    adjustments: round2(items.reduce((s, e) => s + e.adjustmentAmount, 0)),
    gainOrLoss: round2(items.reduce((s, e) => s + e.gainOrLoss, 0)),
  });

  const line1a = sumLine(stBoxA, '1a', 'Short-term from Form 8949 Box A');
  const line1b = sumLine(stBoxB, '1b', 'Short-term from Form 8949 Box B');
  const line1c = sumLine(stBoxC, '1c', 'Short-term from Form 8949 Box C');
  const line7: ScheduleDLine = {
    line: '7',
    description: 'Net short-term capital gain or (loss)',
    proceeds: round2(line1a.proceeds + line1b.proceeds + line1c.proceeds),
    costBasis: round2(line1a.costBasis + line1b.costBasis + line1c.costBasis),
    adjustments: round2(line1a.adjustments + line1b.adjustments + line1c.adjustments),
    gainOrLoss: round2(line1a.gainOrLoss + line1b.gainOrLoss + line1c.gainOrLoss),
  };

  const line8a = sumLine(ltBoxA, '8a', 'Long-term from Form 8949 Box A');
  const line8b = sumLine(ltBoxB, '8b', 'Long-term from Form 8949 Box B');
  const line8c = sumLine(ltBoxC, '8c', 'Long-term from Form 8949 Box C');
  const line15: ScheduleDLine = {
    line: '15',
    description: 'Net long-term capital gain or (loss)',
    proceeds: round2(line8a.proceeds + line8b.proceeds + line8c.proceeds),
    costBasis: round2(line8a.costBasis + line8b.costBasis + line8c.costBasis),
    adjustments: round2(line8a.adjustments + line8b.adjustments + line8c.adjustments),
    gainOrLoss: round2(line8a.gainOrLoss + line8b.gainOrLoss + line8c.gainOrLoss),
  };

  const line16: ScheduleDLine = {
    line: '16',
    description: 'Net capital gain or (loss)',
    proceeds: round2(line7.proceeds + line15.proceeds),
    costBasis: round2(line7.costBasis + line15.costBasis),
    adjustments: round2(line7.adjustments + line15.adjustments),
    gainOrLoss: round2(line7.gainOrLoss + line15.gainOrLoss),
  };

  return {
    partI: { line1a, line1b, line1c, line7 },
    partII: { line8a, line8b, line8c, line15 },
    line16
  };
}

/**
 * Generate the full tax report: Form 8949 + Schedule D + summary.
 */
export async function generateTaxReport(
  userId: string,
  taxYear: number
): Promise<TaxReport> {
  const entries = await generateForm8949(userId, taxYear);
  const scheduleD = generateScheduleD(entries);

  const shortTerm = entries.filter(e => !e.isLongTerm);
  const longTerm = entries.filter(e => e.isLongTerm);
  const washSales = entries.filter(e => e.adjustmentCode === 'W');

  // Determine available years from all dispositions
  const allDispYears = await prisma.lot_dispositions.findMany({
    where: { lot: { user_id: userId } },
    select: { disposed_date: true },
    distinct: ['disposed_date']
  });

  const userAccounts = await prisma.accounts.findMany({
    where: { userId },
    select: { id: true }
  });
  const accountIds = userAccounts.map(a => a.id);

  let optionCloseYears: number[] = [];
  if (accountIds.length > 0) {
    const txnIds = (await prisma.investment_transactions.findMany({
      where: { accountId: { in: accountIds } },
      select: { id: true }
    })).map(t => t.id);

    if (txnIds.length > 0) {
      const closedOpts = await prisma.trading_positions.findMany({
        where: {
          open_investment_txn_id: { in: txnIds },
          status: 'CLOSED',
          close_date: { not: null }
        },
        select: { close_date: true }
      });
      optionCloseYears = closedOpts
        .filter(p => p.close_date)
        .map(p => p.close_date!.getFullYear());
    }
  }

  const stockYears = allDispYears.map(d => d.disposed_date.getFullYear());
  const allYears = [...new Set([...stockYears, ...optionCloseYears])].sort((a, b) => b - a);

  // Ensure current year is always available
  if (!allYears.includes(taxYear)) {
    allYears.push(taxYear);
    allYears.sort((a, b) => b - a);
  }

  return {
    taxYear,
    form8949: {
      shortTerm,
      longTerm
    },
    scheduleD,
    summary: {
      totalDispositions: entries.length,
      shortTermCount: shortTerm.length,
      longTermCount: longTerm.length,
      totalProceeds: round2(entries.reduce((s, e) => s + e.proceeds, 0)),
      totalCostBasis: round2(entries.reduce((s, e) => s + e.costBasis, 0)),
      totalAdjustments: round2(entries.reduce((s, e) => s + e.adjustmentAmount, 0)),
      netGainOrLoss: scheduleD.line16.gainOrLoss,
      washSaleCount: washSales.length,
      washSaleDisallowed: round2(washSales.reduce((s, e) => s + e.adjustmentAmount, 0)),
    },
    availableYears: allYears
  };
}

/**
 * Generate CSV content matching TurboTax Form 8949 import format.
 */
export function generateForm8949CSV(entries: Form8949Entry[]): string {
  const headers = [
    'Description of Property',
    'Date Acquired',
    'Date Sold',
    'Proceeds',
    'Cost or Other Basis',
    'Adjustment Code',
    'Adjustment Amount',
    'Gain or Loss',
    'Short/Long Term',
    'Box'
  ];

  const rows = entries.map(e => [
    csvEscape(e.description),
    e.dateAcquired,
    e.dateSold,
    e.proceeds.toFixed(2),
    e.costBasis.toFixed(2),
    e.adjustmentCode,
    e.adjustmentAmount !== 0 ? e.adjustmentAmount.toFixed(2) : '',
    e.gainOrLoss.toFixed(2),
    e.isLongTerm ? 'Long-term' : 'Short-term',
    e.box
  ]);

  return [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
}

// ============================================
// Helpers
// ============================================

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function csvEscape(s: string): string {
  if (s.includes(',') || s.includes('"') || s.includes('\n')) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

function extractUnderlying(symbol: string): string {
  if (!symbol) return '';
  const parts = symbol.trim().split(/[\s]/);
  const first = parts[0];
  if (/^[A-Z]{1,5}$/.test(first)) return first;
  const match = first.match(/^([A-Z]{1,5})/);
  return match ? match[1] : first.toUpperCase();
}

function buildOptionDescription(pos: {
  symbol: string;
  quantity: number;
  option_type: string | null;
  strike_price: number | null;
  expiration_date: Date | null;
}): string {
  const underlying = extractUnderlying(pos.symbol);
  const qty = Math.abs(pos.quantity);
  const type = pos.option_type || 'Option';
  const strike = pos.strike_price != null ? `$${pos.strike_price}` : '';
  const exp = pos.expiration_date
    ? pos.expiration_date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    : '';

  return `${qty} ${underlying} ${exp} ${strike} ${type}`.replace(/\s+/g, ' ').trim();
}
