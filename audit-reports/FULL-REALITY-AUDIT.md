# FULL-REALITY-AUDIT — current-state truth of the repo

**Branch:** `claude/audit-full-reality` · **Base:** main @ `99330c0c` · **Date:** 2026-06-15
**Scope:** READ ONLY. No code changes. This is the fact base for the README rewrite + next steps.

> Snapshot note: main `99330c0c` includes the recent home rebuild (Calendar series, Travel
> glow-up/TG1, Hero/Intro copy, cost-build pricing, budget-login + readme-reality audits).
> **`PR-License-Fix` is NOT yet merged** — so on main the LICENSE/README still wrongly say
> AGPL and use the dead `licensing@` email. Everything below reflects main as-is.

---

## 0. The big picture (two layers + a legacy tail)

The repo is **one Next.js app with three strata**:

1. **The public home app** (`/` → `ModuleLauncher`) — the NEW front door: a 7-tab, mobile-
   native launcher (Calendar·Travel·Trade·Operations·Books·Tax·Compliance). Some tabs are
   live to guests, some are stubs/showrooms.
2. **The deep authenticated app** (dozens of routes: `/ledger`, `/trading`, `/operations/*`,
   `/compliance/*`, `/dashboard/tax*`, `/budgets/trips/*`, `/hub`) — substantially built,
   gated behind login. This is where the "Production Ready" feature lists actually live.
3. **A legacy tail** — older surfaces being converged into the home app (`/hub`, the old
   4-tier `/pricing`, scattered standalone pages) that still exist and still work.

The README describes **only layer 2**, as if it were the whole product, all "Production
Ready," under the wrong license. The audit's job is to map all three honestly.

---

## 1. Routes & pages (every `app/` page, what it is, status)

`find src/app -name page.tsx` → **57 page routes.** Grouped:

### Public / front door
| Route | What it is | Status |
|---|---|---|
| `/` (`src/app/page.tsx`) | Landing hero + `ModuleLauncher` 7-tab app | **LIVE** |
| `/how-pricing-works` | Cost-build pricing page (per-module ledgers, infra, Method A/B, static placeholders) | **LIVE (new)** |
| `/pricing` | Old 4-tier SaaS page (Free/Pro $20/Pro+ $40/Trader Pro $60) | **LEGACY** — kept; reached from "View Plans" CTAs, not the header |
| `/login` | Login page | LIVE |
| `/privacy`, `/terms`, `/health` | Static info / health | LIVE |

### Bookkeeping ("Books") — deep authed
`/ledger`, `/journal-entries`, `/chart-of-accounts`, `/transactions`, `/statements`,
`/income`, `/accounts`, `/net-worth`, `/business`, `/personal`, `/trial-balance` (api). **Built**
(real double-entry engine + Plaid). Not surfaced on the public home (stub there).

### Trading ("Trade") — deep authed
`/trading`, `/dashboard`, `/data-explorer`, `/data-observatory`. **Built** (scanner, convergence,
TastyTrade). Home surfaces only the admin scan form.

### Tax — deep authed
`/dashboard/tax`, `/dashboard/tax-filing`. **Built** (1040/Sch C/SE/D, 8949, wash sales). Home = stub.

### Trips / Budgeting ("Travel" money-arc) — deep authed
`/budgets/trips`, `/budgets/trips/new`, `/budgets/trips/[id]`,
`/budgets/trips/[id]/discover/[category]/[rank]`, `/trips/[id]`, `/trips/rsvp`, `/booking/confirm`,
plus budget modules `/shopping`, `/auto`, `/growth`, `/agenda`, `/agenda/[id]`, `/agenda/new`.
**Built.** This is the full trip detail / discover / budget flow.

### Operations — deep authed
`/operations`, `/operations/projects`, `/operations/routines`, `/operations/issues`,
`/operations/content`, `/operations/audit-log`. **Built** (projects, routines, daily-plan,
north-star, content studio). Home = a static **showroom** only.

### Compliance — deep authed
`/compliance`, `/compliance/missions`, `/compliance/missions/[id]`, `/compliance/discovery`,
`/compliance/discovery/[id]`, `/compliance/citations`, `/compliance/registry`,
`/compliance/profile`, `/compliance/audit-log`, `/soc2`. **Built** as routes. Home = stub.

### Hub (legacy command center)
`/hub`, `/hub/itinerary`. **LEGACY/LIVE** — the original cockpit. Its calendar logic was
extracted into `HubCalendar` and reused by the home Calendar tab; `/hub` itself still exists
but the home app is the intended front door now.

### Other / internal
`/admin`, `/developer`, `/leads`, `/data-explorer`, `/data-observatory`, `/home` (duplicate/legacy
of `/`?), `/dashboard`. Mostly admin/internal — verify before publicizing.

### The home tabs on the PUBLIC surface (`ModuleLauncher.tsx`)
`TABS` = Calendar·Travel·Trade·Operations·Books·Tax·Compliance (`ModuleLauncher.tsx:51-59`).

| Tab | Public state | Evidence |
|---|---|---|
| **Calendar** | **LIVE** — real `HubCalendar` when authed; static demo for guests | `:371` / `:386` (auth-split blocks); `HubCalendar.tsx` |
| **Travel** | **MOSTLY LIVE** — own flush block (`:403`), `renderBody` money-arc + live search stack | `:403-440`, `renderBody('travel')` |
| **Trade** | **PARTIAL** — admin sees real `ScanFilterForm` (→ `/trading`); others a paid stub | `:296-312` (`isAdmin` branch + default stub) |
| **Operations** | **SHOWROOM** — static `OperationsPipelineShowroom`, no live fetch on home | `:294` |
| **Books** | **STUB** ("coming soon" paid) on home; real as authed routes | `:313` default stub |
| **Tax** | **STUB** on home; real as authed routes | `:313` default stub |
| **Compliance** | **STUB** on home; real as authed routes | `:313` default stub |

---

## 2. Each module — real state (built / stub / retired / half-wired)

### Calendar — **BUILT (live)**
- Real component `src/components/hub/HubCalendar.tsx` + shared `CalendarGrid` (9 consumers).
- Authed → fetches the viewer's calendar (`/api/calendar`, `/api/operations/daily-plan/items`,
  `/api/hub/operations-routines`); guest → static `demoCalendar`, zero personal fetches.
- Recently rebuilt Apple/Outlook-style: flush, edge-to-edge, phone day-only + week strip,
  now-line pill (`CalendarGrid.tsx`; PR-Calendar-Apple/Native/Seamless/Flush/Width, all merged).
- Intro added (PR-Intro-Copy) since the band/caption were removed.

### Travel — **BUILT (mostly live) + half-wired commit**
- **Live & working:** create-a-trip (`CreateTripForm`), trips list (`AllTripsList`),
  budget-vs-actual rows with photos + uncommit/delete (`TripBudgetActual`), live flight search
  (`PublicFlightSearch` → `/api/flights/search`), live hotel search (`PublicHotelSearch` →
  `/api/travel/hotels/search`), live activity search (`PublicActivitySearch` → `/api/travel/
  activities/search`), live visa check (`PublicVisaCheck` → `/api/travel/visa/check`).
- **Deep authed arc:** `/budgets/trips/[id]` + `/api/trips/[id]/{budget,budget-line,itinerary,
  reservations,vendor-commit,lodging,activities,vehicles,transfers,commit}` — the full
  budget→commit→itinerary money-arc exists server-side.
- **HALF-WIRED (the login-bug area):** on the **public home**, flight "Commit to Budget" is a
  stub — `PublicFlightSearch.tsx:149` `book = () => onRequireAuth()` always opens sign-up, even
  when logged in; no `currentTrip` is passed to the widget. So budgeting a flight *from home*
  isn't wired to `vendor-commit`. (See `audit-reports/BUDGET-LOGIN-BUG-AUDIT.md`.) Hotels/
  activities commit-from-home are likewise not wired.
- **Coming-soon (static) on home:** Getting around / insurance / eSIM / events
  (`ComingSoonSection`, `:421-440`).

### Trade — **BUILT (deep) / PARTIAL (public)**
- Deep app real: `/trading`, convergence pipeline, TastyTrade scanner/chains/greeks/quotes/
  positions/backtest (`/api/tastytrade/*`), AI market brief + strategy analysis
  (`/api/ai/market-brief`, `/api/ai/strategy-analysis`, `/api/ai/convergence-synthesis`),
  Finnhub context, FRED/EDGAR feeds, trade cards/links/journal, stock-lots, wash-sales.
- Public home: admin-only `ScanFilterForm` (routes to `/trading`); non-admin = paid stub.

### Operations — **BUILT (deep) / SHOWROOM (public)**
- Deep app real: projects (design/tasks/dependencies/evolution), routines
  (steps/completions/upcoming/today), daily-plan, north-star, content studio
  (scenes/takes/grid/scripts), AI plan/brain-dump (`/api/operations/*`, `/api/ops/*`).
- Public home: static `OperationsPipelineShowroom` (no fetch by design — enforced by the
  build guardrail `scripts/assert-showroom-fetch-free.mjs`, run in `package.json` build).

### Books (Bookkeeping) — **BUILT (deep) / STUB (public)**
- Deep app real: Plaid sync (`/api/plaid/*`), transactions + auto-categorize + commit-to-ledger,
  journal entries, chart-of-accounts + balances, statements + analysis, closing-periods,
  bank-reconciliations, trial-balance, year-end-close, merchant-mappings.
- Public home: paid "coming soon" stub.

### Tax — **BUILT (deep) / STUB (public)**
- Deep app real: `/api/tax/{calculate,report,export,generate-pdf,overrides,wash-sales,documents}`,
  `tax-estimate`, `cpa-export`, `account-tax-mappings`, pages `/dashboard/tax*`. PDFKit installed.
- Public home: paid stub.

### Compliance — **BUILT (deep) / STUB (public)**
- Deep app real: missions, citations (+verify), discovery (runs/profile/proposals),
  compliance-tasks, regulatory-sources, audit-log (+chain verify), `/soc2`
  (`/api/{missions,citations,discovery,compliance-tasks,regulatory-sources,audit-log}`).
- Public home: paid stub. (Note: the README never even names Compliance as a module.)

### Retired / converging
- **`/hub`** → its calendar was extracted to `HubCalendar` for the home Calendar tab; `/hub`
  remains but the home app is the new front door (converging, not deleted).
- **Old `/pricing` tiers** → superseded as the headline pricing by `/how-pricing-works`; still
  present, still linked from in-app "View Plans" CTAs (`UpgradePrompt.tsx:25`,
  `dashboard/page.tsx`, `shopping/page.tsx`).

---

## 3. API / data integrations (what's really wired)

Authoritative status source: `src/lib/travelSourceRegistry.ts` (travel) + lib clients + api routes.

| Integration | Status | Evidence |
|---|---|---|
| **Duffel** (flights) | **LIVE** | `src/lib/duffel.ts`; `/api/flights/search` + `/api/flights/book`; registry `:25` "LIVE for flights" |
| **Viator** (activities) | **LIVE** | `src/lib/viatorClient.ts`; `/api/travel/activities/search`; registry `:20` "LIVE"; `isImplemented` true (`:122`) |
| **LiteAPI** (hotels) | **LIVE (search) / maturing (book)** | `src/lib/liteapiClient.ts`; `/api/travel/hotels/{search,content,reviews}` + `/api/travel/liteapi/{prebook,book}`; `isImplemented` true (`:122`); registry comment hedges "NOT connected" for booking (`:21`) |
| **Google Places** (discovery/dining) | **LIVE** | `/api/places/*`, `/destinations`, `/resorts`; registry default for many categories |
| **Plaid** (banking) | **LIVE** | `src/lib/plaid.ts`; `/api/plaid/{link-token,exchange-token,items,sync}`; `react-plaid-link` |
| **TastyTrade** (options) | **LIVE** | `src/lib/tastytrade.ts`; `/api/tastytrade/*` (connect/quotes/chains/greeks/positions/scanner/backtest); `@tastytrade/api` dep |
| **Finnhub** (news/ratings) | **LIVE** | `/api/finnhub/ticker-context` |
| **FRED** (macro) | **LIVE** | `api.stlouisfed.org` refs in convergence/trading libs (3 files) |
| **SEC EDGAR** (filings) | **LIVE** | `sec.gov` refs in discovery/convergence (3 files); `fast-xml-parser`/`cheerio` |
| **Anthropic Claude** | **LIVE** | `@anthropic-ai/sdk`; `src/lib/ai/client.ts`; `/api/ai/*`, `/api/ops/*`, discovery, news-classifier (12 files) |
| **xAI Grok** | **LIVE** | `src/lib/grok.ts` + `grokAgent.ts`; `xai-sdk` dep; `/api/convergence/sentiment` |
| **OpenAI** | **PRESENT** | `openai` dep; used in some AI paths |
| **Stripe** | **PARTIAL** | `src/lib/stripe.ts`; `/api/stripe/{checkout,portal,webhook}` real (`checkout.sessions.create`), BUT public pricing CTAs say "Coming Soon" — payments not surfaced/activated yet |
| **Mozio** (ground transit) | **PARKED** | registry `:22,:86` "declared, NOT connected"; no client file, no search route; home "Getting around" = `ComingSoonSection` (`ModuleLauncher.tsx:425`) |
| **CoverGenius** (insurance), **Airalo** (eSIM) | **PARKED** | registry `:87-88` declared not connected; home shows them as coming-soon |

**README integration diagram (`README.md:126-127`) is stale:** lists Plaid/Duffel/Google
Places/Grok/OpenAI/Tastytrade/Stripe/Claude/Finnhub — **omits LiteAPI, Viator, FRED, EDGAR**,
and lists Stripe as if fully live.

---

## 4. The real stack (verified)

- **Next.js `15.5.9`** (App Router), **React `18.3.1`**, **TypeScript `^5`** (README badge says
  "TypeScript 5.3"), **TailwindCSS `^3.4.18`** (token theme, no hex in components —
  `tailwind.config.ts`).
- **Prisma `^5.22.0`** (`@prisma/client` + `prisma`), **PostgreSQL** (Azure-hosted per project
  docs; README badge "PostgreSQL 16").
- **Auth:** cookie-based `src/lib/cookie-auth.ts` (`getVerifiedEmail()`) **+** `next-auth
  ^4.24.13` (`@auth/prisma-adapter`, `/api/auth/[...nextauth]`) — dual; API routes gate on
  cookie-auth.
- **Build:** `prisma generate && prisma migrate deploy && next build`, preceded by the showroom
  fetch-free guardrail (`package.json:9`).
- **Key libs:** `recharts` (charts), `leaflet`/`react-leaflet` (maps), `pdfkit`/`pdf-parse`
  (tax/statements), `inngest` (jobs), `rrule` (routines), `cheerio`/`fast-xml-parser` (EDGAR),
  `bcryptjs`/`jsonwebtoken` (auth), `@tanstack/react-virtual`, `p-limit`.
- **License:** **Business Source License 1.1** (`LICENSE`), Licensor Temple Stuart LLC, Change
  Date **2028-01-01 → Apache 2.0**. **README still says AGPL v3** (`:10`, `:942`) — wrong;
  `PR-License-Fix` (unmerged) corrects it. Dead `licensing@` email also still on main pending
  that PR.

---

## 5. What's NEW since the last README/audit (recent evolution — all REAL/built)

Confirmed in code + git log on main:
- **The mobile "edge machine":** fixed phone bottom tab bar (7 tabs, scrollable) + desktop top
  tab row + one-panel-at-a-time gating (`ModuleLauncher.tsx` TABS/`activeModule`; PR-Mobile1/2,
  PR-Edge-A/B — merged #899-900 region).
- **Apple/Outlook calendar:** edge-to-edge day view, flush header, phone day-only + week strip,
  now-line pill (`CalendarGrid.tsx`, `HubCalendar.tsx`; PR-Calendar-Apple/Native/Seamless/
  Flush/Width — merged through `28d1b51a`).
- **Travel glow-up:** Travel pulled into its own flush, edge-to-edge block, band/card chrome
  removed (`ModuleLauncher.tsx:403`; PR-TG1 #907).
- **Cost-build pricing page:** `/how-pricing-works` (`src/app/how-pricing-works/page.tsx`) —
  per-module direct-feed ledgers, infrastructure card, Method A allocate / Method B base fee
  (both render), all static placeholders; header "Pricing" link activated to it (PR-Pricing-Page
  #911). Old `/pricing` tiers kept.
- **Travel money-arc:** trips + budget-vs-actual + photos + uncommit/delete + vendor-commit
  (`TripBudgetActual`, `AllTripsList`, `/api/trips/[id]/*`; Trips PR series — merged).
- **Hero/intro copy refresh:** new hero subhead, NYT line removed, Travel intro rewrite +
  Calendar intro (PR-Hero-Copy #908, PR-Intro-Copy #909).

None of these are in the README yet.

---

## 6. What's genuinely COMING (planned, not built)

Grounded in stubs/markers/registry:
- **Home commit-wiring (search → commit → trip → calendar)** — `PublicFlightSearch.tsx:149`
  stub; budgeting flights/hotels/activities *from the public home* into a selected trip isn't
  wired. **PLANNED** (the deep `/budgets/trips/[id]` arc does it; the home surface doesn't).
- **`hub_scheduled_items` going live** — table exists but is essentially orphan (only a
  reference in `EventDetailPanel.tsx`; not written/read by a live flow). **PLANNED.**
- **Surfacing Books / Tax / Compliance on the public home** — live as authed routes, stubs on
  home (`ModuleLauncher.tsx:313`). **PLANNED.**
- **Pricing → real numbers** — `/how-pricing-works` cells are static `$—`/`TBD`; wiring to
  Books cost data + choosing Method A vs B. **PLANNED** (the page's own footnote says so).
- **Stripe checkout activation** — routes exist (`/api/stripe/checkout|portal|webhook`) but
  public CTAs say "Coming Soon"; payments not turned on. **PLANNED/PARTIAL.**
- **Login → home demo/real flip + redirect** — login still defaults to `/hub`
  (`LoginBox.tsx` default + `page.tsx` `loginRedirect`); should land on `/`. **PLANNED**
  (see `audit-reports/BUDGET-LOGIN-BUG-AUDIT.md`).
- **Mozio (ground), CoverGenius (insurance), Airalo (eSIM)** — declared in the source registry,
  not connected; home shows them coming-soon. **PARKED → PLANNED.**
- **From README roadmap, still open:** onboarding flow, results tracking, multi-broker
  (Schwab/IBKR), invoice generation, iOS/Android app, CPA client portal, team/multi-user,
  multi-currency, payroll, white-label.

---

## REPORT — current-state map + reality deltas

### BUILT (live)
Home Calendar; Travel search (flights/hotels/activities/visa) + trips/budget/actual money-arc;
the full deep authed app (Books, Trading, Tax, Operations, Compliance routes); `/how-pricing-
works`; integrations Duffel, Viator, LiteAPI (search), Google Places, Plaid, TastyTrade,
Finnhub, FRED, EDGAR, Anthropic, Grok; the mobile edge machine + Apple-style calendar.

### PARTIAL / half-wired
Trade tab (admin-only public); Stripe (routes real, checkout not surfaced); LiteAPI booking
(client there, registry hedges); home flight/hotel/activity **commit-to-trip** (stub);
login redirect/demo-flip.

### STUB / showroom (public surface only — real underneath)
Books, Tax, Compliance tabs (paid stubs on home); Operations tab (static showroom).

### RETIRED / converging
`/hub` (calendar extracted into home); old `/pricing` 4-tier page (superseded as headline by
`/how-pricing-works`, still linked from "View Plans").

### PARKED / PLANNED
Mozio, CoverGenius, Airalo; `hub_scheduled_items`; home commit-wiring; pricing real numbers;
checkout activation; surfacing Books/Tax/Compliance publicly.

### Where reality differs from the README / old audits
1. **License:** README says **AGPL v3 + copyleft**; reality is **BSL 1.1 → Apache 2028**
   (`LICENSE`). Dead `licensing@` email. (`PR-License-Fix` pending.)
2. **"Production Ready" everywhere:** true for deep routes, but the **public home gates/stubs**
   Books/Tax/Compliance and **showrooms** Operations — the README implies all are fully usable.
3. **Module taxonomy:** README lists Bookkeeping/Trading/Trips/Budgeting/Tax/**Hub**; reality is
   **7 tabs incl. Calendar/Operations/Compliance**; **Hub is legacy**; **Compliance** is unnamed
   in the README.
4. **Integrations:** README omits **LiteAPI, Viator, FRED, EDGAR**, and overstates **Stripe**.
5. **Whole new surface unmentioned:** the public **tabbed home app**, the **mobile edge
   machine**, the **Apple-style calendar**, and the **cost-build pricing page** — all real, none
   in the README.
6. **`version: 1.0.0`** (README `:71`) — aspirational; the product is in active, fast evolution.
7. **Roadmap staleness:** "Mobile-Responsive UI" marked not-done but the home is mobile-native;
   "Tiers ✅" overstates (checkout still off; a second cost-build model now exists).

**This is the fact base. No code modified.**
