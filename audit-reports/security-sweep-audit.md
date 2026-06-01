# SECURITY SWEEP Audit: paid-route gating across all API routes

**Branch:** `claude/security-sweep-audit`
**Date:** 2026-05-31
**Mode:** READ-ONLY. Paranoid full sweep of 245 routes under `src/app/api/`.
**Goal:** Confirm EVERY route hitting a paid external API is admin/owner-gated
(like the just-fixed `/api/trading/convergence`), so only Alex can trigger paid
calls right now. Flag every under-gated hole.

---

## 0. Gating primitives + the key context

- **`requireAdmin()`** (`src/lib/require-admin.ts:8`) — gates to `OWNER_EMAIL`
  (Alex). Returns 401/403. **The reference** (used by `convergence` + `api/admin/*`).
- **`requireTier(tier, feature, userId)`** (`src/lib/auth-helpers.ts:41`) → 403
  unless `canAccess` (`tiers.ts:66`). **`canAccess` admin-bypasses for
  `ADMIN_USER_ID`** (`tiers.ts:68`).
- **`getVerifiedEmail()`** (`cookie-auth.ts:54`) — login-only (any account).
- **CRITICAL CONTEXT:** **all paid tiers are "Coming Soon" — only `ADMIN_USER_ID`
  has `pro_plus`** (`tiers.ts:8-9`; `free`/`pro` have `ai:false, tripAI:false`,
  only `pro_plus` true `:32-56`). So **`requireTier('ai'|'tripAI')` is
  EFFECTIVELY admin-only today** (no real user has pro_plus) — equivalent cost
  protection to `requireAdmin`. This sharply narrows the real holes: the danger is
  the **`getVerifiedEmail`-only** routes (any logged-in user) and the **no-auth**
  routes.
- **Middleware** (`src/middleware.ts:50-92`): matcher covers `/api/*`
  (`:95-105`); any path not in **PUBLIC_PATHS** requires a verified cookie OR a
  NextAuth token, else **redirect to `/`**. So even no-in-handler-auth routes are
  **not reachable by a true guest** — but middleware does a *redirect* (not a hard
  401) and accepts a NextAuth token without the cookie, so it's a weaker second
  line than an explicit gate.

## 1. PUBLIC_PATHS (middleware) — none reach a paid route

`middleware.ts:50-64`: `/`, `/admin`, `/api/admin/verify`, `/api/admin/users`,
`/api/auth`, `/_next`, `/favicon.ico`, `/pricing`, `/api/stripe/webhook`,
`/api/inngest`, `/opengraph-image`, `/terms`, `/privacy`. **None call a paid
external feed** (`stripe/webhook` is Stripe-inbound, `inngest` is the job runner,
`admin/verify|users` are auth). ✅ No public path reaches a paid vendor.

## 2. HOLES — paid routes that are UNDER-gated (ranked by cost exposure)

> **⚠ TastyTrade is a SHARED FIRM account, not per-user OAuth.** All
> `/api/tastytrade/*` calls authenticate via env creds (`TASTYTRADE_CLIENT_SECRET`
> / `TASTYTRADE_REFRESH_TOKEN` / `TT_USERNAME`, `src/lib/tastytrade.ts:9-118`) —
> i.e. **Alex's own brokerage session**. So *any* logged-in user hitting a TT
> route burns **Alex's** rate limit / account, NOT their own. This **invalidates
> the "user-scoped → acceptable" defense for every TT route** — they're all
> firm-scoped cost.

### 🔴 CRITICAL — NO in-handler auth, paid vendor (any logged-in user; guest blocked only by middleware redirect)
| Route | Paid vendor | Auth | Cite |
|---|---|---|---|
| `/api/test/convergence-pipeline` | **full pipeline** TastyTrade+Finnhub+FRED (`runPipeline`, `limit≤150`) | **NONE** | `convergence-pipeline/route.ts` (0 auth) |
| `/api/test/data-audit` | TastyTrade + Finnhub/FRED | **NONE** | `test/data-audit/route.ts:175` (0) |
| `/api/test/tt-candles` | TastyTrade (arbitrary symbol candle stream) | **NONE** | `test/tt-candles/route.ts` (0) |
| `/api/tastytrade/backtest/run` | TastyTrade backtester (polls ≤60s) | **NONE** | `backtest/run/route.ts:10` (0) |
| `/api/tastytrade/backtest/simulate` | TastyTrade | **NONE** | `backtest/simulate/route.ts:9` (0) |
| `/api/tastytrade/backtest/available` | TastyTrade | **NONE** | `backtest/available/route.ts:4` (0) |

**Worst case:** `/api/test/convergence-pipeline` runs the **same full multi-vendor
paid pipeline** as the main scan with **zero in-handler auth** and `limit` up to
150 tickers. These are **test/debug + backtest** routes with no gate hitting paid
feeds — reachable by **any logged-in user** (middleware blocks no-cookie/no-token
guests via *redirect*, not a hard 401, and accepts a NextAuth token without the
cookie). **Highest priority — admin-gate or delete from prod.**

### 🟠 HIGH — login-only (`getVerifiedEmail`), paid vendor, NOT user-scoped or money-moving
| Route | Paid vendor | Auth | Cite | Exposure |
|---|---|---|---|---|
| `/api/travel/liteapi/book` | LiteAPI **book** (charges card, writes commission) | login-only | `book/route.ts:39` (trip-owner scoped `:90`) | money flow |
| `/api/travel/liteapi/prebook` | LiteAPI **prebook** (locks offer) | login-only | `prebook/route.ts:15` (owner scoped `:43`) | money flow |
| `/api/flights/book` | Duffel **create order** (books a flight) | login-only | `flights/book/route.ts:8` (NOT trip-scoped) | money flow |
| `/api/flights/search` | Duffel offer search (paid/quota) | login-only | `flights/search/route.ts:8` (NOT trip-scoped) | paid scan |
| `/api/tastytrade/scanner` | TastyTrade scanner (market data) | login-only | `scanner/route.ts:156` | paid scan |
| `/api/test/convergence` | full convergence pipeline (TT/Finnhub/FRED/xAI) | login-only | `test/convergence/route.ts` | **paid scan — same cost as the gated `/trading/convergence`** |
| `/api/finnhub/ticker-context` | Finnhub | login-only | `ticker-context/route.ts:6` | paid data |
| `/api/data-observatory/check` | **xAI/Grok** + Finnhub | login-only | `data-observatory/check/route.ts:929` | paid AI |
| `/api/operations/ai/optimize-north-star-section` | Anthropic/Claude | login-only | `optimize-north-star-section/route.ts:97` | paid AI |
| `/api/ops/ai-plan` | Anthropic/Claude | login-only | `ops/ai-plan/route.ts:78` | paid AI |
| `/api/ops/brain-dump` | Anthropic/Claude | login-only | `ops/brain-dump/route.ts:42` | paid AI |
| `/api/places/photo` | Google Places (text-search + photo) | login-only | `places/photo/route.ts:15` | paid quota |
| `/api/trips/[id]/commit` | Google Places (destination photo/geocode) | login-only, **owner-scoped** (`:28`) | `commit/route.ts:10` | paid quota |

> **`/api/test/convergence` is the standout** — it runs the **same paid pipeline**
> as `/api/trading/convergence` (which we just gated to admin) but is **login-only**.
> Gating one and leaving the test twin open defeats the fix. Top of the HIGH list.

### 🟠 HIGH (corrected) — login-only TastyTrade routes hit ALEX'S FIRM account
`balances`, `positions`, `status`, `greeks`, `quotes`, `chains`, `connect`,
`disconnect`, `callback` (all `getVerifiedEmail`-only): because TT is a **shared
firm session** (env creds, not per-user OAuth), these are **NOT user-scoped** —
any logged-in user reads Alex's positions/balances and drives arbitrary-symbol
TT quote/chain/greek calls against his account. `balances`/`positions`/`status`
also **leak Alex's brokerage data** to any logged-in user (a confidentiality issue
on top of cost). **Recommend `requireAdmin`** on all TT routes (only Alex's data,
only Alex should see/drive it). The arbitrary-symbol scan-like ones
(`scanner`/`chains`/`greeks`/`quotes`) are the higher cost sub-set.

### 🟡 LOWER — login-only but genuinely USER-SCOPED (acceptable for now)
**Plaid transaction/investment routes** — `transactions/sync`, `sync-complete`,
`sync-full`, `resync-with-rich-data`, `fix-categories`, `investments`,
`investments/analyze` (all `getVerifiedEmail`, all `where: { userId: user.id }`) —
operate only on the **caller's own** bank data → login-only is defensible. The
gated Plaid routes (`link-token`/`exchange-token`/`items`/`sync`) add
`requireTier('plaid')`. **Stripe** `checkout`/`portal` act on the caller's own
subscription (login-only, user-scoped, fine); `webhook` is signature-verified
(public by design). `admin/backfill-transaction-fields` is correctly `requireAdmin`.

## 3. The Travel scan routes — guest/non-admin reachability (highest-priority check)

**The new public home launcher does NOT open a paid hole for guests:**
- **Guests cannot reach ANY scan route** — they're blocked by middleware (none are
  in PUBLIC_PATHS) and by each handler's `getVerifiedEmail` 401. The launcher lets
  a guest only *fill* the Travel form; the create (`POST /api/trips`) and the scan
  are auth-gated (HOME-PR-1 register-gate).
- **`POST /api/trips/[id]/ai-assistant`** (the main Travel scan — LiteAPI/Viator/
  Google per category) is gated by **`requireTier(user.tier, 'tripAI', user.id)`**
  (`ai-assistant/route.ts:135`). Since `tripAI` is `pro_plus`-only and no real user
  has pro_plus, **this is effectively admin-only today** — the strongest travel
  gate, equivalent to `requireAdmin` for cost. ✅ (Intended boundary — guest fills
  form, only admin/pro_plus runs the paid scan — is **correctly enforced**.)
- **Ownership gap (flag):** `ai-assistant` looks up the trip `where: { id: tripId }`
  **without `userId`** (`:220-221`), and the Google/Viator paths never look up the
  trip at all (`tripId` is only the upsert key). So a pro_plus/admin caller could
  pass **any** `tripId`. Bounded by the tripAI tier gate (admin-only now), so **not
  a current cost hole**, but a data-scoping weakness to fix when paid tiers launch.
- **LiteAPI prebook/book + Duffel** (the money-moving travel calls) are the real
  travel exposure — **login-only, no tier gate** (see §2 HIGH). prebook/book are
  trip-owner-scoped; Duffel is not scoped at all.

**Intended vs actual boundary:** intended = "guest fills form; only authorized
(admin now) runs paid scans/books." Actual = the **scan** (`ai-assistant`) honors
this (tripAI≈admin); the **bookings** (`liteapi book/prebook`, `flights book`) do
**not** (any logged-in user). Recommend gating the bookings.

## 4. Test/debug exposure

Test/debug routes that hit paid vendors: **`/api/test/tt-candles`** (NONE),
**`/api/test/data-audit`** (NONE), **`/api/test/convergence`** (login-only — paid
pipeline), **`/api/test/convergence-pipeline`** (check), plus the
**`/api/tastytrade/backtest/*`** trio (NONE). None are in PUBLIC_PATHS (so no true
guest), but **none should exist with a paid call and no admin gate in a live
deployment** — recommend `requireAdmin` on all of them, or removing the test
routes from prod entirely.

## 5. Fix sequence (recommended)

0. **NOTE — `/api/trading/convergence` is fixed on `claude/trading-pr-sec`** (the
   prior PR added `requireAdmin`), **but not yet merged to main** — this audit
   branch was cut from main, where it still reads `getVerifiedEmail` (`:44`). Merge
   that PR first; this sweep covers the rest.
1. **SEC-2 (🔴 immediate): the NO-auth paid routes** —
   `test/convergence-pipeline` (full pipeline!), `test/data-audit`, `test/tt-candles`,
   `tastytrade/backtest/{run,simulate,available}` → `requireAdmin` **or delete from
   prod** (recommended for the pure test routes). Zero legitimate non-admin use.
2. **SEC-3 (🔴): `test/convergence`** → `requireAdmin` (the login-only twin of the
   now-gated main pipeline — gating one and leaving this open defeats the fix).
3. **SEC-4 (🟠): TastyTrade firm-account routes** — `tastytrade/scanner` (broad
   scan), `chains`, `greeks`, `quotes`, `balances`, `positions`, `status`,
   `connect`, `disconnect`, `callback` → `requireAdmin`. They run on **Alex's
   shared TT session** (cost AND data-confidentiality), so only Alex should reach
   them. `scanner` is the highest-cost; `balances`/`positions` also leak his data.
4. **SEC-5 (🟠): money-moving travel** — `travel/liteapi/book`, `travel/liteapi/
   prebook`, `flights/book` → `requireAdmin` now (only Alex transacts); revisit to
   a booking-tier gate at tier launch. Keep trip-ownership scoping.
5. **SEC-6 (🟠): login-only paid scan/AI routes** — `flights/search`,
   `finnhub/ticker-context`, `data-observatory/check`,
   `operations/ai/optimize-north-star-section`, `ops/ai-plan`, `ops/brain-dump`,
   `places/photo` → `requireAdmin` now (consistency with convergence). The 3 ops AI
   routes (Claude, no scoping) are the clearest.
6. **SEC-7 (🟡, later): ownership-scope `ai-assistant`** — add the `userId` filter
   to the trip lookup; harden when pro_plus opens to real users. (Not a current
   cost hole — tripAI is admin-only today.)
7. **No action:** user-scoped **Plaid** transaction/investment routes + **Stripe**
   checkout/portal/webhook — own-data / signature-verified.

> **Note:** because `requireTier('ai'/'tripAI')` is admin-only TODAY, the
> `/api/ai/*` routes (market-brief, strategy-analysis, convergence-synthesis,
> spending-insights, meal-plan(ner), cart-plan) are **already effectively
> admin-gated** — no action needed now, but they flip open the day a real user
> gets `pro_plus`, so revisit at tier launch.

## Sign-off items
1. **Test/backtest routes (§4)** — admin-gate (SEC-2/3) vs **delete from prod**
   entirely (recommended for the pure test routes). Confirm.
2. **Travel guest boundary (§3)** — confirm the intended boundary is "guest fills
   the form; only admin runs the paid scan" — which `ai-assistant` already enforces
   (tripAI≈admin). **No change needed to keep guests form-filling**; gating is on
   the *scan/booking*, not the form. Confirm this reading.
3. **Bookings (SEC-4)** — `requireAdmin` on liteapi book/prebook + flights/book now
   (only Alex transacts), vs a future booking-tier gate. Confirm interim = admin.
4. **`requireAdmin` vs `requireTier` going forward** — since tiers are admin-only
   today they're equivalent; recommend `requireAdmin` for the explicit "Alex only"
   routes (test/booking) and leave the `requireTier('ai'/'tripAI')` routes as-is
   (they auto-open correctly at tier launch). Confirm.
5. **ai-assistant ownership (SEC-6)** — confirm it's deferred to tier launch (not a
   current cost hole, since tripAI is admin-only).

---

**READ-ONLY audit. No implementation performed.** Swept all 245 routes via three
parallel vendor-cluster passes (AI, finance, travel) + direct verification of
every cited gate. Two corrections the sweep surfaced vs initial assumptions: (1)
**TastyTrade is a shared firm account** (env creds), so no `/api/tastytrade/*`
route is "user-scoped" — they all spend Alex's account; (2)
`/api/test/convergence-pipeline` is **fully unauthenticated** and runs the whole
paid pipeline. Both are reflected above.
