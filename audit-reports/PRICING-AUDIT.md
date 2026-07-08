# PRICING-AUDIT — every module mapped to the real external APIs it fires (the factual skeleton for the transparency pricing page)

**Date:** 2026-07-08 · **Branch:** `claude/pricing-audit` · **Base:** main @ `16405f06` · **READ-ONLY — audit doc only, no app code changed.**

Rules followed: every dependency cited `file:line` from live code; **no prices invented** — cadence is marked only where the billing model is determinable from code/contract structure, otherwise "cadence unknown — Alex fills from invoice." Claims a sweep could not ground are marked **not verified**.

---

## 0. Headline truths the pricing page must be built on

1. **Two modules have ZERO external API cost: Hub Calendar and Tax.** Both are pure Postgres/local compute (verified below). Their only cost is shared infrastructure.
2. **The current `how-pricing-works` page's "Travel $0" claim is false.** Travel fires five paid vendors (Duffel, LiteAPI, Viator, Google Places, RapidAPI-visa) — search costs are real even when bookings are commission-funded.
3. **Anthropic is the main SHARED per-use cost** (Operations + Trading + Compliance + Claude Code Routines). Plaid is shared between Bookkeeping and Trading (investment holdings→cost basis). Everything else is dedicated to one module.
4. **The trading scan is the largest cost concentrator** (Finnhub + FRED + TastyTrade + EDGAR + xAI per run) and is **admin-gated only** — no public user can spend it today (`src/app/api/trading/convergence/route.ts:51`), 15-min cache (`:11`), **no per-run spend cap**.
5. **Both pricing pages are hardcoded filler** (one by explicit design), and one advertised tier ("Trader Pro") doesn't exist in code at all (§3).

## 1. Per-module API dependency map

### TRADING (pages `/trading`, `/data-observatory`; scan pipeline `src/lib/convergence/*`)

| external API | what it's used for | call site (file:line) | trigger | cost cadence |
|---|---|---|---|---|
| **Finnhub** (finnhub.io) | 19 scored endpoints + diagnostics: estimates, metrics, recommendations, insider, earnings, financials, news, earnings-quality, etc. (full endpoint map: `audit-reports/EDGE-7-AUDIT.md`) | `src/lib/convergence/data-fetchers.ts:110-113, 214, 230, 247, 262, 389, 445-447, 894, 1038, 1210, 1823-1824, 1920, 2024, 2074, 2143-2146, 2405, 2436, 2470, 2506, 2546, 2632`; also `src/app/api/finnhub/ticker-context/route.ts:37,60,80` | convergence scan (admin); ticker-context (any authed user, **no rate limit**); data-observatory check | **FIXED** — licensed subscription (Appendix A contract); amount from invoice |
| **FRED** (api.stlouisfed.org) | macro + vol-regime series for the regime gate (VIX/VIX3M/VVIX + 20 series) | `src/lib/convergence/data-fetchers.ts:638, 663, 683, 761`; `data-observatory/check/route.ts:546-547, 807` | scan; observatory check | **$0** — free government API |
| **TastyTrade** (api.tastyworks.com + backtester) | option chains, quotes, greeks, positions, balances, candles, backtests | `src/lib/tastytrade.ts:154` (session), SDK clients across `src/app/api/tastytrade/*`; scan chains via `src/lib/convergence/chain-fetcher.ts:1`, `pipeline.ts:384`; outcome-closer `outcome-tracker.ts:4` | scan; trading page loads (`src/app/trading/page.tsx:214-372`); outcome-closer; backtest panel | cadence unknown — brokerage-account API, no separate billing visible in code; Alex confirms |
| **SEC EDGAR** (data.sec.gov / efts.sec.gov) | XBRL companyfacts, submissions, 10-K/8-K scans | `data-fetchers.ts:931, 1260, 1320, 1569, 1588, 1621, 1672, 2583` | scan | **$0** — free government API |
| **xAI / Grok** (api.x.ai) | social/X sentiment, 2-stage (search + score) for top-9 tickers | `src/lib/convergence/sentiment.ts:152, 218` | scan (`pipeline.ts:1571`); `POST /api/convergence/sentiment` (tier-gated, 20-symbol cap `route.ts:37`) | **PER-USE** (per-token) |
| **Anthropic** (api.anthropic.com) | market brief, strategy analysis, convergence synthesis (model per `src/lib/ai/client.ts:33`) | `ai/market-brief/route.ts:154`; `ai/strategy-analysis/route.ts:130`; `ai/convergence-synthesis/route.ts:348` | user actions post-scan (synthesis called from `ConvergenceIntelligence.tsx:4709`); tier + AI rate-limit gated | **PER-USE** (per-token; in-code cost accounting at `client.ts:58`) |
| **Plaid** (shared with Bookkeeping) | investment holdings/transactions → cost basis | `api/investments/route.ts:30,34`, `investments/analyze/route.ts:28,37` | user sync actions, tier-gated | **PER-USE** (per-item/connection; Alex fills from invoice) |

### TRAVEL (pages `/trips`, `/booking`, `/budgets/trips`; APIs `api/flights|travel|places|trips`)

| external API | what it's used for | call site (file:line) | trigger | cost cadence |
|---|---|---|---|---|
| **Duffel** (api.duffel.com) | flight search, offers, orders/booking, payments | `src/lib/duffel.ts:52, 80, 98, 166, 218, 236, 255` via `flights/{search,payment-intent,book}` routes | user search/book; live-booking hard gate `DUFFEL_ALLOW_LIVE_BOOKING` (`flights/book/route.ts:75`); 25/day booking cap | **PER-USE** (per order/booking; search cadence from contract) |
| **LiteAPI** (api.liteapi.travel / book.liteapi.travel) | hotel search, rates, content, reviews, prebook, book | `src/lib/liteapiClient.ts:247, 305, 650, 730, 795, 853, 887, 904` via `travel/hotels/*`, `travel/liteapi/*` | user search/book; sandbox/prod via `LITEAPI_MODE` (`liteapiClient.ts:36,50`); per-feature daily caps (search 1000 / content 500 / reviews 500 / prebook 100 / book 25 — `src/lib/travelSearchQuota.ts:41-61`) | **PER-USE / commission** — booking-commission model; confirm from contract |
| **Viator** (api.viator.com/partner) | activities + transfers search | `src/lib/viatorClient.ts:84, 307, 341` via `travel/activities/search/route.ts:62`, `travel/transfers/search/route.ts:60` | user search; 1000/day cap | **commission (affiliate)** — revenue-share, not a bill; confirm from contract |
| **Google Places/Maps** (maps.googleapis.com) | POI discovery, geocode, details, photos | guarded `googleFetch`: `src/lib/placesSearch.ts:86, 118, 222`; `places/photo/route.ts:37,47`; `trips/[id]/commit/route.ts:142`; `trips/[id]/ai-assistant/route.ts:86` | user trip discovery, tier + entitlement gated; **hard monthly cap** `GOOGLE_PLACES_MONTHLY_CAP` default 5000 enforced `src/lib/googlePlacesQuota.ts:45-66`; 7-day cache `placesCache.ts:141` | **PER-USE** (per call) |
| **RapidAPI Travel-Buddy visa** | visa-requirement lookup | `src/lib/travelBuddyClient.ts:113` via `travel/visa/check/route.ts:64` | user visa check; 5/day cap "sized to free tier" (`travelSearchQuota.ts:45`) | currently free tier per code comment; PER-USE above free tier — confirm |
| **fetch-og** (arbitrary public URLs) | OG metadata for pasted listing URLs (SSRF-guarded, SEC-5) | `api/fetch-og/route.ts:33` (guard `:28`) | user pastes URL | $0 (no vendor) |
| Airalo / Mozio / Cover Genius / Ticketmaster | — | **not connected** — Airalo/Mozio/CoverGenius declared-only (`src/lib/travelSourceRegistry.ts:24`, `:6`); Ticketmaster appears nowhere | — | no cost |
| **Yelp** | business verification | **dead code** — `src/lib/verification.ts:100` has zero importers; its raw Google fetches (`verification.ts:26,59,73`) would BYPASS the Places cap if ever wired ⚠️ | none | no live cost; flag for deletion or guarded wiring |

**Important compliance fact for the pricing page:** the trip "AI assistant" fires **no LLM** — by design ("per Google Places API terms, Google Places data is NOT sent to any AI/LLM… There is no AI step in this pipe," `trips/[id]/ai-assistant/route.ts:26-29`). Travel's costs are vendor-search costs, not tokens.

### OPERATIONS (pages `/operations/*`; APIs `api/operations/*`, `api/ops/*`)

| external API | what it's used for | call site (file:line) | trigger | cost cadence |
|---|---|---|---|---|
| **Anthropic** | daily plan, brain-dump, project design/tasks/research pipe, content scripts, north-star | `ops/ai-plan/route.ts:90,110-130`; `ops/brain-dump/route.ts:61-64`; `src/lib/ai/generateProjectTasks.ts:216`, `generateProjectDesign.ts:109`, `generateDeepResearch.ts`, `generateReelScript.ts:174`, `enrichRoutineScenes.ts`; pipe via Inngest `src/inngest/functions/operations-pipe-run.ts:170` | user actions + background pipe; budgets: `AI_PIPE_DAILY_CAP` 20/day (`src/lib/pipeBudget.ts:15-70`), Routine caps 10/day + 5/day (`routineFireBudget.ts:18-73`, `execFireBudget.ts:16-71`) | **PER-USE** (per-token) |
| **Inngest** | durable background jobs (pipe runs, routine evaluator, ingest) | client `src/inngest/client.ts:27`, fns `src/inngest/functions/index.ts:22-31` | events + schedules | cadence unknown — SaaS with free tier; Alex fills from invoice |

### HUB CALENDAR (pages `/hub`, `/agenda`; APIs `api/calendar`, `api/hub/*`, `api/agenda*`)

**No external APIs — pure Postgres** (`api/calendar/route.ts` is raw Prisma on `calendar_events`; all `api/hub/*` verified DB-only). It does **not** call Google Calendar or CalDAV; Google/GitHub OAuth is login-only with default scopes (`api/auth/[...nextauth]/route.ts:18-25`). Cost = shared infrastructure only.

### BOOKKEEPING (pages `/transactions`, `/ledger`, `/journal-entries`, `/statements`, `/chart-of-accounts`, `/accounts` …)

| external API | what it's used for | call site (file:line) | trigger | cost cadence |
|---|---|---|---|---|
| **Plaid** | bank/CC account link + transaction sync, balances, institutions | client `src/lib/plaid.ts:27` (production env hardcoded `:9`); `plaid/link-token/route.ts:40`; `plaid/exchange-token/route.ts:29,39,49,73`; `transactions/sync/route.ts:53`, `sync-complete/route.ts:60,180`, `sync-full/route.ts:47` (+ resync/fix/backfill routes) | **user-initiated only** (link flow + manual sync button); no cron sync, **no Plaid webhook handler exists**; tier-gated `requireTier('plaid')` | **PER-USE** (per connected item/month; Alex fills from invoice) |
| **OpenAI** | spending insights (bookkeeping-adjacent) | `ai/spending-insights/route.ts:29,52` (singleton `src/lib/openai.ts:4`) | user action; AI rate-limited (`:26`) | **PER-USE** (per-token) |

Auto-categorization is **pure DB** (`src/lib/auto-categorization-service.ts:39,58-73`) — the nightly cron (`vercel.json:4`, `api/cron/auto-categorize`) fires no vendor. The declared `'gpt'` source type is never produced.

### TAX (APIs `api/tax/*`, `api/account-tax-mappings`, `api/cpa-export`, `api/tax-estimate`)

**No external APIs — zero vendor imports** across all tax routes (grep verified). 1040/Schedule C/wash-sale logic is local; PDFs built locally with pdfkit. Cost = shared infrastructure only.

### COMPLIANCE (de-facto 7th module — pages `/compliance/*`, `/soc2`)

| external API | used for | call site | trigger | cadence |
|---|---|---|---|---|
| **Anthropic** | regulatory discovery runs | `src/lib/discovery/runDiscovery.ts:68-69` | discovery runs | **PER-USE** |
| **Voyage AI** | embeddings + rerank for the regulatory corpus | `src/lib/corpus/embed/voyage-client.ts:19,72`; `retrieve/voyage-rerank-client.ts:16,58`; workbench search + Inngest `embed-pending.ts:22` | ingest jobs + workbench search | **PER-USE** (per-token; `.env.example:139-145` notes a monthly cap) |
| **Gov APIs** (eCFR, US Code, Federal Register, IRS) | regulation text ingest | `src/lib/corpus/ingest/ecfr-fetch.ts:25`, `fedreg-fetch.ts:28`, `uscode-titles.ts:133`, `irb-fetch.ts:32` | Inngest ingest | **$0** — free government APIs |

### Cross-cutting (not one of the six products)

| external API | used for | call site | cadence |
|---|---|---|---|
| **Stripe** | billing itself (checkout, portal, webhook→tier) | `src/lib/stripe.ts:10`; `api/stripe/checkout/route.ts:29,43`; `portal/route.ts:22`; `webhook/route.ts:16,30` | **PER-USE** (% + fee per transaction) |
| **Google/GitHub OAuth** | login only (no calendar/Gmail scopes) | `api/auth/[...nextauth]/route.ts:18-25` | $0 |
| **OpenAI** | meal-plan / meal-planner / cart-plan (Personal/Shopping lifestyle) | `ai/meal-plan/route.ts:62,342`; `meal-planner/route.ts:93,109`; `cart-plan/route.ts:96,170` | **PER-USE** |
| **Infrastructure** (Vercel Pro, Azure Postgres, domain, GitHub) | hosting/DB/repo | deployment stack (README/how-pricing-works INFRA list) — not code-traceable calls | **FIXED** — amounts from invoices |

## 2. Shared vs dedicated (the allocation truth)

**SHARED (fixed or pooled cost must be allocated across products):**

| API | modules sharing it | evidence |
|---|---|---|
| **Anthropic** | Operations + Trading + Compliance (+ Claude Code Routines) | call sites above; single `ANTHROPIC_API_KEY`, shared per-user rate bucket `src/lib/ai-rate-limit.ts:19-40` |
| **Plaid** | Bookkeeping (bank sync) + Trading (investment holdings → cost basis) | `transactions/*` vs `investments/*` call sites |
| **OpenAI** | Bookkeeping (spending insights) + Personal/Shopping (meals, cart) | call sites above |
| **Inngest** | Operations (pipe, routines) + Compliance (corpus ingest, embeddings) | `src/inngest/functions/index.ts:22-31` |
| **Infra** (Vercel, Azure Postgres, domain, GitHub, Stripe-as-processor) | all modules | deployment stack |

**DEDICATED (one module carries the whole cost):**

| API | module |
|---|---|
| Finnhub, FRED($0), TastyTrade, SEC EDGAR($0), xAI | **Trading** |
| Duffel, LiteAPI, Viator, Google Places, RapidAPI-visa | **Travel** |
| Voyage, gov ingest APIs($0) | **Compliance** |
| Stripe (as billing product) | Billing |

**Zero-external-cost modules:** **Hub Calendar** and **Tax** (infra allocation only).

## 3. The current pricing pages — real vs filler (Phase 3 verdict)

### `/how-pricing-works` (`src/app/how-pricing-works/page.tsx`, 435 lines)
**100% hardcoded filler — by explicit design.** The header comment (`page.tsx:3-14`) says so: "STATIC by design: every cost/allocated cell is a hand-entered placeholder ($—, TBD, or a known-free $0). NOTHING here fetches or computes a real number." Every dollar cell is a literal `'$—'`/`'TBD'` (e.g. TastyTrade `:65`, IRS MeF `:91`, the whole INFRA block `:104-109`, totals `:155, :304, :358-370, :388, :402`). The only runtime logic is a Method A/B highlight toggle (`:168`) — it computes nothing. Split percentages (Finnhub 60% `:66`, Method-A splits `:112-118`) are hand-entered constants.
**Two truth errors to fix when rebuilding:** (1) "Travel $0" (`:258`) — contradicted by §1 (five paid vendors); (2) the module ledgers omit shared-API reality (§2) — e.g. Plaid appears only under one module.

### `/pricing` (`src/app/pricing/page.tsx`, 264 lines)
Prices `$0/$20/$40/$60` and all feature bullets are **hardcoded in a `TIERS` const** (`:8-74`), never reconciled against Stripe (real charges live only in `STRIPE_PRO_PRICE_ID`/`STRIPE_PRO_PLUS_PRICE_ID` env). The checkout/portal/auth plumbing is real (`api/stripe/*`) but **every paid button is disabled** ("Coming Soon", `:219`) — the platform currently has no self-serve paying path, so all API costs are Alex's today.
**Phantom tier:** "Trader Pro" (`:58-59`) has **no `TierConfig`, no Stripe price, is not in the `Tier` union** (`src/lib/tiers.ts:15`) and would 400 at checkout (`api/stripe/checkout/route.ts:21`). Filler.
**Real tier structure** (`src/lib/tiers.ts:29-63`): free / pro / pro_plus gating plaid, ai, tradingAnalytics, tripAI, placesSearch, maxLinkedAccounts(0/10/25). **Enforced** via `requireTier` (`src/lib/auth-helpers.ts:41-49`) on ~15 routes (plaid, ai, placesSearch, tripAI). **Defined but NOT enforced:** `tradingAnalytics` (routes deliberately DB-only) and `maxLinkedAccounts` (zero enforcement found) — the pricing page's "10/25 accounts" bullets are cosmetic today. Admin user bypasses all gates (`tiers.ts:13,72`).

## 4. Cost-control inventory (what already protects spend — worth showing on the transparency page)

| control | scope | file:line |
|---|---|---|
| `TRAVEL_SEARCH_DAILY_CAP(_<PROVIDER>)` atomic daily reservations | every travel vendor search/book | `src/lib/travelSearchQuota.ts:63-107` |
| `GOOGLE_PLACES_MONTHLY_CAP` (default 5000) + 7-day cache | Google Places | `src/lib/googlePlacesQuota.ts:27-66`; `placesCache.ts:141` |
| `DUFFEL_ALLOW_LIVE_BOOKING` + booking caps + `BOOK_RATE_LIMIT` | flight booking | `flights/book/route.ts:42,75,97` |
| `LITEAPI_MODE` sandbox default | hotel booking | `liteapiClient.ts:36-50` |
| `requireTier` before paid call (security-first pattern) | plaid/ai/places/tripAI routes | `src/lib/auth-helpers.ts:41-49` + ~15 routes |
| `AI_RATE_LIMIT` 30/hr/user (SEC-5) | all `/api/ai/*` LLM routes | `src/lib/ai-rate-limit.ts:19-40` |
| `AI_PIPE_DAILY_CAP` 20 / `AI_ROUTINE_DAILY_CAP` 10 / `AI_EXEC_DAILY_CAP` 5 | operations pipe + Routines | `pipeBudget.ts:15-70`; `routineFireBudget.ts:18-73`; `execFireBudget.ts:16-71` |
| `requireAdmin` + 15-min cache | the convergence scan (Finnhub/FRED/TT/xAI/EDGAR spend) | `trading/convergence/route.ts:11,51` |
| 20-symbol cap | standalone sentiment route (xAI) | `convergence/sentiment/route.ts:37` |

**Gaps found (flag for hardening, not fixed here):** no daily spend cap on the scan itself beyond the admin gate; `finnhub/ticker-context` has no rate limit; SEC-CHECK already flags `places/photo` + some `operations/ai/*` routes missing tier gates (`audit-reports/SEC-CHECK-prepublish.md:503-504,549-550`); dead `verification.ts` would bypass the Places cap if ever wired.

## One-paragraph summary

The six products split cleanly: **Trading** carries the dedicated heavy feeds (Finnhub FIXED-subscription, TastyTrade, xAI per-token; FRED and EDGAR are free) plus a share of Anthropic; **Travel** carries five dedicated per-use/commission vendors behind hard daily and monthly caps and fires no LLM at all; **Operations** is Anthropic-per-token plus Inngest; **Bookkeeping** is Plaid per-item (user-initiated sync only — no webhook, no cron) plus a sliver of OpenAI; **Hub Calendar and Tax cost exactly $0 in external APIs** — pure Postgres and local compute; Compliance (a de-facto seventh module) runs Anthropic + Voyage per-token over free government sources. The shared-allocation problem reduces to four pools — Anthropic (Ops/Trading/Compliance), Plaid (Books/Trading), OpenAI (Books/Personal), Inngest (Ops/Compliance) — plus fixed infra across everything. The current `how-pricing-works` page is self-admittedly 100% placeholder, the `/pricing` page's four tiers include one that doesn't exist in code and two feature claims that aren't enforced, and every paid button is disabled — so the new pricing page starts from this dependency map, Alex's real invoices for the FIXED/unknown-cadence rows, and the §4 cost-control inventory as the transparency story.
