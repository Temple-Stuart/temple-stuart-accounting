/**
 * Probability utilities for options pricing.
 * Implements the cumulative normal distribution N(x) needed for
 * Black-Scholes probability calculations.
 */

/**
 * Cumulative standard normal distribution function N(x).
 * Uses the Abramowitz & Stegun rational approximation (error < 7.5e-8).
 *
 * This computes P(Z ≤ x) where Z ~ N(0,1).
 */
export function normalCDF(x: number): number {
  if (x > 10) return 1;
  if (x < -10) return 0;

  const a1 = 0.254829592;
  const a2 = -0.284496736;
  const a3 = 1.421413741;
  const a4 = -1.453152027;
  const a5 = 1.061405429;
  const p = 0.3275911;

  const sign = x < 0 ? -1 : 1;
  const absX = Math.abs(x);
  const t = 1.0 / (1.0 + p * absX);
  const y = 1.0 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * Math.exp(-absX * absX / 2);

  return 0.5 * (1.0 + sign * y);
}

/**
 * Calculate d2 for Black-Scholes at a given target price.
 *
 * d2 = [ln(S/K) + (r - sigma^2/2)T] / (sigma * sqrt(T))
 *
 * Where:
 *   S = current underlying price
 *   K = target price (breakeven)
 *   r = risk-free rate (from FRED FEDFUNDS series, converted to decimal). Required — no default.
 *   sigma = implied volatility (annualized, as decimal e.g. 0.25 for 25%)
 *   T = time to expiration in years
 *
 * @returns d2 value, or null if inputs are invalid
 */
export function calcD2(
  spotPrice: number,
  targetPrice: number,
  iv: number,
  dteYears: number,
  riskFreeRate: number,
): number | null {
  if (spotPrice <= 0 || targetPrice <= 0 || iv <= 0 || dteYears <= 0) return null;

  const sqrtT = Math.sqrt(dteYears);
  const d2 = (Math.log(spotPrice / targetPrice) + (riskFreeRate - iv * iv / 2) * dteYears) / (iv * sqrtT);
  return d2;
}

/**
 * Probability that underlying price will be ABOVE targetPrice at expiration.
 * P(S_T > K) = N(d2) where K = targetPrice
 */
export function probAbove(
  spotPrice: number,
  targetPrice: number,
  iv: number,
  dteYears: number,
  riskFreeRate: number,
): number | null {
  const d2 = calcD2(spotPrice, targetPrice, iv, dteYears, riskFreeRate);
  if (d2 === null) return null;
  return normalCDF(d2);
}

/**
 * Probability that underlying price will be BELOW targetPrice at expiration.
 * P(S_T < K) = N(-d2) = 1 - N(d2)
 */
export function probBelow(
  spotPrice: number,
  targetPrice: number,
  iv: number,
  dteYears: number,
  riskFreeRate: number,
): number | null {
  const above = probAbove(spotPrice, targetPrice, iv, dteYears, riskFreeRate);
  if (above === null) return null;
  return 1 - above;
}

/**
 * Probability that underlying stays BETWEEN two prices at expiration.
 * P(lower < S_T < upper) = N(d2_upper) - N(d2_lower)
 *
 * Where d2 is calculated at each boundary:
 * N(d2_upper) = P(S_T > lower), i.e. prob above lower boundary
 * minus P(S_T > upper) = prob above upper boundary
 */
export function probBetween(
  spotPrice: number,
  lowerPrice: number,
  upperPrice: number,
  iv: number,
  dteYears: number,
  riskFreeRate: number,
): number | null {
  const aboveLower = probAbove(spotPrice, lowerPrice, iv, dteYears, riskFreeRate);
  const aboveUpper = probAbove(spotPrice, upperPrice, iv, dteYears, riskFreeRate);
  if (aboveLower === null || aboveUpper === null) return null;
  return aboveLower - aboveUpper;
}
