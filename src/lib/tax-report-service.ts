import { prisma } from '@/lib/prisma';
import { detectWashSales } from './wash-sale-service';
import type { WashSaleViolation } from './wash-sale-service';

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
  // Form 8949 Box classification (IRS Pub 551):
  //   Short-term:            Long-term:
  //     A = basis reported     D = basis reported
  //     B = basis NOT reported E = basis NOT reported
  //     C = no 1099-B          F = no 1099-B
  box: 'A' | 'B' | 'C' | 'D' | 'E' | 'F';
  // Plain-English justification for the chosen box (for audit trail)
  box_reasoning: string;
}

// Sources we trust to produce broker-reported basis (1099-B covered).
//
// 'legacy' is included because every trading_positions row in this app was
// either broker-imported (via Plaid/TastyTrade/Robinhood) or manually
// entered with an explicit source tag. Rows with source='legacy' came from
// the initial schema where source defaulted to 'legacy' — they are in
// practice broker-imported (1099-B basis is reported). The preferred
// disambiguation is via investment_transactions.accounts.source, which is
// resolved per-position below; `legacy` acts as a safety net when that
// lookup returns null.
const BROKER_IMPORTED_SOURCES = new Set([
  'plaid',
  'tastytrade',
  'robinhood',
  'legacy',
]);

function determineBox(isLongTerm: boolean, source: string | null): Form8949Entry['box'] {
  const normalized = source ? source.toLowerCase() : null;
  const isBrokerImported = normalized !== null && BROKER_IMPORTED_SOURCES.has(normalized);
  if (isLongTerm) return isBrokerImported ? 'D' : 'E';
  return isBrokerImported ? 'A' : 'B';
}

function boxReasoning(isLongTerm: boolean, source: string | null): string {
  const term = isLongTerm ? 'long-term' : 'short-term';
  const normalized = source ? source.toLowerCase() : null;
  const isBrokerImported = normalized !== null && BROKER_IMPORTED_SOURCES.has(normalized);
  if (isBrokerImported) {
    return `Broker-reported basis (source=${source}), ${term}`;
  }
  if (source) {
    return `Unreported basis (source=${source}), ${term}`;
  }
  return `Unknown source (defaulting to unreported), ${term}`;
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
  partII: { // Long-term (IRS Schedule D Part II uses Boxes D/E/F)
    line8a: ScheduleDLine;  // Box D (basis reported to IRS)
    line8b: ScheduleDLine;  // Box E (basis NOT reported)
    line8c: ScheduleDLine;  // Box F (no 1099-B)
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
    // Count of wash-sale violations merged into 8949 entries in-memory
    // but NOT yet persisted to the DB. Call POST /api/tax/wash-sales to persist.
    washSalesApplied: number;
  };
  // User-facing warnings (e.g., "N wash sale violations detected but not persisted")
  warnings: string[];
  availableYears: number[];
}

/**
 * Generate Form 8949 entries for a given user and tax year.
 *
 * Backward-compatible signature: returns just the entries array. Internally
 * delegates to generateForm8949WithMetadata so that wash-sale merging and
 * box coding still run — callers that need the warning/count metadata
 * should use generateForm8949WithMetadata directly.
 */
export async function generateForm8949(
  userId: string,
  taxYear: number
): Promise<Form8949Entry[]> {
  const { entries } = await generateForm8949WithMetadata(userId, taxYear);
  return entries;
}

/**
 * Full Form 8949 generation with metadata.
 *
 * Behavior:
 *   1. Calls detectWashSales(userId) to find unapplied wash-sale violations.
 *   2. Merges violations into 8949 entries IN MEMORY ONLY — does NOT write to
 *      the DB. This is intentional: applyWashSaleAdjustments also mutates the
 *      replacement stock_lot's cost_per_share + total_cost_basis (see
 *      wash-sale-service.ts:wash-sale apply), which is destructive and can
 *      double-adjust if run twice. Users who want to persist should POST to
 *      /api/tax/wash-sales.
 *   3. Determines IRS Box A/B/C/D/E/F per disposition from the transaction
 *      source (broker-imported vs. manual/legacy) and holding period.
 */
export async function generateForm8949WithMetadata(
  userId: string,
  taxYear: number
): Promise<{
  entries: Form8949Entry[];
  washSalesApplied: number;
  warnings: string[];
}> {
  const yearStart = new Date(`${taxYear}-01-01T00:00:00.000Z`);
  const yearEnd = new Date(`${taxYear + 1}-01-01T00:00:00.000Z`);

  const entries: Form8949Entry[] = [];
  const warnings: string[] = [];

  // ========== WASH SALE DETECTION (in-memory merge, non-destructive) ==========
  //
  // detectWashSales scans ALL of the user's losing dispositions against every
  // purchase in the ±30-day window. We use it here to overlay the 'W' adjustment
  // on 8949 entries whose DB row hasn't yet been marked is_wash_sale=true.
  //
  // We do NOT call applyWashSaleAdjustments because it also rewrites the
  // replacement lot's cost_per_share / total_cost_basis. That would turn 8949
  // generation into a destructive operation that double-adjusts on re-run.
  const { violations: washViolations } = await detectWashSales(userId);

  // One violation per dispositionId (wash-sale-service already dedupes with
  // IRS first-in rule, but defensively take the first if duplicates leak).
  const violationsByDispositionId = new Map<string, WashSaleViolation>();
  for (const v of washViolations) {
    if (!violationsByDispositionId.has(v.dispositionId)) {
      violationsByDispositionId.set(v.dispositionId, v);
    }
  }
  let washSalesMergedCount = 0;

  // ========== STOCK DISPOSITIONS ==========
  const stockDispositions = await prisma.lot_dispositions.findMany({
    where: {
      disposed_date: { gte: yearStart, lt: yearEnd },
      lot: { user_id: userId }
    },
    include: { lot: true },
    orderBy: { disposed_date: 'asc' }
  });

  // Build stock-lot source map: lot.investment_txn_id → investment_transactions.accounts.source.
  // Used to determine whether basis was broker-reported (Box A/D) vs. manual (Box B/E).
  const stockLotTxnIds = Array.from(
    new Set(stockDispositions.map(d => d.lot.investment_txn_id).filter(Boolean))
  );
  const stockLotTxns = stockLotTxnIds.length > 0
    ? await prisma.investment_transactions.findMany({
        where: { id: { in: stockLotTxnIds } },
        select: { id: true, accounts: { select: { source: true } } },
      })
    : [];
  const stockTxnSourceById = new Map<string, string | null>();
  for (const t of stockLotTxns) {
    stockTxnSourceById.set(t.id, t.accounts?.source ?? null);
  }

  for (const disp of stockDispositions) {
    const dbAdjustment = disp.is_wash_sale ? disp.wash_sale_loss : 0;
    const pendingViolation = !disp.is_wash_sale
      ? violationsByDispositionId.get(disp.id)
      : undefined;

    let adjustmentCode = '';
    let adjustmentAmount = 0;
    if (disp.is_wash_sale) {
      adjustmentCode = 'W';
      adjustmentAmount = dbAdjustment;
    } else if (pendingViolation) {
      adjustmentCode = 'W';
      adjustmentAmount = pendingViolation.disallowedLoss;
      washSalesMergedCount++;
      console.log(
        `[Form 8949] Merged unapplied wash sale: lot_id=${disp.lot_id}, symbol=${disp.lot.symbol}, disallowed_loss=$${adjustmentAmount.toFixed(2)} (in-memory only; POST /api/tax/wash-sales to persist)`
      );
    }

    // Form 8949 column (h): gain/loss = proceeds - cost + wash sale adjustment
    // Wash sale adjustment is positive (adds to cost basis, reducing the loss reported)
    const gainOrLoss = disp.total_proceeds - disp.cost_basis_disposed + adjustmentAmount;

    const source = stockTxnSourceById.get(disp.lot.investment_txn_id) ?? null;
    const box = determineBox(disp.is_long_term, source);
    const reasoning = boxReasoning(disp.is_long_term, source);

    entries.push({
      description: `${disp.quantity_disposed} sh ${disp.lot.symbol}`,
      dateAcquired: disp.lot.acquired_date.toISOString().split('T')[0],
      dateSold: disp.disposed_date.toISOString().split('T')[0],
      proceeds: round2(disp.total_proceeds),
      costBasis: round2(disp.cost_basis_disposed),
      adjustmentCode,
      adjustmentAmount: round2(adjustmentAmount),
      gainOrLoss: round2(gainOrLoss),
      isLongTerm: disp.is_long_term,
      holdingDays: disp.holding_period_days,
      symbol: disp.lot.symbol,
      assetType: 'stock',
      box,
      box_reasoning: reasoning,
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

      // Build the option-position source map: prefer the source on the
      // opening investment_transaction's linked account (e.g., 'plaid')
      // over trading_positions.source (which defaults to 'legacy' and
      // therefore mis-classifies broker-imported trades as Box B). This is
      // the root-cause fix for Bug 3 (32 TastyTrade/Plaid positions showing
      // as Box B instead of Box A).
      const openTxnIds = Array.from(
        new Set(closedOptions.map((p) => p.open_investment_txn_id).filter(Boolean))
      );
      const openTxnRows = openTxnIds.length > 0
        ? await prisma.investment_transactions.findMany({
            where: { id: { in: openTxnIds } },
            select: { id: true, accounts: { select: { source: true } } },
          })
        : [];
      const openTxnSourceById = new Map<string, string | null>();
      for (const t of openTxnRows) {
        openTxnSourceById.set(t.id, t.accounts?.source ?? null);
      }

      for (const pos of closedOptions) {
        const closeDate = pos.close_date!;
        const holdingDays = Math.floor(
          (closeDate.getTime() - pos.open_date.getTime()) / MS_PER_DAY
        );
        const isLongTerm = holdingDays >= 366;
        const proceeds = pos.proceeds || 0;
        const costBasis = pos.cost_basis;
        // Use the pre-calculated realized_pl which correctly handles
        // LONG (proceeds - cost) vs SHORT (cost - proceeds) positions.
        // Recomputing as proceeds - costBasis is wrong for short positions.
        const basePL = pos.realized_pl ?? (proceeds - costBasis);

        // Check for option-side wash sale (wash-sale-service uses pos.id as dispositionId for options)
        let adjustmentCode = '';
        let adjustmentAmount = 0;
        const optViolation = violationsByDispositionId.get(pos.id);
        if (optViolation) {
          adjustmentCode = 'W';
          adjustmentAmount = optViolation.disallowedLoss;
          washSalesMergedCount++;
          console.log(
            `[Form 8949] Merged unapplied wash sale: option_position_id=${pos.id}, symbol=${pos.symbol}, disallowed_loss=$${adjustmentAmount.toFixed(2)} (in-memory only; POST /api/tax/wash-sales to persist)`
          );
        }

        const gainOrLoss = basePL + adjustmentAmount;

        // Build option description: "1 AAPL Jan 20 2025 $150 Call"
        const optDesc = buildOptionDescription(pos);

        // Prefer the opening account's source (authoritative) over the
        // position's own source field (which commonly defaults to 'legacy').
        const effectiveSource =
          openTxnSourceById.get(pos.open_investment_txn_id) ?? pos.source;
        const box = determineBox(isLongTerm, effectiveSource);
        const reasoning = boxReasoning(isLongTerm, effectiveSource);

        entries.push({
          description: optDesc,
          dateAcquired: pos.open_date.toISOString().split('T')[0],
          dateSold: closeDate.toISOString().split('T')[0],
          proceeds: round2(proceeds),
          costBasis: round2(costBasis),
          adjustmentCode,
          adjustmentAmount: round2(adjustmentAmount),
          gainOrLoss: round2(gainOrLoss),
          isLongTerm,
          holdingDays,
          symbol: extractUnderlying(pos.symbol),
          assetType: 'option',
          box,
          box_reasoning: reasoning,
        });
      }
    }
  }

  // Sort by date sold
  entries.sort((a, b) => a.dateSold.localeCompare(b.dateSold));

  if (washSalesMergedCount > 0) {
    warnings.push(
      `${washSalesMergedCount} wash sale violation(s) detected but not yet applied to DB. ` +
      `Call POST /api/tax/wash-sales to persist the cost-basis adjustments.`
    );
  }

  return { entries, washSalesApplied: washSalesMergedCount, warnings };
}

/**
 * Generate Schedule D from Form 8949 entries.
 */
export function generateScheduleD(entries: Form8949Entry[]): ScheduleD {
  const shortTerm = entries.filter(e => !e.isLongTerm);
  const longTerm = entries.filter(e => e.isLongTerm);

  // IRS Form 8949: short-term uses Boxes A/B/C; long-term uses Boxes D/E/F.
  const stBoxA = shortTerm.filter(e => e.box === 'A');
  const stBoxB = shortTerm.filter(e => e.box === 'B');
  const stBoxC = shortTerm.filter(e => e.box === 'C');
  const ltBoxD = longTerm.filter(e => e.box === 'D');
  const ltBoxE = longTerm.filter(e => e.box === 'E');
  const ltBoxF = longTerm.filter(e => e.box === 'F');

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

  const line8a = sumLine(ltBoxD, '8a', 'Long-term from Form 8949 Box D');
  const line8b = sumLine(ltBoxE, '8b', 'Long-term from Form 8949 Box E');
  const line8c = sumLine(ltBoxF, '8c', 'Long-term from Form 8949 Box F');
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
  const { entries, washSalesApplied, warnings } = await generateForm8949WithMetadata(userId, taxYear);
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
      washSalesApplied,
    },
    warnings,
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
