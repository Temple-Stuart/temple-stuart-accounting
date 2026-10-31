/**
 * TRADE-LOG-01 — BUILDING A HAND-ENTERED TRADE. Pure: no database, no clock,
 * no vendor. The route below it supplies the user, the trade number and the
 * store; everything that decides what the rows CONTAIN is here, so a test can
 * check the arithmetic without a database.
 *
 * WHAT IT PRODUCES. One `trading_positions` row per leg, grouped by one
 * `trade_num` — the same shape the synced path writes at
 * position-tracker-service.ts:175-183 (open) and :313-326 (close). The columns
 * are filled from the same functions the synced path now calls
 * (src/lib/tradeLog/optionPnl.ts), so a hand-entered close and a synced close
 * of the same legs produce the SAME realized_pl.
 *
 * WHAT IT NEVER DOES. It never defaults a price, a date, a quantity or a fee.
 * Every number a reader needs either arrives from the form or the build is
 * REFUSED with the reason. In particular a CLOSED leg always gets a non-null
 * `realized_pl`: trade-card-links/route.ts:79 sums `p.realized_pl ?? 0`, so a
 * null on a closed leg would be silently graded as a zero-P&L trade. This
 * writer cannot produce that row.
 */

import { OPTION_MULTIPLIER, roundTrip, openCostBasisCents, positionTypeOf, type LegAction } from './optionPnl';
import { MANUAL_SOURCE } from './ownership';

/** One leg, as the form collects it. Nothing here is optional except the closing half. */
export interface ManualLegInput {
  /** 'buy' opens LONG, 'sell' opens SHORT — the synced path's own rule. */
  side: LegAction;
  optionType: 'CALL' | 'PUT';
  strike: number;
  /** ISO date (YYYY-MM-DD) — the contract's expiration. */
  expiry: string;
  /** Contracts. Positive. */
  quantity: number;
  /** Per-contract premium, in dollars, as the broker shows it. */
  openPrice: number;
  /** The fee the open cost. Asked for, never assumed — it enters the cost basis. */
  openFees: number;
  /** Present only on a closed leg; both or neither. */
  closePrice?: number | null;
  closeFees?: number | null;
}

/** One trade, as the form submits it. */
export interface ManualTradeInput {
  symbol: string;
  /** From AVAILABLE_STRATEGIES (filter-types.ts) — the builders' own list, never free text. */
  strategy: string;
  /** ISO date the position was opened. */
  openDate: string;
  /** ISO date it was closed, when it is closed. Every leg closes together or none does. */
  closeDate?: string | null;
  legs: ManualLegInput[];
}

/** The row this writer hands the store — the column set of trading_positions. */
export interface ManualPositionRow {
  open_investment_txn_id: null;
  userId: string;
  symbol: string;
  option_type: string;
  strike_price: number;
  expiration_date: Date;
  position_type: 'LONG' | 'SHORT';
  quantity: number;
  remaining_quantity: number;
  open_price: number;
  open_fees: number;
  open_date: Date;
  cost_basis: number;
  status: 'OPEN' | 'CLOSED';
  close_investment_txn_id: null;
  close_price: number | null;
  close_fees: number | null;
  close_date: Date | null;
  proceeds: number | null;
  realized_pl: number | null;
  trade_num: string;
  strategy: string;
  source: string;
}

export type BuildResult =
  | { ok: true; rows: ManualPositionRow[]; closed: boolean; realizedPl: number | null }
  | { ok: false; reason: string };

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/** A finite number, and not a string that happens to parse. */
function num(v: unknown): v is number {
  return typeof v === 'number' && Number.isFinite(v);
}

/**
 * The trade number a hand-entered trade takes: the TICKER-0042 form the app
 * already uses (max-trade-num/route.ts:6-11 parses both it and the bare "42").
 */
export function manualTradeNum(symbol: string, next: number): string {
  return `${symbol.toUpperCase()}-${String(next).padStart(4, '0')}`;
}

/**
 * Validate and build. `userId` and `tradeNum` come from the route; everything
 * else from the form. Returns the refusal's reason rather than throwing, so the
 * route can answer 400 with words the person can act on.
 */
export function buildManualTrade(input: ManualTradeInput, userId: string, tradeNum: string, allowedStrategies: readonly string[]): BuildResult {
  const symbol = (input.symbol ?? '').trim().toUpperCase();
  if (!symbol) return { ok: false, reason: 'A symbol is required.' };
  if (symbol.length > 20) return { ok: false, reason: 'A symbol is at most 20 characters.' };

  if (!input.strategy || !allowedStrategies.includes(input.strategy)) {
    return { ok: false, reason: `Strategy must be one the scanner builds: ${allowedStrategies.join(', ')}.` };
  }

  if (!ISO_DATE.test(input.openDate ?? '')) return { ok: false, reason: 'An open date (YYYY-MM-DD) is required.' };
  const openDate = new Date(`${input.openDate}T00:00:00.000Z`);
  if (Number.isNaN(openDate.getTime())) return { ok: false, reason: 'The open date is not a real date.' };

  const legs = Array.isArray(input.legs) ? input.legs : [];
  if (legs.length === 0) return { ok: false, reason: 'A trade needs at least one leg.' };
  if (legs.length > 8) return { ok: false, reason: 'A trade takes at most 8 legs.' };

  // Closing is all-or-nothing: a trade is CLOSED only when a close date is
  // given AND every leg carries its own close price and fee. A half-closed
  // hand entry would leave a CLOSED row with a null realized_pl, which is the
  // row trade-card-links/route.ts:79 silently grades as zero.
  const wantsClose = !!input.closeDate;
  if (wantsClose && !ISO_DATE.test(input.closeDate!)) return { ok: false, reason: 'The close date must be YYYY-MM-DD.' };
  const closeDate = wantsClose ? new Date(`${input.closeDate}T00:00:00.000Z`) : null;
  if (closeDate && Number.isNaN(closeDate.getTime())) return { ok: false, reason: 'The close date is not a real date.' };
  if (closeDate && closeDate < openDate) return { ok: false, reason: 'The close date is before the open date.' };

  const rows: ManualPositionRow[] = [];
  let totalRealized = 0;

  for (let i = 0; i < legs.length; i += 1) {
    const leg = legs[i];
    const at = `Leg ${i + 1}`;
    if (leg?.side !== 'buy' && leg?.side !== 'sell') return { ok: false, reason: `${at}: side must be buy or sell.` };
    if (leg.optionType !== 'CALL' && leg.optionType !== 'PUT') return { ok: false, reason: `${at}: type must be CALL or PUT.` };
    if (!num(leg.strike) || leg.strike <= 0) return { ok: false, reason: `${at}: a strike above 0 is required.` };
    if (!ISO_DATE.test(leg.expiry ?? '')) return { ok: false, reason: `${at}: an expiry (YYYY-MM-DD) is required.` };
    const expiry = new Date(`${leg.expiry}T00:00:00.000Z`);
    if (Number.isNaN(expiry.getTime())) return { ok: false, reason: `${at}: the expiry is not a real date.` };
    if (!num(leg.quantity) || leg.quantity <= 0) return { ok: false, reason: `${at}: a quantity above 0 is required.` };
    if (!num(leg.openPrice) || leg.openPrice < 0) return { ok: false, reason: `${at}: an open price is required.` };
    if (!num(leg.openFees) || leg.openFees < 0) return { ok: false, reason: `${at}: an open fee is required — enter 0 if there was none.` };

    const hasClosePrice = num(leg.closePrice);
    const hasCloseFees = num(leg.closeFees);
    if (wantsClose) {
      if (!hasClosePrice || (leg.closePrice as number) < 0) return { ok: false, reason: `${at}: a close price is required to close this trade.` };
      if (!hasCloseFees || (leg.closeFees as number) < 0) return { ok: false, reason: `${at}: a close fee is required — enter 0 if there was none.` };
    } else if (hasClosePrice || hasCloseFees) {
      return { ok: false, reason: `${at}: a close price was given with no close date — a trade closes on a date.` };
    }

    const positionType = positionTypeOf(leg.side);

    if (wantsClose) {
      const rt = roundTrip({
        openAction: leg.side,
        openPrice: leg.openPrice,
        quantity: leg.quantity,
        openFees: leg.openFees,
        closePrice: leg.closePrice as number,
        closeFees: leg.closeFees as number,
      });
      totalRealized += rt.realizedPl;
      rows.push({
        open_investment_txn_id: null,
        userId,
        symbol,
        option_type: leg.optionType,
        strike_price: leg.strike,
        expiration_date: expiry,
        position_type: rt.positionType,
        quantity: leg.quantity,
        remaining_quantity: 0,
        open_price: leg.openPrice,
        open_fees: leg.openFees,
        open_date: openDate,
        cost_basis: rt.costBasis,
        status: 'CLOSED',
        close_investment_txn_id: null,
        close_price: leg.closePrice as number,
        close_fees: leg.closeFees as number,
        close_date: closeDate,
        proceeds: rt.proceeds,
        realized_pl: rt.realizedPl,
        trade_num: tradeNum,
        strategy: input.strategy,
        source: MANUAL_SOURCE,
      });
    } else {
      const costBasis = openCostBasisCents({ action: leg.side, price: leg.openPrice, quantity: leg.quantity, fees: leg.openFees }) / 100;
      rows.push({
        open_investment_txn_id: null,
        userId,
        symbol,
        option_type: leg.optionType,
        strike_price: leg.strike,
        expiration_date: expiry,
        position_type: positionType,
        quantity: leg.quantity,
        remaining_quantity: leg.quantity,
        open_price: leg.openPrice,
        open_fees: leg.openFees,
        open_date: openDate,
        cost_basis: costBasis,
        status: 'OPEN',
        close_investment_txn_id: null,
        close_price: null,
        close_fees: null,
        close_date: null,
        proceeds: null,
        realized_pl: null,
        trade_num: tradeNum,
        strategy: input.strategy,
        source: MANUAL_SOURCE,
      });
    }
  }

  return {
    ok: true,
    rows,
    closed: wantsClose,
    realizedPl: wantsClose ? Math.round(totalRealized * 100) / 100 : null,
  };
}

/** The contract size, re-exported so a surface can say "× 100" without a second const. */
export { OPTION_MULTIPLIER };
