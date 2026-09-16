import { MIN_N, tradesNeededForTenPointEdge } from './stats';
import { SELF_REPORTED_BIAS_NOTE } from '../tradeLog/ownership';

/**
 * EDGE-01 STEP 2 — the honest frame, printed at the top of every run by the
 * script itself.
 */
export function honestFrame(): string[] {
  return [
    'THE HONEST FRAME',
    'This is one founder\'s discretionary trades, hand-linked and hand-graded, over a short window — a FIRST',
    'LOOK at prediction against outcome, not a backtest. Four biases, and the direction each pushes:',
    '  1. Selection — only the cards the founder chose to trade are here; the scanner\'s other cards were never',
    '     filled. Pushes every bucket toward the founder\'s taste, not the model\'s: a good discretionary filter',
    '     makes the model look better than it is, a bad one worse — the direction is unknown, the size is not small.',
    '  2. Survivorship — only the trades the founder chose to link to a card are graded; unlinked closed trades',
    '     are counted but never scored. Pushes win rates UP if losers were linked less often (the usual way).',
    '  3. Self-reported entry — TRADE-LOG-01 lets a trade be logged by hand, and a hand-entered trade is graded,',
    '     linked and counted exactly like a synced one. ' + SELF_REPORTED_BIAS_NOTE,
    '     Pushes a hand-entered bucket toward the remembered trade: a fill recalled a little better than it was, a',
    '     fee left off, a loser never typed in at all. The books split every bucket by source so the two are never',
    '     read as one — read a HAND-ENTERED bucket as the trader\'s own account of their trading, not the broker\'s.',
    '  4. Small and correlated n — tickets opened in the same week or expiring on the same day share one regime',
    '     and one move; they are closer to one bet than many. Pushes every confidence interval NARROWER than',
    '     the truth: read the cluster counts, not the ticket counts, as the sample size.',
    `Rule: a bucket under n=${MIN_N} prints "insufficient" in place of every percentage. About ${tradesNeededForTenPointEdge()} INDEPENDENT trades`,
    'per bucket are needed to see a 10-point edge in win rate at 95% confidence with 80% power (one-sample',
    'proportion test, p₀ = 0.50 vs p₁ = 0.60). Every number below carries its n.',
  ];
}
