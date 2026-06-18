# Trade tab — wire the full trading pipeline so it runs (READ-ONLY AUDIT)

**Mandate:** Truth-first, read-only, every claim cites file:line. No fixes. Labels:
EXISTS / EXISTS-BUT-UNUSED / MISSING / REUSABLE / RISK. Trade is its OWN architecture — NOT an
/operations module; the Routines/Projects/Content mount pattern does NOT apply.

**Headline:** the trading scanner is **built and works** — the 12-step convergence pipeline
(`lib/convergence/pipeline.ts:runPipeline`, the 4 gates vol-edge/quality/regime/info-edge), all 6
data sources (TastyTrade/Finnhub/FRED/xAI/Anthropic + keyless SEC EDGAR) with env keys + graceful
"not configured" handling, a full dashboard at `/trading`, and all schema. A live MSFT Iron Condor
ran. **The homepage Trade tab does NOT run it inline — for an admin it shows `ScanFilterForm` whose
"Scan" button ROUTES to `/trading` (where the scan executes); non-admins/guests get a stub.** So
"make it run" is **NOT a scanner or data problem** — it's **homepage wiring** (route-away vs.
run-inline) plus the **admin gate** (the scan hits PAID feeds, gated to the owner by design).
**Two real findings:** (1) the run-inline option means mounting a **4,876-line** terminal-styled
component (`ConvergenceIntelligence`) — heavy; (2) a **SECURITY RISK**: three `tastytrade/backtest/*`
routes call the paid TastyTrade API with **zero auth**.

---

## 1. CURRENT TRADE TAB — admin→filter-form (routes away), else stub

`ModuleLauncher.tsx:351-376`:
- **Authed ADMIN** (`m.key === 'trading' && isAdmin`, `:351`) → `<ScanFilterForm … scanTriggerRef
  …/>` — only the FILTER form. Its "Scan" trigger is `scanTriggerRef.current = () =>
  router.push('/trading')` (`:185`) — it **navigates to `/trading`**, it does NOT run the scan on
  the homepage. (`isAdmin` from `/api/auth/me` `:134,162`.)
- **Authed NON-admin / logged-out** → the **paid stub** (`:365-376`): "{label} — coming soon …
  Requires an account" + a "Launch" button → `onRequireAuth`. No scanner.
So today the homepage Trade tab is a **filter form + a redirect** for the admin, a stub for everyone
else. — EXISTS / the wiring gap, `ModuleLauncher.tsx:185, 351-376`.

## 2. THE REAL TRADING SURFACE — `/trading`, coupled (NOT a SectionX)

`app/trading/page.tsx` — a full page using **`next-auth` `useSession`** (`:4`) + **`AppLayout`**
(`:5`), mounting **`ConvergenceIntelligence`** (`:7`), **`TradeLabPanel`** (`:8`),
**`DataObservatory`** (`:9`), `ScanFilterForm`, `COAManagementTable`. This is **NOT** a
self-contained `SectionX` coupled only to a provider — it's an AppLayout page with session +
multiple heavy panels. **`ConvergenceIntelligence` alone is 4,876 lines** (132 `font-mono`). So the
Routines/Projects/Content "wrap-in-OperationsEntityProvider" mount does NOT transfer — mounting this
on the homepage tab is a much larger lift (§8, §h). — EXISTS / RISK (heavy, coupled),
`app/trading/page.tsx:4-12`; `components/convergence/ConvergenceIntelligence.tsx`.

The scanner **engine** is `src/lib/convergence/` (20 files): `pipeline.ts` + the 4 gates
(`vol-edge.ts`, `quality-gate.ts`, `regime.ts`, `info-edge.ts`) + `pre-filter`, `probability`,
`composite`, `chain-fetcher`, `data-fetchers`, `cross-asset`, `sentiment`, `news-classifier`,
`sector-stats`, `trade-cards`, `outcome-tracker`, `snapshot-logger`, `filter-engine`. — EXISTS,
REUSABLE.

## 3. THE 12-STEP PIPELINE — entry + run path

- **Entry:** `runPipeline(...)` (`lib/convergence/pipeline.ts:361`), invoked by **GET
  `/api/trading/convergence`** (`route.ts:2,121`), with a cache + an **SSE streaming** path
  (`?stream=true`, `:65`) for live progress (`onProgress` `:365`).
- **Run path (click → result):** the `/trading` dashboard's `ConvergenceIntelligence` (and
  `SectionE_LiveStream`) fetch **`/api/trading/convergence`** → `requireAdmin()` gate (`:52`) →
  `runPipeline`: **Step A** fetch TT scanner symbols (`:375`), batch through Finnhub/FRED/SEC/TT
  candles (`:2`), compute cross-asset correlations (`:655`), run the **4 gates** + composite scoring
  (`scoreAll`, `composite.ts`), build option chains + **StrategyCards** (`chain-fetcher`,
  `trade-cards`), log a `scan_snapshot` → returns candidates + `pipeline_summary`. — EXISTS,
  `pipeline.ts:361-…`, `convergence/route.ts:42-144`.

## 4. DATA SOURCES + KEYS — all 6 built; env keys referenced (presence only)

| Source | Used for | Env key(s) referenced | Built? |
|---|---|---|---|
| **TastyTrade** | scanner symbols, option chains, Greeks, balances | `TT_USERNAME`, `TT_PASSWORD`, `TASTYTRADE_CLIENT_SECRET`, `TASTYTRADE_REFRESH_TOKEN` | EXISTS (`lib/tastytrade`) |
| **Finnhub** | fundamentals, estimates, news, insider/institutional, peers, 8-K | `FINNHUB_API_KEY` | EXISTS (`data-fetchers.ts`) |
| **FRED** | macro/regime series | `FRED_API_KEY` | EXISTS (`data-fetchers.ts:514`) |
| **xAI Grok** | sentiment | `XAI_API_KEY` | EXISTS (`sentiment.ts`) |
| **Anthropic Claude** | news classification / synthesis | `ANTHROPIC_API_KEY` | EXISTS |
| **SEC EDGAR** | filings, 8-K scan | (keyless, public) | EXISTS |

Each client **gracefully degrades** when a key is absent (e.g. `'FINNHUB_API_KEY not configured'`
`data-fetchers.ts:348`; `'FRED_API_KEY not configured'` `:536`). **Key VALUES not read** (security)
— only the env-var references above. The **live MSFT Iron Condor** is evidence the keys are
configured + working in the deployment. — EXISTS (code) / runtime-config (deployment), all 6.

## 5. WHAT "MAKE IT RUN" REQUIRES — homepage WIRING, not scanner/data

The scanner **runs today** for the admin (via the `/trading` route). The blocker is **not** the
scanner (works), **not** the data (keys present, live trade ran), **not** schema (all present).
The blockers are:
1. **Homepage wiring:** the Trade tab **routes to `/trading`** (`:185`) instead of running the
   pipeline on the tab. To "run it ON the Trade tab" you either (a) keep routing (already works for
   admin), or (b) **mount `ConvergenceIntelligence` inline** — a 4,876-line, session-coupled
   component (MED-LARGE). — the real "wire it" decision.
2. **Admin gate:** the scan is **`requireAdmin`-gated** (`convergence/route.ts:52`) because it hits
   PAID feeds. Non-admin users running it is a **cost + business decision**, not just wiring — and
   per the live-money/paid-API mandate, opening it up needs an explicit tier/cost guard. — RISK.
So: **for the admin, "run it" already works** (route → `/trading` → scan). For everyone else, it's
intentionally gated. The "wiring" is whether the homepage tab should run inline vs. route. —
EXISTS (runs for admin) / the wiring + gate decisions.

## 6. THE PORTFOLIO FORK — separate enhancement, NOT blocking

The audit-memory fork (correlation gate at the END of the 12-step flow vs. a separate
portfolio-allocator module): **neither a "correlation gate" nor a "portfolio-allocator" file
exists** (grep empty). Correlation IS computed — `computeCrossAssetCorrelations`
(`pipeline.ts:655`) — but as **advisory output data** (`cross_asset_correlations` in the result
`:1248`), not as a rejecting gate or an allocator. So the pipeline **runs fine without resolving
the fork**; the fork is a **future enhancement** (does correlation become a gate, or a separate
allocator?), **not a blocker for "run it."** — EXISTS-BUT (advisory only) / MISSING (gate/allocator),
flag for decision, `cross-asset.ts`, `pipeline.ts:655,1248`.

## 7. SCHEMA + STATE — all present, NO migration

`trading_positions (:325)`, `securities (:304)`, `stock_lots (:1228)`, `lot_dispositions (:1266)`,
`lot_adjustments (:1442)`, `trade_journal_entries (:1460)`, `trade_cards (:1513)`,
`trade_card_links (:1582)`, `scan_snapshots (:1699)`. The scan persists a `scan_snapshot`
(`snapshot-logger.ts`); trades persist to the lot/position tables. **No migration needed to run or
persist a scan.** — EXISTS, `prisma/schema.prisma`.

## 8. STYLING — its own thing, terminal, and HUGE (secondary)

`ConvergenceIntelligence` is **4,876 lines / 132 `font-mono`** — terminal-styled, its own dense
data-dashboard aesthetic (tables, monospace numbers, dense rows). Plus `TradeLabPanel`,
`DataObservatory`. A restyle to the homepage flush/sans contract would be **LARGE-to-XL** — far
bigger than Content (66) or Projects (103), and arguably the terminal/data-table look is
**appropriate** for a quant scanner (like keeping the rrule mono). **Styling is SECONDARY to "make
it run"** — flag separately; do NOT block running on a restyle. — RISK (XL restyle), defer,
`ConvergenceIntelligence.tsx` (4,876 lines).

## 9. SECURITY — unauthenticated PAID backtest routes (RISK to surface)

The main scan (`/api/trading/convergence`) is **`requireAdmin`-gated** (`:52`), and the operational
`tastytrade/*` routes (quotes/chains/scanner/positions/greeks/balances/connect) are auth-gated. But
**three routes call the PAID TastyTrade API with ZERO auth** (grep: 0 auth helpers in each):
- `app/api/tastytrade/backtest/run/route.ts` — `getTastytradeSessionToken()` (`:2,12`) + POST to
  TastyTrade backtest (`:27`), **no `requireAdmin`/`getVerified`/session check**.
- `app/api/tastytrade/backtest/simulate/route.ts` — same (`:2,9,47`).
- `app/api/tastytrade/backtest/available/route.ts` — same, no auth.
**Any unauthenticated caller can drive paid TastyTrade backtest calls.** — **RISK / SECURITY**,
surface for a `requireAdmin` gate (mirror `convergence/route.ts:52`). Not part of "run the Trade
tab," but a real exposure to flag.

---

## Explicit answers

**(a) Current Trade tab.** Admin → `ScanFilterForm` whose "Scan" **routes to `/trading`**
(`ModuleLauncher.tsx:351-363, 185`); non-admin/logged-out → a "coming soon / Requires an account"
stub (`:365-376`). It does NOT run the pipeline on the tab.

**(b) Real surface.** `app/trading/page.tsx` (next-auth `useSession` + `AppLayout`) →
`ConvergenceIntelligence` (4,876 lines) + `TradeLabPanel` + `DataObservatory`. Engine =
`lib/convergence/*` (20 files). **Coupled** (session + AppLayout + heavy panels) — NOT a
self-contained SectionX; the operations mount pattern does not transfer.

**(c) 12-step entry + run path.** `runPipeline` (`pipeline.ts:361`) via GET
`/api/trading/convergence` (`requireAdmin` gate, SSE stream). Path: dashboard
`ConvergenceIntelligence` → `/api/trading/convergence` → Step A (TT symbols) → batch Finnhub/FRED/
SEC/TT → cross-asset correlations → 4 gates + composite scoring → chain fetch + StrategyCards →
`scan_snapshot` + candidates returned.

**(d) Data sources.** All 6 **built**: TastyTrade, Finnhub (`FINNHUB_API_KEY`), FRED
(`FRED_API_KEY`), xAI Grok (`XAI_API_KEY`), Anthropic (`ANTHROPIC_API_KEY`), SEC EDGAR (keyless);
TastyTrade via `TT_USERNAME/PASSWORD/CLIENT_SECRET/REFRESH_TOKEN`. Each degrades gracefully if a
key is absent. Key VALUES not inspected; the live MSFT trade evidences they're configured in prod.
None stubbed/missing in code.

**(e) What "make it run" requires.** **Homepage wiring, not scanner/data work.** The scanner runs
today for the admin (route → `/trading`). To run on the Trade tab itself: either keep routing
(works) or mount `ConvergenceIntelligence` inline (MED-LARGE, heavy). The `requireAdmin` gate
(paid feeds) is by design — opening to non-admins is a cost/tier decision, not wiring. Specific
blocker = the tab redirects instead of running inline (+ the gate for non-admins).

**(f) Schema/migration.** None — all 9 trading tables present (§7).

**(g) Security.** Yes — **`tastytrade/backtest/{run,simulate,available}` call paid TastyTrade with
NO auth** (§9). The scan + operational routes are gated. Surface the backtest routes for a
`requireAdmin` gate.

**(h) Recommended PR sequence to make the Trade tab RUN.**
1. **PR-Trade-SEC (SMALL, do FIRST — security).** Add `requireAdmin` (mirror
   `convergence/route.ts:52`) to the 3 `tastytrade/backtest/*` routes. Unrelated to UI but a live
   exposure; fix before more trading work. — RISK fix.
2. **PR-Trade-runwire (SMALL-MED).** Decide the Trade-tab run model: **(A)** keep the
   route-to-`/trading` (already works for admin — maybe just make the admin's "Scan" clearer / the
   non-admin stub honest), or **(B)** run inline: on the homepage Trade tab, fire GET
   `/api/trading/convergence?stream=true` and render a lightweight results view (NOT the full
   4,876-line dashboard) — reuse the SSE + `StrategyCard` types. (B) is MED; (A) is SMALL.
   **Gate:** non-admin access to a paid scan needs an explicit tier/cost decision (live-money
   mandate) — do NOT silently open it.
3. **PR-Trade-style (LARGE-XL, SECONDARY, optional).** Only if a homepage-contract restyle of the
   trading dashboard is wanted — 4,876 lines / 132 mono. Recommend **deferring** (the data-table/
   terminal look suits a quant scanner; running it is the priority).
4. **(Not blocking) Portfolio fork (separate enhancement).** Decide correlation-as-gate vs. a
   portfolio-allocator module — the pipeline runs without it (correlation is advisory today, §6).

**Honest sizing:** the scanner is DONE; "make it run on the tab" is SMALL (keep routing) to MED
(inline results view). The security fix is SMALL and urgent. A full restyle is XL and secondary.
**Live-money / paid-API RISK:** every scan hits paid feeds — keep the `requireAdmin` gate, fix the
backtest routes, and treat any non-admin exposure as an explicit cost decision.

### Citation index
- Trade tab: `ModuleLauncher.tsx:185, 351-376, 134, 162`.
- Surface: `app/trading/page.tsx:4-12`; `components/convergence/ConvergenceIntelligence.tsx` (4,876
  lines, 132 mono); engine `lib/convergence/` (20 files incl. `pipeline.ts`, the 4 gates).
- Pipeline + auth: `pipeline.ts:361,375,655,1248`; `api/trading/convergence/route.ts:42-65, 52`.
- Data/keys: `data-fetchers.ts:348,514,536`; env refs ANTHROPIC/FINNHUB/FRED/TASTYTRADE_*/TT_*/XAI.
- Schema: `prisma/schema.prisma:304,325,1228,1266,1442,1460,1513,1582,1699`.
- Security (no-auth paid): `api/tastytrade/backtest/{run,simulate,available}/route.ts` (0 auth).
- Portfolio fork: `lib/convergence/cross-asset.ts`; `pipeline.ts:655,1248` (advisory, no gate/allocator).

*Do not implement — audit only.*
