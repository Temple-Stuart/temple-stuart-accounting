// ===== RAW DATA INPUTS =====

export interface CandleData {
  time: number;
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface TTScannerData {
  symbol: string;
  ivRank: number;
  ivPercentile: number;
  impliedVolatility: number;
  liquidityRating: number | null;
  earningsDate: string | null;
  daysTillEarnings: number | null;
  hv30: number | null;
  hv60: number | null;
  hv90: number | null;
  iv30: number | null;
  ivHvSpread: number | null;
  beta: number | null;
  corrSpy: number | null;
  marketCap: number | null;
  sector: string | null;
  industry: string | null;
  peRatio: number | null;
  eps: number | null;
  dividendYield: number | null;
  lendability: string | null;
  borrowRate: number | null;
  earningsActualEps: number | null;
  earningsEstimate: number | null;
  earningsTimeOfDay: string | null;
  termStructure: { date: string; iv: number }[];
}

export interface FinnhubFundamentals {
  metric: Record<string, number | string | null>;
  fieldCount: number;
}

export interface FinnhubRecommendation {
  buy: number;
  hold: number;
  sell: number;
  strongBuy: number;
  strongSell: number;
  period: string;
}

export interface FinnhubInsiderSentiment {
  symbol: string;
  year: number;
  month: number;
  change: number;
  mspr: number;
}

export interface FinnhubEarnings {
  actual: number;
  estimate: number;
  period: string;
  surprise: number;
  surprisePercent: number;
  symbol: string;
}

export interface FinnhubEpsEstimate {
  epsAvg: number;
  epsHigh: number;
  epsLow: number;
  numberAnalysts: number;
  period: string;
  quarter: number;
  year: number;
}

export interface FinnhubRevenueEstimate {
  revenueAvg: number;
  revenueHigh: number;
  revenueLow: number;
  numberAnalysts: number;
  period: string;
  quarter: number;
  year: number;
}

export interface FinnhubPriceTarget {
  targetHigh: number;
  targetLow: number;
  targetMean: number;
  targetMedian: number;
  numberAnalysts: number;
  lastUpdated: string;
}

export interface FinnhubUpgradeDowngrade {
  symbol: string;
  gradeTime: number;
  company: string;
  fromGrade: string;
  toGrade: string;
  action: string;
}

export interface FinnhubEstimateData {
  epsEstimates: FinnhubEpsEstimate[];
  revenueEstimates: FinnhubRevenueEstimate[];
  priceTarget: FinnhubPriceTarget | null;
  upgradeDowngrade: FinnhubUpgradeDowngrade[];
}

export interface FredMacroData {
  vix: number | null;
  treasury10y: number | null;
  fedFunds: number | null;
  unemployment: number | null;
  cpi: number | null;
  gdp: number | null;
  consumerConfidence: number | null;
  nonfarmPayrolls: number | null;
  cpiMom: number | null;
  // Institutional-grade series (added for regime classification)
  yieldCurveSpread: number | null;     // T10Y2Y: 10Y-2Y Treasury spread (daily)
  breakeven5y: number | null;          // T5YIE: 5-Year breakeven inflation (daily)
  hySpread: number | null;             // BAMLH0A0HYM2: ICE BofA HY credit spread (daily)
  nfci: number | null;                 // NFCI: Chicago Fed Financial Conditions (weekly)
  initialClaims: number | null;        // ICSA: Initial jobless claims (weekly)
  // Staleness tracking for weekly series
  initialClaimsDate: string | null;    // Observation date of ICSA
  nfciDate: string | null;             // Observation date of NFCI
}

// ===== ANNUAL FINANCIALS (for Piotroski YoY signals) =====

export interface AnnualFinancialPeriod {
  grossProfit: number | null;
  revenue: number | null;
  currentAssets: number | null;
  currentLiabilities: number | null;
  totalAssets: number | null;
  longTermDebt: number | null;
  sharesOutstanding: number | null;
  operatingCashFlow: number | null;
  capitalExpenditure: number | null;
  netIncome: number | null;
  operatingIncome: number | null;
  incomeTaxExpense: number | null;
  preTaxIncome: number | null;
  stockholdersEquity: number | null;
  longTermDebtCurrent: number | null;
  longTermDebtNoncurrent: number | null;
  cashAndEquivalents: number | null;
  weightedAvgShares: number | null;
  year: number;
}

export interface AnnualFinancials {
  currentYear: AnnualFinancialPeriod;
  priorYear: AnnualFinancialPeriod;
}

// ===== OPTIONS FLOW DATA (from Finnhub option chain) =====

export interface OptionsFlowData {
  put_call_ratio: number | null;
  volume_bias: number | null;
  unusual_activity_ratio: number | null;
  total_call_volume: number;
  total_put_volume: number;
  total_call_oi: number;
  total_put_oi: number;
  strikes_analyzed: number;
  high_activity_strikes: number;
  expirations_analyzed: number;
}

// ===== NEWS SENTIMENT DATA (from Finnhub company-news + keyword matching) =====

export interface NewsHeadlineEntry {
  datetime: number;
  headline: string;
  source: string;
  url: string;
  sentiment_keywords: string[];
  sentiment: 'bullish' | 'bearish' | 'neutral';
  confidence?: number; // 0-1; 1.0 for keyword, actual for LLM
}

export interface NewsSentimentPeriod {
  bullish_matches: number;
  bearish_matches: number;
  neutral: number;
  score: number;
}

export interface NewsSentimentData {
  total_articles_30d: number;
  articles_7d: number;
  articles_8_30d: number;
  buzz_ratio: number | null;
  sentiment_7d: NewsSentimentPeriod;
  sentiment_8_30d: NewsSentimentPeriod;
  sentiment_momentum: number;
  source_distribution: Record<string, number>;
  tier1_ratio: number;
  headlines: NewsHeadlineEntry[];
  classification_method: string; // 'llm-haiku' | 'keyword-fallback'
}

// ===== FINNHUB EARNINGS QUALITY (from /stock/earnings-quality-score endpoint) =====

export interface FinnhubEarningsQuality {
  score: number;               // Composite earnings quality score (0-100 typically)
  letterScore: string;         // Letter grade: A+, A, B+, B, C+, C, D
}

// ===== FINNHUB FINBERT SENTIMENT (from /news-sentiment endpoint) =====

export interface FinnhubNewsSentiment {
  companyNewsScore: number;               // FinBERT overall company sentiment score (0-1, 0.5 = neutral)
  sectorAverageNewsScore: number | null;  // Sector average for comparison
  sectorAverageBullishPercent: number | null;
  buzz: number | null;                    // Buzz score (article count vs historical average)
  bullishPercent: number | null;
  bearishPercent: number | null;
}

// ===== COMBINED RAW INPUT =====

export interface ConvergenceInput {
  symbol: string;
  ttScanner: TTScannerData | null;
  candles: CandleData[];
  finnhubFundamentals: FinnhubFundamentals | null;
  finnhubRecommendations: FinnhubRecommendation[];
  finnhubInsiderSentiment: FinnhubInsiderSentiment[];
  finnhubEarnings: FinnhubEarnings[];
  finnhubEstimates: FinnhubEstimateData | null;
  fredMacro: FredMacroData;
  annualFinancials: AnnualFinancials | null;
  optionsFlow: OptionsFlowData | null;
  newsSentiment: NewsSentimentData | null;
  finnhubNewsSentiment: FinnhubNewsSentiment | null;
  finnhubEarningsQuality: FinnhubEarningsQuality | null;
  peerStats?: Record<string, { ticker_count?: number; peer_group_type?: string; peer_group_name?: string; metrics: Record<string, { mean: number; std: number; sortedValues?: number[] }> }>;
  peerGroupAssignment?: Record<string, string>;
}

// ===== DATA CONFIDENCE =====

export interface DataConfidence {
  total_sub_scores: number;
  imputed_sub_scores: number;
  confidence: number; // 1 - (imputed / total), range 0 to 1
  imputed_fields: string[];
}

// ===== SCORING TRACES =====

export interface SubScoreTrace {
  score: number;
  weight: number;
  inputs: Record<string, number | string | boolean | null>;
  formula: string;
  notes: string;
}

// -- Vol Edge --

export interface MispricingTrace extends SubScoreTrace {
  z_scores: {
    vrp_z: number | null;
    ivp_z: number | null;
    iv_hv_z: number | null;
    hv_accel_z: number | null;
    note: string;
    transform: 'percentile' | 'z-score-fallback' | 'raw';
  };
  hv_trend: string;
  iv_composite: {
    iv_rank: number | null;
    iv_percentile: number | null;
    iv_composite_score: number;
    iv_composite_method: string;
    high_conviction_iv: boolean;
    vol_regime: 'POST_SPIKE' | 'SPIKE_BUILDING' | 'NORMAL';
    vol_regime_note: string;
  };
}

export interface TermStructureTrace extends SubScoreTrace {
  shape: string;
  richest_tenor: string | null;
  cheapest_tenor: string | null;
  optimal_expiration: string | null;
  expirations_analyzed: number;
  earnings_kink_detected: boolean;
}

export interface TechnicalsTrace extends SubScoreTrace {
  sub_scores: {
    rsi_score: number;
    trend_score: number;
    bollinger_score: number;
    volume_score: number;
    high52w_score: number;
  };
  indicators: {
    rsi_14: number | null;
    rsi_trace: { avg_gain: number; avg_loss: number; rs: number } | null;
    sma_20: number | null;
    sma_50: number | null;
    latest_close: number | null;
    bb_upper: number | null;
    bb_lower: number | null;
    bb_middle: number | null;
    bb_position: number | null;
    bb_width: number | null;
    high52w_ratio: number | null;
    high52w_range_position: number | null;
    avg_volume_5d: number | null;
    avg_volume_20d: number | null;
    volume_ratio: number | null;
  };
  candles_used: number;
}

export interface VolEdgeResult {
  score: number;
  data_confidence: DataConfidence;
  breakdown: {
    mispricing: MispricingTrace;
    term_structure: TermStructureTrace;
    technicals: TechnicalsTrace;
  };
}

// -- Quality Gate --

export interface SafetyTrace extends SubScoreTrace {
  sub_scores: {
    liquidity_rating_score: number;
    market_cap_score: number;
    volume_score: number;
    lendability_score: number;
    beta_score: number;
    debt_to_equity_score: number;
  };
  piotroski: {
    available_signals: number;
    total_signals: number;
    computable: Record<string, boolean | null>;
    change_signals: {
      computable_count: number;
      passed_count: number;
      change_score: number | null;  // passed/computable ratio (0-1), null if 0 computable
      modifier: number;             // ±10 adjustment applied to profitability
    };
    note: string;
  };
  altman_z: {
    score: number | null;
    components_available: number;
    components_total: number;
    computable: Record<string, boolean>;
    capped: boolean;
  };
  borrow_rate_adjustment: {
    borrow_rate: number | null;
    penalty: number;
    score_before_penalty: number;
  };
}

export interface ProfitabilityTrace extends SubScoreTrace {
  sub_scores: {
    gross_margin_score: number;
    roe_score: number;
    roa_score: number;
    roic_score: number;
    pe_score: number;
    ps_score: number;
    ev_ebitda_score: number;
    fcf_score: number;
  };
  earnings_quality: {
    surprise_consistency: number;
    dte_score: number;
    beat_rate: number;
    earnings_detail: {
      total_quarters: number;
      beats: number;
      misses: number;
      in_line: number;
      avg_surprise_pct: number | null;
      streak: string;
    };
    earnings_quality_ensemble?: {
      finnhub_eq_score: number | null;
      finnhub_eq_letter: string | null;
      sue_score: number;
      ensemble_agreement: 'agree' | 'disagree' | 'unavailable';
      confidence_modifier: number;
    };
  };
}

export interface EarningsQualityTrace extends SubScoreTrace {
  sub_scores: {
    surprise_consistency: number;
    days_to_earnings_score: number;
    beat_rate: number;
  };
  earnings_detail: {
    total_quarters: number;
    beats: number;
    misses: number;
    in_line: number;
    avg_surprise_pct: number | null;
    streak: string;
  };
}

export interface GrowthTrace extends SubScoreTrace {
  sub_scores: {
    revenue_growth_score: number;
    eps_growth_score: number;
    dividend_growth_score: number;
  };
}

export interface FundamentalRiskTrace extends SubScoreTrace {
  sub_scores: {
    cash_flow_stability_score: number;
    earnings_predictability_score: number;
    asset_turnover_score: number;
  };
}

/** @deprecated Use FundamentalRiskTrace */
export type EfficiencyTrace = FundamentalRiskTrace;

export interface QualityGateResult {
  score: number;
  mspr_adjustment: number;
  data_confidence: DataConfidence;
  breakdown: {
    safety: SafetyTrace;
    profitability: ProfitabilityTrace;
    growth: GrowthTrace;
    fundamentalRisk: FundamentalRiskTrace;
  };
}

// -- Regime --

export interface StrategyRegimeScore {
  strategy: string;
  raw_score: number;
  vix_adjustment: number;
  final_score: number;
}

export interface RegimeResult {
  score: number;
  data_confidence: DataConfidence;
  breakdown: {
    growth_signal: {
      score: number;
      sub_scores: {
        gdp_score: number;
        unemployment_score: number;
        nfp_score: number;
        consumer_confidence_score: number;
        icsa_score: number;
        nfci_score: number;
      };
      raw_values: {
        gdp: number | null;
        unemployment: number | null;
        nfp: number | null;
        consumer_confidence: number | null;
        initial_claims: number | null;
        nfci: number | null;
      };
      stale_flags?: string[];
    };
    inflation_signal: {
      score: number;
      sub_scores: {
        cpi_yoy_score: number;
        cpi_mom_score: number;
        fed_funds_score: number;
        treasury_10y_score: number;
        breakeven_5y_score: number;
      };
      raw_values: {
        cpi_yoy: number | null;
        cpi_mom: number | null;
        fed_funds: number | null;
        treasury_10y: number | null;
        breakeven_5y: number | null;
      };
    };
    regime_probabilities: {
      goldilocks: number;
      reflation: number;
      stagflation: number;
      deflation: number;
    };
    dominant_regime: string;
    regime_signals: {
      yield_curve_spread: number | null;
      yield_curve_inverted: boolean;
      hy_spread: number | null;
      hy_stress_level: 'normal' | 'elevated' | 'crisis' | null;
    };
    vix_overlay: {
      vix: number | null;
      adjustment_type: string;
    };
    strategy_scores: StrategyRegimeScore[];
    best_strategy: string;
    spy_correlation_modifier: {
      corr_spy: number | null;
      multiplier: number;
      base_regime_score: number;
      adjusted_regime_score: number;
      formula: string;
      note: string;
    };
  };
}

// -- Info Edge --

export interface AnalystConsensusTrace extends SubScoreTrace {
  sub_scores: {
    estimate_level_score: number;
    estimate_dispersion_score: number;
    revenue_eps_alignment_score: number;
    consensus_breadth_score: number;
  };
  indicators: {
    forward_eps: number | null;
    trailing_actual_eps: number | null;
    eps_dispersion_pct: number | null;
    revenue_growth_direction: string | null;
    eps_growth_direction: string | null;
    number_analysts_estimates: number | null;
    number_analysts_recommendations: number | null;
  };
  raw_counts: {
    strongBuy: number;
    buy: number;
    hold: number;
    sell: number;
    strongSell: number;
    total: number;
  };
}

export interface PriceTargetSignalTrace extends SubScoreTrace {
  sub_scores: {
    price_target_score: number;
  };
  indicators: {
    raw_implied_return_pct: number | null;
    peer_median_implied_return_pct: number | null;
    delta_tper: number | null;
    num_analysts: number;
    price_target_median: number | null;
    price_target_mean: number | null;
    price_target_high: number | null;
    price_target_low: number | null;
    latest_close: number | null;
  };
}

export interface UpgradeDowngradeSignalTrace extends SubScoreTrace {
  sub_scores: {
    upgrade_downgrade_score: number;
  };
  indicators: {
    total_events_90d: number;
    upgrades_count: number;
    downgrades_count: number;
    initiations_count: number;
    reiterations_count: number;
    net_rating_momentum_raw: number;
  };
}

export interface InsiderActivityTrace extends SubScoreTrace {
  sub_scores: {
    mspr_score: number;
    trend_score: number;
  };
  insider_detail: {
    months_available: number;
    latest_mspr: number | null;
    avg_mspr_3m: number | null;
    net_direction: string;
  };
}

export interface EarningsMomentumTrace extends SubScoreTrace {
  sub_scores: {
    beat_streak_score: number;
    surprise_magnitude_score: number;
    consistency_score: number;
  };
  momentum_detail: {
    last_4_surprises: (number | null)[];
    consecutive_beats: number;
    consecutive_misses: number;
    avg_surprise_pct: number | null;
    direction: string;
  };
}

export interface FlowSignalTrace {
  score: number;
  weight: number;
  inputs: Record<string, number | string | boolean | null>;
  formula: string;
  notes: string;
  sub_scores: {
    put_call_ratio_score: number;
    unusual_activity_score: number;
    volume_bias_score: number;
    option_stock_ratio_score: number;
  };
  flow_detail: {
    data_available: boolean;
    option_stock_ratio: number | null;
    note: string;
  };
}

export interface NewsSentimentTrace {
  score: number;
  weight: number;
  inputs: Record<string, number | string | boolean | null>;
  formula: string;
  notes: string;
  sub_scores: {
    buzz_score: number;
    sentiment_score: number;
    source_quality_score: number;
  };
  news_detail: {
    data_available: boolean;
    total_articles_30d: number;
    articles_7d: number;
    buzz_ratio: number | null;
    sentiment_7d_score: number | null;
    sentiment_momentum: number | null;
    tier1_ratio: number | null;
    source_distribution: Record<string, number>;
    headlines: NewsHeadlineEntry[];
    classification_method: string;
  };
  ensemble?: {
    finnhub_sentiment_score: number | null;
    finnhub_buzz: number | null;
    finnhub_sector_avg: number | null;
    ensemble_agreement: 'unanimous' | 'majority' | 'split' | 'two-leg';
    ensemble_confidence_modifier: number; // +0.20, 0, -0.30
    leg_directions: {
      keyword: 'bullish' | 'bearish' | 'neutral';
      haiku: 'bullish' | 'bearish' | 'neutral' | null;
      finbert: 'bullish' | 'bearish' | 'neutral' | null;
    };
  };
}

export interface InfoEdgeResult {
  score: number;
  data_confidence: DataConfidence;
  breakdown: {
    analyst_consensus: AnalystConsensusTrace;
    price_target_signal: PriceTargetSignalTrace;
    upgrade_downgrade_signal: UpgradeDowngradeSignalTrace;
    insider_activity: InsiderActivityTrace;
    earnings_momentum: EarningsMomentumTrace;
    flow_signal: FlowSignalTrace;
    news_sentiment: NewsSentimentTrace;
  };
}

// -- Composite --

export interface CompositeResult {
  score: number;
  rank_method: string;
  note: string;
  convergence_gate: string;
  direction: string;
  category_scores: {
    vol_edge: number;
    quality: number;
    regime: number;
    info_edge: number;
  };
  categories_above_50: number;
  position_size_pct: number;
  sizing_method: string;
  data_confidence: DataConfidence;
}

// -- Strategy Suggestion --

export interface TradeCardLeg {
  type: string;
  side: string;
  strike: number;
  price: number;
}

export interface TradeCardData {
  name: string;
  legs: TradeCardLeg[];
  expiration: string;
  dte: number;
  netCredit: number | null;
  netDebit: number | null;
  maxProfit: number | null;
  maxLoss: number | null;
  breakevens: number[];
  pop: number | null;
  riskReward: number | null;
  ev: number;
}

export interface StrategySuggestion {
  direction: string;
  regime_preferred: string;
  vol_edge_confirms: string;
  suggested_strategy: string;
  suggested_dte: number;
  note: string;
  trade_cards?: TradeCardData[];
  full_trade_cards?: TradeCard[];
}

// -- Trade Card (unified output: setup + rationale + key stats) --

export interface TradeCardSetup {
  strategy_name: string;
  legs: { type: string; side: string; strike: number; price: number }[];
  expiration_date: string;
  dte: number;
  net_credit: number | null;
  net_debit: number | null;
  max_profit: number | null;
  max_loss: number | null;
  breakevens: number[];
  probability_of_profit: number | null;
  pop_method: 'breakeven_d2' | 'delta_approx';
  hv_pop: number | null;
  risk_reward_ratio: number | null;
  greeks: {
    delta: number;
    gamma: number;
    theta: number;
    vega: number;
    theta_per_day: number;
  };
  ev: number;
  ev_per_risk: number;
  has_wide_spread: boolean;
  is_unlimited_risk: boolean;
}

export interface TradeCardWhy {
  composite_score: number;
  letter_grade: string;
  direction: string;
  convergence_gate: string;
  category_scores: {
    vol_edge: number;
    quality: number;
    regime: number;
    info_edge: number;
  };
  plain_english_signals: string[];
  regime_context: string;
  risk_flags: string[];
}

export interface SocialSentiment {
  score: number;          // -1 to +1
  magnitude: number;      // 0 to 1
  postCount: number;
  themes: string[];
  bullishPct: number;     // 0-100
  bearishPct: number;     // 0-100
  samplePosts?: {
    text: string;
    sentiment: 'bullish' | 'bearish' | 'neutral';
    author: string;
  }[];
  dataAge: string;        // ISO timestamp
}

export interface TradeCardKeyStats {
  iv_rank: number | null;
  iv_percentile: number | null;
  iv30: number | null;
  hv30: number | null;
  iv_hv_spread: number | null;
  earnings_date: string | null;
  days_to_earnings: number | null;
  market_cap: number | null;
  sector: string | null;
  beta: number | null;
  spy_correlation: number | null;
  pe_ratio: number | null;
  dividend_yield: number | null;
  liquidity_rating: number | null;
  lendability: string | null;
  borrow_rate: number | null;
  buzz_ratio: number | null;
  sentiment_momentum: number | null;
  analyst_consensus: string | null;
  social_sentiment?: SocialSentiment;
}

export interface TradeCard {
  symbol: string;
  generated_at: string;
  label: string;
  setup: TradeCardSetup;
  why: TradeCardWhy;
  key_stats: TradeCardKeyStats;
}

// -- Full Pipeline Response --

export interface ConvergenceResponse {
  symbol: string;
  timestamp: string;
  pipeline_runtime_ms: number;
  raw_data: {
    tastytrade_scanner: TTScannerData | null;
    tastytrade_candles: { count: number; oldest: string | null; newest: string | null; sample: CandleData | null };
    finnhub_fundamentals: { field_count: number; sample_fields: Record<string, number | string | null> } | null;
    finnhub_recommendations: { latest: FinnhubRecommendation | null; history_count: number };
    finnhub_insider_sentiment: { latest_mspr: number | null; months_available: number };
    finnhub_earnings: { latest: FinnhubEarnings | null; quarters_available: number };
    fred_macro: FredMacroData;
  };
  scores: {
    vol_edge: VolEdgeResult;
    quality: QualityGateResult;
    regime: RegimeResult;
    info_edge: InfoEdgeResult;
    composite: CompositeResult;
  };
  strategy_suggestion: StrategySuggestion;
  data_gaps: string[];
}
