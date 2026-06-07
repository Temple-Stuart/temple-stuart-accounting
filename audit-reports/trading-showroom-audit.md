# Trading Showroom — Readiness Audit (READ-ONLY)

**Date:** 2026-06-07
**Branch:** `claude/audit-trading-showroom`
**Scope:** Read-only. No application code modified. Only this report was created. No external market-data calls made.
**Method:** Every claim cites `file:line`. Anything not read is marked **NOT VERIFIED**.

> **Headline:** The locked-showroom *pattern* exists and is proven (`OperationsShowroom` + `Panel` +
> `onRequireAuth`, mounted via `ModuleLauncher`). The Trading module, however, is the **most
> heavily-coupled** surface in the app: the live page (`src/app/trading/page.tsx`) self-fetches ~10
> user/admin endpoints on mount, gates whole sections on `isOwner`, and the scanner runs an
> admin-only paid pipeline (Finnhub + FRED + xAI + Anthropic). A guest showroom must therefore be a
> **fully fetch-free re-implementation fed by a hardcoded constants file** — not a reuse of the live
> page. Two strong *pure presentational* components already exist to build on (`ScanFilterForm`,
> `ScannerResultsTable`). **One CRITICAL security finding:** three TastyTrade backtest routes call the
> owner's session token with **no auth gate** (E.1).

---

## A. EXISTS — verified (file + line)

### A.1 Trading UI inventory

**Page:** `src/app/trading/page.tsx` — `'use client'` `:1`, `TradingPage` `:87`. Component tree (top-level children):
- `ScanFilterForm` `:750-757` (scanner filter inputs).
- "Performance" 7-metric row — inline JSX `:760-782`.
- `COAManagementTable` `:791-795` (gated on `tradingEntityId`).
- "Commit Trades to Ledger" — inline `:801-831`.
- `CalendarGrid` (P&L calendar) `:837-844`.
- `ConvergenceIntelligence` `:861-869` (gated `isOwner && ttConnected` `:851`).
- `TradeLabPanel` `:876-882`.
- **Trade Journal** table — inline `:887-1017`; journal modal `:1033-1121`.
- `DataObservatory` `:1023` (gated `isOwner` `:1021`).

**Data each top-level piece requires (fetches on mount):**
- `/api/user/scanner-start-date` `:137`
- `/api/trade-cards` `:148,878`
- `/api/entities` `:201` (to find the trading entity)
- `/api/tastytrade/status` `:214` (gated `isOwner` `:213`)
- `/api/tastytrade/positions` + `/balances` `:263-264` (on `ttConnected`)
- `/api/trading/trades` `:422`
- `/api/trading-journal` `:423`
- `/api/investment-transactions/max-trade-num` `:424`
- `/api/journal-transactions?source_type=trading_position` `:407`
- TT live data on click: quotes `:305`, chains `:333`, greeks `:372`, connect/disconnect/callback `:229,248,291`.

**Client-rendered vs server-rendered:** the entire page is `'use client'` `:1` and client-fetches everything. **No server-rendered props.** → a guest render is an API + props problem, identical in shape to the Showroom-Pipeline audit's section D.

**Scanner pipeline UI:** `src/components/convergence/ConvergenceIntelligence.tsx` — `'use client'`, **6 `fetch(` calls** (grep count) → not pure. It renders `ScannerResultsTable` and `FilterPanel` (`src/components/convergence/`).

### A.2 Pipeline stage structure (the narrative skeleton)

- **Orchestrator:** `src/lib/convergence/pipeline.ts`, `runPipeline()` `:361`. Stages are emitted as `onProgress({ step, label })` events — these `label`s are the user-facing stage names (see **F** for verbatim list). Steps `step_a … step_l` are the 12 the brief calls A–L; the pipeline additionally emits `step_m … step_t` (Final Selection, Chain Fetch, Live Greeks, Strategy Scoring, Live Options Flow, Re-Score Live, Trade Cards, Save & Return) — **more than 12 stages exist** (`pipeline.ts:1419,1718,1550,1738,1607,1674,1755,1920`).
- **Note on order:** labels are emitted in code-execution order, which is **not** alphabetical — `step_l` ("Re-Score With Technicals") fires at `:1207`, *before* `step_j`/`step_k` at `:1235`/`:1270`. The letter is the identity; execution order differs.
- **Four gates** (`src/lib/convergence/composite.ts:13-16`): `scoreVolEdge` (`vol-edge.ts`), `scoreQualityGate` (`quality-gate.ts`), `scoreRegime` (`regime.ts`), `scoreInfoEdge` (`info-edge.ts`). Composite-note display tokens: `VE / Q / R / IE` (`composite.ts:185`).
- **Gate weights:** static `{ vol_edge:0.25, quality:0.25, regime:0.25, info_edge:0.25 }` (`composite.ts:27`); regime-dependent dynamic table `REGIME_WEIGHT_TABLE` (`composite.ts:32-43`, keys GOLDILOCKS/REFLATION/DEFLATION/STAGFLATION/CRISIS); confidence-blended `finalWeight = blend×dynamic + (1−blend)×static` (`composite.ts:78-84`) then normalized to sum 1.0 (`composite.ts:86-93`).

### A.3 Composite scoring + the honesty rules (ground truth)

- **Composite score:** weighted sum of the 4 gate scores (`composite.ts:126-132`).
- **Convergence gate / sizing:** `above50 = scores > 50` count (`composite.ts:135-136`); `<2 → 0% NO TRADE`, `==2 → 20%`, `3+ → continuous 30–100%` (`composite.ts:142-155`).
- **Direction** from Info-Edge: `>65 BULLISH`, `<35 BEARISH`, else NEUTRAL (`composite.ts:158-161`).
- **Aggregate data-confidence:** `confidence = 1 − imputed/total_sub_scores`, with every imputed field listed (`composite.ts:163-180`).
- **The info-edge null / re-normalization rule (precise truth):**
  - **Re-normalized (truly excluded):** ONLY `news_sentiment` — when null, its term is dropped from `baseScore` and `totalWeight` drops by its 0.15 weight, so the remaining sub-scores re-weight to fill (`info-edge.ts:1308-1325`).
  - **Imputed-neutral (NOT excluded):** other missing sub-scores fall back to a neutral 50 with `formula: 'imputed(50)'` (e.g. `fundOwnershipFlow` `info-edge.ts:1281`, `materialEventFlag` `:1297`) — but each is recorded in `imputedFields`, so `data_confidence` honestly reports it (`info-edge.ts:1334-1361`).
  - → The narrative's "no imputed neutral" claim is **only fully true for `news_sentiment`**; everywhere else the honesty is "impute 50 but flag it in `data_confidence`." State it that way.

### A.4 API routes — auth + scoping + paid providers

| Route | Auth | Scoping | Paid provider |
|---|---|---|---|
| `trading/convergence/route.ts` (runs pipeline) | `requireAdmin()` BEFORE pipeline `:51` | snapshot `userId` `:68-72` | **Finnhub + FRED + xAI + Anthropic** (via `runPipeline`) |
| `tastytrade/scanner/route.ts` | `requireAdmin()` `:162` + `getVerifiedEmail` `:164` | `getAuthenticatedClient(user.id)` `:174` | TastyTrade |
| `tastytrade/{status,balances,positions,quotes,chains,greeks,connect,disconnect,callback}` | `requireAdmin` + `getVerifiedEmail` (each `:4-5`) | per-user TT client | TastyTrade |
| `trading/trades/route.ts` | `getVerifiedEmail` `:7` | `accounts.userId / user_id` `:19,163` | none (DB) |
| `trading-journal/route.ts` | `getVerifiedEmail` `:7,29,91` | `userId: user.id` `:16,46,68,107` | none (DB) |
| `ai/convergence-synthesis/route.ts` | `getVerifiedEmail` `:269` | — | **Anthropic** `:282` |
| `convergence/sentiment/route.ts` | `getVerifiedEmail` `:11` | — | **xAI** (`sentiment.ts:258`) |

- **`requireAdmin` impl:** `src/lib/require-admin.ts:8-19` — 401 for guests, 403 unless `userEmail === OWNER_EMAIL`.
- **Paid env vars:** `FINNHUB_API_KEY` (`data-fetchers.ts` many), `FRED_API_KEY` (`data-fetchers.ts:525,688`), `XAI_API_KEY` (`pipeline.ts:1464,1710`, `sentiment.ts:258`), `ANTHROPIC_API_KEY` (`ai/convergence-synthesis/route.ts:282`, `news-classifier.ts:16`), TastyTrade `TASTYTRADE_CLIENT_SECRET`/`TASTYTRADE_REFRESH_TOKEN`/`TT_USERNAME`/`TT_PASSWORD` (`tastytrade.ts:9-17,114-115`).
- **Paid call on RENDER vs click:** the live page triggers paid TT calls **on mount only when** `isOwner && ttConnected` (`positions`/`balances` `:282-286`); the scanner pipeline (Finnhub/FRED/xAI/Anthropic) runs **only on explicit Scan** via `/trading/convergence`. No paid call fires for a logged-out visitor on the public page (they never reach these admin routes — see E/F).

### A.5 Showroom pattern (the seams the Trading showroom plugs into)

- `src/components/home/OperationsShowroom.tsx` — `Props { onRequireAuth: () => void }` `:32-36`; `Panel` container `:42-75` (step label + title + body + optional gated footer button `:62-71`); fetch-free by construction `:4-5`.
- **Mount:** `src/components/home/ModuleLauncher.tsx:7` imports it; `:110-114` renders it in the `operations` module card; tag "Live demo · log in to use" `:160`.
- **`onRequireAuth` thread:** `page.tsx:74` → `ModuleLauncher` prop `:41` → showroom/panels.
- **Trading module card today:** `ModuleLauncher.MODULES` has `{ key:'trading', live:false, blurb:'AI vol scanner + options strategy builder.' }` `:31`. `renderBody` trading branch: **admins** get the live `ScanFilterForm` (whose Scan routes to `/trading`) `:116-129`; **everyone else** gets the paid stub with a `Launch → onRequireAuth` button `:130-143`. There is **no** `TradingShowroom` equivalent to `OperationsShowroom` (see B.1).

### A.6 Trade journal + scanner-result data shapes (for the demo dataset)

- **`trade_journal_entries`** `schema.prisma:1375-1399`: `id, userId, tradeNum, entryDate, entryType, thesis, setup, emotion, riskReward, mistakes, lessons, rating(1-5), aiAnalysis, tags[]`. The journal UI displays a derived `Trade` shape (`page.tsx:27-43`: `tradeNum, type, underlying, strategy, status, openDate, closeDate, legs, realizedPL, shares, costBasis, proceeds`) joined to the journal entry (`page.tsx:61-73`).
- **`trade_cards`** (scored scan row) `schema.prisma:1428-1495`: `symbol, strategy_name, direction, legs(Json), entry_price, max_profit, max_loss, win_rate, risk_reward, thesis_points(Json), key_stats(Json), macro_regime, sentiment, headlines(Json), dte, **composite_score, letter_grade, convergence_gate**, **vol_edge_score, quality_score, regime_score, info_edge_score**, greeks_*, ev_per_risk, social_*`. This is the exact shape the demo scan table must mirror.

---

## B. MISSING — with grep evidence

### B.1 A Trading showroom component — MISSING
- `ls src/components/home/` → `ContentPreview, EvolutionPreview, ModuleLauncher, OperationsShowroom, ProjectCreateForm, RoutineCreateForm`. **No `TradingShowroom`** and no trading panel components. The trading module card renders only the live `ScanFilterForm` (admins) or a stub (`ModuleLauncher.tsx:116-143`).

### B.2 A hardcoded demo dataset — MISSING
- `find src -iname "*demoData*" -o -iname "*showroomData*" -o -iname "*narrative*"` → none. No constants file with sample scan rows / sample trades exists. The MSFT-iron-condor demo must be authored fresh against the A.6 shapes.

### B.3 Narrative / explanatory-copy layer (reusable component) — MISSING
- The Operations showroom copy is **inline JSX**, not a reusable narrative component or constants file (e.g. `OperationsShowroom.tsx:80-85`, `home/ProjectCreateForm.tsx:133-136`). There is no `NarrativeBlock` component and no `*narrative*` constants file on `main` (B.2 grep). → The Trading narrative is **net-new**; there is no landed component to reuse. (Same conclusion as the Showroom-Pipeline audit's section B.3.)

---

## C. REUSABLE — showroom seams + pure components (cited)

- **`Panel` + `OperationsShowroom` + `onRequireAuth`** (`OperationsShowroom.tsx:32-75`; mount `ModuleLauncher.tsx:110-114`) — the locked-demo container and the single gated trigger. A `TradingShowroom` drops into `ModuleLauncher.renderBody`'s `trading` branch (`:116-143`).
- **`ScanFilterForm`** (`src/components/trading/ScanFilterForm.tsx`) — `'use client'` `:1`, **fetch-free**: it is entirely props-driven (`onFiltersChange` callbacks, filters applied client-side `:11`), no `fetch`/`useEffect`/`useSession`. Already reused unchanged in `ModuleLauncher` for admins. **Directly reusable** in a guest showroom (wire its Scan button to `onRequireAuth`).
- **`ScannerResultsTable`** (`src/components/convergence/ScannerResultsTable.tsx`) — `'use client'`, **no `fetch`/`useEffect`**; purely presentational, driven by props `results, sentimentMap, rejectionMap, savedCards, savingCards, saveErrors, onSaveCard, onRemoveCard, pipelineProgress` `:58-68,375-385`. The scored-results table can render hardcoded demo `TickerDetail[]`; gate `onSaveCard`/`onRemoveCard` to `onRequireAuth`. **Strong reuse candidate.**
- **Composite/gate constants** (`composite.ts:27,32-43`) — static + regime weight tables are pure data the narrative can quote verbatim.
- **Trade-journal table markup** (`page.tsx:887-1017`) — pure presentational table over a `Trade[]`/`JournalEntry[]`; can be lifted into a fetch-free demo with hardcoded rows (the modal `:1033-1121` is the gated "edit" action → `onRequireAuth`).

---

## D. COUPLING MAP — what a locked guest render must sever / stub

| Coupling | Cite | Locked-guest implication |
|---|---|---|
| `useSession()` (next-auth) + `isOwner` derivation | `page.tsx:4,88-91` | Whole sections (`ConvergenceIntelligence`, `DataObservatory`, TT status) gate on `isOwner` `:213,851,1021`. A guest render must not depend on session; use static demo data. |
| Mount fetches (~10 endpoints) | `page.tsx:137,148,201,214,407,422-424` | All are auth/admin-scoped → guest gets 401/redirect. Must be **removed** in a fetch-free re-impl (no seed mechanism exists, B.2). |
| `AppLayout` shell | `page.tsx:5,742` | The home page doesn't use AppLayout; the showroom lives inside `ModuleLauncher`'s plain section, so this is naturally severed. |
| `ConvergenceIntelligence` (6 fetches) | component grep | Not reusable as-is; the showroom needs `ScanFilterForm` + `ScannerResultsTable` (both pure) wired to static data instead. |
| `TradeLabPanel`, `DataObservatory`, `COAManagementTable`, `CalendarGrid` | `page.tsx:876,1023,791,837` | NOT VERIFIED as pure (not read). Assume coupled; exclude or replace with static panels in the showroom. |
| Scanner pipeline (paid) | `/trading/convergence` → `runPipeline` `pipeline.ts:361` | **Never** invoke for guests — Finnhub/FRED/xAI/Anthropic. The showroom's "Scan" must call `onRequireAuth`, never fetch. |
| TT live data (paid) | `page.tsx:263-264,305,333,372` | Never invoke for guests; demo shows static positions/quotes. |

**Net:** the Trading showroom is a **fetch-free re-implementation** (mirroring `home/ProjectCreateForm`'s recipe), reusing the two pure components (`ScanFilterForm`, `ScannerResultsTable`) + a static `trade_cards`/`Trade` dataset, with every action routed to `onRequireAuth`.

---

## E. SECURITY FLAGS

### E.1 CRITICAL — three TastyTrade backtest routes have NO auth gate
- `src/app/api/tastytrade/backtest/simulate/route.ts`, `…/run/route.ts`, `…/available/route.ts` — **no `getVerifiedEmail`, no `requireAdmin`, no session check** anywhere (verified by grep of each file). Each imports and calls `getTastytradeSessionToken()` (`simulate:2`, `run:2`, `available:2`) and hits TastyTrade's backtester (`available:8` → `backtester.vast.tastyworks.com`; `run:27,68`; `simulate:47`). `getTastytradeSessionToken` uses the **owner's** env credentials (`tastytrade.ts:9-17`).
- **Exposure:** middleware blocks fully-logged-out guests (no cookie → redirect to `/`, see E.3), so the **public showroom is safe**. BUT **any authenticated non-admin user** passes middleware and reaches these routes — unlike **every** sibling `tastytrade/*` route, which calls `requireAdmin`. A non-admin can thus trigger paid TastyTrade backtester calls on the owner's session token. **Flag for Alex regardless of the showroom work.**

### E.2 Account-identifying data location (leak surface to keep out of shared components)
- `tastytrade_connections` stores per-user `sessionToken`, `rememberToken`, `accountNumbers[]` (`schema.prisma:1411-1426`). Live account numbers also flow to the client via `/api/tastytrade/status` → `setTtAccounts` (`page.tsx:217-218,238`) and positions/balances (`:272-273`). **None of this may appear in a shared/demo component.** The demo dataset must use fictional symbols/numbers only.
- `NEXT_PUBLIC_OWNER_EMAIL` is read client-side (`page.tsx:90`) — the owner's email is already exposed to the client bundle (by design, for the `isOwner` check). Not a new leak, noted for accuracy.

### E.3 No trading data on any public path (today)
- `middleware.ts` `PUBLIC_PATHS` `:50-64` = `/`, `/admin`, `/api/admin/verify`, `/api/admin/users`, `/api/auth`, `/_next`, `/favicon.ico`, `/pricing`, `/api/stripe/webhook`, `/api/inngest`, `/opengraph-image`, `/terms`, `/privacy`. **No `/trading`, `/api/trading`, `/api/tastytrade`, or `/api/convergence` entry.** Logged-out requests to those redirect to `/` (`middleware.ts:85-88`). The public home `/` renders the trading **stub** for guests (`ModuleLauncher.tsx:130-143`), not live data. **No leak on the public surface today.**

---

## F. STAGE NAMES VERBATIM — the A–L steps + four gates (narrative keys off this)

**The 12 pipeline steps (A–L), exactly as the `label` strings appear in `src/lib/convergence/pipeline.ts`:**

| Letter | `step` id | `label` (verbatim) | Cite |
|---|---|---|---|
| A | `step_a` | `TT Scanner` | `pipeline.ts:418` |
| B | `step_b` | `Pre-Filter` | `:458` |
| C | `step_c` | `Hard Exclusions` | `:507` |
| D | `step_d` | `Top-N Selection` | `:525` |
| E | `step_e` | `Hard Filters` | `:535` |
| F | `step_f` | `Peer Grouping` | `:572` |
| G | `step_g` | `Pre-Score` | `:623` |
| H | `step_h` | `Macro & Regime Data` | `:675` |
| I | `step_i` | `Data Enrichment` | `:1015-1016` |
| J | `step_j` | `Candle Data & Cross-Asset Correlations` | `:1235` |
| K | `step_k` | `4-Gate Scoring` | `:1270` |
| L | `step_l` | `Re-Score With Technicals` | `:1207` |

*(Additional stages beyond A–L also exist: `step_m` Final Selection `:1419`, `step_n` Chain Fetch `:1718`, `step_o` Live Greeks Subscription `:1550`, `step_p` Strategy Scoring `:1738`, `step_q` Live Options Flow & GEX `:1607`, `step_r` Re-Score With Live Data `:1674`, `step_s` Trade Cards `:1755`, `step_t` Save & Return `:1920`.)*

**The four gates (verbatim identifiers + display tokens):**

| Gate id (`composite.ts`) | Scorer / file | Display token | Static weight |
|---|---|---|---|
| `vol_edge` | `scoreVolEdge` / `vol-edge.ts` | `VE` (`composite.ts:185`) | 0.25 (`:27`) |
| `quality` | `scoreQualityGate` / `quality-gate.ts` | `Q` | 0.25 |
| `regime` | `scoreRegime` / `regime.ts` | `R` | 0.25 |
| `info_edge` | `scoreInfoEdge` / `info-edge.ts` | `IE` | 0.25 |

**Regime labels** (weight-table keys, `composite.ts:32-43`): `GOLDILOCKS`, `REFLATION`, `STAGFLATION`, `DEFLATION`, plus `CRISIS` override. **Regime sub-steps** (`regime.ts`): STEP A Normalize Macro `:49`, STEP A Composite Growth/Inflation `:141`, STEP B Regime Classification `:206`, STEP C Strategy-Regime Matrix `:272`, STEP D VIX Overlay `:319`. *(These are an internal A–D within the Regime gate — distinct from the pipeline's A–L; do not conflate in copy.)*

---

## G. ALEX-SIDE CHECKS

- **Vercel env (confirm SET; values never printed):** `FINNHUB_API_KEY`, `FRED_API_KEY`, `XAI_API_KEY`, `ANTHROPIC_API_KEY`, `TASTYTRADE_CLIENT_SECRET`, `TASTYTRADE_REFRESH_TOKEN`, `TT_USERNAME`, `TT_PASSWORD`, `OWNER_EMAIL`, `NEXT_PUBLIC_OWNER_EMAIL`. The showroom must reach **none** of these for guests.
- **E.1 backtest routes:** decide whether to add `requireAdmin` to the three `tastytrade/backtest/*` routes — currently any logged-in user can hit the owner's TT backtester. (Code change, not part of this read-only audit.)
- **psql (auditor cannot reach DB):**
  ```sql
  -- Confirm trade data is single-owner today (leak blast-radius)
  SELECT "userId", count(*) FROM trade_cards GROUP BY "userId";
  SELECT "userId", count(*) FROM trade_journal_entries GROUP BY "userId";
  -- Confirm only the owner has a TT connection (account numbers live here)
  SELECT "userId", status, array_length("accountNumbers",1) FROM tastytrade_connections;
  ```
- Confirm `/api/auth/me` stays public (relied on by `ModuleLauncher.tsx:55` for the `isAdmin` gate that decides the trading card body) — it is public via the `/api/auth` prefix (`middleware.ts:55`).

---

## H. SUGGESTIONS (not verified needs)

Auditor opinion only:

1. **Build `TradingShowroom` as a fetch-free sibling of `OperationsShowroom`** (`OperationsShowroom.tsx:42-120` recipe), reusing `Panel` + `onRequireAuth`, slotting into `ModuleLauncher.renderBody`'s `trading` branch (`:116-143`).
2. **Reuse the two pure components directly:** `ScanFilterForm` (already fetch-free) and `ScannerResultsTable` (props-only), feeding the latter hardcoded demo `TickerDetail[]` and gating `onSaveCard`/`onRemoveCard` to `onRequireAuth`.
3. **Author the demo dataset as a constants file** matching `trade_cards` (`schema.prisma:1428-1495`) + the `Trade`/`JournalEntry` shapes (`page.tsx:27-73`) — fictional MSFT iron condor; no real symbols/accounts (E.2).
4. **Narrative copy = a constants map keyed by the verbatim F-list** (`step_a…step_l` + the four gate ids), plus a small `NarrativeBlock` component (none exists, B.3). Be honest about the info-edge rule: only `news_sentiment` is re-normalized; other gaps impute 50 and flag `data_confidence` (A.3).
5. **Keep the hard invariant:** no `fetch` on render or click in any showroom component; never invoke `/trading/convergence`, `/api/tastytrade/*`, or `/api/convergence/*` for guests.
6. **Fix E.1 independently** of the showroom — it is a live gap (non-admin can spend on the owner's TT backtester), not blocked by the showroom work.

---

*End of audit. No application code was modified; only this report was created.*
