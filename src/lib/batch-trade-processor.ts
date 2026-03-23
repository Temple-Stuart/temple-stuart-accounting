import { randomUUID } from 'crypto';
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

// ═══════════════════════════════════════════════════════════════
// processOptions — Open and close option positions via
// commitOptionsTrade() from position-tracker-service.ts
// ═══════════════════════════════════════════════════════════════

export interface OptionsProcessResult {
  trades_processed: number;
  positions_opened: number;
  positions_closed: number;
  journal_entries_created: number;
  trade_numbers_assigned: string[];
  errors: Array<{ trade_group: string; error: string }>;
}

export async function processOptions(
  userId: string,
  year: number,
  preview: BatchPreviewResult
): Promise<OptionsProcessResult> {
  const result: OptionsProcessResult = {
    trades_processed: 0,
    positions_opened: 0,
    positions_closed: 0,
    journal_entries_created: 0,
    trade_numbers_assigned: [],
    errors: [],
  };

  // Get the trading entity
  const tradingEntity = await prisma.entities.findFirst({
    where: { userId, entity_type: 'trading' },
  });
  if (!tradingEntity) {
    result.errors.push({ trade_group: '', error: 'No trading entity found for user.' });
    return result;
  }
  const entityId = tradingEntity.id;

  // Re-query unprocessed option transactions (timeout resilience: skips already-processed)
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

  // Build duplicate ID set (same logic as classifyAndPreview)
  type InvTxn = (typeof allUnprocessed)[number];
  const dedupMap = new Map<string, InvTxn[]>();
  for (const txn of allUnprocessed) {
    const dateStr = txn.date.toISOString().split('T')[0];
    const key = [
      txn.security_id || 'null', dateStr, String(txn.quantity),
      String(txn.price), txn.type || 'null', txn.subtype || 'null',
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

  // Filter to option transactions only (non-duplicates, has option_contract_type,
  // not assignment/exercise/expiration — those are Prompt 4)
  const optionTxns = allUnprocessed.filter((txn: InvTxn) => {
    if (duplicateIds.has(txn.id)) return false;
    if (!txn.security?.option_contract_type) return false;
    if (txn.subtype === 'assignment' || txn.subtype === 'exercise') return false;
    const nameLower = (txn.name || '').toLowerCase();
    if (nameLower.includes('expiration')) return false;
    return true;
  });

  if (optionTxns.length === 0) return result;

  // Get current global max trade number
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

  // Group option transactions into trades by (underlying, expiry, date)
  const tradeGroups = new Map<string, InvTxn[]>();
  for (const txn of optionTxns) {
    const sec = txn.security;
    const underlying = (sec?.option_underlying_ticker || sec?.ticker_symbol || 'UNKNOWN').toUpperCase();
    const expiry = sec?.option_expiration_date
      ? sec.option_expiration_date.toISOString().split('T')[0]
      : 'unknown';
    const tradeDate = txn.date.toISOString().split('T')[0];
    const key = `${underlying}|${expiry}|${tradeDate}`;

    const group = tradeGroups.get(key);
    if (group) { group.push(txn); } else { tradeGroups.set(key, [txn]); }
  }

  // Separate into open-only groups, close-only groups, and mixed groups
  const openGroups: Array<[string, InvTxn[]]> = [];
  const closeGroups: Array<[string, InvTxn[]]> = [];
  const mixedGroups: Array<[string, InvTxn[]]> = [];

  for (const [key, txns] of tradeGroups) {
    const hasOpens = txns.some(t => (t.name || '').toLowerCase().includes('to open'));
    const hasCloses = txns.some(t => (t.name || '').toLowerCase().includes('to close'));
    if (hasOpens && hasCloses) {
      mixedGroups.push([key, txns]);
    } else if (hasOpens) {
      openGroups.push([key, txns]);
    } else {
      closeGroups.push([key, txns]);
    }
  }

  // Helper: build InvestmentLeg[] from transactions
  // Follows the exact pattern from commit-to-ledger/route.ts:75-102
  function buildLegs(txns: InvTxn[]) {
    return txns.map(txn => {
      const name = txn.name.toLowerCase();
      const positionEffect: 'open' | 'close' = name.includes('to open') ? 'open' : 'close';
      const action = txn.type as 'buy' | 'sell';
      const symbol = (
        txn.security?.option_underlying_ticker ||
        txn.security?.ticker_symbol ||
        txn.name.split(' ').find((w: string) => /^[A-Z]{1,5}$/.test(w)) ||
        'UNKNOWN'
      ).toUpperCase();

      return {
        id: txn.id,
        date: txn.date,
        name: txn.name,
        symbol,
        strike: txn.security?.option_strike_price || null,
        expiry: txn.security?.option_expiration_date || null,
        contractType: (txn.security?.option_contract_type as 'call' | 'put' | null) || null,
        action,
        positionEffect,
        quantity: txn.quantity || 1,
        price: txn.price || 0,
        fees: txn.rhFees || txn.fees || 0,
        amount: txn.amount || 0,
        subtype: txn.subtype || undefined,
        txnType: txn.type || undefined,
      };
    });
  }

  // Helper: detect strategy from a list of transactions
  function detectGroupStrategy(txns: InvTxn[]): string {
    const contractTypes = txns.map(t => (t.security?.option_contract_type || '').toLowerCase());
    const calls = contractTypes.filter(c => c === 'call').length;
    const puts = contractTypes.filter(c => c === 'put').length;
    const strikes = new Set(txns.map(t => t.security?.option_strike_price));

    if (txns.length === 4 && calls === 2 && puts === 2) return 'iron-condor';
    if (txns.length === 2 && (calls === 2 || puts === 2) && strikes.size === 2) {
      return calls === 2 ? 'call-spread' : 'put-spread';
    }
    if (txns.length === 2 && calls === 1 && puts === 1) return 'straddle-strangle';
    if (txns.length === 1) return 'single';
    return `multi-leg-${txns.length}`;
  }

  // Helper: process a single trade group
  async function processTradeGroup(key: string, txns: InvTxn[]): Promise<void> {
    const [underlying] = key.split('|');
    const strategy = detectGroupStrategy(txns);
    const legs = buildLegs(txns);

    globalMaxNum++;
    const tradeNum = `${underlying}-${String(globalMaxNum).padStart(4, '0')}`;

    try {
      const commitResult = await prisma.$transaction(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        async (tx: any) => {
          return await positionTrackerService.commitOptionsTrade({
            legs,
            strategy,
            tradeNum,
            userId,
            entityId,
            tx,
            createdBy: 'batch-trade-processor',
          });
        },
        { maxWait: 10000, timeout: 30000 }
      );

      result.trades_processed++;
      result.trade_numbers_assigned.push(tradeNum);

      // Count opens and closes from the results
      for (const r of commitResult.results) {
        if (r.action === 'OPEN') {
          result.positions_opened++;
          result.journal_entries_created++;
        } else if (r.action === 'CLOSE' || r.action === 'PARTIAL_CLOSE' ||
                   r.action === 'SPREAD_CLOSE' || r.action === 'SPREAD_CLOSE_SETTLEMENT') {
          result.positions_closed++;
          result.journal_entries_created++;
        }
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      result.errors.push({ trade_group: key, error: message });
    }
  }

  // STEP 1: Process all OPEN groups first (ensures positions exist before closes)
  for (const [key, txns] of openGroups) {
    await processTradeGroup(key, txns);
  }

  // STEP 2: Process mixed groups (opens first within group — handled by commitOptionsTrade)
  for (const [key, txns] of mixedGroups) {
    await processTradeGroup(key, txns);
  }

  // STEP 3: Process all CLOSE groups last
  for (const [key, txns] of closeGroups) {
    await processTradeGroup(key, txns);
  }

  return result;
}

// ═══════════════════════════════════════════════════════════════
// processStockSells — FIFO lot matching + disposition creation
// for STOCK_SELL and CRYPTO_SELL transactions
// Replicates the logic from stock-lots/commit/route.ts since
// that flow is in the route handler, not a reusable service.
// ═══════════════════════════════════════════════════════════════

export interface StockSellProcessResult {
  sells_processed: number;
  dispositions_created: number;
  journal_entries_created: number;
  total_realized_gain_loss: number;
  errors: Array<{ transactionId: string; symbol: string; error: string }>;
}

function daysBetween(date1: Date, date2: Date): number {
  const msPerDay = 24 * 60 * 60 * 1000;
  return Math.floor((date2.getTime() - date1.getTime()) / msPerDay);
}

export async function processStockSells(
  userId: string,
  year: number,
  _preview: BatchPreviewResult
): Promise<StockSellProcessResult> {
  const result: StockSellProcessResult = {
    sells_processed: 0,
    dispositions_created: 0,
    journal_entries_created: 0,
    total_realized_gain_loss: 0,
    errors: [],
  };

  const tradingEntity = await prisma.entities.findFirst({
    where: { userId, entity_type: 'trading' },
  });
  if (!tradingEntity) {
    result.errors.push({ transactionId: '', symbol: '', error: 'No trading entity found.' });
    return result;
  }
  const entityId = tradingEntity.id;

  // Re-query unprocessed sell transactions
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

  // Dedup
  type InvTxn = (typeof allUnprocessed)[number];
  const dedupMap = new Map<string, InvTxn[]>();
  for (const txn of allUnprocessed) {
    const dateStr = txn.date.toISOString().split('T')[0];
    const key = [
      txn.security_id || 'null', dateStr, String(txn.quantity),
      String(txn.price), txn.type || 'null', txn.subtype || 'null',
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

  // Filter to sells only
  const sellTransactions = allUnprocessed.filter((txn: InvTxn) => {
    if (duplicateIds.has(txn.id)) return false;
    if (txn.type !== 'sell') return false;
    const sec = txn.security;
    if (sec?.option_contract_type) return false;
    const secType = sec?.type || '';
    return secType === 'equity' || secType === 'etf' || secType === 'cryptocurrency';
  });

  if (sellTransactions.length === 0) return result;

  // Get global max trade number
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

  // Process each sell — replicates stock-lots/commit/route.ts logic
  for (const txn of sellTransactions) {
    const ticker = (txn.security?.ticker_symbol || 'UNKNOWN').toUpperCase();
    const saleQuantity = Math.abs(txn.quantity || 0);
    const salePrice = txn.price || 0;
    const saleFees = txn.rhFees || txn.fees || 0;
    const saleDateObj = txn.date;
    const totalProceeds = (saleQuantity * salePrice) - saleFees;

    globalMaxNum++;
    const tradeNum = `${ticker}-${String(globalMaxNum).padStart(4, '0')}`;

    try {
      await prisma.$transaction(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        async (tx: any) => {
          // Find open lots FIFO
          const lots = await tx.stock_lots.findMany({
            where: {
              user_id: userId,
              symbol: ticker,
              status: { in: ['OPEN', 'PARTIAL'] },
              remaining_quantity: { gt: 0 },
            },
            orderBy: { acquired_date: 'asc' },
          });

          if (lots.length === 0) {
            throw new Error(`No open lots found for ${ticker}`);
          }

          let remaining = saleQuantity;
          let totalCostBasis = 0;
          let dispositionsCreated = 0;

          for (const lot of lots) {
            if (remaining <= 0) break;
            const quantityFromLot = Math.min(remaining, lot.remaining_quantity);
            if (quantityFromLot <= 0) continue;

            const costBasisUsed = quantityFromLot * lot.cost_per_share;
            const proceedsAllocated = (quantityFromLot / saleQuantity) * totalProceeds;
            const feesAllocated = (quantityFromLot / saleQuantity) * saleFees;
            const gainLoss = proceedsAllocated - costBasisUsed;
            const holdingDays = daysBetween(lot.acquired_date, saleDateObj);
            const isLongTerm = holdingDays >= 365;

            totalCostBasis += costBasisUsed;

            await tx.lot_dispositions.create({
              data: {
                lot_id: lot.id,
                sale_txn_id: txn.id,
                disposed_date: saleDateObj,
                quantity_disposed: quantityFromLot,
                proceeds_per_share: salePrice,
                total_proceeds: proceedsAllocated,
                fees_allocated: feesAllocated,
                cost_basis_disposed: costBasisUsed,
                realized_gain_loss: gainLoss,
                holding_period_days: holdingDays,
                is_long_term: isLongTerm,
                is_wash_sale: false,
                wash_sale_loss: 0,
                matching_method: 'FIFO',
              },
            });
            dispositionsCreated++;

            const newRemaining = lot.remaining_quantity - quantityFromLot;
            await tx.stock_lots.update({
              where: { id: lot.id },
              data: {
                remaining_quantity: Math.max(0, newRemaining),
                status: newRemaining <= 0.0001 ? 'CLOSED' : 'PARTIAL',
              },
            });

            remaining -= quantityFromLot;
          }

          if (remaining > 0.01) {
            throw new Error(`Could not match all shares for ${ticker}: ${remaining.toFixed(4)} remaining`);
          }

          // Journal entry — same pattern as stock-lots/commit/route.ts:211-302
          const TRADING_CASH = '1010';
          const STOCK_POSITION = '1100';
          const proceedsCents = Math.round(totalProceeds * 100);
          const costBasisCents = Math.round(totalCostBasis * 100);
          const plCents = proceedsCents - costBasisCents;
          const PL_ACCOUNT = plCents >= 0 ? '4100' : '5100';

          const accounts = await tx.chart_of_accounts.findMany({
            where: { code: { in: [TRADING_CASH, STOCK_POSITION, PL_ACCOUNT] }, userId, entity_id: entityId },
          });
          const cashAccount = accounts.find((a: { code: string }) => a.code === TRADING_CASH);
          const stockAccount = accounts.find((a: { code: string }) => a.code === STOCK_POSITION);
          const plAccount = accounts.find((a: { code: string }) => a.code === PL_ACCOUNT);

          if (!cashAccount || !stockAccount || !plAccount) {
            throw new Error(`Missing required accounts: ${TRADING_CASH}, ${STOCK_POSITION}, ${PL_ACCOUNT}`);
          }

          const journalEntry = await tx.journal_entries.create({
            data: {
              userId,
              entity_id: entityId,
              date: saleDateObj,
              description: `SELL STOCK: ${saleQuantity} ${ticker} @ $${salePrice.toFixed(2)} (FIFO)`,
              source_type: 'investment_txn',
              source_id: txn.id,
              status: 'posted',
              metadata: { strategy: 'sell-stock', tradeNum },
              request_id: randomUUID(),
              created_by: 'batch-trade-processor',
            },
          });

          // DR Trading Cash
          await tx.ledger_entries.create({
            data: {
              journal_entry_id: journalEntry.id,
              account_id: cashAccount.id,
              amount: BigInt(proceedsCents),
              entry_type: 'D',
              created_by: 'batch-trade-processor',
            },
          });
          await tx.chart_of_accounts.update({
            where: { id: cashAccount.id },
            data: { settled_balance: { increment: BigInt(proceedsCents) }, version: { increment: 1 } },
          });

          // CR Stock Position
          await tx.ledger_entries.create({
            data: {
              journal_entry_id: journalEntry.id,
              account_id: stockAccount.id,
              amount: BigInt(costBasisCents),
              entry_type: 'C',
              created_by: 'batch-trade-processor',
            },
          });
          await tx.chart_of_accounts.update({
            where: { id: stockAccount.id },
            data: { settled_balance: { increment: BigInt(-costBasisCents) }, version: { increment: 1 } },
          });

          // P&L entry
          await tx.ledger_entries.create({
            data: {
              journal_entry_id: journalEntry.id,
              account_id: plAccount.id,
              amount: BigInt(Math.abs(plCents)),
              entry_type: plCents >= 0 ? 'C' : 'D',
              created_by: 'batch-trade-processor',
            },
          });
          const plBalanceChange = plCents >= 0 ? BigInt(Math.abs(plCents)) : BigInt(-Math.abs(plCents));
          await tx.chart_of_accounts.update({
            where: { id: plAccount.id },
            data: { settled_balance: { increment: plBalanceChange }, version: { increment: 1 } },
          });

          // Update investment_transaction
          await tx.investment_transactions.update({
            where: { id: txn.id },
            data: { tradeNum, strategy: 'sell-stock', accountCode: TRADING_CASH },
          });

          result.sells_processed++;
          result.dispositions_created += dispositionsCreated;
          result.journal_entries_created++;
          result.total_realized_gain_loss += plCents / 100;
        },
        { maxWait: 10000, timeout: 30000 }
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      result.errors.push({ transactionId: txn.id, symbol: ticker, error: message });
    }
  }

  return result;
}

// ═══════════════════════════════════════════════════════════════
// processAssignmentsExercises — Flag assignment/exercise records
// for manual review since they require understanding the original
// option position context (put vs call, long vs short) to determine
// the correct accounting treatment.
// ═══════════════════════════════════════════════════════════════

export interface AssignmentExerciseResult {
  processed: number;
  flagged_for_review: number;
  errors: Array<{ transactionId: string; name: string; error: string }>;
}

export async function processAssignmentsExercises(
  userId: string,
  year: number,
  _preview: BatchPreviewResult
): Promise<AssignmentExerciseResult> {
  const result: AssignmentExerciseResult = {
    processed: 0,
    flagged_for_review: 0,
    errors: [],
  };

  const startDate = new Date(`${year}-01-01T00:00:00.000Z`);
  const endDate = new Date(`${year + 1}-01-01T00:00:00.000Z`);

  const unprocessed = await prisma.investment_transactions.findMany({
    where: {
      tradeNum: null,
      accounts: { userId },
      date: { gte: startDate, lt: endDate },
    },
    include: { security: true },
    orderBy: { date: 'asc' },
  });

  type UnprocTxn = (typeof unprocessed)[number];
  const assignmentExerciseTxns = unprocessed.filter((txn: UnprocTxn) =>
    txn.subtype === 'assignment' || txn.subtype === 'exercise'
  );

  if (assignmentExerciseTxns.length === 0) return result;

  // Flag each record for manual review with descriptive context.
  // Assignment/exercise accounting depends on whether it was a put or call,
  // and whether the user was long or short the option — information that
  // requires matching against the original option position which may have
  // been committed with a different trade number in processOptions().
  for (const txn of assignmentExerciseTxns) {
    result.flagged_for_review++;
    result.errors.push({
      transactionId: txn.id,
      name: txn.name,
      error: `FLAGGED FOR MANUAL REVIEW: ${txn.subtype} transaction "${txn.name}" on ${txn.date.toISOString().split('T')[0]}. ` +
        `Amount: $${txn.amount}, Qty: ${txn.quantity}. ` +
        `Requires matching to original option position to determine correct treatment ` +
        `(stock acquisition vs disposal). Use the manual assignment/exercise workflow.`,
    });
  }

  return result;
}

// ═══════════════════════════════════════════════════════════════
// processDividends — Book dividend income journal entries
// DR 1010 (Trading Cash), CR 4300 (Dividend Income)
// ═══════════════════════════════════════════════════════════════

export interface DividendProcessResult {
  dividends_booked: number;
  journal_entries_created: number;
  total_dividend_income: number;
  errors: Array<{ transactionId: string; error: string }>;
}

export async function processDividends(
  userId: string,
  year: number,
  _preview: BatchPreviewResult
): Promise<DividendProcessResult> {
  const result: DividendProcessResult = {
    dividends_booked: 0,
    journal_entries_created: 0,
    total_dividend_income: 0,
    errors: [],
  };

  const tradingEntity = await prisma.entities.findFirst({
    where: { userId, entity_type: 'trading' },
  });
  if (!tradingEntity) {
    result.errors.push({ transactionId: '', error: 'No trading entity found.' });
    return result;
  }
  const entityId = tradingEntity.id;

  const startDate = new Date(`${year}-01-01T00:00:00.000Z`);
  const endDate = new Date(`${year + 1}-01-01T00:00:00.000Z`);

  // Query dividends directly by type+subtype rather than filtering all unprocessed.
  // Cash/dividend transactions may not have a security_id, so we query specifically
  // for type='cash' + subtype='dividend' to avoid issues with security joins.
  const dividendTxns = await prisma.investment_transactions.findMany({
    where: {
      tradeNum: null,
      accounts: { userId },
      date: { gte: startDate, lt: endDate },
      type: 'cash',
      subtype: 'dividend',
    },
    include: { security: true },
    orderBy: { date: 'asc' },
  });

  if (dividendTxns.length === 0) return result;

  // Get global max trade number
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

  const TRADING_CASH = '1010';
  const DIVIDEND_INCOME = '4300';

  for (const txn of dividendTxns) {
    const ticker = (txn.security?.ticker_symbol || 'DIV').toUpperCase();
    globalMaxNum++;
    const tradeNum = `${ticker}-${String(globalMaxNum).padStart(4, '0')}`;
    // Dividend amounts from Plaid are negative (money entering account)
    const dividendAmount = Math.abs(txn.amount || 0);
    const amountCents = Math.round(dividendAmount * 100);

    if (amountCents === 0) continue;

    try {
      await prisma.$transaction(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        async (tx: any) => {
          const accounts = await tx.chart_of_accounts.findMany({
            where: { code: { in: [TRADING_CASH, DIVIDEND_INCOME] }, userId, entity_id: entityId },
          });
          const cashAccount = accounts.find((a: { code: string }) => a.code === TRADING_CASH);
          const divAccount = accounts.find((a: { code: string }) => a.code === DIVIDEND_INCOME);

          if (!cashAccount || !divAccount) {
            throw new Error(`Missing COA accounts: ${TRADING_CASH} or ${DIVIDEND_INCOME}. Ensure trading entity has dividend income account (4300).`);
          }

          // DR Trading Cash, CR Dividend Income
          const journalEntry = await tx.journal_entries.create({
            data: {
              userId,
              entity_id: entityId,
              date: txn.date,
              description: `DIVIDEND: ${ticker} $${dividendAmount.toFixed(2)}`,
              source_type: 'investment_txn',
              source_id: txn.id,
              status: 'posted',
              metadata: { strategy: 'dividend', tradeNum },
              request_id: randomUUID(),
              created_by: 'batch-trade-processor',
            },
          });

          await tx.ledger_entries.create({
            data: {
              journal_entry_id: journalEntry.id,
              account_id: cashAccount.id,
              amount: BigInt(amountCents),
              entry_type: 'D',
              created_by: 'batch-trade-processor',
            },
          });
          await tx.chart_of_accounts.update({
            where: { id: cashAccount.id },
            data: { settled_balance: { increment: BigInt(amountCents) }, version: { increment: 1 } },
          });

          await tx.ledger_entries.create({
            data: {
              journal_entry_id: journalEntry.id,
              account_id: divAccount.id,
              amount: BigInt(amountCents),
              entry_type: 'C',
              created_by: 'batch-trade-processor',
            },
          });
          await tx.chart_of_accounts.update({
            where: { id: divAccount.id },
            data: { settled_balance: { increment: BigInt(amountCents) }, version: { increment: 1 } },
          });

          await tx.investment_transactions.update({
            where: { id: txn.id },
            data: { tradeNum, strategy: 'dividend', accountCode: TRADING_CASH },
          });

          result.dividends_booked++;
          result.journal_entries_created++;
          result.total_dividend_income += dividendAmount;
        },
        { maxWait: 10000, timeout: 30000 }
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      result.errors.push({ transactionId: txn.id, error: message });
    }
  }

  return result;
}

// ═══════════════════════════════════════════════════════════════
// processRemainingCloses — Retry any stuck option closes that
// failed during processOptions (e.g., the PLTR close that had
// "Cannot close 2 contracts - only 1 remaining")
// ═══════════════════════════════════════════════════════════════

export interface RemainingClosesResult {
  retried: number;
  succeeded: number;
  errors: Array<{ transactionId: string; error: string }>;
}

export async function processRemainingCloses(
  userId: string,
  year: number,
  _preview: BatchPreviewResult
): Promise<RemainingClosesResult> {
  const result: RemainingClosesResult = {
    retried: 0,
    succeeded: 0,
    errors: [],
  };

  const tradingEntity = await prisma.entities.findFirst({
    where: { userId, entity_type: 'trading' },
  });
  if (!tradingEntity) return result;
  const entityId = tradingEntity.id;

  const startDate = new Date(`${year}-01-01T00:00:00.000Z`);
  const endDate = new Date(`${year + 1}-01-01T00:00:00.000Z`);

  const unprocessed = await prisma.investment_transactions.findMany({
    where: {
      tradeNum: null,
      accounts: { userId },
      date: { gte: startDate, lt: endDate },
    },
    include: { security: true },
    orderBy: { date: 'asc' },
  });

  // Filter to option closes only (have option_contract_type, name has "to close")
  type CloseTxn = (typeof unprocessed)[number];
  const stuckCloses = unprocessed.filter((txn: CloseTxn) => {
    if (!txn.security?.option_contract_type) return false;
    const nameLower = (txn.name || '').toLowerCase();
    return nameLower.includes('to close');
  });

  if (stuckCloses.length === 0) return result;

  // Get global max trade number
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

  // Try processing each stuck close individually
  for (const txn of stuckCloses) {
    result.retried++;
    const underlying = (
      txn.security?.option_underlying_ticker ||
      txn.security?.ticker_symbol || 'UNKNOWN'
    ).toUpperCase();

    globalMaxNum++;
    const tradeNum = `${underlying}-${String(globalMaxNum).padStart(4, '0')}`;

    try {
      await prisma.$transaction(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        async (tx: any) => {
          const leg = {
            id: txn.id,
            date: txn.date,
            name: txn.name,
            symbol: underlying,
            strike: txn.security?.option_strike_price || null,
            expiry: txn.security?.option_expiration_date || null,
            contractType: (txn.security?.option_contract_type as 'call' | 'put' | null) || null,
            action: txn.type as 'buy' | 'sell',
            positionEffect: 'close' as const,
            quantity: txn.quantity || 1,
            price: txn.price || 0,
            fees: txn.rhFees || txn.fees || 0,
            amount: txn.amount || 0,
            subtype: txn.subtype || undefined,
            txnType: txn.type || undefined,
          };

          await positionTrackerService.commitOptionsTrade({
            legs: [leg],
            strategy: 'single',
            tradeNum,
            userId,
            entityId,
            tx,
            createdBy: 'batch-trade-processor',
          });
        },
        { maxWait: 10000, timeout: 30000 }
      );
      result.succeeded++;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      result.errors.push({ transactionId: txn.id, error: message });
    }
  }

  return result;
}

// ═══════════════════════════════════════════════════════════════
// runValidation — Post-processing integrity checks
// ═══════════════════════════════════════════════════════════════

export interface ValidationResult {
  all_debits_equal_credits: boolean;
  unbalanced_journal_entries: number;
  orphan_open_positions: number;
  negative_lots: number;
  remaining_unprocessed: number;
  total_options_realized_pl: number;
  total_stock_realized_gl: number;
}

export async function runValidation(
  userId: string,
  year: number
): Promise<ValidationResult> {
  // 1. Check every batch-processor journal entry has debits = credits
  const batchJournalEntries = await prisma.journal_entries.findMany({
    where: {
      userId,
      created_by: 'batch-trade-processor',
    },
    select: { id: true },
  });

  let unbalancedCount = 0;
  for (const je of batchJournalEntries) {
    const ledgerEntries = await prisma.ledger_entries.findMany({
      where: { journal_entry_id: je.id },
      select: { entry_type: true, amount: true },
    });
    type LE = { entry_type: string; amount: bigint };
    const debits = ledgerEntries
      .filter((le: LE) => le.entry_type === 'D')
      .reduce((sum: number, le: LE) => sum + Number(le.amount), 0);
    const credits = ledgerEntries
      .filter((le: LE) => le.entry_type === 'C')
      .reduce((sum: number, le: LE) => sum + Number(le.amount), 0);
    if (debits !== credits) unbalancedCount++;
  }

  // 2. No trading_positions with status=OPEN AND close_investment_txn_id IS NOT NULL
  const orphanPositions = await prisma.trading_positions.count({
    where: {
      status: 'OPEN',
      close_investment_txn_id: { not: null },
    },
  });

  // 3. No stock_lots with remaining_quantity < 0
  const negativeLots = await prisma.stock_lots.count({
    where: {
      user_id: userId,
      remaining_quantity: { lt: 0 },
    },
  });

  // 4. Count remaining unprocessed investment_transactions
  const startDate = new Date(`${year}-01-01T00:00:00.000Z`);
  const endDate = new Date(`${year + 1}-01-01T00:00:00.000Z`);
  const remainingUnprocessed = await prisma.investment_transactions.count({
    where: {
      tradeNum: null,
      accounts: { userId },
      date: { gte: startDate, lt: endDate },
    },
  });

  // 5. Total realized P&L from trading_positions (options)
  const optionPositions = await prisma.trading_positions.findMany({
    where: {
      status: 'CLOSED',
      open_date: { gte: startDate, lt: endDate },
    },
    select: { realized_pl: true },
  });
  const totalOptionsPL = optionPositions.reduce(
    (sum: number, p: { realized_pl: number | null }) => sum + (p.realized_pl || 0), 0
  );

  // 6. Total realized gain/loss from lot_dispositions (stocks)
  const dispositions = await prisma.lot_dispositions.findMany({
    where: {
      disposed_date: { gte: startDate, lt: endDate },
      lot: { user_id: userId },
    },
    select: { realized_gain_loss: true },
  });
  const totalStockGL = dispositions.reduce(
    (sum: number, d: { realized_gain_loss: number | null }) => sum + (d.realized_gain_loss || 0), 0
  );

  return {
    all_debits_equal_credits: unbalancedCount === 0,
    unbalanced_journal_entries: unbalancedCount,
    orphan_open_positions: orphanPositions,
    negative_lots: negativeLots,
    remaining_unprocessed: remainingUnprocessed,
    total_options_realized_pl: Math.round(totalOptionsPL * 100) / 100,
    total_stock_realized_gl: Math.round(totalStockGL * 100) / 100,
  };
}

// ═══════════════════════════════════════════════════════════════
// processCallSpreadAssignments — Handle 6 ITM call spread pairs
// Each pair: exercise on long call + assignment on short call
// Net effect = cash settlement, no shares held
// ═══════════════════════════════════════════════════════════════

export interface CallSpreadAssignmentResult {
  pairs_processed: number;
  positions_closed: number;
  journal_entries_created: number;
  transactions_updated: number;
  errors: Array<{ description: string; error: string }>;
}

export async function processCallSpreadAssignments(
  userId: string,
  year: number,
  _preview: BatchPreviewResult
): Promise<CallSpreadAssignmentResult> {
  const result: CallSpreadAssignmentResult = {
    pairs_processed: 0,
    positions_closed: 0,
    journal_entries_created: 0,
    transactions_updated: 0,
    errors: [],
  };

  const tradingEntity = await prisma.entities.findFirst({
    where: { userId, entity_type: 'trading' },
  });
  if (!tradingEntity) {
    result.errors.push({ description: '', error: 'No trading entity found.' });
    return result;
  }
  const entityId = tradingEntity.id;

  // Fetch unprocessed assignment/exercise transactions
  const startDate = new Date(`${year}-01-01T00:00:00.000Z`);
  const endDate = new Date(`${year + 1}-01-01T00:00:00.000Z`);

  const unprocessed = await prisma.investment_transactions.findMany({
    where: {
      tradeNum: null,
      accounts: { userId },
      date: { gte: startDate, lt: endDate },
    },
    include: { security: true },
    orderBy: { date: 'asc' },
  });

  type AETxn = (typeof unprocessed)[number];
  const assignmentExerciseTxns = unprocessed.filter((txn: AETxn) =>
    txn.subtype === 'assignment' || txn.subtype === 'exercise'
  );

  if (assignmentExerciseTxns.length === 0) return result;

  // Group by date to find pairs (exercise + assignment on same date = one spread settlement)
  const byDate = new Map<string, AETxn[]>();
  for (const txn of assignmentExerciseTxns) {
    const dateKey = txn.date.toISOString().split('T')[0];
    const group = byDate.get(dateKey);
    if (group) { group.push(txn); } else { byDate.set(dateKey, [txn]); }
  }

  // Get global max trade number
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

  // Process each date group
  for (const [dateKey, txns] of byDate) {
    // Within each date, pair exercises with assignments by extracting symbol from security
    // Group by underlying symbol
    const bySymbol = new Map<string, { exercises: AETxn[]; assignments: AETxn[] }>();
    for (const txn of txns) {
      const symbol = (
        txn.security?.option_underlying_ticker ||
        txn.security?.ticker_symbol ||
        'UNKNOWN'
      ).toUpperCase();
      if (!bySymbol.has(symbol)) bySymbol.set(symbol, { exercises: [], assignments: [] });
      const group = bySymbol.get(symbol)!;
      if (txn.subtype === 'exercise') group.exercises.push(txn);
      else group.assignments.push(txn);
    }

    for (const [symbol, group] of bySymbol) {
      const { exercises, assignments } = group;
      const pairDesc = `${symbol} ${dateKey}: ${exercises.length} exercises, ${assignments.length} assignments`;

      if (exercises.length === 0 && assignments.length === 0) continue;

      globalMaxNum++;
      const tradeNum = `${symbol}-${String(globalMaxNum).padStart(4, '0')}`;

      try {
        await prisma.$transaction(
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          async (tx: any) => {
            // Build all legs as close legs and route through commitOptionsTrade
            // which will detect the exercise/assignment pattern via name parsing
            // and use closeSpreadAtomically()
            const allTxns = [...exercises, ...assignments];
            const legs = allTxns.map(txn => {
              const name = txn.name.toLowerCase();
              const action = txn.type as 'buy' | 'sell';
              const sec = txn.security;

              return {
                id: txn.id,
                date: txn.date,
                name: txn.name,
                symbol,
                strike: sec?.option_strike_price || null,
                expiry: sec?.option_expiration_date || null,
                contractType: (sec?.option_contract_type as 'call' | 'put' | null) || null,
                action,
                positionEffect: 'close' as const,
                quantity: Math.abs(txn.quantity || 1),
                price: txn.price || 0,
                fees: txn.rhFees || txn.fees || 0,
                amount: txn.amount || 0,
                subtype: txn.subtype || undefined,
                txnType: txn.type || undefined,
              };
            });

            // commitOptionsTrade detects exercise/assignment in names (lines 54-57)
            // and routes to closeSpreadAtomically which finds open positions by trade_num.
            // But these positions were opened with different trade numbers. So we need
            // to find and close the positions directly.

            // Find open positions matching each leg
            for (const txn of allTxns) {
              const sec = txn.security;
              // Assignment/exercise transactions are type='transfer' — their security
              // may not have option fields. Parse strike and type from the name:
              // "transfer - exercise of 1 PLTR call with strike of $170.00"
              // "transfer - assignment of 3 XOM calls with strike of $111.00"
              const nameLower = (txn.name || '').toLowerCase();
              const nameMatch = nameLower.match(/\b(call|put)s?\b.*?strike\s+of\s+\$?([\d.]+)/);

              const strike = nameMatch
                ? parseFloat(nameMatch[2])
                : sec?.option_strike_price;
              const optionType = nameMatch
                ? nameMatch[1].toUpperCase()  // "call" → "CALL"
                : sec?.option_contract_type?.toUpperCase();
              const expiry = sec?.option_expiration_date;

              if (!strike || !optionType) {
                result.errors.push({
                  description: pairDesc,
                  error: `Cannot extract strike/type from txn ${txn.id}: ${txn.name}`,
                });
                continue;
              }

              // Find matching open position
              const openPosition = await tx.trading_positions.findFirst({
                where: {
                  symbol,
                  strike_price: strike,
                  option_type: optionType,
                  status: 'OPEN',
                  // Match by expiration if available
                  ...(expiry ? { expiration_date: expiry } : {}),
                },
                orderBy: { open_date: 'asc' },
              });

              if (!openPosition) {
                result.errors.push({
                  description: pairDesc,
                  error: `No open ${optionType} position found for ${symbol} $${strike}`,
                });
                continue;
              }

              // Close the position: proceeds = 0 for exercise/assignment
              // Realized P&L = -(cost_basis) for exercise (money spent on premium is lost)
              // Realized P&L = +(cost_basis) for assignment (premium received is kept)
              const isExercise = txn.subtype === 'exercise';
              const costBasis = openPosition.cost_basis; // in dollars
              const realizedPL = isExercise ? -(costBasis) : costBasis;

              await tx.trading_positions.update({
                where: { id: openPosition.id },
                data: {
                  status: 'CLOSED',
                  remaining_quantity: 0,
                  close_investment_txn_id: txn.id,
                  close_date: txn.date,
                  close_price: 0,
                  close_fees: 0,
                  proceeds: 0,
                  realized_pl: realizedPL,
                },
              });
              result.positions_closed++;

              // Create journal entry to reverse the position
              const positionAccount = openPosition.position_type === 'LONG'
                ? (optionType === 'CALL' ? '1200' : '1210')
                : (optionType === 'CALL' ? '2100' : '2110');
              const originalCostCents = Math.round(Math.abs(costBasis) * 100);
              const isGain = realizedPL > 0;
              const plAccount = isGain ? '4100' : '5100';

              const accounts = await tx.chart_of_accounts.findMany({
                where: {
                  code: { in: [positionAccount, plAccount] },
                  userId,
                  entity_id: entityId,
                },
              });

              const posAcct = accounts.find((a: { code: string }) => a.code === positionAccount);
              const plAcct = accounts.find((a: { code: string }) => a.code === plAccount);

              if (!posAcct || !plAcct) {
                result.errors.push({
                  description: pairDesc,
                  error: `Missing COA accounts: ${positionAccount} or ${plAccount}`,
                });
                continue;
              }

              // Journal entry: reverse the position, book P&L
              // Exercise (LONG): CR position (remove asset), DR loss (premium lost)
              // Assignment (SHORT): DR position (remove liability), CR gain (premium kept)
              const journalEntry = await tx.journal_entries.create({
                data: {
                  userId,
                  entity_id: entityId,
                  date: txn.date,
                  description: `${isExercise ? 'EXERCISE' : 'ASSIGNMENT'}: ${symbol} $${strike} ${optionType}`,
                  source_type: 'investment_txn',
                  source_id: txn.id,
                  status: 'posted',
                  metadata: { strategy: 'call-spread', tradeNum },
                  request_id: randomUUID(),
                  created_by: 'batch-trade-processor',
                },
              });

              if (isExercise) {
                // Remove LONG asset: CR position, DR loss
                await tx.ledger_entries.create({
                  data: {
                    journal_entry_id: journalEntry.id,
                    account_id: posAcct.id,
                    amount: BigInt(originalCostCents),
                    entry_type: 'C',
                    created_by: 'batch-trade-processor',
                  },
                });
                await tx.chart_of_accounts.update({
                  where: { id: posAcct.id },
                  data: { settled_balance: { increment: BigInt(-originalCostCents) }, version: { increment: 1 } },
                });

                await tx.ledger_entries.create({
                  data: {
                    journal_entry_id: journalEntry.id,
                    account_id: plAcct.id,
                    amount: BigInt(originalCostCents),
                    entry_type: 'D',
                    created_by: 'batch-trade-processor',
                  },
                });
                await tx.chart_of_accounts.update({
                  where: { id: plAcct.id },
                  data: { settled_balance: { increment: BigInt(-originalCostCents) }, version: { increment: 1 } },
                });
              } else {
                // Remove SHORT liability: DR position, CR gain
                await tx.ledger_entries.create({
                  data: {
                    journal_entry_id: journalEntry.id,
                    account_id: posAcct.id,
                    amount: BigInt(originalCostCents),
                    entry_type: 'D',
                    created_by: 'batch-trade-processor',
                  },
                });
                await tx.chart_of_accounts.update({
                  where: { id: posAcct.id },
                  data: { settled_balance: { increment: BigInt(originalCostCents) }, version: { increment: 1 } },
                });

                await tx.ledger_entries.create({
                  data: {
                    journal_entry_id: journalEntry.id,
                    account_id: plAcct.id,
                    amount: BigInt(originalCostCents),
                    entry_type: 'C',
                    created_by: 'batch-trade-processor',
                  },
                });
                await tx.chart_of_accounts.update({
                  where: { id: plAcct.id },
                  data: { settled_balance: { increment: BigInt(originalCostCents) }, version: { increment: 1 } },
                });
              }

              result.journal_entries_created++;

              // Update investment_transaction
              await tx.investment_transactions.update({
                where: { id: txn.id },
                data: {
                  tradeNum,
                  strategy: 'call-spread',
                  accountCode: positionAccount,
                },
              });
              result.transactions_updated++;
            }

            result.pairs_processed++;
          },
          { maxWait: 10000, timeout: 30000 }
        );
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        result.errors.push({ description: pairDesc, error: message });
      }
    }
  }

  return result;
}
