/**
 * MODEL-01 STEP 4 — THE LEAF: every number labelled for what it is.
 *
 * PoP is the breakeven-d2 probability under a lognormal model at scan-time IV
 * (strategy-builder.ts calculateBreakevenPoP → probability.ts N(d2)); EV is
 * built from it (or from the leg deltas) — pricing quantities, not forecasts.
 * Every customer-facing surface renders these labels and this tooltip FROM
 * HERE (the build asserts it); the words "win rate" leave every surface that
 * shows a model number. trade_cards.win_rate stays as a column — it holds the
 * model PoP in percent (ConvergenceIntelligence.tsx saveCard) — but the UI
 * names it for what it is.
 */

export const POP_MODEL_LABEL = 'PoP (model)';
export const EV_MODEL_LABEL = 'EV (model)';
export const EV_PER_RISK_MODEL_LABEL = 'EV/Risk (model)';
/** The HV variant: the same breakeven arithmetic with TastyTrade hv30 for σ (normal, zero drift) — still a model number. */
export const HV_POP_MODEL_LABEL = 'PoP (HV model)';

/** The one shared tooltip — the ruling's sentence, verbatim. */
export const MODEL_NUMBER_TOOLTIP = 'breakeven-d2 probability under a lognormal model at scan-time IV — a pricing quantity, not a forecast; realized frequency is measured in EDGE-01.';

/** The HV window and the vendor's undisclosed estimator — stated wherever HV is shown. */
export const HV_SOURCE_NOTE = 'HV is TastyTrade historical-volatility-30-day (hv30; the 60- and 90-day fields arrive alongside). The vendor does not disclose the estimator — return type, sampling or annualization — so the window is known and the method is not.';

/** The filter sliders bound the same model numbers. */
export const MIN_POP_MODEL_LABEL = `Min ${POP_MODEL_LABEL}`;
export const MIN_EV_MODEL_LABEL = `Min ${EV_MODEL_LABEL}`;
export const MIN_EV_PER_RISK_MODEL_LABEL = `Min ${EV_PER_RISK_MODEL_LABEL}`;

/** The method suffix a surface may print beside the number. */
export function popMethodLabel(method: string | null | undefined): string {
  if (method === 'breakeven_d2') return 'N(d2)';
  if (method === 'delta_approx') return 'Δ approx';
  return '—';
}
