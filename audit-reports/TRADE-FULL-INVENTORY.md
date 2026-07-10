# TRADE-FULL-INVENTORY — everything the real Trade tab renders

**Date:** 2026-07-10 · **Branch:** `claude/trade-full-inventory` · **READ-ONLY — no code changed, no design yet.**

Purpose: the complete section-by-section map of what a logged-in, tab:trade-entitled user sees, so
the logged-out showcase can show the FULL product. The current showcase (hero + 20-step rail + 4
gate cards + 3-row sample + CTA) covers a fraction of this inventory — most of the cockpit below is
not represented at all.

**The real mount order** (`ModuleLauncher.tsx` Trade section, unlocked branch): 1. Trading­Data­Disclaimer →
2. CoverageDeclaration → 3. ScanFilterForm (bandless) → 4. ConvergenceIntelligence (the scanner
cockpit: pipeline flow + results + deep dives + synthesis) → 5. TradeRecord → 6. TradeLabPanel
(`ModuleLauncher.tsx:~798-819`; TradeLabPanel mount at `:819`).

Component sizes: ConvergenceIntelligence.tsx 4,971 lines · ScannerResultsTable.tsx 742 ·
TradeLabPanel.tsx 687 · FilterPanel.tsx 393 · TradeRecord.tsx 228 · ScanFilterForm.tsx 202 ·
CoverageDeclaration.tsx 90 · TradingDataDisclaimer.tsx 19 — **7,444 lines of real Trade surface.**

---

## 1. THE SCANNER FILTER PANEL — `ScanFilterForm.tsx` (202 lines, read fully)

All 18 `ScannerFilters` fields + universe rendered expanded inline (`:7-16` header comment). What a
user configures:

| Group | Controls | file:line |
|---|---|---|
| Universe | S&P 500 / Nasdaq 100 pill toggle | `:35`, `:59-68` |
| Direction | All / Bull / Bear / Ntrl segmented | `:70-79` |
| Premium | SELL / BUY / BOTH segmented | `:81-90` |
| Risk | Defined / Unlimited segmented | `:92-101` |
| DTE | min–max number pair (0–365, default 30–60) | `:103-111`; defaults `filter-types.ts:65-66` |
| Width $ | min–max spread width pair (default 1–10) | `:113-121`; defaults `filter-types.ts:67-68` |
| Liquidity gates (4) | Min OI slider (0–5000, default 100) · Max bid-ask spread % (1–50, default 10) · Min underlying volume (0–10M, default 500K) · Min TT liquidity rating 1–5 stars (default 2) | `:130-133`; `filter-types.ts:8-13,54-59` |
| Edge metrics (6) | Min PoP % (default 50) · Min EV $ (−500–1000) · Min EV/Risk ratio · Vol Edge IV>HV / IV<HV / Any · Min IV Rank % · Min X-sentiment (−1.0–1.0) | `:140-145`; `filter-types.ts:36-43,70-77` |
| Strategies | 16 chips (Iron Condor, Put/Call Credit Spread, Short Strangle/Straddle, Jade Lizard, Bull Call/Bear Call/Bear Put/Bull Put Spread, Long Straddle/Strangle, Debit/Calendar/Diagonal Spread, Iron Butterfly), multi-select, "(all)" default + Reset | `:150-174`; `filter-types.ts:85-102` |
| Scan CTA + broker dot | gold Scan button; "TT Connected"/"No Broker" status dot in the band header | `:177-182`, `:191-197` |

Filters apply CLIENT-SIDE via `applyFilters` in CI (`:11-12` comment) — a re-filter needs no re-scan.
There is also a second in-cockpit `FilterPanel.tsx` (393 lines) with `countActiveFilters` and an
"Active:" filter-description strip in FilteredResultsSection (`ConvergenceIntelligence.tsx:4388`).

## 2. THE TRACK RECORD — `TradeRecord.tsx` (228 lines, read fully)

The self-graded public record, all stats deterministic from user-owned rows (`:5-17`):
- **Headline counts, denominator first** (`:131-136`): N linked trades · N closed positions
  unlinked (excluded) · N cards queued-not-linked.
- **Honest win rate** (`:145-150`): `{W}W – {L}L – {BE}BE of {N} decided` — decided = linked AND
  closed (`:93-101`); open-linked shown as "outcome unknown"; never a bare percentage.
- **Net P&L** over decided linked trades (`:152-156`).
- **The integrity line (flagship)** (`:158-171`): "Max-loss model: X of Y linked trades stayed
  within their card's stated max loss" — with every violator listed by symbol, claimed vs actual
  (`:162-169`). The forensic claimed-vs-actual check as living UI.
- **Grade distribution** A–F over linked trades (`:173-181`).
- **Per-trade table** (collapsible, losses sorted first `:120-125`): Symbol / Generated / Claimed
  max loss / Actual P&L (or "Open") / Grade (`:192-222`).
- Truth-states: loading / error+Retry ("Nothing is assumed — no stats are shown until it loads",
  `:73-86`) / honest zero-state (`:138-142`).

## 3. THE PIPELINE FLOW — inside `ConvergenceIntelligence.tsx` (header `:1609`)

"Pipeline Flow" panel: **20 expandable step panels, step_a…step_t in A→T order** (toggles
`:1618-…`; emission map `pipeline.ts:423-2070`). Each panel = a one-line live summary + an expanded
body with the step's actual data, e.g.:
- step_a: "{N} symbols fetched" + the full symbol grid with per-symbol status (`:1624`, `:1696-1723`).
- step_g: "{X} → {Y} selected for enrichment" with per-ticker rank/score/cutoff reasons (`:2464`; `pipeline.ts:639-643`).
- step_i: "{N} Finnhub calls" + error counts (`:2749`; `pipeline.ts:1054-…`).
- step_j: per-ticker candle table + cross-asset correlations sections (`:3000`, `:3042`).
- step_o: "{N} Greeks events received across {M} symbols" (`:3716`).
- **Data-lineage teaching tables** inside step panels — columns DATA POINT / SOURCE / WHEN APPLIED /
  rule / why it matters / consequence: pre-score weights (IV Rank 40% / IV-HV 35% / Liquidity 25%,
  `:1841-1843`), Step-C exclusion rules (`:1962-1964`), Step-E filter rules (>$2B, ≥2/5, IV present,
  `:2198-2200`), Step-S final-eligibility rules (3/4 convergence gate, quality floor ≥40, sector cap
  max 2, `:4147-4149`). **These lineage tables are static hardcoded teaching copy** — no live data.

## 4. THE RESULTS TABLE — `ScannerResultsTable.tsx` (742 lines)

"Dense, sortable, selectable power table for bulk scan results" (`:7-9`). Columns (`:573-589`):
checkbox · **Symbol** · **X** (social sentiment from X/Twitter via xAI Grok, `:577`) · **Score** ·
**Direction** · **Strategy** · **Legs** · **Entry** · **Max P** · **Max L** · **Est. PoP** ("N(d2)
at breakeven when available, delta approximation otherwise — actual results will vary", `:585`) ·
**Est. EV** (three-outcome model, `:586`) · **EV/Risk** (`:587`) · **R:R** · **DTE**. Sortable on
9 columns; rows expand into the TickerChapter deep dive (imports `TickerChapter`, `:26`).
Plus the batch **ranked top-9 summary rows** (RankedRow: rank, composite, all four gate scores,
convergence string, direction, strategy, sector, IVP — CI `:33-46`, rendered `:261-269`).

## 5. TRADE CARDS / TRADE LAB — `TradeLabPanel.tsx` (687 lines, read fully)

The queue → link → grade loop closing the record:
- **Header**: "Trade Lab · N cards" + status filter (All/Queued/Entered/Linked/Graded) + Refresh (`:283-304`).
- **Coverage strip**: linked cards · closed positions · unlinked (denominator always visible, `:306-314`).
- **Scanner start date** (legacy boundary): user-set date; "positions opened before X are legacy
  trades without scanner data" (`:316-368`).
- **Card row** (`:392-515`): symbol + strategy name + BULLISH/BEARISH/NEUTRAL chip + status badge
  (queued/entered/linked/graded) + **A–F grade badge**; the **legs** line (SELL/BUY · CALL/PUT ·
  strike · price per leg, `:421-429`); meta (queued date, DTE, expiration, Trade #, linked date);
  right rail: **Actual P&L** (graded), Max Profit / Max Loss / Est. PoP / R:R grid (`:441-462`);
  status-dependent actions: Link to Position / Remove / Check Grade / Unlink (`:464-512`).
- **Link-to-position mechanic** (`:517-563`): dropdown of matchable synced positions (trade #,
  symbol, strategy, option type/strike, open date, OPEN/CLOSED badge) fetched for the card's symbol
  after its generated_at; "No matching positions yet — execute the trade and commit it in Books
  first" (`:529-531` — the Books-tab integration line).
- **Expanded scorecard** (`:565-679`): **PREDICTED vs ACTUAL** two-column (predicted max P/L, PoP,
  R:R, entry price vs actual P&L, entry/exit price, grade badge); **THESIS with ✓/✗ checkmarks** —
  each thesis point graded true/false after outcome (`:641-661`); **REGIME** paragraph (`:663-669`);
  link **NOTES** (`:671-677`).

## 6. THE DEEP DIVE — TickerChapter + TerminalTradeCard + TickerCard (CI `:192-1560`)

Per-ticker travel-through-the-pipeline, one chapter per finalist:
- **WHY THIS TICKER** (`:256-257`): ranking data from step_k — where it placed and why.
- **CHAIN FETCH (STEP N)** (`:283-284`): expirations table — Expiration / DTE / Strikes /
  Strategies Built / Best Score (`:305-309`).
- **STRATEGY SCORING (STEP P)** (`:335-336`): what was built and scored per expiration.
- **TerminalTradeCard** (`:392-830`), rendered for BOTH trade and no-trade cases (`:426`):
  **For vs Against** (`:465`), **Gate Scores** (`:497`), **Vol Detail** (`:524`), **Company &
  Macro** (`:569`), **Info Signals** (`:603`), **Headlines** (`:649`); the no-strategy case
  (`:662-…`) shows "No trade cards — {chain error}" or "No strategies passed quality gates"
  (`:1172`) plus **rejection_reasons** — per-strategy rejection with the failing gate, value vs
  threshold (BatchResponse `:71-76`); the trade case adds **Trade Setup** (legs, `:730`) and its
  own FOR vs AGAINST (`:775`).
- **TickerCard** (`:833-1560`): **Social Pulse (xAI/Grok)** (`:883`) — score, magnitude, post count,
  bullish/bearish/neutral counts, themes, sample posts with author (`:58-69`); **Why This Trade**
  (`:1180`); **Vol Edge Breakdown** — five sub-signals: mispricing, term structure, technicals,
  skew, GEX (`:1227-1231`); **Macro Regime** — 14 FRED indicators, rule-based sigmoid scoring,
  "inspired by Hamilton (1989)" (`:1288-1292`); **Key Stats** (`:1350`) incl. analyst consensus
  (`:1530`); **Recent Headlines** (`:1544`); red-flag strip (UNLIMITED / INSIDER / REGIME BRAKE
  prefixes, `:1334`).

## 7. OTHER SECTIONS (not in the mandate's list)

- **TradingDataDisclaimer** (`TradingDataDisclaimer.tsx:8-19`): the persistent data-not-advice
  note, mounted at the top of the tab AND above card results (LANG-1).
- **CoverageDeclaration** (`CoverageDeclaration.tsx:78-89`): "This tab reflects N synced
  transactions from X to Y; N closed positions are not linked and excluded; trades never synced
  are not visible" — the honest-denominator preamble (RISK-1).
- **Claude batch synthesis**: after the pipeline finishes, results go to
  `/api/ai/convergence-synthesis` — "Send pipeline results to Claude for synthesis (no re-run)"
  (CI `:4708-4716`); BatchResponse carries pipeline_summary (total_universe → after_hard_filters →
  pre_scored → scored → final_9 + runtime, `:48-56`), top_9 ranked rows, social sentiment,
  rejection reasons, and timing (pipeline_ms / ai_ms / total_ms, `:77`).
- **Account size input** (CI `:4466+`): user-entered capital context (explicitly "USER-ENTERED,
  not synced from any broker"); unset → cards show no dollar math.
- **Look Up a Specific Ticker** (CI `:4941`): single-ticker lookup form (single-ticker deep dive
  without a full scan).
- **Scan mechanics**: the Scan button streams the pipeline live —
  `/api/trading/convergence?stream=true&limit=9&refresh=true` (CI `:4672`) — which is why the
  20-step flow renders as a live progress display.
- **Active-filters strip** (`:4388`) + client-side re-filter without re-scan.

---

## PHASE 2 — what "show it all" means: per-section logged-out feasibility

Constraint: logged-out = static, zero fetch, zero user data, zero paid calls (SHOW discipline,
`TabShowcases.tsx:7-11`; the scan API is tab:trade-gated + quota'd server-side regardless).

| # | Section | Can the REAL component render logged-out? | How |
|---|---|---|---|
| 1 | ScanFilterForm | **YES — as-is.** Fully presentational: props in, callbacks out, zero fetches (`ScanFilterForm.tsx:10-12`). Mount with `DEFAULT_FILTERS` + local no-op/useState handlers, `showHeader` as desired, omit `ttConnected`; point the Scan button at the signup modal instead of `scanTriggerRef`. A visitor can literally play with every real control. | direct reuse |
| 2 | TradeRecord | **NO — self-fetches** `/api/trade-cards` + coverage (`:47-50`); logged-out lands in the error state. Show a static, labeled example record rendering the SAME sections (denominator line, W–L–BE of decided, net P&L, max-loss integrity line, A–F grades, per-trade rows). | faithful static mirror |
| 3 | Pipeline Flow | **PARTLY.** The live display needs SSE progress state. BUT the data-lineage teaching tables inside it are static hardcoded copy (`:1841-1843`, `:1962-1964`, `:2198-2200`, `:4147-4149`) — extractable/renderable verbatim with zero fetches. The 20-step rail (already built) + these real lineage tables = most of the flow's teaching value, honestly static. | static rail + verbatim lineage tables |
| 4 | Results table | **STRUCTURALLY YES, data must be declared.** ScannerResultsTable is props-driven, but full rows need TickerDetail/TradeCard shapes (chain-derived legs/EV/PoP) the pure `scoreAll()` fixture does not produce — leg/EV numbers would be DECLARED example values, labeled. Alternative: a static mirror of the real 15-column header with 2-3 example rows. | example-fed reuse or static mirror |
| 5 | Trade Lab | **NO — self-fetches** (`:118-131`) and is inherently user-state. Show one static example card in each key state (queued with legs + predicted grid; graded with PREDICTED vs ACTUAL, thesis ✓/✗, grade badge, actual P&L) — the exact layout of `:565-679`. | faithful static mirror |
| 6 | Deep dive | **STRUCTURALLY YES, same caveat as #4.** TickerChapter/TerminalTradeCard take props (`:212-224`), but a full TickerDetail (chain, strategies, headlines, sentiment) must be a declared example fixture — gate scores can stay engine-real (scoreAll), chain/strategy/sentiment values are labeled examples. The rejection-reasons ("why NOT this strategy") and For-vs-Against sections are high showcase value. | example-fed reuse or static mirror |
| 7a | Disclaimer | **YES — as-is** (pure static, `TradingDataDisclaimer.tsx`). | direct reuse |
| 7b | CoverageDeclaration | **NO** (self-fetch); its one-line honest-denominator copy can be shown as a static example sentence. | static example line |
| 7c | Claude synthesis / Social Pulse | **NO — paid calls** (xAI, Anthropic). Static labeled example only (e.g. one example Social Pulse card with fictional posts clearly labeled). | static labeled example |
| 7d | Account size / ticker lookup | Static rendering trivially possible; lookup button routes to signup. | static |

**Bottom line for the showcase design (not built here):** the real product's two most
showable pieces need no fabrication at all — the ENTIRE filter cockpit (#1) and the disclaimer
(#7a) mount directly, and the pipeline's own teaching tables (#3) are already static copy. The
record/lab/deep-dive (#2/#5/#6) carry the product's honesty story (claimed-vs-actual, graded
theses, NO-TRADE with reasons) and can be shown as clearly-labeled example states that mirror the
real layouts section-for-section. Gate scores in any example should keep coming from the real
`scoreAll()` fixture (`tradeShowcaseRows.ts`) so engine numbers never drift.
