import { prisma } from '@/lib/prisma';
import { positionTrackerService } from '@/lib/position-tracker-service';

// ═══════════════════════════════════════════════════════════════
// Classification categories for investment transactions
// ═══════════════════════════════════════════════════════════════

type Category =
  | 'OPTION_OPEN'
  | 'OPTION_CLOSE'
  | 'STOCK_BUY'
  | 'STOCK_SELL'
  | 'CRYPTO_BUY'
  | 'CRYPTO_SELL'
  | 'ASSIGNMENT'
  | 'EXERCISE'
  | 'DIVIDEND'
  | 'TRANSFER'
  | 'DEPOSIT'
  | 'UNKNOWN';

interface ClassifiedTransaction {
  id: string;
  investment_transaction_id: string;
  date: Date;
  name: string;
  type: string | null;
  subtype: string | null;
  amount: number | null;
  price: number | null;
  quantity: number | null;
  fees: number | null;
  security_id: string | null;
  createdAt: Date;
  // From securities join
  ticker_symbol: string | null;
  option_underlying_ticker: string | null;
  option_contract_type: string | null;
  option_strike_price: number | null;
  option_expiration_date: Date | null;
  security_type: string | null;
  // Classification result
  category: Category;
}

export interface OptionTradeGroup {
  underlying: string;
  expiration: string;
  trade_date: string;
  strategy: string;
  leg_count: number;
  legs: Array<{
    id: string;
    name: string;
    type: string;
    contract_type: string;
    strike: number;
    quantity: number;
    price: number;
    amount: number;
  }>;
}

export interface BatchPreviewResult {
  mode: 'preview';
  year: number;
  summary: {
    total_transactions: number;
    duplicates_found: number;
    duplicate_ids: string[];
    after_dedup: number;
    classified: Record<string, number>;
    option_trades_detected: number;
    stock_lots_to_create: number;
    stock_sells_to_match: number;
    dividends_to_book: number;
    skipped_transfers: number;
    skipped_deposits: number;
    unknown_count: number;
  };
  option_trade_groups: OptionTradeGroup[];
  stock_buys: Array<{
    id: string;
    symbol: string;
    date: string;
    quantity: number;
    price: number;
    amount: number;
  }>;
  stock_sells: Array<{
    id: string;
    symbol: string;
    date: string;
    quantity: number;
    price: number;
    amount: number;
  }>;
  errors: string[];
}

// ═══════════════════════════════════════════════════════════════
// classifyAndPreview — Read-only analysis of unprocessed transactions
// ═══════════════════════════════════════════════════════════════

export async function classifyAndPreview(userId: string, year: number): Promise<BatchPreviewResult> {
  const errors: string[] = [];

  // A — Query all unprocessed investment transactions for the year
  // Pattern from src/app/api/investment-transactions/opens/route.ts:16-27
  const startDate = new Date(`${year}-01-01T00:00:00.000Z`);
  const endDate = new Date(`${year + 1}-01-01T00:00:00.000Z`);

  const transactions = await prisma.investment_transactions.findMany({
    where: {
      tradeNum: null,
      accounts: { userId },
      date: { gte: startDate, lt: endDate },
    },
    include: {
      security: true,
    },
    orderBy: { date: 'asc' },
  });

  const totalTransactions = transactions.length;

  // B — Detect duplicates by business key
  // Group by (security_id, date, quantity, price, type, subtype)
  type InvTxn = (typeof transactions)[number];
  const dedupMap = new Map<string, InvTxn[]>();

  for (const txn of transactions) {
    const dateStr = txn.date.toISOString().split('T')[0];
    const key = [
      txn.security_id || 'null',
      dateStr,
      String(txn.quantity),
      String(txn.price),
      txn.type || 'null',
      txn.subtype || 'null',
    ].join('|');

    const group = dedupMap.get(key);
    if (group) {
      group.push(txn);
    } else {
      dedupMap.set(key, [txn]);
    }
  }

  const duplicateIds = new Set<string>();
  for (const group of dedupMap.values()) {
    if (group.length < 2) continue;
    // Sort by createdAt ascending — keep the first, flag the rest
    group.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
    for (let i = 1; i < group.length; i++) {
      duplicateIds.add(group[i].id);
    }
  }

  // C — Classify each non-duplicate transaction
  const classified: ClassifiedTransaction[] = [];

  for (const txn of transactions) {
    if (duplicateIds.has(txn.id)) continue;

    const sec = txn.security;
    const nameLower = (txn.name || '').toLowerCase();
    const hasOptionContract = !!(sec?.option_contract_type);
    const securityType = sec?.type || null;

    let category: Category = 'UNKNOWN';

    // Classification order matters — check specific subtypes first
    if (txn.subtype === 'assignment') {
      category = 'ASSIGNMENT';
    } else if (txn.subtype === 'exercise') {
      category = 'EXERCISE';
    } else if (txn.type === 'cash' && txn.subtype === 'dividend') {
      category = 'DIVIDEND';
    } else if (txn.type === 'cash' && txn.subtype === 'deposit') {
      category = 'DEPOSIT';
    } else if (txn.type === 'transfer' && txn.subtype === 'transfer') {
      category = 'TRANSFER';
    } else if (hasOptionContract) {
      // Option: determine open vs close from name
      if (nameLower.includes('to open') || txn.type === 'buy') {
        // "buy to open" or "sell to open" — both are opens
        if (nameLower.includes('to close')) {
          category = 'OPTION_CLOSE';
        } else if (nameLower.includes('to open')) {
          category = 'OPTION_OPEN';
        } else if (txn.type === 'buy') {
          category = 'OPTION_OPEN';
        } else {
          category = 'OPTION_CLOSE';
        }
      } else if (nameLower.includes('to close') || txn.type === 'sell') {
        category = 'OPTION_CLOSE';
      } else {
        category = 'UNKNOWN';
      }
    } else if (securityType === 'cryptocurrency') {
      category = txn.type === 'buy' ? 'CRYPTO_BUY' : txn.type === 'sell' ? 'CRYPTO_SELL' : 'UNKNOWN';
    } else if (securityType === 'equity' || securityType === 'etf') {
      category = txn.type === 'buy' ? 'STOCK_BUY' : txn.type === 'sell' ? 'STOCK_SELL' : 'UNKNOWN';
    }

    classified.push({
      id: txn.id,
      investment_transaction_id: txn.investment_transaction_id,
      date: txn.date,
      name: txn.name,
      type: txn.type,
      subtype: txn.subtype,
      amount: txn.amount,
      price: txn.price,
      quantity: txn.quantity,
      fees: txn.fees,
      security_id: txn.security_id,
      createdAt: txn.createdAt,
      ticker_symbol: sec?.ticker_symbol || null,
      option_underlying_ticker: sec?.option_underlying_ticker || null,
      option_contract_type: sec?.option_contract_type || null,
      option_strike_price: sec?.option_strike_price || null,
      option_expiration_date: sec?.option_expiration_date || null,
      security_type: securityType,
      category,
    });
  }

  // Count by category
  const categoryCounts: Record<string, number> = {};
  for (const txn of classified) {
    categoryCounts[txn.category] = (categoryCounts[txn.category] || 0) + 1;
  }

  // D — Group options into logical trades
  // Open options: group by (underlying_ticker, option_expiration_date, transaction_date)
  const optionOpens = classified.filter(t => t.category === 'OPTION_OPEN');
  const optionOpenGroups = groupOptionsIntoTrades(optionOpens);

  // Close options: group the same way
  const optionCloses = classified.filter(t => t.category === 'OPTION_CLOSE');
  const optionCloseGroups = groupOptionsIntoTrades(optionCloses);

  const allOptionGroups = [...optionOpenGroups, ...optionCloseGroups];

  // Stock buys — each is one lot
  const stockBuys = classified
    .filter(t => t.category === 'STOCK_BUY')
    .map(t => ({
      id: t.id,
      symbol: t.ticker_symbol || 'UNKNOWN',
      date: t.date.toISOString().split('T')[0],
      quantity: t.quantity || 0,
      price: t.price || 0,
      amount: t.amount || 0,
    }));

  // Stock sells — each is one trade
  const stockSells = classified
    .filter(t => t.category === 'STOCK_SELL')
    .map(t => ({
      id: t.id,
      symbol: t.ticker_symbol || 'UNKNOWN',
      date: t.date.toISOString().split('T')[0],
      quantity: t.quantity || 0,
      price: t.price || 0,
      amount: t.amount || 0,
    }));

  // E — Build preview result
  return {
    mode: 'preview',
    year,
    summary: {
      total_transactions: totalTransactions,
      duplicates_found: duplicateIds.size,
      duplicate_ids: Array.from(duplicateIds),
      after_dedup: classified.length,
      classified: categoryCounts,
      option_trades_detected: allOptionGroups.length,
      stock_lots_to_create: stockBuys.length,
      stock_sells_to_match: stockSells.length,
      dividends_to_book: categoryCounts['DIVIDEND'] || 0,
      skipped_transfers: categoryCounts['TRANSFER'] || 0,
      skipped_deposits: categoryCounts['DEPOSIT'] || 0,
      unknown_count: categoryCounts['UNKNOWN'] || 0,
    },
    option_trade_groups: allOptionGroups,
    stock_buys: stockBuys,
    stock_sells: stockSells,
    errors,
  };
}

// ═══════════════════════════════════════════════════════════════
// Helper: Group option transactions into logical trades
// ═══════════════════════════════════════════════════════════════

function groupOptionsIntoTrades(options: ClassifiedTransaction[]): OptionTradeGroup[] {
  // Group by (underlying_ticker, option_expiration_date, transaction_date)
  const groups = new Map<string, ClassifiedTransaction[]>();

  for (const txn of options) {
    const underlying = txn.option_underlying_ticker || txn.ticker_symbol || 'UNKNOWN';
    const expiration = txn.option_expiration_date
      ? txn.option_expiration_date.toISOString().split('T')[0]
      : 'unknown';
    const tradeDate = txn.date.toISOString().split('T')[0];
    const key = `${underlying}|${expiration}|${tradeDate}`;

    const group = groups.get(key);
    if (group) {
      group.push(txn);
    } else {
      groups.set(key, [txn]);
    }
  }

  const result: OptionTradeGroup[] = [];

  for (const [key, legs] of groups) {
    const [underlying, expiration, tradeDate] = key.split('|');
    const strategy = detectStrategy(legs);

    result.push({
      underlying,
      expiration,
      trade_date: tradeDate,
      strategy,
      leg_count: legs.length,
      legs: legs.map(l => ({
        id: l.id,
        name: l.name,
        type: l.type || 'unknown',
        contract_type: l.option_contract_type || 'unknown',
        strike: l.option_strike_price || 0,
        quantity: l.quantity || 0,
        price: l.price || 0,
        amount: l.amount || 0,
      })),
    });
  }

  return result;
}

// ═══════════════════════════════════════════════════════════════
// Helper: Detect option strategy from legs
// ═══════════════════════════════════════════════════════════════

function detectStrategy(legs: ClassifiedTransaction[]): string {
  const contractTypes = legs.map(l => (l.option_contract_type || '').toLowerCase());
  const calls = contractTypes.filter(c => c === 'call').length;
  const puts = contractTypes.filter(c => c === 'put').length;
  const strikes = new Set(legs.map(l => l.option_strike_price));

  if (legs.length === 4 && calls === 2 && puts === 2) {
    return 'iron-condor';
  }
  if (legs.length === 2 && (calls === 2 || puts === 2) && strikes.size === 2) {
    return calls === 2 ? 'call-spread' : 'put-spread';
  }
  if (legs.length === 2 && calls === 1 && puts === 1) {
    return 'straddle-strangle';
  }
  if (legs.length === 1) {
    return 'single';
  }
  // Fallback for 3-leg or other multi-leg structures
  return `multi-leg-${legs.length}`;
}

// ═══════════════════════════════════════════════════════════════
// processStockBuys — Create stock_lots + journal entries for
// STOCK_BUY and CRYPTO_BUY transactions
// ═══════════════════════════════════════════════════════════════

export interface StockBuyProcessResult {
  lots_created: number;
  journal_entries_created: number;
  trade_numbers_assigned: string[];
  errors: Array<{ transactionId: string; symbol: string; error: string }>;
}

export async function processStockBuys(
  userId: string,
  year: number,
  preview: BatchPreviewResult
): Promise<StockBuyProcessResult> {
  const result: StockBuyProcessResult = {
    lots_created: 0,
    journal_entries_created: 0,
    trade_numbers_assigned: [],
    errors: [],
  };

  // Get the trading entity for this user
  const tradingEntity = await prisma.entities.findFirst({
    where: { userId, entity_type: 'trading' },
  });
  if (!tradingEntity) {
    result.errors.push({
      transactionId: '',
      symbol: '',
      error: 'No trading entity found for user. Cannot create lots.',
    });
    return result;
  }
  const entityId = tradingEntity.id;

  // Combine stock buys and crypto buys into one list
  // Crypto buys from the preview are in classified as CRYPTO_BUY but not in preview.stock_buys.
  // Re-query crypto buys from the classified data. Since classifyAndPreview doesn't expose
  // crypto_buys separately, we query them directly here.
  const startDate = new Date(`${year}-01-01T00:00:00.000Z`);
  const endDate = new Date(`${year + 1}-01-01T00:00:00.000Z`);

  const allUnprocessed = await prisma.investment_transactions.findMany({
    where: {
      tradeNum: null,
      accounts: { userId },
      date: { gte: startDate, lt: endDate },
    },
    include: { security: true },
    orderBy: { date: 'asc' },
  });

  // Build the duplicate ID set (same logic as classifyAndPreview)
  type InvTxn = (typeof allUnprocessed)[number];
  const dedupMap = new Map<string, InvTxn[]>();
  for (const txn of allUnprocessed) {
    const dateStr = txn.date.toISOString().split('T')[0];
    const key = [
      txn.security_id || 'null',
      dateStr,
      String(txn.quantity),
      String(txn.price),
      txn.type || 'null',
      txn.subtype || 'null',
    ].join('|');
    const group = dedupMap.get(key);
    if (group) { group.push(txn); } else { dedupMap.set(key, [txn]); }
  }
  const duplicateIds = new Set<string>();
  for (const group of dedupMap.values()) {
    if (group.length < 2) continue;
    group.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
    for (let i = 1; i < group.length; i++) duplicateIds.add(group[i].id);
  }

  // Filter to stock/ETF buys and crypto buys (non-duplicates, non-options)
  const buyTransactions = allUnprocessed.filter((txn: InvTxn) => {
    if (duplicateIds.has(txn.id)) return false;
    if (txn.type !== 'buy') return false;
    const sec = txn.security;
    if (sec?.option_contract_type) return false; // skip options
    const secType = sec?.type || '';
    return secType === 'equity' || secType === 'etf' || secType === 'cryptocurrency';
  });

  if (buyTransactions.length === 0) return result;

  // Get current global max trade number to start incrementing from
  const existingTradeNums = await prisma.investment_transactions.findMany({
    where: { tradeNum: { not: null }, accounts: { userId } },
    select: { tradeNum: true },
    distinct: ['tradeNum'],
  });
  let globalMaxNum = 0;
  for (const r of existingTradeNums) {
    if (r.tradeNum) {
      const match = r.tradeNum.match(/-(\d+)$/);
      const num = match ? parseInt(match[1], 10) : parseInt(r.tradeNum, 10);
      if (!isNaN(num) && num > globalMaxNum) globalMaxNum = num;
    }
  }

  // Process each buy individually — each buy = one lot = one trade number
  // Uses commitStockTrade() from position-tracker-service.ts (lines 691-769)
  // which creates: stock_lot + journal entry + updates investment_transaction
  for (const txn of buyTransactions) {
    const ticker = (
      txn.security?.ticker_symbol ||
      txn.security?.option_underlying_ticker ||
      'UNKNOWN'
    ).toUpperCase();

    globalMaxNum++;
    const tradeNum = `${ticker}-${String(globalMaxNum).padStart(4, '0')}`;

    try {
      const commitResult = await prisma.$transaction(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        async (tx: any) => {
          return await positionTrackerService.commitStockTrade({
            legs: [{
              id: txn.id,
              date: txn.date,
              symbol: ticker,
              action: 'buy',
              quantity: txn.quantity || 0,
              price: txn.price || 0,
              fees: txn.rhFees || txn.fees || 0,
              amount: txn.amount || 0,
            }],
            strategy: txn.security?.type === 'cryptocurrency' ? 'long-crypto' : 'long-stock',
            tradeNum,
            userId,
            entityId,
            tx,
            createdBy: 'batch-trade-processor',
          });
        },
        { maxWait: 10000, timeout: 30000 }
      );

      result.lots_created += commitResult.committed;
      result.journal_entries_created += commitResult.committed;
      result.trade_numbers_assigned.push(tradeNum);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      result.errors.push({ transactionId: txn.id, symbol: ticker, error: message });
    }
  }

  return result;
}
