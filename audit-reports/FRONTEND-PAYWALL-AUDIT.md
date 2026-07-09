# FRONTEND-PAYWALL-AUDIT — what a logged-out / free visitor actually sees, and where the labels lie

**Date:** 2026-07-08 · **Branch:** `claude/frontend-paywall-audit` · **Base:** main @ `a713f96b` · **READ-ONLY — audit doc only, no code changed.**

**The one-sentence truth:** the frontend paywall is an **admin wall plus an auth wall — not a tier wall.** The backend gates by tier (~15 `requireTier` routes); the homepage gates by `isAdmin`; exactly **three** client surfaces gate by tier; and a paying Pro/Pro+ subscriber (if checkout were enabled today) would **still see "coming soon" stubs** on Trade/Books/Tax/Compliance, because the UI never checks their plan — only whether they are Alex.

---

## 1. The logged-out homepage (`src/app/page.tsx` + `src/components/home/ModuleLauncher.tsx`)

Header: "Enter →" opens the LoginBox modal in login mode (`page.tsx:131-134`); "Get Started" opens it in register mode (`page.tsx:181-184`); "Pricing" links to `/how-pricing-works` (`page.tsx:109-111`). Nothing else is behind either button — no trial, no checkout.

Middleware context (`src/middleware.ts:50-131`): every module PAGE (`/trading`, `/transactions`, `/operations`, `/hub`, …) redirects a logged-out visitor to `/` (`:127-131`). The genuinely public surface: `/`, `/pricing`, `/terms`, `/privacy`, the guest travel search/booking APIs (`:70-87`, rate-limited + daily-capped), the Stripe webhook, Inngest — **and `/admin` (`middleware.ts:52`), which a logged-out visitor can load** (its own page/API gate is its only protection — flagged for review, not judged here).

### Per-tab logged-out behavior (the tab bar is `ModuleLauncher.tsx:108-118`)

| tab | what a logged-out visitor gets | evidence |
|---|---|---|
| **Runway** | a REAL empty calendar grid (`demoEvents={[]}` — zero fetches) + the budget panel in preview mode (empty shells, zero authed fetches) | `ModuleLauncher.tsx:598-615` |
| **Travel** | **LIVE functionality, guest-usable:** flight/hotel/transfer/activity search + visa check hit real vendors through the public API paths; trip SAVE is register-gated (`gateGuestCreate` opens the sign-up modal); premium Google categories render 🔒 locked cards (no fetch, zero spend); three static coming-soon rows (insurance / eSIM / events) | `:622-750`, `:348-355`, `:736-747`, `:705-716`; `middleware.ts:70-87` |
| **Routines** | fetch-free teaser form; "create" opens the login modal | `:499-501` |
| **Projects** | fetch-free marketing showroom (`OperationsPipelineShowroom`) | `:461-463` |
| **Content** | same showroom | `:480-482` |
| **Trade** | the shared paid stub: *"Trading — coming soon. … Requires an account."* + **"Launch Trading Module"** button | `:508-520` via `:821-823` |
| **Books** | same stub ("Bookkeeping — coming soon.") | `:881-883` |
| **Tax** | same stub | `:896-900` |
| **Compliance** | same stub | `:913-917` |

### The "Launch Trading Module" button and the coming-soon claim (Phase 1 item 3)

- **The button routes nowhere.** `onClick={onRequireAuth}` (`ModuleLauncher.tsx:514`) → the register/login modal (`page.tsx:195`). It never navigates to `/trading`. For an **already-logged-in** non-admin, "Launch Trading Module" opens a login modal — a dead-end loop.
- **Trading is NOT coming soon — it is live.** The same file mounts the full working surface for the admin on the same tab (`ScanFilterForm` + `ConvergenceIntelligence` + `TradeLabPanel`, `:791-820`). The standalone `/trading` page is fully functional and contains no coming-soon text; **any registered user can load it directly** (middleware auth only, no tier/admin gate on the page), and its data routes are auth-only — `/api/trading/trades` has no tier gate (`api/trading/trades/route.ts:5-13`). What is actually withheld from non-admins is the scan (`requireAdmin`, `trading/convergence/route.ts:51`) and the `isOwner` sections on the page (`trading/page.tsx:90-91, 851, 1021`).
- **Verdict: "coming soon" is an access label wearing a build-status costume.** The honest copy is "built — not yet open to the public" (which is what `tiers.ts:8-9` says internally). The contradiction is sharpened by the tab descriptor directly above the stub, which speaks in the present tense about what the scanner does (`ModuleLauncher.tsx:139`).

## 2. UI paywall vs backend gate (the honest state)

`/api/auth/me` **does** return `tier` to the client (`me/route.ts:28, 48`) along with server-computed `isAdmin` and `entitledCategories`. What consumes it:

| consumer | what it reads | what it gates |
|---|---|---|
| `ModuleLauncher` | `isAdmin`, `entitledCategories` — **ignores `tier`** (`:203-206`) | homepage real surfaces (admin wall) + travel category locks |
| `AppLayout` (the app shell) | `{email, name}` only (`AppLayout.tsx:47-50`) — **tier never read** | nothing — sidebar/shell identical for all tiers |
| `dashboard/page.tsx` | `tier` (`:170`) + `ADMIN_USER_ID` | Plaid bank-sync: free → inline "Bank Sync requires Pro" modal (`:325-331, 435-447`) |
| `shopping/page.tsx` | `tier` (`:40-42`) | AI planner: free → "requires Pro+" block (`:250-280, 294-306`) |
| `budgets/trips/[id]/page.tsx` | `tier` (`:776`) | trip AI: free/pro → "requires Pro+" + scan provider not mounted (`:835-851`) |
| `UpgradePrompt.tsx` | — | **DEAD CODE** — the reusable tier-gate component is imported by nothing |

### Gating classification (end-to-end truth)

| state | features | evidence |
|---|---|---|
| **Gated end-to-end (UI + API)** | Plaid bank-sync; shopping AI planner; trip AI planner; premium travel categories (UI locks + per-category server gate) | table above + `requireTier` call sites |
| **API-gated but UI-open** | `tradingAnalytics` (realized P&L): server 403s for free (`realized-pnl/route.ts:51-52` post-PAYWALL) — but the only UI consumer, `RunwayBudgetPanel.tsx:200-204`, renders the 403 as *"Trading unavailable — could not load realized P&L"* (`:280`) — **an outage message, not a paywall message** | see §3 lie #2 |
| **Auth-gated only (no tier anywhere)** | `/trading` page (full render, empty data for a free user — "No trades in selected period"), `/transactions`, `/operations`, `/hub`, `/dashboard/tax`; `/api/trading/trades` | sweep of all `page.tsx`; `trading/page.tsx:421-432, 1011-1013` |
| **Admin/owner-gated (identity, not plan)** | homepage Trade/Books/Tax/Compliance real surfaces; the convergence scan; trading-page intel sections | `ModuleLauncher.tsx:791-919`; `trading/page.tsx:90-91` |

**Free-logged-in-user experience, plainly:** fully rendered module pages with empty/zero data, no upgrade walls anywhere except the three hand-rolled modals. No crashes — but also almost no selling: the tier system is invisible in the UI outside those three spots.

## 3. Every place a label lies about what the code does

1. **"{Module} — coming soon" on Trade/Books/Tax/Compliance** (`ModuleLauncher.tsx:510`): all four are built and live behind the admin wall; `/trading` even loads fully for any registered user. Access label presented as build status.
2. **"Trading unavailable — could not load realized P&L"** (`RunwayBudgetPanel.tsx:280`): for a free user this is a deliberate 403 paywall (`tradingAnalytics: false`) rendered as an availability failure. The truthful message is "requires Pro."
3. **"Launch Trading Module"** (`ModuleLauncher.tsx:517`): launches nothing — opens a sign-up modal, even for users who are already signed in.
4. **Present-tense Trade descriptor above the stub** (`ModuleLauncher.tsx:139`): "Tell the scanner what you're hunting, and it pulls live prices…" — directly above "coming soon" for everyone but the admin.
5. **Pricing bullets "Plaid bank sync (10 accounts)" / "Up to 25 linked accounts"** (`pricing/page.tsx:31, 50`): `maxLinkedAccounts` is enforced **nowhere** (no UI check, no API check — confirmed again this audit; PAYWALL-2 finding stands).
6. **"Coming Soon - Now Active!"** (`hub/itinerary/page.tsx:135`): the inverse lie — a shipped feature still wearing a coming-soon label.
7. **Honest labels, for the record:** the pricing page's Pro/Pro+ "Coming Soon" CTAs are TRUE (buttons genuinely disabled, `pricing/page.tsx:204-205`); the travel insurance/eSIM/events rows are TRUE coming-soons (vendors not connected — PRICING-AUDIT); Mozio/Airalo/Cover Genius "(coming soon)" in the trip planner are TRUE (unbuilt, `TripPlannerAI.tsx:1051-1093`).

## One-paragraph summary

A logged-out visitor gets a genuinely free, working Travel tab, an honest empty Runway calendar, fetch-free demos for Projects/Routines/Content, and "coming soon" stubs for Trade/Books/Tax/Compliance whose Launch buttons only open a sign-up modal — while all four "coming soon" modules are in fact live behind an **admin** wall, and `/trading` loads fully for any registered account. The tier system the backend enforces (~15 `requireTier` routes) reaches the UI in exactly three hand-rolled places (bank-sync, shopping AI, trip AI); the reusable `UpgradePrompt` component is dead code; the app shell and homepage never read `tier` at all, so a future paying subscriber would still see the same stubs as a free user. The paywall work ahead of any public launch is less about adding gates than about making the UI tell the truth: replace admin-wall "coming soon" labels with plan-aware states, turn the Runway panel's 403 into an upgrade prompt instead of a fake outage, wire (or delete) `UpgradePrompt`, and either enforce or stop advertising the account limits.
