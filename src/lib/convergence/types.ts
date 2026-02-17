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

export interface FredMacroData {
  vix: number | null;
  treasury10y: number | null;
  fedFunds: number | null;
  unemployment: number | null;
  cpi: number | null;
  gdp: number | null;
  consumerConfidence: number | null;
  nonfarmPayrolls: number | null;
  sofr: number | null;
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
  fredMacro: FredMacroData;
  sectorStats?: Record<string, { metrics: Record<string, { mean: number; std: number }> }>;
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
  };
  hv_trend: string;
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
    macd_score: number;
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
    macd_line: number | null;
    macd_signal: number | null;
    macd_histogram: number | null;
    avg_volume_5d: number | null;
    avg_volume_20d: number | null;
    volume_ratio: number | null;
  };
  candles_used: number;
}

export interface VolEdgeResult {
  score: number;
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
    note: string;
  };
  altman_z: {
    score: number | null;
    components_available: number;
    components_total: number;
    computable: Record<string, boolean>;
    capped: boolean;
  };
}

export interface ProfitabilityTrace extends SubScoreTrace {
  sub_scores: {
    gross_margin_score: number;
    roe_score: number;
    roa_score: number;
    pe_score: number;
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

export interface EfficiencyTrace extends SubScoreTrace {
  sub_scores: {
    asset_turnover_score: number;
    margin_spread_score: number;
    inventory_turnover_score: number;
  };
}

export interface QualityGateResult {
  score: number;
  mspr_adjustment: number;
  breakdown: {
    safety: SafetyTrace;
    profitability: ProfitabilityTrace;
    growth: GrowthTrace;
    efficiency: EfficiencyTrace;
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
  breakdown: {
    growth_signal: {
      score: number;
      sub_scores: {
        gdp_score: number;
        unemployment_score: number;
        nfp_score: number;
        consumer_confidence_score: number;
      };
      raw_values: {
        gdp: number | null;
        unemployment: number | null;
        nfp: number | null;
        consumer_confidence: number | null;
      };
    };
    inflation_signal: {
      score: number;
      sub_scores: {
        cpi_yoy_score: number;
        cpi_mom_score: number;
        fed_funds_score: number;
        treasury_10y_score: number;
      };
      raw_values: {
        cpi_yoy: number | null;
        cpi_mom: number | null;
        fed_funds: number | null;
        treasury_10y: number | null;
      };
    };
    regime_probabilities: {
      goldilocks: number;
      reflation: number;
      stagflation: number;
      deflation: number;
    };
    dominant_regime: string;
    vix_overlay: {
      vix: number | null;
      adjustment_type: string;
    };
    strategy_scores: StrategyRegimeScore[];
    best_strategy: string;
  };
}

// -- Info Edge --

export interface AnalystConsensusTrace extends SubScoreTrace {
  sub_scores: {
    buy_sell_ratio_score: number;
    strong_conviction_score: number;
    coverage_score: number;
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

export interface InfoEdgeResult {
  score: number;
  breakdown: {
    analyst_consensus: AnalystConsensusTrace;
    insider_activity: InsiderActivityTrace;
    earnings_momentum: EarningsMomentumTrace;
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
