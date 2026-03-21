# REALITY AUDIT — Temple-Stuart Accounting Platform

**Audit Date**: March 21, 2026
**Auditor**: Claude (Opus 4.6)
**Scope**: Full-stack audit of bookkeeping, trading/scanner, and UI/infrastructure modules
**Files Reviewed**: 40+ source files, 15,000+ lines examined

---

## EXECUTIVE SUMMARY

This platform is a **substantially built** personal accounting + options trading system combining:
- Double-entry bookkeeping with Plaid integration
- Options convergence scanner with 10+ pipeline steps
- Live TastyTrade chain data and trade card generation
- FRED macro regime detection, Finnhub fundamentals, SEC EDGAR filings

**Overall Assessment**: Core bookkeeping and trading features work. Several data integrations are fetched but **not wired into scoring**. Missing-data handling defaults to neutral (50-point) scores across the board, which masks confidence gaps.

---

## MODULE 1: BOOKKEEPING

### Feature Verdicts

| Feature | Verdict | Notes |
|---------|---------|-------|
| Chart of Accounts | **WORKS** | Full CRUD, multi-entity, balance tracking |
| Plaid Transaction Sync | **WORKS** | Complete integration, institution info, dedup, 2yr history |
| Manual Transaction Entry | **PARTIAL** | Creates transaction record but NO automatic journal entry |
| Auto-Categorization | **WORKS** | Rules-based (13 hardcoded categories), merchant feedback loop |
| Journal Entries / Double-Entry | **WORKS** | Balance enforcement, reversals, cross-entity, period close guard |
| Bank Reconciliation | **WORKS** | Full reconciliation workflow with adjustments |
| Financial Statements | **PARTIAL** | Income Statement and Balance Sheet work. NO Cash Flow Statement |
| Period Close | **WORKS** | Enforcement on all 8 entry pathways, reopen with audit trail |
| CPA Export | **PARTIAL** | Form 8949 only. No Schedule C, D, or 1040 |
| Entity Separation | **WORKS** | Full multi-entity scoping, cross-entity categorization |
| Merchant Mapping & Learning | **WORKS** | Learning loop with confidence scoring (penalty/reward) |

### Bookkeeping Details

**Plaid Sync** (`/api/transactions/sync-complete/route.ts`):
- Uses `transactionsGet` with offset pagination
- Stores full enrichment: personal_finance_category, counterparties, logo_url
- Deduplicates pending→posted transitions
- Updates account balances on first page

**Double-Entry Ledger** (`/lib/journal-entry-service.ts`):
- `commitPlaidTransaction()` creates journal entry + 2 ledger entries (D/C pair)
- Idempotency guard via `request_id` prevents duplicate JEs on retry
- Updates `settled_balance` on both accounts
- Supports cross-entity categorization (personal bank → business expense)

**Auto-Categorization** (`/lib/auto-categorization-service.ts`):
- Tier 1: Merchant mapping lookup (confidence > 0.5)
- Tier 2: Hardcoded Plaid category → COA code map (13 entries, confidence 0.6)
- Tier 3: Null (unmatched)
- Feedback loop: Penalizes wrong predictions (confidence *= 0.7), rewards correct ones

**Period Close** (`/lib/period-close-guard.ts`):
- `assertPeriodOpen()` called before EVERY journal entry creation
- Enforced in: commitPlaidTransaction, commitManualJournalEntry, journal POST, and 5 more paths
- Reopen requires notes (audit trail)

### Bookkeeping Gaps

- **Manual transactions don't auto-journal**: They sit in `transactions` table awaiting categorization/commitment
- **No Cash Flow Statement**: Income Statement and Balance Sheet work, but Statement of Cash Flows is not implemented
- **CPA export limited to Form 8949**: No Schedule C (business income), Schedule D (summary), or Form 1040 integration
- **Auto-categorization is rules-only**: 13 hardcoded categories, no ML/NLP classification

---

## MODULE 2: TRADING / CONVERGENCE SCANNER

### Pipeline Steps

| Step | Name | Status | Details |
|------|------|--------|---------|
| A | TT Scanner data fetch | **WORKS** | Batches ~500 symbols from TastyTrade marketMetrics |
| A2 | Pre-filter ranking | **WORKS** | IV percentile, IV-HV spread, liquidity scoring |
| C | Hard exclusions | **WORKS** | Filters by market cap, liquidity, borrow rate |
| D | Top-N selection | **WORKS** | Selects top preScore tickers (default limit × 2) |
| B | Hard filters (safety) | **WORKS** | Volume, IV rank, market-cap gates |
| C1 | Finnhub peers fetch | **WORKS** | `/stock/peers` for each survivor |
| C2 | Initial peer stats | **WORKS** | GICS industry → sector fallback |
| E | Finnhub batch fetch | **WORKS** | Fundamentals, recommendations, insider sentiment, earnings |
| E3-E11 | Enrichment data | **PARTIAL** | 9 optional endpoints, some fail gracefully with null |
| E11b | Text peer classification | **WORKS** | Text-based peer groups from 10-K descriptions |
| F | Score all 4 categories | **WORKS** | vol_edge, quality, regime, info_edge |
| F2 | Fetch candles & re-score | **WORKS** | 60-day candles from TT, re-scores with real technicals |
| G | Rank & diversify | **WORKS** | Sorts by composite, filters to top 9 per sector |
| G1.5 | Social sentiment (xAI) | **PARTIAL** | Requires XAI_API_KEY; fetched but NOT scored |
| G2 | Chain & trade cards | **WORKS** | Fetches option chains, builds trade card strategies |
| G2.5 | Re-score with flow data | **WORKS** | Re-scores with real OptionsFlowData from chain |
| H | Assemble result | **WORKS** | Builds final ConvergenceResponse |

### Feature Verdicts

| Feature | Verdict | Notes |
|---------|---------|-------|
| Options Scanner Pipeline | **PARTIAL** | 16 steps mostly work; universe stubs empty (Russell 2000, S&P 400/600) |
| TastyTrade Integration | **WORKS** | Live WebSocket bid/ask + Greeks, 15s stability window |
| Finnhub Integration | **WORKS** | 15 endpoints called; dividends/basic-financials NOT called |
| FRED Integration | **WORKS** | 20 macro series, 1-hour cache TTL |
| xAI Social Sentiment | **PARTIAL** | Fetched but NOT integrated into composite score |
| SEC EDGAR | **PARTIAL** | XBRL filing data fetched but NOT used in scoring |
| Trade Card Generation | **WORKS** | Live bid/ask during market hours; Black-Scholes theo when closed |
| Strategy Scoring | **WORKS** | 4-category deterministic scoring with 50-point null defaults |
| News Sentiment | **WORKS** | Keyword classifier + optional FinBERT ensemble |
| Regime Detection | **WORKS** | 4-regime classification (Goldilocks/Reflation/Stagflation/Deflation) |
| Trade Journal | **WORKS** | Full position lifecycle, qualitative notes |
| Wash Sale Tracking | **WORKS** | IRS Pub 550 compliant ±30 day detection |
| P&L Reporting | **WORKS** | Real ledger data from trading_positions + GL |

### Scoring Categories

**Vol Edge** (`vol-edge.ts`): IV vs HV mispricing, term structure shape, technicals (RSI, Bollinger, volume), skew (put-call IV ratio), GEX (net gamma, flip strike). Missing data → 50 (neutral) for skew/GEX, 40 (pessimistic) for technicals.

**Quality Gate** (`quality-gate.ts`): Safety (20%), Profitability (40%), Growth (20%), Fundamental Risk (20%). Uses PE, margins, ROE, FCF, Piotroski score. All null values → 50-point default.

**Regime** (`regime.ts`): Normalizes 10 macro indicators via sigmoid, classifies into 4 regimes using growth × inflation matrix, applies stress overlays (yield curve, HY spreads, VIX), SPY correlation modifier. Missing values → 50-point baseline.

**Info Edge** (`info-edge.ts`): Analyst consensus (20%), price targets (15%), insider activity (20%), earnings momentum (15%), options flow (15%), news sentiment (10%), institutional ownership (5%). Missing → 50 or 0 depending on field.

### Trade Card Pricing

- **Market Open**: Live bid/ask from TastyTrade WebSocket Quote events
- **Market Closed**: Falls back to `theoPrice` (exchange Black-Scholes valuation from vol surface)
- **Strategy builder** chooses live if available, theo as fallback
- **No slippage model**: Uses mid-price, not realistic entry/exit

### Trading Gaps

- **Universe definitions stubbed**: `RUSSELL_2000`, `SP400`, `SP600`, `WILSHIRE_5000` are all empty arrays with TODOs
- **xAI sentiment fetched but discarded**: Not wired into any scoring category
- **SEC EDGAR data fetched but discarded**: `secFilingData` in ConvergenceInput is null in final output
- **No slippage model**: Uses mid-price; should use ask for buys, bid for sells
- **No mark-to-market**: Open positions show cost basis, not current price
- **No portfolio-level Greeks**: No aggregate delta/theta/vega exposure
- **No dividend-adjusted Greeks**: Upcoming ex-dates not factored
- **No cross-security wash sales**: AAPL call → AAPL stock not detected

---

## MODULE 3: DATA INTEGRATIONS SUMMARY

### TastyTrade

| Data Point | Source | Status |
|-----------|--------|--------|
| Market metrics (IV rank, HV) | marketMetricsService | **WORKS** |
| Live bid/ask quotes | WebSocket Quote events | **WORKS** |
| Greeks (delta, gamma, theta, vega, rho) | WebSocket Greeks events | **WORKS** |
| Theoretical price | WebSocket Greeks theoPrice | **WORKS** |
| 60-day candles | Candle endpoint | **WORKS** |
| Account margin/buying power | — | **NOT IMPLEMENTED** |

### Finnhub

| Endpoint | Status |
|----------|--------|
| `/stock/profile2` | **WORKS** (CIK lookup) |
| `/stock/company-earnings` | **WORKS** |
| `/stock/recommendation` | **WORKS** |
| `/stock/insider-sentiment` | **WORKS** |
| `/stock/fundamentals` | **WORKS** |
| `/stock/eps-estimate` | **WORKS** |
| `/stock/revenue-estimate` | **WORKS** |
| `/stock/price-target` | **WORKS** |
| `/stock/upgrade-downgrade` | **WORKS** |
| `/stock/financials` (quarterly) | **WORKS** |
| `/news-sentiment` (FinBERT) | **WORKS** |
| `/stock/earnings-quality-score` | **WORKS** |
| `/stock/ownership` | **WORKS** |
| `/stock/revenue-breakdown2` | **WORKS** |
| `/stock/fund-ownership` | **WORKS** |
| `/stock/dividends` | **NOT CALLED** (type-defined only) |
| `/stock/basic-financials` | **NOT CALLED** |

### FRED (Federal Reserve Economic Data)

All 20 series fetched and used in regime detection:
`VIXCLS`, `DGS10`, `FEDFUNDS`, `UNRATE`, `A191RL1Q225SBEA` (GDP), `UMCSENT`, `T10Y2Y`, `T5YIE`, `BAMLH0A0HYM2`, `NFCI`, `ICSA`, `VXVCLS`, `VVIXCLS`, `WALCL`, `WTREGEN`, `RRPONTSYD`, `BAMLC0A4CBBB`, `T10Y3M`, `DTWEXBGS`, `PAYEMS`, `CPIAUCSL`

1-hour cache TTL. Weekly series flagged if older than 14 days.

### SEC EDGAR
- CIK lookup via Finnhub profile2 (cached 30 days)
- XBRL filing data fetched (filing date, type, EPS/revenue actuals)
- **Results fetched but NOT used in scoring**
- Form 4 and 8-K types defined but never fetched

### xAI (Grok)
- Calls `api.x.ai/v1/responses` with Grok 4.1 Fast + x_search
- Returns sentiment score (-1 to +1), magnitude, post counts, themes
- **Results fetched but NOT integrated into composite score**
- Optional: skipped if `XAI_API_KEY` not set

---

## CRITICAL FINDINGS

### What Works End-to-End
- Double-entry bookkeeping with Plaid sync and auto-categorization
- Multi-entity separation (Personal, Business, Trading)
- Period close enforcement across all entry pathways
- Bank reconciliation with adjustment calculation
- TastyTrade live chain data → trade card generation
- 4-category strategy scoring (vol edge, quality, regime, info edge)
- Macro regime detection with 20 FRED series
- Finnhub fundamentals enrichment (15 endpoints)
- Position tracking with realized P&L
- Wash sale detection (IRS Pub 550)
- Form 8949 CPA export

### What's Fetched but Not Used
- **xAI social sentiment**: Grok queries run, results stored, never scored
- **SEC EDGAR filing data**: XBRL data fetched, `secFilingData` always null in output
- **Finnhub dividends**: Type defined, endpoint never called
- **Form 4 insider transactions**: Type defined, never fetched
- **8-K material events**: Type defined, never fetched

### What's Missing
- **Cash Flow Statement**: Not implemented
- **Schedule C/D/1040 export**: Only Form 8949
- **Universe definitions**: Russell 2000, S&P 400/600/5000 arrays are empty
- **Mark-to-market for open positions**: Uses cost basis only
- **Portfolio-level Greeks**: No aggregate delta/theta/vega
- **Slippage model**: Mid-price used, no bid-ask spread adjustment
- **Dividend-adjusted Greeks**: Upcoming dividends not factored
- **Cross-security wash sales**: Option → stock replacement not detected
- **Confidence-weighted scoring**: All null data → blanket 50-point default
- **Cash flow statement**: Not implemented

---

## RECOMMENDATIONS (Priority Order)

1. **Wire xAI sentiment into scoring**: Add to info_edge (10-15% weight) — data already fetched
2. **Wire SEC EDGAR into scoring**: Use filing age, earnings surprise in quality gate
3. **Implement confidence weighting**: Replace blanket 50-point defaults with data-age-weighted scores
4. **Add Cash Flow Statement**: Complete the financial statements trifecta
5. **Complete universe definitions**: Source Russell 2000/S&P 400/600 from ETF holdings
6. **Add mark-to-market**: Fetch current bid/ask for open position P&L
7. **Add portfolio Greeks**: Compute aggregate delta/theta/vega for entire account
8. **Add slippage model**: Use ask for buys, bid for sells (minimum 5 bps)
9. **Expand CPA export**: Add Schedule C, Schedule D
10. **Auto-journal manual transactions**: Create JE on manual transaction entry

---

*End of audit.*
