// TEACH-1 — plain-language explainers for every number on a trade card.
//
// Deterministic client-side content templates — ZERO per-tap cost, no fetches, no
// external APIs. Each explainer interpolates the card's LIVE values.
//
// Language rules (LANG-1 + Alex's voice): plain, ~5th-grade readable, no jargon without
// an immediate plain translation, step-by-step "how this number is made", NO imperatives,
// NO "should/recommend/consider", NO predictions. We teach what a number MEANS and HOW
// it is made — never what to do about it.
//
// TRUTH-FIRST: `source` labels are exact per the Phase-1 catalog (TastyTrade live options
// chain / Finnhub / FRED / computed by the scanner / computed on this page) — no generic
// "market data" hand-waving. A null/missing value is handled by the UI's true-state
// message; explain() may assume the value it needs is present (the UI guards nulls).

export interface MetricValues {
  [k: string]: number | string | null | undefined;
}

export interface MetricExplainer {
  title: string;
  /** 2-4 short plain sentences using the card's live numbers. */
  explain: (v: MetricValues) => string[];
  /** How the number is made: 3-6 plain steps (raw data -> math -> result). */
  pipeline: string[];
  /** Exact data-source label (Phase-1 accurate). */
  source: string;
}

const pct = (v: unknown, d = 0) => (typeof v === 'number' ? `${v.toFixed(d)}%` : '—');
const num = (v: unknown, d = 1) => (typeof v === 'number' ? v.toFixed(d) : '—');
const dollars = (v: unknown) =>
  typeof v === 'number' ? (v < 0 ? '-' : '') + '$' + Math.abs(Math.round(v)).toLocaleString('en-US') : '—';

export const METRIC_EXPLAINERS: Record<string, MetricExplainer> = {
  composite_score: {
    title: 'Convergence score',
    explain: (v) => [
      `This card scores ${num(v.score)} out of 100.`,
      'It is the average of four separate report cards on the trade — how mispriced the options look, how healthy the company is, whether the wider market backdrop fits, and whether informed people are buying.',
      'A higher number means more of those four things point the same way at once.',
    ],
    pipeline: [
      'Four gates are each scored 0 to 100: Vol Edge, Quality, Regime, Info Edge.',
      'Each gate is turned into a "z-score" — how far above or below normal it is.',
      'The four are blended with fixed weights (Vol Edge counts most, Info Edge least).',
      'The blend is scaled back onto a 0-to-100 line — that is this number.',
    ],
    source: 'Computed by the scanner from the four gate scores',
  },

  letter_grade: {
    title: 'Letter grade',
    explain: (v) => [
      `The score of ${num(v.score)} maps to grade ${v.grade ?? '—'}.`,
      'It is just the score in report-card form: 80 and up is an A, 65+ a B, 50+ a C, 35+ a D, below 35 an F.',
      'The grade adds no new information — it only makes the score quicker to read.',
    ],
    pipeline: [
      'Take the convergence score (0 to 100).',
      'Look up which band it falls in: 80+ A, 65+ B, 50+ C, 35+ D, else F.',
      'Show that letter.',
    ],
    source: 'Computed on this page from the convergence score',
  },

  vol_edge: {
    title: 'Vol Edge',
    explain: (v) => [
      `Vol Edge is ${num(v.score)} out of 100.`,
      'It asks one question: are these options priced higher than the stock actually tends to move?',
      'When options are "expensive" like that, a seller of options is being paid extra for the same risk. Above 50 means they look expensive.',
    ],
    pipeline: [
      'Measure how much the options imply the stock will move (implied volatility).',
      'Measure how much the stock has really moved lately (realized volatility).',
      'Compare the two as a z-score, and add option-chain shape clues (term structure, skew, dealer positioning).',
      'Blend those into a 0-to-100 score.',
      'Example: if options price in a big swing but the stock has been calm, this score rises.',
    ],
    source: 'Computed by the scanner from TastyTrade options data and price history',
  },

  quality: {
    title: 'Quality gate',
    explain: (v) => [
      `Quality is ${num(v.score)} out of 100.`,
      'It is a health check on the underlying company — is it profitable, financially safe, and steady with its earnings?',
      'Above 50 means the company looks solid rather than shaky.',
    ],
    pipeline: [
      'Pull company fundamentals: profitability, margins, balance-sheet safety (Piotroski F-Score).',
      'Add earnings quality: how often it beats, and whether profits are real cash or accounting.',
      'Combine those into a 0-to-100 score.',
    ],
    source: 'Computed by the scanner from Finnhub fundamentals data',
  },

  regime: {
    title: 'Macro regime gate',
    explain: (v) => [
      `Regime is ${num(v.score)} out of 100.`,
      'It looks at the weather of the whole economy — growth, inflation, interest rates, the yield curve — and asks whether that backdrop fits this trade.',
      'Above 50 means the big-picture conditions line up rather than fight the trade.',
    ],
    pipeline: [
      'Read 14 national economic indicators (GDP, CPI, Fed Funds rate, yield curve, credit spreads, and more).',
      'Classify the current environment (for example: calm growth, or high-stress).',
      'Score how well that environment fits the trade direction, 0 to 100.',
    ],
    source: 'Computed by the scanner from FRED macro data',
  },

  info_edge: {
    title: 'Info Edge gate',
    explain: (v) => [
      `Info Edge is ${num(v.score)} out of 100.`,
      'It watches for footprints of people who tend to know more — company insiders buying, big institutions, analysts changing their minds, and the tone of the news.',
      'Above 50 means those footprints lean positive.',
    ],
    pipeline: [
      'Check insider buying vs selling (the MSPR ratio).',
      'Check institutional ownership changes and analyst upgrades/downgrades.',
      'Read recent news tone with a sentiment model (FinBERT) and earnings-surprise history.',
      'Blend into a 0-to-100 score.',
    ],
    source: 'Computed by the scanner from Finnhub analyst/insider data and news sentiment',
  },

  gates: {
    title: 'Gates passed',
    explain: (v) => [
      `${v.gates ?? '—'} of 4 gates scored above 50 on this card.`,
      'The four gates are Vol Edge, Quality, Regime, and Info Edge. A gate "passes" when its score clears 50.',
      'More gates above 50 means more of the four checks agree at the same time. 4 of 4 is the most agreement possible.',
    ],
    pipeline: [
      'Score each of the four gates 0 to 100.',
      'Count how many are above 50.',
      'Show that count out of 4.',
    ],
    source: 'Computed on this page from the four gate scores',
  },

  direction: {
    title: 'Direction',
    explain: (v) => [
      `The scanner reads this setup as "${v.direction ?? '—'}".`,
      'It is the way the four gates lean when you add them up — up-leaning, down-leaning, or balanced.',
      'It describes what the signals say, not a call on what happens next.',
    ],
    pipeline: [
      'Look at which gates are strong and in which direction they point.',
      'Take the dominant lean across all four.',
      'Label it (for example bullish, bearish, or neutral).',
    ],
    source: 'Computed by the scanner from the four gate scores',
  },

  iv_rank: {
    title: 'IV Rank',
    explain: (v) => [
      `IV Rank is ${num(v.iv_rank, 2)}.`,
      `It says today's option prices sit near the ${num(v.iv_rank, 0)} mark on a 0-to-100 line versus the past year.`,
      'Higher means options are pricier than they usually are — the market is paying up for a possible move.',
    ],
    pipeline: [
      'Track this stock’s implied volatility (option-priced expected move) every day for a year.',
      'Find where today sits between the year’s lowest and highest.',
      'Turn that position into a 0-to-100 rank.',
      'Example: 82 means options are more expensive than they were on about 82% of the past year.',
    ],
    source: 'Computed by the scanner from TastyTrade options data',
  },

  iv30: {
    title: 'IV (30-day)',
    explain: (v) => [
      `The 30-day implied volatility is ${pct(v.iv30, 1)}.`,
      'This is the size of move the options are pricing in over the next month, as a yearly percentage.',
      'Bigger number means the options expect a bumpier ride.',
    ],
    pipeline: [
      'Read the current option prices around 30 days out.',
      'Back out the move those prices imply (implied volatility).',
      'State it as an annualized percentage.',
    ],
    source: 'Computed by the scanner from TastyTrade live options chain',
  },

  hv30: {
    title: 'HV (30-day)',
    explain: (v) => [
      `The 30-day historical volatility is ${pct(v.hv30, 1)}.`,
      'This is how much the stock has ACTUALLY moved over the last month, as a yearly percentage.',
      'It is the reality check against what the options expect.',
    ],
    pipeline: [
      'Take the stock’s daily price changes over the past ~30 days.',
      'Measure how spread out those changes were (standard deviation).',
      'Scale it up to a yearly percentage.',
    ],
    source: 'Computed by the scanner from historical price data',
  },

  vrp: {
    title: 'VRP (IV minus HV)',
    explain: (v) => [
      `The volatility risk premium is ${typeof v.vrp === 'number' ? (v.vrp > 0 ? '+' : '') + pct(v.vrp, 1) : '—'}.`,
      'It is simply what options expect (IV) minus what the stock actually did (HV).',
      'A positive gap means options were pricing in more movement than really happened — the seller’s cushion.',
    ],
    pipeline: [
      'Take implied volatility (what options expect).',
      'Subtract historical volatility (what actually happened).',
      'The leftover gap is the volatility risk premium.',
      'Example: IV 40% minus HV 25% = +15% — options were 15 points "richer" than reality.',
    ],
    source: 'Computed by the scanner from TastyTrade IV and historical price data',
  },

  max_profit: {
    title: 'Max profit',
    explain: (v) => [
      `The most this trade can make is ${dollars(v.max_profit)}.`,
      'It is the best-case dollar outcome if everything lands exactly right at expiration.',
      'It is a ceiling, not a promise — most trades land somewhere in between.',
    ],
    pipeline: [
      'Take the option legs, their strike prices, and the price paid or collected.',
      'Work out the payoff at the single best price for this structure.',
      'Multiply by 100 (one option controls 100 shares).',
    ],
    source: 'Computed by the scanner from the option legs and prices',
  },

  max_loss: {
    title: 'Max loss',
    explain: (v) => [
      `The most this trade is designed to lose is ${dollars(v.max_loss)}.`,
      'It is the worst-case dollar outcome for a defined-risk structure at expiration.',
      'This is the number the track record checks each closed trade against.',
    ],
    pipeline: [
      'Take the option legs, strikes, and the price paid or collected.',
      'Work out the payoff at the single worst price for this structure.',
      'Multiply by 100 (one option controls 100 shares).',
      'Note: if a leg is a naked short, loss is not capped — the card flags that separately.',
    ],
    source: 'Computed by the scanner from the option legs and prices',
  },

  est_pop: {
    title: 'Estimated probability of profit',
    explain: (v) => [
      `The estimated chance this trade ends with any profit is ${pct(v.pop, 0)}.`,
      v.pop_method === 'N(d2)'
        ? 'It is measured from where the stock would have to close (the breakeven), using a standard options-math formula.'
        : 'It is a quick estimate read from the option deltas — less precise than the breakeven method.',
      'It is an estimate from today’s prices, not a guarantee.',
    ],
    pipeline: [
      'Find the breakeven price(s) where the trade turns from loss to profit.',
      'Use options math to estimate the chance the stock closes on the winning side (the N(d2) method).',
      'If breakevens are unavailable, fall back to a delta-based approximation.',
      'State it as a percentage.',
    ],
    source: 'Computed by the scanner from the option prices and breakevens',
  },

  ev: {
    title: 'Expected value (EV)',
    explain: (v) => [
      `The estimated average outcome is ${dollars(v.ev)} per trade.`,
      'It weighs the win, the loss, and the in-between by how likely each is, then averages them.',
      'It is a long-run average estimate, not what any single trade will do.',
    ],
    pipeline: [
      'List the possible outcomes (roughly: max win, max loss, and a middle case).',
      'Estimate the chance of each from the option prices.',
      'Multiply each outcome by its chance and add them up.',
      'Example: 60% chance of +$100 and 40% chance of -$100 gives an EV of +$20.',
    ],
    source: 'Computed by the scanner using a three-outcome model',
  },

  ev_per_risk: {
    title: 'EV per unit of risk',
    explain: (v) => [
      `For every $1 at risk, the estimated average return is ${num(v.ev_per_risk, 3)}.`,
      'It takes the expected value and divides it by the max loss, so trades of different sizes can be compared fairly.',
      'Bigger means more estimated reward for the same dollar of risk.',
    ],
    pipeline: [
      'Take the expected value (the average estimated outcome).',
      'Divide it by the max loss (the dollars at risk).',
      'The result is expected return per dollar risked.',
    ],
    source: 'Computed by the scanner from EV and max loss',
  },

  risk_reward: {
    title: 'Risk / reward',
    explain: (v) => [
      `The risk-to-reward ratio is ${num(v.risk_reward, 2)}.`,
      'It compares the most you can lose to the most you can make.',
      'A ratio of 2.00 means you are risking two dollars to try to make one — common for high-probability option sales.',
    ],
    pipeline: [
      'Take the max loss and the max profit.',
      'Divide max loss by max profit.',
      'Show the ratio.',
    ],
    source: 'Computed by the scanner from max loss and max profit',
  },

  breakevens: {
    title: 'Breakeven price(s)',
    explain: (v) => [
      `This trade breaks even at ${v.breakevens ? String(v.breakevens) : '—'}.`,
      'These are the stock prices where the trade makes exactly zero at expiration — the line between profit and loss.',
      'Inside the breakevens the trade profits; past them it loses.',
    ],
    pipeline: [
      'Start from the strikes and the price paid or collected.',
      'Find the stock price(s) where the payoff is exactly zero.',
      'Those are the breakeven point(s).',
    ],
    source: 'Computed by the scanner from the option legs and prices',
  },

  delta: {
    title: 'Delta exposure',
    explain: (v) => [
      `Dollar delta is about ${dollars(v.dollar_delta)}.`,
      'It is how much the position gains or loses if the stock moves $1 right now.',
      'Near zero means the trade barely cares which way the stock goes — it is close to direction-neutral.',
    ],
    pipeline: [
      'Take the position’s net delta from the live option chain.',
      'Multiply by the stock price and by 100 (shares per contract).',
      'That is the dollar move per $1 stock move.',
    ],
    source: 'Computed by the scanner from TastyTrade live option greeks',
  },

  theta: {
    title: 'Daily theta',
    explain: (v) => [
      `Time decay is ${typeof v.theta === 'number' ? (v.theta >= 0 ? '+' : '') + dollars(v.theta) : '—'} per day.`,
      'It is how much the position earns (if positive) or loses (if negative) each day just from time passing.',
      'Option sellers usually want this positive — the clock pays them.',
    ],
    pipeline: [
      'Take the position’s theta from the live option chain.',
      'Express it in dollars per contract, per calendar day.',
      'Show that daily amount.',
    ],
    source: 'Computed by the scanner from TastyTrade live option greeks',
  },

  vega: {
    title: 'Vega',
    explain: (v) => [
      `Vega is about ${dollars(v.vega)} per 1 point of volatility.`,
      'It is how much the position gains or loses if implied volatility moves up or down by one percentage point.',
      'It tells you how sensitive the trade is to options getting more or less "expensive".',
    ],
    pipeline: [
      'Take the position’s vega from the live option chain.',
      'Scale it to dollars per contract per 1 volatility point.',
      'Show that amount.',
    ],
    source: 'Computed by the scanner from TastyTrade live option greeks',
  },

  kelly: {
    title: 'Quarter-Kelly size',
    explain: (v) => [
      `Quarter-Kelly comes out to ${num(v.kelly, 1)}% of an account.`,
      'The Kelly formula estimates a position size from the win chance and the reward-to-risk. This card uses a quarter of it — a cautious fraction.',
      'It is a math output about sizing, not a call to trade any amount.',
    ],
    pipeline: [
      'Take the estimated win rate and the reward-to-risk ratio.',
      'Full Kelly = (win rate × ratio − loss rate) ÷ ratio.',
      'Multiply by 0.25 to get the cautious quarter-Kelly.',
      'Show it as a percent of an account. Example: full Kelly 8% → quarter-Kelly 2%.',
    ],
    source: 'Computed on this page from the win rate and reward-to-risk',
  },

  hv_pop: {
    title: 'HV-based probability of profit',
    explain: (v) => [
      `Using how the stock has really moved, the estimated chance of profit is ${pct(v.hv_pop, 0)}.`,
      'It is the same idea as PoP, but it uses the stock’s actual past movement (historical volatility) instead of what options imply.',
      'Comparing it with the options-based PoP shows whether the two agree.',
    ],
    pipeline: [
      'Measure the stock’s real movement (historical volatility).',
      'Estimate the chance it closes on the winning side of the breakevens.',
      'State it as a percentage.',
    ],
    source: 'Computed by the scanner from historical price data',
  },

  net_credit_debit: {
    title: 'Credit collected / debit paid',
    explain: (v) => [
      typeof v.net_credit === 'number' && v.net_credit > 0
        ? `This trade collects ${dollars((v.net_credit as number) * 100)} up front.`
        : typeof v.net_debit === 'number'
        ? `This trade costs ${dollars((v.net_debit as number) * 100)} up front.`
        : 'The upfront amount is not available for this card.',
      'A credit is cash you receive to open the trade; a debit is cash you pay.',
      'It is multiplied by 100 because one option contract controls 100 shares.',
    ],
    pipeline: [
      'Add up the price of the options you sell (money in).',
      'Subtract the price of the options you buy (money out).',
      'If the total is positive it is a credit; if negative it is a debit. Multiply by 100.',
    ],
    source: 'Computed by the scanner from the option legs and prices',
  },
};

export type MetricKey = keyof typeof METRIC_EXPLAINERS;
