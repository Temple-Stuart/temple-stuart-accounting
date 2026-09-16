/**
 * TRADE-LOG-01 — THE OPTION P&L ARITHMETIC, in one place.
 *
 * These four functions were inline in src/lib/position-tracker-service.ts —
 * the cost basis at `openPosition` (:149-155) and the proceeds / realized P&L
 * at `closePosition` (:275-288). A hand-entered close must produce the SAME
 * number as a synced one, so the ruling says reuse, never retype: the tracker
 * service now CALLS these, and the manual writer calls them too. One path, one
 * answer, one place to be wrong.
 *
 * MONEY IS CENTS (integers) inside this leaf. The caller divides by 100 on the
 * way into the row, exactly as the tracker service always did
 * (`cost_basis: costBasis / 100`). Nothing here rounds a dollar amount.
 *
 * A leaf: no imports, no database, no vendor.
 */

/** Every option contract is 100 shares. The tracker service's own `multiplier`. */
export const OPTION_MULTIPLIER = 100;

/** Which way a leg goes. 'buy' opens LONG / closes a SHORT; 'sell' opens SHORT / closes a LONG. */
export type LegAction = 'buy' | 'sell';
/** What the row records once opened. */
export type PositionType = 'LONG' | 'SHORT';

/**
 * The cost basis of an OPENING leg, in cents.
 * position-tracker-service.ts:149-155 — a buy pays the fee, a sell keeps less of the credit.
 */
export function openCostBasisCents(input: { action: LegAction; price: number; quantity: number; fees: number }): number {
  const { action, price, quantity, fees } = input;
  return action === 'buy'
    ? Math.round((price * quantity * OPTION_MULTIPLIER + fees) * 100)
    : Math.round((price * quantity * OPTION_MULTIPLIER - fees) * 100);
}

/** The position a leg opens. position-tracker-service.ts:157 — buy is LONG, sell is SHORT. */
export function positionTypeOf(action: LegAction): PositionType {
  return action === 'buy' ? 'LONG' : 'SHORT';
}

/**
 * The proceeds of a CLOSING leg, in cents.
 * position-tracker-service.ts:276-281 — selling to close nets the fee out,
 * buying to close adds it on.
 */
export function closeProceedsCents(input: { action: LegAction; price: number; quantity: number; fees: number }): number {
  const { action, price, quantity, fees } = input;
  return action === 'sell'
    ? Math.round((price * quantity * OPTION_MULTIPLIER - fees) * 100)
    : Math.round((price * quantity * OPTION_MULTIPLIER + fees) * 100);
}

/**
 * Realized P&L in cents. position-tracker-service.ts:283-287 — a LONG makes
 * money when proceeds beat the cost; a SHORT when the cost (the credit taken
 * in) beats what it costs to buy back.
 */
export function realizedPlCents(input: { positionType: PositionType; proceedsCents: number; originalCostCents: number }): number {
  const { positionType, proceedsCents, originalCostCents } = input;
  return positionType === 'LONG' ? proceedsCents - originalCostCents : originalCostCents - proceedsCents;
}

/**
 * The cost basis attributable to the quantity being closed, in cents.
 * position-tracker-service.ts:231-232 — a partial close takes its share.
 * `costBasis` is the row's stored DOLLAR value (trading_positions.cost_basis).
 */
export function proportionalCostCents(input: { closeQty: number; positionQty: number; costBasis: number }): number {
  const { closeQty, positionQty, costBasis } = input;
  if (positionQty === 0) return 0;
  return Math.round(((closeQty / positionQty) * costBasis) * 100);
}

/**
 * A whole one-leg round trip, for a hand-entered CLOSED leg: open and close in
 * one call, every number from the functions above. Returns DOLLARS, the shape
 * a trading_positions row stores.
 *
 * `closeQty` defaults to the full quantity — a hand-entered close is whole
 * unless the caller says otherwise. Nothing is defaulted that the form asks
 * for: price, quantity and fees all arrive from the user.
 */
export function roundTrip(input: {
  openAction: LegAction;
  openPrice: number;
  quantity: number;
  openFees: number;
  closePrice: number;
  closeFees: number;
  closeQty?: number;
}): { positionType: PositionType; costBasis: number; proceeds: number; realizedPl: number } {
  const { openAction, openPrice, quantity, openFees, closePrice, closeFees } = input;
  const closeQty = input.closeQty ?? quantity;
  const positionType = positionTypeOf(openAction);
  const costBasisCents = openCostBasisCents({ action: openAction, price: openPrice, quantity, fees: openFees });
  const costBasis = costBasisCents / 100;
  // The closing leg is the opposite action — a LONG is sold to close, a SHORT bought back.
  const closeAction: LegAction = openAction === 'buy' ? 'sell' : 'buy';
  const proceedsCents = closeProceedsCents({ action: closeAction, price: closePrice, quantity: closeQty, fees: closeFees });
  const originalCostCents = proportionalCostCents({ closeQty, positionQty: quantity, costBasis });
  const plCents = realizedPlCents({ positionType, proceedsCents, originalCostCents });
  return {
    positionType,
    costBasis,
    proceeds: proceedsCents / 100,
    realizedPl: plCents / 100,
  };
}
